import { readFile, writeFile } from "node:fs/promises";

const root = process.cwd();

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Missing target: ${label}`);
  return source.replace(search, replacement);
}

async function patchHtml() {
  const path = `${root}/index.html`;
  let source = await readFile(path, "utf8");

  source = replaceOnce(
    source,
    `            <div class="analysis-toggle-row">\n              <div>\n                <strong>实时教练</strong>\n                <span>每步解释关键原因</span>\n              </div>\n              <label class="switch">\n                <input id="analysisToggle" type="checkbox" checked />\n                <span class="switch-track"></span>\n              </label>\n            </div>`,
    `            <div class="analysis-toggle-row">\n              <div>\n                <strong>实时教练</strong>\n                <span>每步解释关键原因</span>\n              </div>\n              <label class="switch">\n                <input id="analysisToggle" type="checkbox" checked />\n                <span class="switch-track"></span>\n              </label>\n            </div>\n\n            <div class="analysis-toggle-row hint-toggle-row">\n              <div>\n                <strong>棋盘候选箭头</strong>\n                <span>显示最佳、第二和第三候选着</span>\n              </div>\n              <label class="switch">\n                <input id="moveHintsToggle" type="checkbox" checked />\n                <span class="switch-track"></span>\n              </label>\n            </div>`,
    "move hint toggle",
  );

  source = replaceOnce(
    source,
    `            </svg>\n            <div id="boardPoints" class="board-points"></div>`,
    `            </svg>\n            <svg id="moveHints" class="move-hints" viewBox="0 0 800 900" preserveAspectRatio="none" aria-hidden="true"></svg>\n            <div id="boardPoints" class="board-points"></div>`,
    "move hint overlay",
  );

  source = replaceOnce(
    source,
    `          <div class="board-footer">\n            <span>你执红先行</span>\n            <span id="lastMoveLabel">请选择一个棋子开始</span>\n          </div>`,
    `          <div class="board-footer">\n            <div class="move-hint-legend" id="moveHintLegend">\n              <span class="hint-best"><i></i>1 最佳</span>\n              <span class="hint-second"><i></i>2 第二</span>\n              <span class="hint-third"><i></i>3 第三</span>\n            </div>\n            <span id="lastMoveLabel">请选择一个棋子开始</span>\n          </div>`,
    "move hint legend",
  );

  await writeFile(path, source, "utf8");
}

async function patchCss() {
  const path = `${root}/styles.css`;
  let source = await readFile(path, "utf8");

  source = replaceOnce(
    source,
    `.analysis-toggle-row {\n  margin-top: 14px;`,
    `.analysis-toggle-row {\n  margin-top: 14px;`,
    "analysis toggle anchor",
  );

  source = replaceOnce(
    source,
    `.analysis-toggle-row span {\n  margin-top: 3px;\n  color: var(--muted);\n  font-size: 11px;\n}`,
    `.analysis-toggle-row span {\n  margin-top: 3px;\n  color: var(--muted);\n  font-size: 11px;\n}\n\n.hint-toggle-row {\n  margin-top: 8px;\n  background: #f5f3ec;\n  border-color: rgba(168, 120, 54, 0.16);\n}`,
    "hint toggle style",
  );

  source = replaceOnce(
    source,
    `.board-lines,\n.board-points {`,
    `.board-lines,\n.board-points,\n.move-hints {`,
    "board layer sizing",
  );

  source = replaceOnce(
    source,
    `.board-lines {\n  overflow: visible;\n}`,
    `.board-lines {\n  overflow: visible;\n}\n\n.move-hints {\n  overflow: visible;\n  pointer-events: none;\n  z-index: 3;\n}\n\n.move-hint-line {\n  fill: none;\n  stroke-linecap: round;\n  stroke-linejoin: round;\n  vector-effect: non-scaling-stroke;\n  filter: drop-shadow(0 2px 2px rgba(21, 31, 26, 0.2));\n}\n\n.move-hint-rank circle {\n  stroke: rgba(255, 255, 255, 0.9);\n  stroke-width: 2.5;\n  vector-effect: non-scaling-stroke;\n}\n\n.move-hint-rank text {\n  fill: white;\n  font-family: system-ui, sans-serif;\n  font-size: 26px;\n  font-weight: 800;\n  text-anchor: middle;\n  dominant-baseline: central;\n}`,
    "move hint graphics",
  );

  source = replaceOnce(
    source,
    `.board-footer {\n  min-height: 34px;\n  margin-top: 8px;\n  color: #768078;\n  font-size: 11px;\n}`,
    `.board-footer {\n  min-height: 34px;\n  margin-top: 8px;\n  color: #768078;\n  font-size: 11px;\n}\n\n.move-hint-legend {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  transition: opacity 140ms ease;\n}\n\n.move-hint-legend.hidden {\n  opacity: 0;\n  visibility: hidden;\n}\n\n.move-hint-legend span {\n  display: inline-flex;\n  align-items: center;\n  gap: 4px;\n}\n\n.move-hint-legend i {\n  width: 9px;\n  height: 9px;\n  border-radius: 50%;\n}\n\n.move-hint-legend .hint-best i { background: #237a52; }\n.move-hint-legend .hint-second i { background: #3577b8; }\n.move-hint-legend .hint-third i { background: #7d817f; }`,
    "move hint legend style",
  );

  await writeFile(path, source, "utf8");
}

async function patchApp() {
  const path = `${root}/app.js`;
  let source = await readFile(path, "utf8");

  source = replaceOnce(
    source,
    `const analysisToggleElement = document.querySelector("#analysisToggle");\nconst levelSelectElement = document.querySelector("#levelSelect");`,
    `const analysisToggleElement = document.querySelector("#analysisToggle");\nconst moveHintsToggleElement = document.querySelector("#moveHintsToggle");\nconst moveHintsElement = document.querySelector("#moveHints");\nconst moveHintLegendElement = document.querySelector("#moveHintLegend");\nconst levelSelectElement = document.querySelector("#levelSelect");`,
    "move hint dom refs",
  );

  source = replaceOnce(
    source,
    `let engineEvaluationCp = null;\nlet pausedAfterUndo = false;`,
    `let engineEvaluationCp = null;\nlet pausedAfterUndo = false;\nlet moveSuggestions = [];\nlet suggestionRequestId = 0;`,
    "move hint state",
  );

  source = replaceOnce(
    source,
    `async function initializeEngine() {\n  try {\n    engineStateElement.textContent = "正在连接 Pikafish…";\n    const health = await engineClient.health();\n    if (!health.configured) throw new Error("Pikafish 尚未配置");\n    engineConnected = true;\n    engineError = null;\n    engineStateElement.textContent = health.ready ? "Pikafish 已连接" : "Pikafish 已就绪";\n    return true;`,
    `async function initializeEngine() {\n  try {\n    engineStateElement.textContent = "正在连接 Pikafish…";\n    const health = await engineClient.health();\n    if (!health.configured) throw new Error("Pikafish 尚未配置");\n    engineConnected = true;\n    engineError = null;\n    engineStateElement.textContent = health.ready ? "Pikafish 已连接" : "Pikafish 已就绪";\n    window.setTimeout(refreshMoveSuggestions, 0);\n    return true;`,
    "initial suggestion refresh",
  );

  const insertBefore = `async function chooseComputerMove() {`;
  const helpers = `function hintCoordinates(row, col) {\n  return {\n    x: (flipped ? 8 - col : col) * 100,\n    y: (flipped ? 9 - row : row) * 100,\n  };\n}\n\nfunction clearMoveSuggestions() {\n  suggestionRequestId += 1;\n  moveSuggestions = [];\n  renderMoveHints();\n}\n\nfunction renderMoveHints() {\n  if (!moveHintsElement || !moveHintLegendElement) return;\n  const visible = Boolean(\n    moveHintsToggleElement?.checked &&\n    currentTurn === COLORS.RED &&\n    !locked &&\n    !gameOver &&\n    moveSuggestions.length\n  );\n\n  moveHintLegendElement.classList.toggle("hidden", !visible);\n  if (!visible) {\n    moveHintsElement.innerHTML = "";\n    return;\n  }\n\n  const colors = ["#237a52", "#3577b8", "#7d817f"];\n  const widths = [12, 9, 7];\n  const opacities = [0.9, 0.78, 0.66];\n  const definitions = colors.map((color, index) =>\n    '<marker id="hint-arrow-' + index + '" markerWidth="11" markerHeight="11" refX="8" refY="5.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L10,5.5 L0,11 Z" fill="' + color + '"></path></marker>'\n  ).join("");\n\n  const arrows = moveSuggestions.slice(0, 3).map((item, index) => {\n    const from = hintCoordinates(item.move.fromRow, item.move.fromCol);\n    const to = hintCoordinates(item.move.toRow, item.move.toCol);\n    const dx = to.x - from.x;\n    const dy = to.y - from.y;\n    const length = Math.hypot(dx, dy) || 1;\n    const startPadding = 37;\n    const endPadding = 42;\n    const x1 = from.x + (dx / length) * startPadding;\n    const y1 = from.y + (dy / length) * startPadding;\n    const x2 = to.x - (dx / length) * endPadding;\n    const y2 = to.y - (dy / length) * endPadding;\n    const badgeX = x1 + (x2 - x1) * 0.68;\n    const badgeY = y1 + (y2 - y1) * 0.68;\n    return '<g class="move-hint">' +\n      '<line class="move-hint-line" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + colors[index] + '" stroke-width="' + widths[index] + '" opacity="' + opacities[index] + '" marker-end="url(#hint-arrow-' + index + ')"></line>' +\n      '<g class="move-hint-rank" transform="translate(' + badgeX + ' ' + badgeY + ')"><circle r="18" fill="' + colors[index] + '"></circle><text y="1">' + (index + 1) + '</text></g>' +\n    '</g>';\n  }).join("");\n\n  moveHintsElement.innerHTML = '<defs>' + definitions + '</defs>' + arrows;\n}\n\nasync function refreshMoveSuggestions() {\n  const requestId = ++suggestionRequestId;\n  moveSuggestions = [];\n  renderMoveHints();\n\n  if (!moveHintsToggleElement?.checked || !engineConnected || locked || gameOver || currentTurn !== COLORS.RED || pausedAfterUndo) return;\n\n  try {\n    engineStateElement.textContent = "Pikafish 正在生成棋盘候选…";\n    const settings = engineSettings();\n    const analysis = await engineClient.analyze(board, COLORS.RED, {\n      depth: Math.max(8, Math.min(13, settings.depth)),\n      multiPv: 3,\n    });\n    if (requestId !== suggestionRequestId || locked || currentTurn !== COLORS.RED || gameOver) return;\n    moveSuggestions = analysis.lines\n      .filter((line) => line.parsedMove)\n      .slice(0, 3)\n      .map((line) => ({ move: line.parsedMove, score: line.numericScore }));\n    engineEvaluationCp = analysis.lines[0]?.numericScore ?? engineEvaluationCp;\n    renderEvaluation();\n    renderMoveHints();\n    engineStateElement.textContent = "Pikafish 已连接 · 候选箭头已更新";\n  } catch (error) {\n    if (requestId !== suggestionRequestId) return;\n    moveSuggestions = [];\n    renderMoveHints();\n    engineStateElement.textContent = "候选箭头暂时不可用";\n  }\n}\n\n`;
  source = replaceOnce(source, insertBefore, helpers + insertBefore, "move hint helpers");

  source = replaceOnce(
    source,
    `async function performHumanMove(move) {\n  if (locked || gameOver || pausedAfterUndo) return;\n  locked = true;`,
    `async function performHumanMove(move) {\n  if (locked || gameOver || pausedAfterUndo) return;\n  clearMoveSuggestions();\n  locked = true;`,
    "clear hints on human move",
  );

  source = replaceOnce(
    source,
    `  engineStateElement.textContent = "Pikafish 已连接";\n  render();\n  finishIfNeeded();\n}`,
    `  engineStateElement.textContent = "Pikafish 已连接";\n  render();\n  if (!finishIfNeeded()) refreshMoveSuggestions();\n}`,
    "refresh after computer move",
  );

  source = replaceOnce(
    source,
    `function render() {\n  renderBoard();\n  renderHistory();\n  renderStatus();\n  renderEvaluation();\n  renderCoach();\n}`,
    `function render() {\n  renderBoard();\n  renderHistory();\n  renderStatus();\n  renderEvaluation();\n  renderCoach();\n  renderMoveHints();\n}`,
    "render move hints",
  );

  source = replaceOnce(
    source,
    `  pausedAfterUndo = false;\n  lastMoveLabelElement.textContent = "请选择一个棋子开始";\n  render();`,
    `  pausedAfterUndo = false;\n  clearMoveSuggestions();\n  lastMoveLabelElement.textContent = "请选择一个棋子开始";\n  render();\n  if (engineConnected) refreshMoveSuggestions();`,
    "reset suggestions",
  );

  source = replaceOnce(
    source,
    `  if (pausedAfterUndo) lastMoveLabelElement.textContent = "已退回电脑走棋前。可继续让电脑重新选择。";\n  render();\n}`,
    `  if (pausedAfterUndo) lastMoveLabelElement.textContent = "已退回电脑走棋前。可继续让电脑重新选择。";\n  render();\n  if (!pausedAfterUndo && currentTurn === COLORS.RED) refreshMoveSuggestions();\n}`,
    "one step undo suggestions",
  );

  source = replaceOnce(
    source,
    `  pausedAfterUndo = false;\n  render();\n}\n\nasync function resumeAfterUndo()`,
    `  pausedAfterUndo = false;\n  render();\n  if (currentTurn === COLORS.RED) refreshMoveSuggestions();\n}\n\nasync function resumeAfterUndo()`,
    "turn undo suggestions",
  );

  source = replaceOnce(
    source,
    `flipButtonElement.addEventListener("click", () => {\n  flipped = !flipped;\n  renderBoard();\n});\nanalysisToggleElement.addEventListener("change", renderCoach);`,
    `flipButtonElement.addEventListener("click", () => {\n  flipped = !flipped;\n  renderBoard();\n  renderMoveHints();\n});\nanalysisToggleElement.addEventListener("change", renderCoach);\nmoveHintsToggleElement.addEventListener("change", () => {\n  if (moveHintsToggleElement.checked) refreshMoveSuggestions();\n  else clearMoveSuggestions();\n});\nlevelSelectElement.addEventListener("change", () => {\n  if (currentTurn === COLORS.RED && !locked) refreshMoveSuggestions();\n});`,
    "hint toggle listeners",
  );

  await writeFile(path, source, "utf8");
}

await patchHtml();
await patchCss();
await patchApp();
console.log("Visual ranked move hints added.");
