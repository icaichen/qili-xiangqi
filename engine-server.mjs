import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { coachHealth, explainCoach } from "./coach-service.mjs";
import { recognizeBoardFromImage, recognitionHealth } from "./analysis-service.mjs";
import { handleOnlineRequest, serviceInfo as onlineServiceInfo } from "./online-game-service.mjs";
import { handleIdentityRequest } from "./identity-service.mjs";
import { RED, BLACK, OPPOSITE, createInitialBoard, applyMove, validateMove, gameStatus } from "./xiangqi-server-rules.mjs";

const PORT = Number(process.env.ENGINE_PORT || 8787);
const ENGINE_PATH = process.env.XIANGQI_ENGINE_PATH || "";
const NETWORK_PATH = process.env.XIANGQI_NETWORK_PATH || "";
const ENGINE_KIND = process.env.XIANGQI_ENGINE_KIND || "pikafish";
const DEFAULT_DEPTH = clamp(Number(process.env.ENGINE_DEPTH || 12), 4, 30);
const DEFAULT_MULTIPV = clamp(Number(process.env.ENGINE_MULTIPV || 3), 1, 8);
const REQUEST_TIMEOUT_MS = clamp(Number(process.env.ENGINE_TIMEOUT_MS || 12000), 2000, 60000);

const FEN_PIECES = {
  red: { rook: "R", horse: "N", elephant: "B", advisor: "A", general: "K", cannon: "C", pawn: "P" },
  black: { rook: "r", horse: "n", elephant: "b", advisor: "a", general: "k", cannon: "c", pawn: "p" },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function json(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-qili-guest-token",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    total += chunk.length;
    if (total > 150_000) throw Object.assign(new Error("Request body is too large"), { statusCode: 413 });
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validateFen(fen) {
  if (typeof fen !== "string" || fen.length < 20 || fen.length > 180) return false;
  const [placement, side] = fen.trim().split(/\s+/);
  if (!placement || !["w", "b"].includes(side)) return false;
  const ranks = placement.split("/");
  if (ranks.length !== 10) return false;

  return ranks.every((rank) => {
    let files = 0;
    for (const char of rank) {
      if (/\d/.test(char)) files += Number(char);
      else if (/[rnbakcpRNBAKCP]/.test(char)) files += 1;
      else return false;
    }
    return files === 9;
  });
}

function boardToFen(board, sideToMove) {
  const ranks = board.map((row) => {
    let empty = 0;
    let output = "";
    for (const entry of row) {
      if (!entry) {
        empty += 1;
        continue;
      }
      if (empty) {
        output += String(empty);
        empty = 0;
      }
      output += FEN_PIECES[entry.color][entry.type];
    }
    if (empty) output += String(empty);
    return output;
  });
  return `${ranks.join("/")} ${sideToMove === RED ? "w" : "b"} - - 0 1`;
}

function squareToUci(row, col) {
  return `${String.fromCharCode(97 + col)}${9 - row}`;
}

function moveToUci(move) {
  return `${squareToUci(move.fromRow, move.fromCol)}${squareToUci(move.toRow, move.toCol)}`;
}

function scoreValue(line) {
  if (!line?.score) return 0;
  if (line.score.type === "mate") return Math.sign(Number(line.score.value) || 1) * 100000;
  return Number(line.score.value || 0);
}

function parseInfoLine(line) {
  if (!line.startsWith("info ") || !line.includes(" pv ")) return null;
  const depthMatch = line.match(/\bdepth\s+(\d+)/);
  const multipvMatch = line.match(/\bmultipv\s+(\d+)/);
  const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
  const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
  const nodesMatch = line.match(/\bnodes\s+(\d+)/);
  const timeMatch = line.match(/\btime\s+(\d+)/);
  const pvIndex = line.indexOf(" pv ");
  const pv = pvIndex >= 0 ? line.slice(pvIndex + 4).trim().split(/\s+/).filter(Boolean) : [];

  if (!pv.length) return null;

  return {
    depth: depthMatch ? Number(depthMatch[1]) : 0,
    multipv: multipvMatch ? Number(multipvMatch[1]) : 1,
    score: mateMatch
      ? { type: "mate", value: Number(mateMatch[1]) }
      : { type: "cp", value: cpMatch ? Number(cpMatch[1]) : 0 },
    nodes: nodesMatch ? Number(nodesMatch[1]) : 0,
    timeMs: timeMatch ? Number(timeMatch[1]) : 0,
    move: pv[0],
    pv,
  };
}

class UciEngine {
  constructor(enginePath, kind, networkPath) {
    this.enginePath = enginePath;
    this.kind = kind;
    this.networkPath = networkPath;
    this.process = null;
    this.ready = false;
    this.buffer = "";
    this.waiters = [];
    this.queue = Promise.resolve();
  }

  async start() {
    if (this.ready) return;
    if (!this.enginePath) throw new Error("XIANGQI_ENGINE_PATH is not configured");

    this.process = spawn(this.enginePath, [], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    this.process.stdout.setEncoding("utf8");
    this.process.stderr.setEncoding("utf8");
    this.process.stdout.on("data", (chunk) => this.consume(chunk));
    this.process.stderr.on("data", (chunk) => {
      const message = chunk.trim();
      if (message) console.error(`[engine] ${message}`);
    });
    this.process.on("exit", (code, signal) => {
      this.ready = false;
      this.rejectAll(new Error(`Engine exited (code=${code}, signal=${signal})`));
    });
    this.process.on("error", (error) => this.rejectAll(error));

    this.send("uci");
    await this.waitFor((line) => line === "uciok", 8000);

    if (this.kind === "fairy-stockfish") {
      this.send("setoption name UCI_Variant value xiangqi");
    }
    if (this.kind === "pikafish" && this.networkPath) {
      this.send(`setoption name EvalFile value ${this.networkPath}`);
    }

    this.send("setoption name Threads value 1");
    this.send("setoption name Hash value 64");
    this.send("isready");
    await this.waitFor((line) => line === "readyok", 8000);
    this.ready = true;
  }

  consume(chunk) {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      for (const waiter of [...this.waiters]) waiter.handle(line);
    }
  }

  send(command) {
    if (!this.process?.stdin.writable) throw new Error("Engine process is not writable");
    this.process.stdin.write(`${command}\n`);
  }

  waitFor(predicate, timeoutMs) {
    return new Promise((resolve, reject) => {
      const waiter = {
        handle: (line) => {
          try {
            if (!predicate(line)) return;
            clearTimeout(timer);
            this.waiters = this.waiters.filter((item) => item !== waiter);
            resolve(line);
          } catch (error) {
            clearTimeout(timer);
            this.waiters = this.waiters.filter((item) => item !== waiter);
            reject(error);
          }
        },
        reject,
      };

      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((item) => item !== waiter);
        reject(new Error("Engine response timed out"));
      }, timeoutMs);

      this.waiters.push(waiter);
    });
  }

  rejectAll(error) {
    const waiters = [...this.waiters];
    this.waiters = [];
    waiters.forEach((waiter) => waiter.reject(error));
  }

  analyze(request) {
    const task = async () => {
      await this.start();
      const depth = clamp(Number(request.depth || DEFAULT_DEPTH), 4, 30);
      const multipv = clamp(Number(request.multiPv || DEFAULT_MULTIPV), 1, 8);
      const linesByRank = new Map();

      this.send(`setoption name MultiPV value ${multipv}`);
      this.send(`position fen ${request.fen}`);

      const completed = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.send("stop");
          cleanup();
          reject(new Error("Analysis timed out"));
        }, REQUEST_TIMEOUT_MS);

        const waiter = {
          handle: (line) => {
            const parsed = parseInfoLine(line);
            if (parsed) {
              const previous = linesByRank.get(parsed.multipv);
              if (!previous || parsed.depth >= previous.depth) linesByRank.set(parsed.multipv, parsed);
            }

            if (line.startsWith("bestmove ")) {
              cleanup();
              const bestMove = line.split(/\s+/)[1] || null;
              resolve({
                bestMove,
                depth,
                multiPv: multipv,
                lines: [...linesByRank.values()].sort((a, b) => a.multipv - b.multipv),
              });
            }
          },
          reject,
        };

        const cleanup = () => {
          clearTimeout(timer);
          this.waiters = this.waiters.filter((item) => item !== waiter);
        };

        this.waiters.push(waiter);
        this.send(`go depth ${depth}`);
      });

      return completed;
    };

    const queued = this.queue.then(task, task);
    this.queue = queued.catch(() => undefined);
    return queued;
  }

  close() {
    if (!this.process) return;
    try {
      this.send("quit");
    } catch {
      this.process.kill();
    }
  }
}

const engine = new UciEngine(ENGINE_PATH, ENGINE_KIND, NETWORK_PATH);

async function analyzeGame(body) {
  const moves = Array.isArray(body?.moves) ? body.moves.slice(0, 120) : [];
  const playerColor = body?.playerColor === BLACK ? BLACK : RED;
  const depth = clamp(Number(body?.depth || 7), 4, 10);
  const maxPlayerMoves = clamp(Number(body?.maxPlayerMoves || 36), 4, 50);

  if (!moves.length) throw Object.assign(new Error("Game has no moves to analyze"), { statusCode: 400 });

  let board = createInitialBoard();
  let turn = RED;
  const assessments = [];

  for (let index = 0; index < moves.length; index += 1) {
    const raw = moves[index] || {};
    const candidate = raw.move || raw;
    const checked = validateMove(board, turn, candidate);
    if (!checked.ok) {
      throw Object.assign(new Error(`Stored game contains an illegal move at ply ${index + 1}: ${checked.reason}`), { statusCode: 400 });
    }

    const sourceBoard = board;
    let before = null;
    if (turn === playerColor && assessments.length < maxPlayerMoves) {
      before = await engine.analyze({ fen: boardToFen(sourceBoard, turn), depth, multiPv: 3 });
    }

    const moved = applyMove(sourceBoard, checked.move);
    board = moved.board;

    if (before) {
      const stateAfter = gameStatus(board, OPPOSITE[turn]);
      let after = null;
      let actualScore = 0;
      if (stateAfter.over) {
        actualScore = stateAfter.winner === turn ? 100000 : stateAfter.winner ? -100000 : 0;
      } else {
        after = await engine.analyze({ fen: boardToFen(board, OPPOSITE[turn]), depth, multiPv: 1 });
        actualScore = -scoreValue(after.lines?.[0]);
      }

      const bestScore = scoreValue(before.lines?.[0]);
      const loss = Math.max(0, bestScore - actualScore);
      assessments.push({
        ply: index + 1,
        color: turn,
        actualMove: moveToUci(checked.move),
        bestMove: before.lines?.[0]?.move || before.bestMove || null,
        loss,
        bestScore,
        actualScore,
        bestPv: before.lines?.[0]?.pv || [],
        replyPv: after?.lines?.[0]?.pv || [],
      });
    }

    turn = OPPOSITE[turn];
  }

  const ranked = [...assessments].sort((a, b) => b.loss - a.loss || a.ply - b.ply);
  const meaningful = ranked.filter((entry) => entry.loss >= 35);
  const turningPoints = (meaningful.length ? meaningful : ranked).slice(0, 5);

  return {
    playerColor,
    depth,
    scannedPlayerMoves: assessments.length,
    totalPlies: moves.length,
    assessments,
    turningPoints,
  };
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
    });
    response.end();
    return;
  }

  if (request.url?.startsWith("/api/identity/") || request.url?.startsWith("/api/auth/")) {
    if (await handleIdentityRequest(request, response)) return;
  }

  if (request.url?.startsWith("/api/online/")) {
    if (await handleOnlineRequest(request, response)) return;
  }

  if (request.method === "GET" && request.url === "/api/engine/health") {
    json(response, 200, {
      ok: Boolean(ENGINE_PATH),
      configured: Boolean(ENGINE_PATH),
      networkConfigured: Boolean(NETWORK_PATH),
      ready: engine.ready,
      kind: ENGINE_KIND,
      port: PORT,
      coach: coachHealth(),
      analysis: recognitionHealth(),
      online: onlineServiceInfo(),
      apiVersion: 4,
      capabilities: ["analyze-position", "analyze-game", "coach-explain", "recognize-board"],
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/coach/recognize-board") {
    try {
      const body = await readJson(request);
      const recognition = await recognizeBoardFromImage(body);
      json(response, 200, recognition);
    } catch (error) {
      console.error("[recognize-board]", error);
      json(response, Number(error?.statusCode || 500), { error: error instanceof Error ? error.message : "截图识别失败" });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/coach/explain") {
    try {
      const body = await readJson(request);
      const explanation = await explainCoach(body);
      json(response, 200, explanation);
    } catch (error) {
      console.error("[coach]", error);
      const status = Number(error?.statusCode || 500);
      json(response, status, { error: error instanceof Error ? error.message : "Unknown coach error" });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/engine/analyze-game") {
    try {
      if (!ENGINE_PATH) {
        json(response, 503, {
          error: "Engine is not configured",
          instruction: "Set XIANGQI_ENGINE_PATH to a compatible UCI xiangqi engine binary.",
        });
        return;
      }
      const body = await readJson(request);
      const result = await analyzeGame(body);
      json(response, 200, result);
    } catch (error) {
      console.error("[analyze-game]", error);
      json(response, Number(error?.statusCode || 500), { error: error instanceof Error ? error.message : "Game analysis failed" });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/engine/analyze") {
    try {
      if (!ENGINE_PATH) {
        json(response, 503, {
          error: "Engine is not configured",
          instruction: "Set XIANGQI_ENGINE_PATH to a compatible UCI xiangqi engine binary.",
        });
        return;
      }

      const body = await readJson(request);
      if (!validateFen(body.fen)) {
        json(response, 400, { error: "Invalid xiangqi FEN" });
        return;
      }

      const analysis = await engine.analyze(body);
      json(response, 200, analysis);
    } catch (error) {
      console.error(error);
      json(response, 500, { error: error instanceof Error ? error.message : "Unknown engine error" });
    }
    return;
  }

  json(response, 404, { error: "Not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Xiangqi engine API listening on http://127.0.0.1:${PORT}`);
  console.log(ENGINE_PATH ? `Engine: ${ENGINE_KIND} at ${ENGINE_PATH}` : "Engine path is not configured yet.");
  if (NETWORK_PATH) console.log(`Network: ${NETWORK_PATH}`);
});

function shutdown() {
  engine.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 1500).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
