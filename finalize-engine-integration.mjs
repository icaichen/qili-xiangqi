import { readFile, writeFile } from "node:fs/promises";

function mustReplace(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Patch target not found: ${label}`);
  return next;
}

async function patchIndex() {
  const path = "index.html";
  let source = await readFile(path, "utf8");
  source = source
    .replace("入门 · 随机应对", "入门 · Pikafish 低深度")
    .replace("进阶 · 战术优先", "进阶 · Pikafish 标准")
    .replace("高手 · 两层搜索", "高手 · Pikafish 深度分析")
    .replace("原型启发式已启用", "正在连接 Pikafish…")
    .replace('<script type="module" src="/app.js"></script>', '<script src="/engine-client.js"></script>\n    <script type="module" src="/app.js"></script>');
  await writeFile(path, source, "utf8");
}

async function patchApp() {
  const path = "app.js";
  let source = await readFile(path, "utf8");
  if (source.includes("const engineClient = window.XiangqiEngineClient")) return;

  source = source.replace(
    'const reviewDropzoneElement = document.querySelector("#reviewDropzone");',
    'const reviewDropzoneElement = document.querySelector("#reviewDropzone");\nconst engineStateElement = document.querySelector("#engineState");\nconst engineClient = window.XiangqiEngineClient;',
  );
  source = source.replace(
    'let coachAnalysis = null;',
    'let coachAnalysis = null;\nlet engineConnected = false;\nlet engineError = null;\nlet engineEvaluationCp = null;',
  );

  const engineHelpers = [
    'function engineSettings() {',
    '  const level = levelSelectElement.value;',
    '  if (level === "beginner") return { depth: 6, multiPv: 5 };',
    '  if (level === "advanced") return { depth: 14, multiPv: 4 };',
    '  return { depth: 10, multiPv: 4 };',
    '}',
    '',
    'function formatEngineScore(cp) {',
    '  if (!Number.isFinite(cp)) return "—";',
    '  if (Math.abs(cp) >= 90000) return cp > 0 ? "将杀" : "被将杀";',
    '  const value = cp / 100;',
    '  return (value > 0 ? "+" : "") + value.toFixed(2);',
    '}',
    '',
    'function pvToNotation(sourceBoard, pv, limit = 4) {',
    '  let working = cloneBoard(sourceBoard);',
    '  const labels = [];',
    '  for (const uci of (pv || []).slice(0, limit)) {',
    '    const move = engineClient.uciToMove(uci, working);',
    '    if (!move) break;',
    '    labels.push(formatMove(move, working));',
    '    working = applyMove(working, move).board;',
    '  }',
    '  return labels.join("，");',
    '}',
    '',
    'async function initializeEngine() {',
    '  try {',
    '    engineStateElement.textContent = "正在连接 Pikafish…";',
    '    const health = await engineClient.health();',
    '    if (!health.configured) throw new Error("Pikafish 尚未配置");',
    '    engineConnected = true;',
    '    engineError = null;',
    '    engineStateElement.textContent = health.ready ? "Pikafish 已连接" : "Pikafish 已就绪";',
    '    return true;',
    '  } catch (error) {',
    '    engineConnected = false;',
    '    engineError = error instanceof Error ? error.message : "引擎连接失败";',
    '    engineStateElement.textContent = "连接失败：" + engineError;',
    '    return false;',
    '  }',
    '}',
    '',
    'async function chooseComputerMove() {',
    '  const settings = engineSettings();',
    '  const analysis = await engineClient.analyze(board, COLORS.BLACK, settings);',
    '  const lines = analysis.lines.filter((line) => line.parsedMove);',
    '  if (!lines.length) return null;',
    '  let index = 0;',
    '  if (levelSelectElement.value === "beginner") index = Math.min(lines.length - 1, Math.floor(Math.random() * Math.min(4, lines.length)));',
    '  else if (levelSelectElement.value === "intermediate" && lines.length > 1 && Math.random() < 0.12) index = 1;',
    '  return { move: lines[index].parsedMove, analysis };',
    '}',
    '',
  ].join("\n");

  source = mustReplace(
    source,
    /function chooseComputerMove\(\) \{[\s\S]*?\n\}\n\nfunction sameMove/,
    engineHelpers + 'function sameMove',
    "computer engine block",
  );

  const coachBlock = [
    'function buildCoachAnalysis(sourceBoard, move, analysis, chosenScoreOverride = null) {',
    '  const chosenUci = engineClient.moveToUci(move);',
    '  const lines = analysis.lines.filter((line) => line.parsedMove);',
    '  const bestLine = lines[0];',
    '  const selectedLine = lines.find((line) => line.move === chosenUci);',
    '  const bestMove = bestLine?.parsedMove ?? move;',
    '  const bestScore = bestLine?.numericScore ?? 0;',
    '  const chosenScore = selectedLine?.numericScore ?? chosenScoreOverride;',
    '  const gap = chosenScore == null ? 150 : Math.max(0, bestScore - chosenScore);',
    '  const quality = gap < 30 ? "good" : gap < 100 ? "inaccuracy" : "mistake";',
    '  const facts = describeMove(sourceBoard, move);',
    '  const bestFacts = describeMove(sourceBoard, bestMove);',
    '  const variation = pvToNotation(sourceBoard, bestLine?.pv, 4);',
    '  return {',
    '    quality,',
    '    title: quality === "good" ? "这步接近引擎首选" : quality === "inaccuracy" ? "这步可以更精确" : "这步错过了更强的方案",',
    '    summary: facts.join("；") + "。" + (chosenScore == null ? "这步未进入引擎主要候选。" : "相比最佳着约损失 " + formatEngineScore(gap) + "。"),',
    '    bestMove: formatMove(bestMove, sourceBoard),',
    '    bestReason: bestFacts.join("；") + "。" + (variation ? "引擎主变化：" + variation + "。" : ""),',
    '    principle: principleForMove(sourceBoard, move),',
    '    candidates: lines.slice(0, 3).map((line) => ({ notation: formatMove(line.parsedMove, sourceBoard), score: formatEngineScore(line.numericScore), selected: line.move === chosenUci })),',
    '  };',
    '}',
  ].join("\n");

  source = mustReplace(source, /function buildCoachAnalysis\([\s\S]*?\n\}\n\nfunction performMove/, coachBlock + "\n\nfunction performMove", "coach analysis");

  const turnBlock = [
    'async function performHumanMove(move) {',
    '  if (locked || gameOver) return;',
    '  locked = true;',
    '  selected = null;',
    '  legalTargets = [];',
    '  if (!engineConnected && !(await initializeEngine())) { locked = false; render(); return; }',
    '  const sourceBoard = cloneBoard(board);',
    '  performMove(move, COLORS.RED);',
    '  currentTurn = COLORS.BLACK;',
    '  engineStateElement.textContent = "Pikafish 正在分析…";',
    '  render();',
    '  if (finishIfNeeded()) return;',
    '  try {',
    '    const settings = engineSettings();',
    '    if (analysisToggleElement.checked) {',
    '      const before = await engineClient.analyze(sourceBoard, COLORS.RED, { depth: settings.depth, multiPv: 5 });',
    '      const chosenUci = engineClient.moveToUci(move);',
    '      let chosenScore = before.lines.find((line) => line.move === chosenUci)?.numericScore ?? null;',
    '      if (chosenScore == null) {',
    '        const after = await engineClient.analyze(board, COLORS.BLACK, { depth: Math.max(5, settings.depth - 2), multiPv: 1 });',
    '        chosenScore = -(after.lines[0]?.numericScore ?? 0);',
    '      }',
    '      coachAnalysis = buildCoachAnalysis(sourceBoard, move, before, chosenScore);',
    '      engineEvaluationCp = before.lines[0]?.numericScore ?? null;',
    '      renderCoach();',
    '      renderEvaluation();',
    '    }',
    '    await performComputerMove();',
    '  } catch (error) {',
    '    engineConnected = false;',
    '    engineError = error instanceof Error ? error.message : "Pikafish 分析失败";',
    '    engineStateElement.textContent = "引擎错误：" + engineError;',
    '    locked = false;',
    '    render();',
    '  }',
    '}',
    '',
    'async function performComputerMove() {',
    '  if (gameOver) return;',
    '  engineStateElement.textContent = "Pikafish 正在选择应对…";',
    '  const choice = await chooseComputerMove();',
    '  if (!choice) { locked = false; finishIfNeeded(); return; }',
    '  engineEvaluationCp = -(choice.analysis.lines[0]?.numericScore ?? 0);',
    '  performMove(choice.move, COLORS.BLACK);',
    '  currentTurn = COLORS.RED;',
    '  locked = false;',
    '  engineStateElement.textContent = "Pikafish 已连接";',
    '  render();',
    '  finishIfNeeded();',
    '}',
  ].join("\n");

  source = mustReplace(source, /function performHumanMove\([\s\S]*?\n\}\n\nfunction finishIfNeeded/, turnBlock + "\n\nfunction finishIfNeeded", "turn handling");

  const evalBlock = [
    'function renderEvaluation() {',
    '  if (engineEvaluationCp == null) { evaluationDisplayElement.innerHTML = "<span>引擎</span><strong>等待分析</strong>"; return; }',
    '  const score = engineEvaluationCp;',
    '  const label = score > 180 ? "红方明显占优" : score > 60 ? "红方稍优" : score < -180 ? "黑方明显占优" : score < -60 ? "黑方稍优" : "均势";',
    '  evaluationDisplayElement.innerHTML = "<span>" + formatEngineScore(score) + "</span><strong>" + label + "</strong>";',
    '}',
  ].join("\n");
  source = mustReplace(source, /function renderEvaluation\(\) \{[\s\S]*?\n\}/, evalBlock, "evaluation");
  source = source.replace('${Math.round(candidate.score)}', '${candidate.score}');
  source = source.replace('  coachAnalysis = null;\n  lastMoveLabelElement.textContent = "请选择一个棋子开始";', '  coachAnalysis = null;\n  engineEvaluationCp = null;\n  lastMoveLabelElement.textContent = "请选择一个棋子开始";');
  source = source.replace(/\nrender\(\);\s*$/, '\nrender();\ninitializeEngine();\n');
  await writeFile(path, source, "utf8");
}

await patchIndex();
await patchApp();
console.log("Pikafish front-end integration completed.");
