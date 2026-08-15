import { readFile, writeFile } from "node:fs/promises";

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Patch target not found: ${label}`);
  return source.replace(search, replacement);
}

async function patchServer() {
  const path = "engine-server.mjs";
  let source = await readFile(path, "utf8");

  source = replaceOnce(
    source,
    'const ENGINE_PATH = process.env.XIANGQI_ENGINE_PATH || "";\nconst ENGINE_KIND = process.env.XIANGQI_ENGINE_KIND || "pikafish";',
    'const ENGINE_PATH = process.env.XIANGQI_ENGINE_PATH || "";\nconst NETWORK_PATH = process.env.XIANGQI_NETWORK_PATH || "";\nconst ENGINE_KIND = process.env.XIANGQI_ENGINE_KIND || "pikafish";',
    "server network constant",
  );

  source = replaceOnce(
    source,
    '  constructor(enginePath, kind) {\n    this.enginePath = enginePath;\n    this.kind = kind;',
    '  constructor(enginePath, kind, networkPath) {\n    this.enginePath = enginePath;\n    this.kind = kind;\n    this.networkPath = networkPath;',
    "server constructor",
  );

  source = replaceOnce(
    source,
    '    if (this.kind === "fairy-stockfish") {\n      this.send("setoption name UCI_Variant value xiangqi");\n    }\n\n    this.send("setoption name Threads value 1");',
    '    if (this.kind === "fairy-stockfish") {\n      this.send("setoption name UCI_Variant value xiangqi");\n    }\n    if (this.kind === "pikafish" && this.networkPath) {\n      this.send(`setoption name EvalFile value ${this.networkPath}`);\n    }\n\n    this.send("setoption name Threads value 1");',
    "server EvalFile option",
  );

  source = replaceOnce(
    source,
    'const engine = new UciEngine(ENGINE_PATH, ENGINE_KIND);',
    'const engine = new UciEngine(ENGINE_PATH, ENGINE_KIND, NETWORK_PATH);',
    "server engine initialization",
  );

  source = replaceOnce(
    source,
    '      configured: Boolean(ENGINE_PATH),\n      ready: engine.ready,\n      kind: ENGINE_KIND,',
    '      configured: Boolean(ENGINE_PATH),\n      networkConfigured: Boolean(NETWORK_PATH),\n      ready: engine.ready,\n      kind: ENGINE_KIND,',
    "server health",
  );

  source = replaceOnce(
    source,
    '  console.log(ENGINE_PATH ? `Engine: ${ENGINE_KIND} at ${ENGINE_PATH}` : "Engine path is not configured yet.");',
    '  console.log(ENGINE_PATH ? `Engine: ${ENGINE_KIND} at ${ENGINE_PATH}` : "Engine path is not configured yet.");\n  if (NETWORK_PATH) console.log(`Network: ${NETWORK_PATH}`);',
    "server startup log",
  );

  await writeFile(path, source, "utf8");
}

async function patchIndex() {
  const path = "index.html";
  let source = await readFile(path, "utf8");

  source = replaceOnce(
    source,
    '<option value="beginner">入门 · 随机应对</option>\n               <option value="intermediate" selected>进阶 · 战术优先</option>\n               <option value="advanced">高手 · 两层搜索</option>',
    '<option value="beginner">入门 · Pikafish 浅层</option>\n               <option value="intermediate" selected>进阶 · Pikafish 标准</option>\n               <option value="advanced">高手 · Pikafish 深度分析</option>',
    "difficulty labels",
  );

  source = replaceOnce(
    source,
    '<span id="engineState">原型启发式已启用</span>',
    '<span id="engineState">正在连接 Pikafish…</span>',
    "engine state label",
  );

  source = replaceOnce(
    source,
    '    <script type="module" src="/app.js"></script>',
    '    <script type="module" src="/engine-client.js"></script>\n    <script type="module" src="/app.js"></script>',
    "engine client script",
  );

  await writeFile(path, source, "utf8");
}

async function patchApp() {
  const path = "app.js";
  let source = await readFile(path, "utf8");

  source = replaceOnce(
    source,
    'const reviewDropzoneElement = document.querySelector("#reviewDropzone");',
    'const reviewDropzoneElement = document.querySelector("#reviewDropzone");\nconst engineStateElement = document.querySelector("#engineState");\nconst engineClient = window.XiangqiEngineClient;',
    "engine DOM references",
  );

  source = replaceOnce(
    source,
    'let gameOver = false;\nlet coachAnalysis = null;',
    'let gameOver = false;\nlet coachAnalysis = null;\nlet engineConnected = false;\nlet engineEvaluationCp = null;\nlet engineError = null;',
    "engine state variables",
  );

  const oldComputer = `function chooseComputerMove() {
  const moves = generateLegalMoves(board, COLORS.BLACK);
  if (!moves.length) return null;

  const level = levelSelectElement.value;
  if (level === "beginner") {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  if (level === "intermediate") {
    const ranked = moves
      .map((move) => ({ move, score: moveHeuristic(board, move, COLORS.BLACK) + Math.random() * 24 }))
      .sort((a, b) => b.score - a.score);
    return ranked[Math.floor(Math.random() * Math.min(3, ranked.length))].move;
  }

  let bestMove = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const result = applyMove(board, move);
    const score = minimax(result.board, 2, -Infinity, Infinity, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}`;

  const newComputer = `function engineSettings() {
  const level = levelSelectElement.value;
  if (level === "beginner") return { depth: 5, multiPv: 5 };
  if (level === "advanced") return { depth: 14, multiPv: 3 };
  return { depth: 9, multiPv: 4 };
}

async function chooseComputerMove() {
  const legalMoves = generateLegalMoves(board, COLORS.BLACK);
  if (!legalMoves.length) return null;

  const settings = engineSettings();
  const analysis = await engineClient.analyze(board, COLORS.BLACK, settings);
  const usable = analysis.lines
    .map((line) => ({ line, move: line.parsedMove }))
    .filter(({ move }) => move && legalMoves.some((legal) => sameMove(legal, move)));

  if (!usable.length) throw new Error("Pikafish 没有返回可执行着法");

  let selected = usable[0];
  if (levelSelectElement.value === "beginner") {
    const weights = [0.38, 0.25, 0.18, 0.12, 0.07].slice(0, usable.length);
    const total = weights.reduce((sum, value) => sum + value, 0);
    let roll = Math.random() * total;
    for (let index = 0; index < weights.length; index += 1) {
      roll -= weights[index];
      if (roll <= 0) {
        selected = usable[index];
        break;
      }
    }
  } else if (levelSelectElement.value === "intermediate" && usable.length > 1 && Math.random() < 0.18) {
    selected = usable[1];
  }

  return { move: selected.move, selectedLine: selected.line, analysis };
}`;
  source = replaceOnce(source, oldComputer, newComputer, "computer engine selection");

  source = replaceOnce(
    source,
    `function sameMove(a, b) {
  return a.fromRow === b.fromRow && a.fromCol === b.fromCol && a.toRow === b.toRow && a.toCol === b.toCol;
}`,
    `function sameMove(a, b) {
  return Boolean(a && b) && a.fromRow === b.fromRow && a.fromCol === b.fromCol && a.toRow === b.toRow && a.toCol === b.toCol;
}

function formatEngineScore(cp) {
  if (!Number.isFinite(cp)) return "—";
  if (Math.abs(cp) >= 90000) return cp > 0 ? "将杀" : "被将杀";
  const pawns = cp / 100;
  return (pawns > 0 ? "+" : "") + pawns.toFixed(2);
}

function pvToNotation(sourceBoard, pv, limit = 4) {
  let working = cloneBoard(sourceBoard);
  const labels = [];
  for (const uci of (pv || []).slice(0, limit)) {
    const move = engineClient.uciToMove(uci, working);
    if (!move) break;
    labels.push(formatMove(move, working));
    working = applyMove(working, move).board;
  }
  return labels.join("，");
}

async function initializeEngine() {
  try {
    engineStateElement.textContent = "正在连接 Pikafish…";
    const health = await engineClient.health();
    if (!health.configured) throw new Error("Pikafish 尚未配置");
    engineConnected = true;
    engineError = null;
    engineStateElement.textContent = health.ready ? "Pikafish 已连接" : "Pikafish 已就绪";
    return true;
  } catch (error) {
    engineConnected = false;
    engineError = error instanceof Error ? error.message : "引擎连接失败";
    engineStateElement.textContent = "连接失败：" + engineError;
    return false;
  }
}`,
    "engine helper functions",
  );

  source = replaceOnce(
    source,
    `function buildCoachAnalysis(sourceBoard, move, candidates) {
  const chosen = candidates.find((candidate) => sameMove(candidate, move)) ?? {
    ...move,
    score: moveHeuristic(sourceBoard, move, COLORS.RED),
  };
  const best = candidates[0] ?? chosen;
  const gap = best.score - chosen.score;
  const quality = gap < 18 ? "good" : gap < 70 ? "inaccuracy" : "mistake";
  const facts = describeMove(sourceBoard, move);
  const bestFacts = describeMove(sourceBoard, best);

  return {
    quality,
    title: quality === "good" ? "这步思路合理" : quality === "inaccuracy" ? "这步有更精确的选择" : "这步忽略了更强的手段",
    summary: facts.join("；") + "。",
    bestMove: formatMove(best, sourceBoard),
    bestReason: bestFacts.join("；") + "。",
    principle: principleForMove(sourceBoard, move),
    candidates: candidates.slice(0, 3).map((candidate) => ({
      notation: formatMove(candidate, sourceBoard),
      score: candidate.score,
      selected: sameMove(candidate, move),
    })),
  };
}`,
    `function buildCoachAnalysis(sourceBoard, move, analysis, chosenScoreOverride = null) {
  const chosenUci = engineClient.moveToUci(move);
  const usableLines = analysis.lines.filter((line) => line.parsedMove);
  const bestLine = usableLines[0];
  const selectedLine = usableLines.find((line) => line.move === chosenUci);
  const bestMove = bestLine?.parsedMove ?? move;
  const bestScore = bestLine?.numericScore ?? 0;
  const chosenScore = selectedLine?.numericScore ?? chosenScoreOverride;
  const gap = chosenScore == null ? 120 : bestScore - chosenScore;
  const quality = gap < 30 ? "good" : gap < 100 ? "inaccuracy" : "mistake";
  const facts = describeMove(sourceBoard, move);
  const bestFacts = describeMove(sourceBoard, bestMove);
  const variation = pvToNotation(sourceBoard, bestLine?.pv, 4);

  return {
    quality,
    title: quality === "good" ? "这步接近引擎首选" : quality === "inaccuracy" ? "这步可以更精确" : "这步错过了明显更强的方案",
    summary: facts.join("；") + "。" + (chosenScore == null ? "这步未进入引擎前五候选。" : "相比最佳着约损失 " + formatEngineScore(Math.max(0, gap)) + "。"),
    bestMove: formatMove(bestMove, sourceBoard),
    bestReason: bestFacts.join("；") + "。" + (variation ? "引擎主变化：" + variation + "。" : ""),
    principle: principleForMove(sourceBoard, move),
    candidates: usableLines.slice(0, 3).map((line) => ({
      notation: formatMove(line.parsedMove, sourceBoard),
      score: formatEngineScore(line.numericScore),
      selected: line.move === chosenUci,
    })),
  };
}`,
    "engine coach analysis",
  );

  source = replaceOnce(
    source,
    `function performHumanMove(move) {
  if (locked || gameOver) return;
  const sourceBoard = cloneBoard(board);
  const candidates = rankMoves(sourceBoard, COLORS.RED, 6);

  performMove(move, COLORS.RED);
  coachAnalysis = buildCoachAnalysis(sourceBoard, move, candidates);
  selected = null;
  legalTargets = [];
  currentTurn = COLORS.BLACK;
  render();

  if (finishIfNeeded()) return;

  locked = true;
  renderStatus();
  window.setTimeout(performComputerMove, 520);
}

function performComputerMove() {
  if (gameOver) return;
  const move = chooseComputerMove();
  if (!move) {
    finishIfNeeded();
    return;
  }

  performMove(move, COLORS.BLACK);
  currentTurn = COLORS.RED;
  locked = false;
  render();
  finishIfNeeded();
}`,
    `async function performHumanMove(move) {
  if (locked || gameOver) return;
  locked = true;
  selected = null;
  legalTargets = [];

  if (!engineConnected && !(await initializeEngine())) {
    locked = false;
    coachAnalysis = {
      quality: "mistake",
      title: "Pikafish 未连接",
      summary: engineError || "请确认使用 npm run dev 启动完整服务。",
      bestMove: "无法分析",
      bestReason: "当前不会退回假引擎。",
      principle: "先恢复真实引擎连接，再继续对弈。",
      candidates: [],
    };
    render();
    return;
  }

  const sourceBoard = cloneBoard(board);
  performMove(move, COLORS.RED);
  currentTurn = COLORS.BLACK;
  engineStateElement.textContent = "Pikafish 正在分析你的走法…";
  render();

  if (finishIfNeeded()) return;

  try {
    if (analysisToggleElement.checked) {
      const settings = engineSettings();
      const analysis = await engineClient.analyze(sourceBoard, COLORS.RED, { depth: settings.depth, multiPv: 5 });
      const chosenUci = engineClient.moveToUci(move);
      let chosenScore = analysis.lines.find((line) => line.move === chosenUci)?.numericScore ?? null;
      if (chosenScore == null) {
        const afterMoveAnalysis = await engineClient.analyze(board, COLORS.BLACK, {
          depth: Math.max(5, settings.depth - 2),
          multiPv: 1,
        });
        chosenScore = -(afterMoveAnalysis.lines[0]?.numericScore ?? 0);
      }
      coachAnalysis = buildCoachAnalysis(sourceBoard, move, analysis, chosenScore);
      engineEvaluationCp = analysis.lines[0]?.numericScore ?? null;
      renderCoach();
      renderEvaluation();
    }

    await performComputerMove();
  } catch (error) {
    engineConnected = false;
    engineError = error instanceof Error ? error.message : "Pikafish 分析失败";
    engineStateElement.textContent = "引擎错误：" + engineError;
    coachAnalysis = {
      quality: "mistake",
      title: "真实引擎分析失败",
      summary: engineError,
      bestMove: "请悔棋后重试",
      bestReason: "系统没有使用本地假分析替代。",
      principle: "检查引擎服务后再继续。",
      candidates: [],
    };
    locked = false;
    render();
  }
}

async function performComputerMove() {
  if (gameOver) return;
  engineStateElement.textContent = "Pikafish 正在选择应对…";
  const choice = await chooseComputerMove();
  if (!choice) {
    finishIfNeeded();
    return;
  }

  engineEvaluationCp = -(choice.analysis.lines[0]?.numericScore ?? 0);
  performMove(choice.move, COLORS.BLACK);
  currentTurn = COLORS.RED;
  locked = false;
  engineStateElement.textContent = "Pikafish 已连接";
  render();
  finishIfNeeded();
}`,
    "async engine turns",
  );

  source = replaceOnce(
    source,
    `function renderEvaluation() {
  const score = materialEvaluation(board);
  const label = score > 180 ? "黑方明显占优" : score > 60 ? "黑方稍优" : score < -180 ? "红方明显占优" : score < -60 ? "红方稍优" : "均势";
  evaluationDisplayElement.innerHTML = "<span>局势</span><strong>" + label + "</strong>";
}`,
    `function renderEvaluation() {
  if (engineEvaluationCp == null) {
    evaluationDisplayElement.innerHTML = "<span>引擎</span><strong>等待分析</strong>";
    return;
  }
  const score = engineEvaluationCp;
  const label = score > 180 ? "红方明显占优" : score > 60 ? "红方稍优" : score < -180 ? "黑方明显占优" : score < -60 ? "黑方稍优" : "均势";
  evaluationDisplayElement.innerHTML = "<span>" + formatEngineScore(score) + "</span><strong>" + label + "</strong>";
}`,
    "engine evaluation display",
  );

  source = replaceOnce(
    source,
    '<span class="candidate-score">${Math.round(candidate.score)}</span>',
    '<span class="candidate-score">${candidate.score}</span>',
    "candidate score display",
  );

  source = replaceOnce(
    source,
    '  coachAnalysis = null;\n  lastMoveLabelElement.textContent = "请选择一个棋子开始";',
    '  coachAnalysis = null;\n  engineEvaluationCp = null;\n  lastMoveLabelElement.textContent = "请选择一个棋子开始";',
    "reset engine evaluation",
  );

  source = replaceOnce(
    source,
    'render();\n',
    'render();\ninitializeEngine();\n',
    "initialize engine on startup",
  );

  await writeFile(path, source, "utf8");
}

await patchServer();
await patchIndex();
await patchApp();
console.log("Real Pikafish integration applied.");
