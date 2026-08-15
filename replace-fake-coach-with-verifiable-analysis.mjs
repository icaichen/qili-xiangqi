import { readFile, writeFile } from "node:fs/promises";

const root = process.cwd();

function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`Missing range: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

// Replace coach analysis with verifiable engine data only.
{
  const path = `${root}/coach-tools.js`;
  let source = await readFile(path, "utf8");
  const startMarker = "function routeData(sourceBoard, pv, adapters, limit = 6) {";
  const endMarker = "\nwindow.XiangqiCoachTools = {";
  const replacement = `function routeData(sourceBoard, pv, adapters, limit = 8) {
  let working = adapters.cloneBoard(sourceBoard);
  const steps = [];
  for (const uci of (pv || []).slice(0, limit)) {
    const move = adapters.uciToMove(uci, working);
    if (!move) break;
    const moving = working[move.fromRow]?.[move.fromCol];
    const captured = working[move.toRow]?.[move.toCol];
    const notation = adapters.formatMove(move, working);
    const next = adapters.applyMove(working, move).board;
    const givesCheck = moving ? adapters.isInCheck(next, adapters.opposite[moving.color]) : false;
    const events = [];
    if (captured) events.push(\`吃掉\${captured.label}\`);
    if (givesCheck) events.push("将军");
    steps.push({
      uci,
      move: { ...move },
      notation,
      events,
      captured: captured?.label || null,
      givesCheck,
    });
    working = next;
  }
  return {
    sequence: steps.map((step) => step.notation).join(" → "),
    steps,
    finalBoard: working,
  };
}

function tacticalEvents(route) {
  return route.steps
    .map((step, index) => step.events.length ? \`第\${index + 1}步 \${step.notation}：\${step.events.join("、")}\` : null)
    .filter(Boolean);
}

function buildCoachAnalysis({ sourceBoard, move, beforeAnalysis, afterAnalysis, adapters }) {
  const chosenUci = adapters.moveToUci(move);
  const lines = beforeAnalysis.lines.filter((line) => line.parsedMove);
  const bestLine = lines[0];
  const selectedIndex = lines.findIndex((line) => line.move === chosenUci);
  const selectedLine = selectedIndex >= 0 ? lines[selectedIndex] : null;
  const bestMove = bestLine?.parsedMove ?? move;
  const bestScore = bestLine?.numericScore ?? 0;
  const afterScore = -(afterAnalysis.lines[0]?.numericScore ?? 0);
  const chosenScore = selectedLine?.numericScore ?? afterScore;
  const gap = Math.max(0, bestScore - chosenScore);
  const selectedIsBest = Boolean(bestLine && bestLine.move === chosenUci);
  const moveRank = selectedIndex >= 0 ? selectedIndex + 1 : null;

  const replyLine = afterAnalysis.lines.find((line) => line.parsedMove) ?? afterAnalysis.lines[0];
  const replyMove = replyLine?.parsedMove;
  const replyNotation = replyMove
    ? adapters.formatMove(replyMove, adapters.applyMove(sourceBoard, move).board)
    : "未返回";

  const chosenPv = selectedLine?.pv?.length
    ? selectedLine.pv
    : [chosenUci, ...(replyLine?.pv || [])];
  const yourRoute = routeData(sourceBoard, chosenPv, adapters, 8);
  const bestRoute = routeData(sourceBoard, bestLine?.pv || [], adapters, 8);
  const yourEvents = tacticalEvents(yourRoute);
  const bestEvents = tacticalEvents(bestRoute);
  const sameRoute = selectedIsBest || yourRoute.sequence === bestRoute.sequence;

  let verdict;
  let quality;
  if (selectedIsBest) {
    quality = "good";
    verdict = "你走的是 Pikafish 当前首选。";
  } else if (gap < 30) {
    quality = "good";
    verdict = \`这步与首选基本等价，评价差只有 \${formatScore(gap)}。\`;
  } else if (gap < 100) {
    quality = "inaccuracy";
    verdict = \`这步可下，但比首选约差 \${formatScore(gap)}。\`;
  } else {
    quality = "mistake";
    verdict = \`这步让局面评价下降约 \${formatScore(gap)}。\`;
  }

  let evidence;
  if (selectedIsBest) {
    evidence = yourEvents.length
      ? \`这条主变化中可确认的战术事件：\${yourEvents.join("；")}。\`
      : "前八手主变化中没有吃子或将军。引擎选择它，但当前输出不足以证明一个单一的人类战略原因。";
  } else if (yourEvents.length || bestEvents.length) {
    const yourText = yourEvents.length ? yourEvents.join("；") : "前八手没有吃子或将军";
    const bestText = bestEvents.length ? bestEvents.join("；") : "前八手没有吃子或将军";
    evidence = \`你的路线：\${yourText}。首选路线：\${bestText}。\`;
  } else {
    evidence = "两条主变化前八手都没有吃子或将军。只能确认引擎分数不同，不能诚实地声称某个单一原因。";
  }

  const opponentText = replyMove
    ? \`对手的引擎首选回应是 \${replyNotation}。这只是最佳应对，不代表一定存在立即战术。\`
    : "引擎没有返回可展示的对手回应。";

  return {
    quality,
    verdict,
    selectedIsBest,
    sameRoute,
    moveRank,
    moveNotation: adapters.formatMove(move, sourceBoard),
    bestMove: adapters.formatMove(bestMove, sourceBoard),
    bestScore,
    chosenScore,
    gap,
    opponentMove: replyNotation,
    opponentText,
    evidence,
    sourceBoard: adapters.cloneBoard(sourceBoard),
    routes: {
      your: yourRoute,
      best: bestRoute,
    },
    engineDetail: \`首选 \${formatScore(bestScore)}；你的走法 \${formatScore(chosenScore)}；差值 \${formatScore(gap)}；搜索深度 \${bestLine?.depth ?? beforeAnalysis.depth ?? "—"}。\`,
    candidates: lines.slice(0, 5).map((line, index) => ({
      rank: index + 1,
      notation: adapters.formatMove(line.parsedMove, sourceBoard),
      score: formatScore(line.numericScore),
      loss: formatScore(Math.max(0, bestScore - line.numericScore)),
      selected: line.move === chosenUci,
    })),
  };
}
`;
  source = replaceRange(source, startMarker, endMarker, replacement, "coach analysis");
  await writeFile(path, source, "utf8");
}

// Add route preview modal.
{
  const path = `${root}/index.html`;
  let source = await readFile(path, "utf8");
  const marker = "\n    <script type=\"module\" src=\"/engine-client.js\"></script>";
  if (!source.includes("id=\"routePreviewModal\"")) {
    const modal = `
    <div id="routePreviewModal" class="route-preview-modal hidden" role="dialog" aria-modal="true" aria-labelledby="routePreviewTitle">
      <div class="route-preview-dialog">
        <div class="route-preview-header">
          <div>
            <span class="eyebrow">棋盘验证</span>
            <h2 id="routePreviewTitle">查看引擎路线</h2>
          </div>
          <button id="routePreviewClose" class="modal-close" aria-label="关闭路线预览">×</button>
        </div>
        <div id="routePreviewBoard" class="route-preview-board" aria-label="路线预览棋盘"></div>
        <div class="route-preview-info">
          <strong id="routePreviewStep">起始局面</strong>
          <span id="routePreviewEvent">使用前后按钮逐步查看真实棋盘变化。</span>
        </div>
        <div class="route-preview-actions">
          <button id="routePreviewPrev" class="button button-ghost">上一步</button>
          <span id="routePreviewCounter">0 / 0</span>
          <button id="routePreviewNext" class="button button-primary">下一步</button>
        </div>
      </div>
    </div>
`;
    source = source.replace(marker, modal + marker);
  }
  await writeFile(path, source, "utf8");
}

// Replace coach UI and connect the visual route player.
{
  const path = `${root}/app.js`;
  let source = await readFile(path, "utf8");

  const refsMarker = 'const notationBreakdownElement = document.querySelector("#notationBreakdown");';
  if (!source.includes('const routePreviewModalElement')) {
    source = source.replace(refsMarker, refsMarker + `
const routePreviewModalElement = document.querySelector("#routePreviewModal");
const routePreviewBoardElement = document.querySelector("#routePreviewBoard");
const routePreviewTitleElement = document.querySelector("#routePreviewTitle");
const routePreviewStepElement = document.querySelector("#routePreviewStep");
const routePreviewEventElement = document.querySelector("#routePreviewEvent");
const routePreviewCounterElement = document.querySelector("#routePreviewCounter");
const routePreviewPrevElement = document.querySelector("#routePreviewPrev");
const routePreviewNextElement = document.querySelector("#routePreviewNext");
const routePreviewCloseElement = document.querySelector("#routePreviewClose");`);
  }

  const stateMarker = "let suggestionRequestId = 0;";
  if (!source.includes("let routePreviewState")) {
    source = source.replace(stateMarker, stateMarker + `
let routePreviewState = { route: null, index: 0, title: "" };`);
  }

  const renderStart = source.indexOf("function routeStepsHtml(steps) {");
  const renderEnd = source.indexOf("\nfunction render()", renderStart);
  if (renderStart < 0 || renderEnd < 0) throw new Error("Missing old coach renderer");

  const renderer = `function candidateRowsHtml(candidates) {
  return candidates.map((candidate) =>
    '<div class="candidate-row"><span class="candidate-rank">' + candidate.rank + '</span><strong>' + candidate.notation + (candidate.selected ? ' · 你的选择' : '') + '</strong><span class="candidate-score">' + candidate.score + '</span></div>'
  ).join('');
}

function renderCoach() {
  if (!analysisToggleElement.checked) {
    coachContentElement.innerHTML = '<article class="coach-card neutral"><span class="card-kicker">实时教练已关闭</span><h3>独立思考模式</h3><p>打开后只显示引擎排名、评价差和可验证的战术事件。</p></article>';
    return;
  }

  if (!coachAnalysis) {
    coachContentElement.innerHTML = '<article class="coach-card neutral"><span class="card-kicker">等待走棋</span><h3>分析不会再编故事</h3><p>系统只报告引擎候选排名、分数、主变化和棋盘上实际发生的吃子或将军。</p></article>';
    return;
  }

  const qualityClass = coachAnalysis.quality === "good" ? "good" : "warning";
  const rankText = coachAnalysis.moveRank ? '第 ' + coachAnalysis.moveRank + ' 候选' : '未进入前五候选';
  const comparisonTitle = coachAnalysis.selectedIsBest ? '你走的是首选' : '引擎比较结果';
  const routeButtons =
    '<div class="route-view-actions">' +
      '<button class="button button-ghost route-preview-trigger" data-route="your">在棋盘查看你的路线</button>' +
      (coachAnalysis.sameRoute ? '' : '<button class="button button-primary route-preview-trigger" data-route="best">在棋盘查看首选路线</button>') +
    '</div>';

  coachContentElement.innerHTML =
    '<article class="coach-card ' + qualityClass + '">' +
      '<span class="card-kicker">' + comparisonTitle + '</span>' +
      '<h3>' + coachAnalysis.moveNotation + ' · ' + rankText + '</h3>' +
      '<p>' + coachAnalysis.verdict + '</p>' +
      '<div class="engine-fact-grid">' +
        '<div><span>你的评价</span><strong>' + formatEngineScore(coachAnalysis.chosenScore) + '</strong></div>' +
        '<div><span>首选评价</span><strong>' + formatEngineScore(coachAnalysis.bestScore) + '</strong></div>' +
        '<div><span>评价差</span><strong>' + formatEngineScore(coachAnalysis.gap) + '</strong></div>' +
      '</div>' +
    '</article>' +
    '<article class="coach-card neutral">' +
      '<span class="card-kicker">下一步</span><h3>' + coachAnalysis.opponentMove + '</h3><p>' + coachAnalysis.opponentText + '</p>' +
    '</article>' +
    '<article class="coach-card good">' +
      '<span class="card-kicker">可验证信息</span><h3>主变化中的真实事件</h3><p>' + coachAnalysis.evidence + '</p>' +
      '<div class="route-sequence compact"><strong>引擎主变化：</strong>' + coachAnalysis.routes.your.sequence + '</div>' +
      (coachAnalysis.sameRoute ? '' : '<div class="route-sequence compact"><strong>首选主变化：</strong>' + coachAnalysis.routes.best.sequence + '</div>') +
      routeButtons +
      '<div class="candidate-list">' + candidateRowsHtml(coachAnalysis.candidates) + '</div>' +
    '</article>' +
    '<details class="engine-details"><summary>查看原始引擎数据</summary><p>' + coachAnalysis.engineDetail + '</p></details>';
}
`;
  source = source.slice(0, renderStart) + renderer + source.slice(renderEnd);

  const eventsMarker = 'newGameButtonElement.addEventListener("click", resetGame);';
  if (!source.includes("function openRoutePreview")) {
    const previewCode = `function previewBoardAt(route, index) {
  let previewBoard = cloneBoard(coachAnalysis.sourceBoard);
  for (let stepIndex = 0; stepIndex < index; stepIndex += 1) {
    previewBoard = applyMove(previewBoard, route.steps[stepIndex].move).board;
  }
  return previewBoard;
}

function renderRoutePreview() {
  const route = routePreviewState.route;
  if (!route || !routePreviewBoardElement) return;
  const previewBoard = previewBoardAt(route, routePreviewState.index);
  const activeStep = routePreviewState.index > 0 ? route.steps[routePreviewState.index - 1] : null;
  routePreviewBoardElement.innerHTML = "";
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = document.createElement("div");
      cell.className = "route-preview-cell";
      if (activeStep && activeStep.move.toRow === row && activeStep.move.toCol === col) cell.classList.add("active-to");
      if (activeStep && activeStep.move.fromRow === row && activeStep.move.fromCol === col) cell.classList.add("active-from");
      const entry = previewBoard[row][col];
      if (entry) {
        const pieceElement = document.createElement("span");
        pieceElement.className = "route-preview-piece " + entry.color;
        pieceElement.textContent = entry.label;
        cell.appendChild(pieceElement);
      }
      routePreviewBoardElement.appendChild(cell);
    }
  }
  routePreviewTitleElement.textContent = routePreviewState.title;
  routePreviewCounterElement.textContent = routePreviewState.index + " / " + route.steps.length;
  routePreviewPrevElement.disabled = routePreviewState.index === 0;
  routePreviewNextElement.disabled = routePreviewState.index >= route.steps.length;
  routePreviewStepElement.textContent = activeStep ? activeStep.notation : "起始局面";
  routePreviewEventElement.textContent = activeStep
    ? (activeStep.events.length ? activeStep.events.join("、") : "这一手没有立即吃子或将军。")
    : "使用前后按钮逐步查看棋盘上的真实变化。";
}

function openRoutePreview(routeKey) {
  if (!coachAnalysis?.routes?.[routeKey]) return;
  routePreviewState = {
    route: coachAnalysis.routes[routeKey],
    index: 0,
    title: routeKey === "best" ? "Pikafish 首选路线" : "你的走法路线",
  };
  routePreviewModalElement.classList.remove("hidden");
  document.body.classList.add("modal-open");
  renderRoutePreview();
}

function closeRoutePreview() {
  routePreviewModalElement?.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

coachContentElement.addEventListener("click", (event) => {
  const button = event.target.closest(".route-preview-trigger");
  if (button) openRoutePreview(button.dataset.route);
});
routePreviewPrevElement?.addEventListener("click", () => {
  routePreviewState.index = Math.max(0, routePreviewState.index - 1);
  renderRoutePreview();
});
routePreviewNextElement?.addEventListener("click", () => {
  routePreviewState.index = Math.min(routePreviewState.route.steps.length, routePreviewState.index + 1);
  renderRoutePreview();
});
routePreviewCloseElement?.addEventListener("click", closeRoutePreview);
routePreviewModalElement?.addEventListener("click", (event) => {
  if (event.target === routePreviewModalElement) closeRoutePreview();
});

`;
    source = source.replace(eventsMarker, previewCode + eventsMarker);
  }

  const escapeMarker = 'document.addEventListener("keydown", (event) => {';
  if (source.includes(escapeMarker) && !source.includes('routePreviewModalElement?.classList.contains("hidden")')) {
    source = source.replace(
      '  if (event.key === "Escape" && !notationModalElement?.classList.contains("hidden")) closeNotationModal();',
      '  if (event.key === "Escape" && !notationModalElement?.classList.contains("hidden")) closeNotationModal();\n  if (event.key === "Escape" && !routePreviewModalElement?.classList.contains("hidden")) closeRoutePreview();',
    );
  }

  await writeFile(path, source, "utf8");
}

// Styling for compact facts and visual route playback.
{
  const path = `${root}/styles.css`;
  let source = await readFile(path, "utf8");
  if (!source.includes(".route-preview-modal")) {
    source += `

.engine-fact-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 14px;
}
.engine-fact-grid > div {
  padding: 10px;
  border: 1px solid rgba(35, 75, 59, 0.12);
  border-radius: 12px;
  background: rgba(255,255,255,0.55);
}
.engine-fact-grid span,
.engine-fact-grid strong { display: block; }
.engine-fact-grid span { color: var(--muted); font-size: 10px; }
.engine-fact-grid strong { margin-top: 4px; font-size: 15px; }
.route-sequence.compact {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255,255,255,0.55);
  font-size: 12px;
  line-height: 1.65;
}
.route-view-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 12px;
}
.route-preview-modal {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(24, 32, 27, 0.55);
  backdrop-filter: blur(8px);
}
.route-preview-modal.hidden { display: none; }
.route-preview-dialog {
  width: min(92vw, 620px);
  max-height: 92vh;
  overflow: auto;
  padding: 20px;
  border-radius: 22px;
  background: #f8f8f3;
  box-shadow: 0 30px 90px rgba(0,0,0,0.28);
}
.route-preview-header,
.route-preview-actions,
.route-preview-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.route-preview-board {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  grid-template-rows: repeat(10, 1fr);
  width: min(100%, 500px);
  aspect-ratio: 9 / 10;
  margin: 18px auto;
  border: 8px solid #6f4d2d;
  border-radius: 14px;
  background: #d7aa6c;
  overflow: hidden;
}
.route-preview-cell {
  position: relative;
  display: grid;
  place-items: center;
  border-right: 1px solid rgba(79,48,24,0.35);
  border-bottom: 1px solid rgba(79,48,24,0.35);
}
.route-preview-cell.active-from { background: rgba(53,119,184,0.2); }
.route-preview-cell.active-to { background: rgba(35,122,82,0.25); }
.route-preview-piece {
  width: 76%;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border: 2px solid currentColor;
  border-radius: 50%;
  background: #efd098;
  font-family: "Noto Serif SC", serif;
  font-weight: 700;
  font-size: clamp(12px, 2.4vw, 22px);
  box-shadow: 0 3px 5px rgba(69,41,20,0.25);
}
.route-preview-piece.red { color: #a33d31; }
.route-preview-piece.black { color: #29372f; }
.route-preview-info {
  align-items: flex-start;
  flex-direction: column;
  padding: 12px 14px;
  border-radius: 13px;
  background: #eef2ef;
}
.route-preview-info span { color: var(--muted); font-size: 12px; }
.route-preview-actions { margin-top: 14px; }
@media (max-width: 620px) {
  .engine-fact-grid { grid-template-columns: 1fr; }
  .route-view-actions { grid-template-columns: 1fr; }
}
`;
  }
  await writeFile(path, source, "utf8");
}

console.log("Fake coach prose replaced with verifiable engine facts and visual route playback.");
