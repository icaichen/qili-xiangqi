import { readFile, writeFile } from "node:fs/promises";

function replaceExact(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Missing target: ${label}`);
  return source.replace(search, replacement);
}

function replaceRegex(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Missing regex target: ${label}`);
  return source.replace(pattern, replacement);
}

async function patchIndex() {
  const path = "index.html";
  let source = await readFile(path, "utf8");
  source = replaceExact(
    source,
    `            <label class="field-label" for="levelSelect">电脑水平</label>
            <select id="levelSelect" class="select-control">
              <option value="beginner">入门 · Pikafish 低深度</option>
              <option value="intermediate" selected>进阶 · Pikafish 标准</option>
              <option value="advanced">高手 · Pikafish 深度分析</option>
            </select>`,
    `            <label class="field-label" for="levelSelect">估算训练棋力</label>
            <select id="levelSelect" class="select-control">
              <option value="800">800 · 刚入门</option>
              <option value="1000">1000 · 基础对弈</option>
              <option value="1200" selected>1200 · 常见战术</option>
              <option value="1400">1400 · 稳定业余</option>
              <option value="1600">1600 · 较强业余</option>
              <option value="1800">1800 · 高水平业余</option>
              <option value="2000">2000 · 接近强手</option>
              <option value="max">无限制 · Pikafish全力</option>
            </select>
            <p class="level-note">这是训练用估算等级，不等同于天天象棋或其他平台积分。</p>`,
    "rating selector",
  );
  source = replaceExact(
    source,
    `          <div class="left-actions">
            <button id="undoButton" class="button button-ghost" disabled>悔棋一步</button>
            <button id="flipButton" class="button button-ghost">翻转棋盘</button>
          </div>`,
    `          <div class="left-actions">
            <button id="undoStepButton" class="button button-ghost" disabled>退回一步</button>
            <button id="undoButton" class="button button-ghost" disabled>悔棋一回合</button>
            <button id="resumeButton" class="button button-primary action-wide hidden">继续对弈</button>
            <button id="flipButton" class="button button-ghost action-wide">翻转棋盘</button>
          </div>`,
    "undo controls",
  );
  source = replaceExact(
    source,
    `    <script type="module" src="/engine-client.js"></script>
    <script type="module" src="/app.js"></script>`,
    `    <script type="module" src="/engine-client.js"></script>
    <script type="module" src="/coach-tools.js"></script>
    <script type="module" src="/app.js"></script>`,
    "coach tools script",
  );
  await writeFile(path, source, "utf8");
}

async function patchStyles() {
  const path = "styles.css";
  let source = await readFile(path, "utf8");
  source = replaceExact(
    source,
    `.select-control {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 11px 12px;
  outline: none;
  color: #25332b;
  background: rgba(255, 255, 255, 0.74);
}`,
    `.select-control {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 11px 12px;
  outline: none;
  color: #25332b;
  background: rgba(255, 255, 255, 0.74);
}

.level-note {
  margin: 7px 2px 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.5;
}`,
    "level note styles",
  );
  source = replaceExact(
    source,
    `.left-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 14px;
}`,
    `.left-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 14px;
}

.action-wide {
  grid-column: 1 / -1;
}`,
    "wide action styles",
  );
  source += `

.coach-card .coach-sequence {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(35, 75, 59, 0.07);
  color: #48564e;
  font-size: 11px;
  line-height: 1.65;
}

.coach-card .confidence {
  display: inline-flex;
  margin-top: 10px;
  padding: 5px 8px;
  border-radius: 999px;
  background: rgba(35, 75, 59, 0.08);
  color: #516058;
  font-size: 10px;
}

.engine-details {
  margin-top: 12px;
  border-top: 1px solid rgba(31, 45, 37, 0.1);
  padding-top: 10px;
}

.engine-details summary {
  cursor: pointer;
  color: #526159;
  font-size: 11px;
  font-weight: 600;
}

.engine-details p {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.65;
}
`;
  await writeFile(path, source, "utf8");
}

async function patchApp() {
  const path = "app.js";
  let source = await readFile(path, "utf8");

  source = replaceExact(
    source,
    `const undoButtonElement = document.querySelector("#undoButton");
const newGameButtonElement = document.querySelector("#newGameButton");`,
    `const undoStepButtonElement = document.querySelector("#undoStepButton");
const undoButtonElement = document.querySelector("#undoButton");
const resumeButtonElement = document.querySelector("#resumeButton");
const newGameButtonElement = document.querySelector("#newGameButton");`,
    "undo DOM refs",
  );
  source = replaceExact(
    source,
    `const engineClient = window.XiangqiEngineClient;`,
    `const engineClient = window.XiangqiEngineClient;
const coachTools = window.XiangqiCoachTools;`,
    "coach tools ref",
  );
  source = replaceExact(
    source,
    `let engineEvaluationCp = null;`,
    `let engineEvaluationCp = null;
let pausedAfterUndo = false;`,
    "pause state",
  );

  source = replaceRegex(
    source,
    /function engineSettings\(\) \{[\s\S]*?\n\}\n\nfunction formatEngineScore/,
    `function engineSettings() {
  return coachTools.getLevelSettings(levelSelectElement.value);
}

function formatEngineScore`,
    "engine settings",
  );

  source = replaceRegex(
    source,
    /async function chooseComputerMove\(\) \{[\s\S]*?\n\}\nfunction sameMove/,
    `async function chooseComputerMove() {
  const settings = engineSettings();
  const analysis = await engineClient.analyze(board, COLORS.BLACK, {
    depth: settings.depth,
    multiPv: settings.multiPv,
  });
  const selectedLine = coachTools.chooseLine(analysis.lines, levelSelectElement.value);
  if (!selectedLine?.parsedMove) return null;
  return { move: selectedLine.parsedMove, analysis, selectedLine };
}
function sameMove`,
    "computer level selection",
  );

  source = replaceRegex(
    source,
    /function buildCoachAnalysis\(sourceBoard, move, analysis, chosenScoreOverride = null\) \{[\s\S]*?\n\}\n\nfunction performMove/,
    `function buildCoachAnalysis(sourceBoard, move, beforeAnalysis, afterAnalysis) {
  return coachTools.buildCoachAnalysis({
    sourceBoard,
    move,
    beforeAnalysis,
    afterAnalysis,
    adapters: {
      cloneBoard,
      applyMove,
      isInCheck,
      isSquareAttacked,
      formatMove,
      uciToMove: engineClient.uciToMove,
      moveToUci: engineClient.moveToUci,
      pieceValues: PIECE_VALUES,
      opposite: OPPOSITE,
    },
  });
}

function performMove`,
    "deep coach builder",
  );

  source = replaceRegex(
    source,
    /async function performHumanMove\(move\) \{[\s\S]*?\n\}\n\nasync function performComputerMove/,
    `async function performHumanMove(move) {
  if (locked || gameOver || pausedAfterUndo) return;
  locked = true;
  selected = null;
  legalTargets = [];
  if (!engineConnected && !(await initializeEngine())) { locked = false; render(); return; }
  const sourceBoard = cloneBoard(board);
  performMove(move, COLORS.RED);
  currentTurn = COLORS.BLACK;
  engineStateElement.textContent = "Pikafish 正在比较两条路线…";
  render();
  if (finishIfNeeded()) return;
  try {
    const settings = engineSettings();
    if (analysisToggleElement.checked) {
      const coachDepth = Math.max(8, Math.min(14, settings.depth));
      const before = await engineClient.analyze(sourceBoard, COLORS.RED, { depth: coachDepth, multiPv: 8 });
      const after = await engineClient.analyze(board, COLORS.BLACK, { depth: coachDepth, multiPv: 3 });
      coachAnalysis = buildCoachAnalysis(sourceBoard, move, before, after);
      engineEvaluationCp = -(after.lines[0]?.numericScore ?? 0);
      renderCoach();
      renderEvaluation();
    }
    await performComputerMove();
  } catch (error) {
    engineConnected = false;
    engineError = error instanceof Error ? error.message : "Pikafish 分析失败";
    engineStateElement.textContent = "引擎错误：" + engineError;
    locked = false;
    render();
  }
}

async function performComputerMove`,
    "deeper human analysis",
  );

  source = replaceExact(
    source,
    `  moveCountElement.textContent = \`${history.length} 手\`;
  undoButtonElement.disabled = history.length === 0 || locked;`,
    `  moveCountElement.textContent = \`${history.length} 手\`;
  undoStepButtonElement.disabled = history.length === 0 || locked;
  undoButtonElement.disabled = history.length === 0 || locked;
  resumeButtonElement.classList.toggle("hidden", !pausedAfterUndo);`,
    "history controls",
  );

  source = replaceRegex(
    source,
    /function renderCoach\(\) \{[\s\S]*?\n\}\n\nfunction render\(\)/,
    String.raw`function renderCoach() {
  if (!analysisToggleElement.checked) {
    coachContentElement.innerHTML = '<article class="coach-card neutral"><span class="card-kicker">实时教练已关闭</span><h3>你可以先独立思考</h3><p>重新打开后，系统会比较你的路线、最佳路线和对手最强回应。</p></article>';
    return;
  }

  if (!coachAnalysis) {
    coachContentElement.innerHTML = '<article class="coach-card neutral"><span class="card-kicker">教练提示</span><h3>先走一步，再比较路线</h3><p>系统不会假装读取引擎思想，而会用对手最强回应和反事实路线解释差异。</p></article><article class="coach-card principle"><span class="card-kicker">解释原则</span><h3>战术讲确定事实，战略讲证据强度</h3><p>能确认的将军、吃子和受攻关系会直接说明；安静局面会明确标为推断。</p></article>';
    return;
  }

  const qualityClass = coachAnalysis.quality === "good" ? "good" : "warning";
  const candidates = coachAnalysis.candidates.map((candidate, index) =>
    '<div class="candidate-row"><span class="candidate-rank">' + (index + 1) + '</span><strong>' + candidate.notation + (candidate.selected ? ' · 你的选择' : '') + '</strong><span class="candidate-score">' + candidate.score + '</span></div>'
  ).join('');

  coachContentElement.innerHTML =
    '<article class="coach-card ' + qualityClass + '">' +
      '<span class="card-kicker">你这步发生了什么</span><h3>' + coachAnalysis.title + '</h3><p>' + coachAnalysis.whatHappened + '</p>' +
    '</article>' +
    '<article class="coach-card warning">' +
      '<span class="card-kicker">对手会怎样惩罚</span><h3>' + coachAnalysis.opponentMove + '</h3><p>' + coachAnalysis.opponentReply + '</p>' +
    '</article>' +
    '<article class="coach-card good">' +
      '<span class="card-kicker">为什么最佳着更好</span><h3>' + coachAnalysis.bestMove + '</h3><p>' + coachAnalysis.bestReason + '</p>' +
      '<p>' + coachAnalysis.avoidReason + '</p>' +
      '<div class="coach-sequence"><strong>引擎路线：</strong>' + coachAnalysis.sequence + '<br>' + coachAnalysis.route + '</div>' +
      '<div class="candidate-list">' + candidates + '</div>' +
    '</article>' +
    '<article class="coach-card principle">' +
      '<span class="card-kicker">下次记住</span><h3>把路线转化为判断方法</h3><p>' + coachAnalysis.principle + '</p>' +
      '<span class="confidence">解释可信度：' + coachAnalysis.confidence + '</span>' +
      '<details class="engine-details"><summary>查看引擎细节</summary><p>' + coachAnalysis.engineDetail + '</p></details>' +
    '</article>';
}

function render()` ,
    "coach rendering",
  );

  source = replaceExact(
    source,
    `  coachAnalysis = null;
  engineEvaluationCp = null;
  lastMoveLabelElement.textContent = "请选择一个棋子开始";`,
    `  coachAnalysis = null;
  engineEvaluationCp = null;
  pausedAfterUndo = false;
  lastMoveLabelElement.textContent = "请选择一个棋子开始";`,
    "reset pause",
  );

  source = replaceRegex(
    source,
    /function undoTurn\(\) \{[\s\S]*?\n\}\n\nnewGameButtonElement/,
    `function restoreAfterUndo(removeCount, forceRedTurn) {
  history.splice(-removeCount, removeCount);
  snapshots.splice(-removeCount, removeCount);
  board = cloneBoard(snapshots.at(-1));
  currentTurn = forceRedTurn ? COLORS.RED : (history.length % 2 === 0 ? COLORS.RED : COLORS.BLACK);
  selected = null;
  legalTargets = [];
  locked = false;
  gameOver = false;
  coachAnalysis = null;
  engineEvaluationCp = null;
  lastMoveLabelElement.textContent = history.length ? "已回到 " + history.at(-1).notation + " 之后" : "请选择一个棋子开始";
}

function undoOneStep() {
  if (!history.length || locked) return;
  const removed = history.at(-1);
  restoreAfterUndo(1, false);
  currentTurn = removed.color;
  pausedAfterUndo = removed.color === COLORS.BLACK;
  if (pausedAfterUndo) lastMoveLabelElement.textContent = "已退回电脑走棋前。可继续让电脑重新选择。";
  render();
}

function undoTurn() {
  if (!history.length || locked) return;
  const removeCount = history.at(-1)?.color === COLORS.BLACK && history.length >= 2 ? 2 : 1;
  restoreAfterUndo(removeCount, true);
  pausedAfterUndo = false;
  render();
}

async function resumeAfterUndo() {
  if (!pausedAfterUndo || locked) return;
  pausedAfterUndo = false;
  if (currentTurn === COLORS.BLACK) {
    locked = true;
    render();
    await performComputerMove();
  } else {
    render();
  }
}

newGameButtonElement`,
    "undo functions",
  );

  source = replaceExact(
    source,
    `newGameButtonElement.addEventListener("click", resetGame);
undoButtonElement.addEventListener("click", undoTurn);`,
    `newGameButtonElement.addEventListener("click", resetGame);
undoStepButtonElement.addEventListener("click", undoOneStep);
undoButtonElement.addEventListener("click", undoTurn);
resumeButtonElement.addEventListener("click", resumeAfterUndo);`,
    "undo listeners",
  );

  await writeFile(path, source, "utf8");
}

await patchIndex();
await patchStyles();
await patchApp();
console.log("Levels, deeper teaching, and one-step reverse are installed.");
