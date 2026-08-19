const isLocalDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_BASE = window.__QILI_ENGINE_API__ || (isLocalDev ? "http://127.0.0.1:8787" : window.location.origin);

const FEN_PIECES = {
  red: { rook: "R", horse: "N", elephant: "B", advisor: "A", general: "K", cannon: "C", pawn: "P" },
  black: { rook: "r", horse: "n", elephant: "b", advisor: "a", general: "k", cannon: "c", pawn: "p" },
};

function boardToFen(board, sideToMove) {
  const ranks = board.map((row) => {
    let empty = 0;
    let output = "";
    for (const piece of row) {
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty) {
        output += String(empty);
        empty = 0;
      }
      output += FEN_PIECES[piece.color][piece.type];
    }
    if (empty) output += String(empty);
    return output;
  });
  return `${ranks.join("/")} ${sideToMove === "red" ? "w" : "b"} - - 0 1`;
}

function squareToUci(row, col) {
  return `${String.fromCharCode(97 + col)}${9 - row}`;
}

function moveToUci(move) {
  return `${squareToUci(move.fromRow, move.fromCol)}${squareToUci(move.toRow, move.toCol)}`;
}

function uciToMove(uci, board) {
  if (typeof uci !== "string" || !/^[a-i][0-9][a-i][0-9]$/.test(uci)) return null;
  const fromCol = uci.charCodeAt(0) - 97;
  const fromRow = 9 - Number(uci[1]);
  const toCol = uci.charCodeAt(2) - 97;
  const toRow = 9 - Number(uci[3]);
  const piece = board[fromRow]?.[fromCol];
  if (!piece) return null;
  return { fromRow, fromCol, toRow, toCol, piece };
}

function numericScore(line) {
  if (!line?.score) return 0;
  if (line.score.type === "mate") return Math.sign(line.score.value || 1) * 100000;
  return Number(line.score.value || 0);
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.instruction || `Engine request failed (${response.status})`);
  }
  return payload;
}

async function health() {
  return fetchJson("/api/engine/health");
}

async function analyze(board, sideToMove, { depth = 10, multiPv = 3, maxTimeMs = null } = {}) {
  const fen = boardToFen(board, sideToMove);
  const result = await fetchJson("/api/engine/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fen, depth, multiPv, maxTimeMs }),
  });
  return {
    ...result,
    fen,
    lines: (result.lines || []).map((line) => ({
      ...line,
      numericScore: numericScore(line),
      parsedMove: uciToMove(line.move, board),
    })),
  };
}

async function analyzeGame(game, { depth = 7, maxPlayerMoves = 36 } = {}) {
  if (!game || !Array.isArray(game.moves) || !game.moves.length) throw new Error("这盘棋没有可复盘的着法");
  let token = null;
  try {
    token = await window.QiliIdentity?.getAuthToken?.();
  } catch {
    token = null;
  }
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return fetchJson("/api/engine/analyze-game", {
    method: "POST",
    headers,
    body: JSON.stringify({
      moves: game.moves,
      playerColor: game.color,
      depth,
      maxPlayerMoves,
    }),
  });
}

async function explainCoach(coachCase) {
  return fetchJson("/api/coach/explain", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(coachCase),
  });
}

window.XiangqiEngineClient = {
  health,
  analyze,
  analyzeGame,
  explainCoach,
  boardToFen,
  moveToUci,
  uciToMove,
  numericScore,
};
