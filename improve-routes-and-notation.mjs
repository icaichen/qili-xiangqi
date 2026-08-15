import { readFile, writeFile } from "node:fs/promises";

const root = process.cwd();

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Missing target: ${label}`);
  return source.replace(search, replacement);
}

// index.html
{
  const path = `${root}/index.html`;
  let source = await readFile(path, "utf8");
  source = replaceOnce(
    source,
    `<input id="moveHintsToggle" type="checkbox" checked />`,
    `<input id="moveHintsToggle" type="checkbox" />`,
    "move hints default",
  );
  source = replaceOnce(
    source,
    `<strong>棋盘候选箭头</strong>\n                <span>显示最佳、第二和第三候选着</span>`,
    `<strong>显示候选着</strong>\n                <span>开启后在棋盘显示最佳、第二和第三候选</span>`,
    "move hints wording",
  );
  source = replaceOnce(
    source,
    `          <section class="history-section">`,
    `          <details class="notation-guide" open>
            <summary>
              <span><strong>象棋记谱怎么读</strong><small>例如：车二进四</small></span>
              <span class="notation-chevron">⌄</span>
            </summary>
            <div class="notation-examples" role="group" aria-label="记谱示例">
              <button class="notation-example active" data-notation="车二进四" data-piece="rook" data-color="red">车二进四</button>
              <button class="notation-example" data-notation="马八进七" data-piece="horse" data-color="red">马八进七</button>
              <button class="notation-example" data-notation="炮2平5" data-piece="cannon" data-color="black">炮2平5</button>
            </div>
            <div id="notationBreakdown" class="notation-breakdown" aria-live="polite"></div>
            <p class="notation-rule">红方通常用中文数字，黑方通常用阿拉伯数字；纵线都从走棋一方的右侧开始数。</p>
          </details>

          <section class="history-section">`,
    "notation guide section",
  );
  await writeFile(path, source, "utf8");
}

// styles.css
{
  const path = `${root}/styles.css`;
  let source = await readFile(path, "utf8");
  source += `

.notation-guide {
  margin-top: 14px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.62);
  overflow: hidden;
}

.notation-guide summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 13px;
  cursor: pointer;
  list-style: none;
}

.notation-guide summary::-webkit-details-marker { display: none; }
.notation-guide summary span:first-child { display: flex; flex-direction: column; gap: 2px; }
.notation-guide summary strong { font-size: 12px; }
.notation-guide summary small { color: var(--muted); font-size: 10px; font-weight: 400; }
.notation-chevron { color: var(--muted); transition: transform 160ms ease; }
.notation-guide[open] .notation-chevron { transform: rotate(180deg); }

.notation-examples {
  display: flex;
  gap: 6px;
  padding: 0 12px 10px;
}

.notation-example {
  flex: 1;
  min-width: 0;
  padding: 7px 5px;
  border: 1px solid var(--line);
  border-radius: 9px;
  color: #59645d;
  background: rgba(247, 249, 246, 0.92);
  font-family: "Noto Serif SC", serif;
  font-size: 11px;
}

.notation-example.active {
  color: white;
  border-color: var(--green);
  background: var(--green);
}

.notation-breakdown {
  margin: 0 12px 10px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.notation-token {
  min-width: 0;
  padding: 8px 5px;
  border-radius: 9px;
  text-align: center;
  background: #f0f4f1;
}

.notation-token b {
  display: block;
  margin-bottom: 3px;
  color: var(--green);
  font-family: "Noto Serif SC", serif;
  font-size: 17px;
}

.notation-token span {
  display: block;
  color: #68736c;
  font-size: 9px;
  line-height: 1.35;
}

.notation-rule {
  margin: 0;
  padding: 0 12px 12px;
  color: var(--muted);
  font-size: 9px;
  line-height: 1.55;
}

.route-comparison {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.route-box {
  padding: 10px;
  border: 1px solid rgba(31, 45, 37, 0.1);
  border-radius: 10px;
  background: rgba(245, 248, 245, 0.82);
}

.route-box.best { border-color: rgba(35, 122, 82, 0.25); background: rgba(231, 242, 235, 0.76); }
.route-box strong { display: block; margin-bottom: 5px; font-size: 11px; }
.route-sequence { color: #334139; font-family: "Noto Serif SC", serif; font-size: 11px; line-height: 1.65; }
.route-steps { margin: 7px 0 0; padding-left: 18px; color: #68736c; font-size: 10px; line-height: 1.55; }
.route-evidence { margin-top: 8px; padding: 9px 10px; border-radius: 10px; background: #f4efe6; color: #67543b; font-size: 10px; line-height: 1.55; }
`;
  await writeFile(path, source, "utf8");
}

// coach-tools.js
{
  const path = `${root}/coach-tools.js`;
  let source = await readFile(path, "utf8");
  source = source.replace(
    `  if (!sentences.length) sentences.push("没有立刻得子或将军，价值主要取决于后续路线");`,
    `  if (!sentences.length) sentences.push("没有立即出现吃子或将军；需要查看下方列出的具体主变化，才能判断这步的长期效果");`,
  );

  const oldRoute = source.slice(source.indexOf("function routeExplanation"), source.indexOf("function buildCoachAnalysis"));
  if (!oldRoute.startsWith("function routeExplanation")) throw new Error("Missing routeExplanation block");
  const newRoute = `function routeData(sourceBoard, pv, adapters, limit = 6) {
  let working = adapters.cloneBoard(sourceBoard);
  const steps = [];
  for (const uci of (pv || []).slice(0, limit)) {
    const move = adapters.uciToMove(uci, working);
    if (!move) break;
    const notation = adapters.formatMove(move, working);
    const facts = immediateFacts(working, move, adapters);
    steps.push({ notation, explanation: facts.sentences.join("；"), concrete: facts.concrete });
    working = adapters.applyMove(working, move).board;
  }
  return {
    sequence: steps.map((step) => step.notation).join(" → "),
    steps,
    finalBoard: working,
  };
}

function positionEvidence(chosenBoard, bestBoard, moverColor, adapters) {
  if (!adapters.generateLegalMoves) return "当前只能确认两条路线的引擎评价不同，尚没有足够的可验证局面指标说明单一原因。";
  const opponent = adapters.opposite[moverColor];
  const chosenMobility = adapters.generateLegalMoves(chosenBoard, moverColor).length;
  const bestMobility = adapters.generateLegalMoves(bestBoard, moverColor).length;
  const chosenOpponentMobility = adapters.generateLegalMoves(chosenBoard, opponent).length;
  const bestOpponentMobility = adapters.generateLegalMoves(bestBoard, opponent).length;
  const chosenExposed = attackedPieces(chosenBoard, moverColor, opponent, adapters);
  const bestExposed = attackedPieces(bestBoard, moverColor, opponent, adapters);
  const evidence = [];

  if (bestMobility >= chosenMobility + 4) evidence.push(\`最佳着后你有\${bestMobility}个合法选择，比你的路线多\${bestMobility - chosenMobility}个，子力更容易展开\`);
  if (bestOpponentMobility + 4 <= chosenOpponentMobility) evidence.push(\`最佳着把对手的合法选择从\${chosenOpponentMobility}个压到\${bestOpponentMobility}个，限制更强\`);
  if (bestExposed.length < chosenExposed.length) evidence.push(\`最佳着后受攻击的己方棋子更少（\${bestExposed.length}个，对比你的路线\${chosenExposed.length}个）\`);
  if (!evidence.length) return "在可直接检查的活动度和受攻关系上，两条路线差异很小；引擎偏好主要来自更深层的后续变化，而不是眼前单一战术。";
  return evidence.join("；") + "。";
}

`;
  source = source.replace(oldRoute, newRoute);

  const start = source.indexOf("function buildCoachAnalysis");
  const end = source.indexOf("\nwindow.XiangqiCoachTools", start);
  if (start < 0 || end < 0) throw new Error("Missing buildCoachAnalysis block");
  const newBuild = `function buildCoachAnalysis({ sourceBoard, move, beforeAnalysis, afterAnalysis, adapters }) {
  const chosenUci = adapters.moveToUci(move);
  const lines = beforeAnalysis.lines.filter((line) => line.parsedMove);
  const bestLine = lines[0];
  const selectedLine = lines.find((line) => line.move === chosenUci);
  const bestMove = bestLine?.parsedMove ?? move;
  const bestScore = bestLine?.numericScore ?? 0;
  const afterScore = -(afterAnalysis.lines[0]?.numericScore ?? 0);
  const chosenScore = selectedLine?.numericScore ?? afterScore;
  const gap = Math.max(0, bestScore - chosenScore);
  const quality = gap < 30 ? "good" : gap < 100 ? "inaccuracy" : "mistake";

  const chosenFacts = immediateFacts(sourceBoard, move, adapters);
  const bestFacts = immediateFacts(sourceBoard, bestMove, adapters);
  const replyLine = afterAnalysis.lines.find((line) => line.parsedMove) ?? afterAnalysis.lines[0];
  const replyMove = replyLine?.parsedMove;
  const replyFacts = replyMove ? immediateFacts(chosenFacts.board, replyMove, adapters) : null;
  const chosenPv = selectedLine?.pv?.length ? selectedLine.pv : [chosenUci, ...(replyLine?.pv || [])];
  const chosenRoute = routeData(sourceBoard, chosenPv, adapters, 6);
  const bestRoute = routeData(sourceBoard, bestLine?.pv || [], adapters, 6);
  const evidence = positionEvidence(chosenFacts.board, bestFacts.board, chosenFacts.moving.color, adapters);

  const replyNotation = replyMove ? adapters.formatMove(replyMove, chosenFacts.board) : "未返回明确应对";
  const replyText = replyFacts
    ? \`对手最强回应是\${replyNotation}：\${replyFacts.sentences.join("；")}。\`
    : "引擎没有返回可展示的对手应对。";

  let avoidReason;
  if (gap < 30) {
    avoidReason = \`这两步在当前搜索深度下基本等价，差值只有\${formatScore(gap)}。不要把它理解成你的走法错误；Pikafish只是略微偏好另一条具体变化。\`;
  } else if (replyFacts?.concrete) {
    avoidReason = \`引擎降低你这步的评价，最直接的证据是\${replyNotation}这手回应。你的路线比最佳路线约差\${formatScore(gap)}。\`;
  } else {
    avoidReason = \`你的路线比最佳路线约差\${formatScore(gap)}，但前几步没有单一的强制战术。下面会同时列出两条具体路线，并说明能验证到的局面差异。\`;
  }

  const confidence = replyFacts?.concrete || chosenFacts.concrete || bestFacts.concrete
    ? "高：有具体战术或受攻关系支持"
    : "中：来自具体主变化与可验证局面指标";

  return {
    quality,
    title: quality === "good" ? "这步基本成立" : quality === "inaccuracy" ? "这步可下，但有更准确的路线" : "这步给了对手更强的反击机会",
    whatHappened: \`你走\${adapters.formatMove(move, sourceBoard)}后，\${chosenFacts.sentences.join("；")}。\`,
    opponentMove: replyNotation,
    opponentReply: replyText,
    bestMove: adapters.formatMove(bestMove, sourceBoard),
    bestReason: \`Pikafish更喜欢\${adapters.formatMove(bestMove, sourceBoard)}：\${bestFacts.sentences.join("；")}。\`,
    avoidReason,
    yourSequence: chosenRoute.sequence || "主变化不足",
    bestSequence: bestRoute.sequence || "主变化不足",
    yourSteps: chosenRoute.steps,
    bestSteps: bestRoute.steps,
    evidence,
    principle: replyFacts?.concrete
      ? "判断一手棋不能只看它做了什么，还要先找到对手最强、最强制的回应。"
      : "安静局面要比较两条具体路线，而不是用“后续更好”这类无法验证的空话。",
    confidence,
    engineDetail: \`最佳路线 \${formatScore(bestScore)}；你的路线 \${formatScore(chosenScore)}；差值 \${formatScore(gap)}；搜索深度 \${bestLine?.depth ?? beforeAnalysis.depth ?? "—"}。\`,
    candidates: lines.slice(0, 4).map((line) => ({
      notation: adapters.formatMove(line.parsedMove, sourceBoard),
      score: formatScore(line.numericScore),
      loss: formatScore(Math.max(0, bestScore - line.numericScore)),
      selected: line.move === chosenUci,
    })),
  };
}
`;
  source = source.slice(0, start) + newBuild + source.slice(end);
  await writeFile(path, source, "utf8");
}

// app.js
{
  const path = `${root}/app.js`;
  let source = await readFile(path, "utf8");
  source = replaceOnce(
    source,
    `const moveHintsToggleElement = document.querySelector("#moveHintsToggle");`,
    `const moveHintsToggleElement = document.querySelector("#moveHintsToggle");
const notationBreakdownElement = document.querySelector("#notationBreakdown");`,
    "notation element",
  );
  source = replaceOnce(
    source,
    `      opposite: OPPOSITE,`,
    `      opposite: OPPOSITE,\n      generateLegalMoves,`,
    "legal move adapter",
  );

  const renderStart = source.indexOf("function renderCoach()");
  const renderEnd = source.indexOf("\nfunction render()", renderStart);
  if (renderStart < 0 || renderEnd < 0) throw new Error("Missing renderCoach");
  const newRenderCoach = `function routeStepsHtml(steps) {
  if (!steps?.length) return '<li>引擎没有返回足够长的路线。</li>';
  return steps.slice(0, 5).map((step, index) => '<li><strong>' + (index + 1) + '. ' + step.notation + '</strong>：' + step.explanation + '</li>').join('');
}

function renderCoach() {
  if (!analysisToggleElement.checked) {
    coachContentElement.innerHTML = '<article class="coach-card neutral"><span class="card-kicker">实时教练已关闭</span><h3>你可以先独立思考</h3><p>重新打开后，系统会比较你的路线、最佳路线和对手最强回应。</p></article>';
    return;
  }

  if (!coachAnalysis) {
    coachContentElement.innerHTML = '<article class="coach-card neutral"><span class="card-kicker">教练提示</span><h3>先走一步，再比较两条具体路线</h3><p>系统会列出你的走法之后和最佳着之后的实际主变化，不再只说“后续路线更好”。</p></article><article class="coach-card principle"><span class="card-kicker">解释原则</span><h3>战术讲确定事实，战略讲证据强度</h3><p>能确认的将军、吃子和受攻关系会直接说明；安静局面会展示双方实际变化和可验证指标。</p></article>';
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
      '<span class="card-kicker">对手会怎样回应</span><h3>' + coachAnalysis.opponentMove + '</h3><p>' + coachAnalysis.opponentReply + '</p>' +
    '</article>' +
    '<article class="coach-card good">' +
      '<span class="card-kicker">为什么最佳着更好</span><h3>' + coachAnalysis.bestMove + '</h3><p>' + coachAnalysis.bestReason + '</p>' +
      '<p>' + coachAnalysis.avoidReason + '</p>' +
      '<div class="route-comparison">' +
        '<div class="route-box"><strong>你的具体路线</strong><div class="route-sequence">' + coachAnalysis.yourSequence + '</div><ol class="route-steps">' + routeStepsHtml(coachAnalysis.yourSteps) + '</ol></div>' +
        '<div class="route-box best"><strong>Pikafish最佳路线</strong><div class="route-sequence">' + coachAnalysis.bestSequence + '</div><ol class="route-steps">' + routeStepsHtml(coachAnalysis.bestSteps) + '</ol></div>' +
      '</div>' +
      '<div class="route-evidence"><strong>目前能验证的差异：</strong>' + coachAnalysis.evidence + '</div>' +
      '<div class="candidate-list">' + candidates + '</div>' +
    '</article>' +
    '<article class="coach-card principle">' +
      '<span class="card-kicker">下次记住</span><h3>把路线转化为判断方法</h3><p>' + coachAnalysis.principle + '</p>' +
      '<span class="confidence">解释可信度：' + coachAnalysis.confidence + '</span>' +
      '<details class="engine-details"><summary>查看引擎细节</summary><p>' + coachAnalysis.engineDetail + '</p></details>' +
    '</article>';
}
`;
  source = source.slice(0, renderStart) + newRenderCoach + source.slice(renderEnd);

  source = replaceOnce(
    source,
    `moveHintsToggleElement?.addEventListener("change", () => {`,
    `function renderNotationLesson(notation = "车二进四", pieceType = "rook", color = "red") {
  if (!notationBreakdownElement) return;
  const chars = [...notation];
  const [pieceName = "", file = "", action = "", destination = ""] = chars;
  const fileText = (color === "red" ? "红方第" : "黑方第") + file + "路；从走棋一方右侧数";
  const actionText = action === "进" ? "向对方方向移动" : action === "退" ? "向自己方向移动" : "横向移动";
  let destinationText;
  if (action === "平" || ["horse", "elephant", "advisor"].includes(pieceType)) {
    destinationText = "落到第" + destination + "路";
  } else {
    destinationText = "前进或后退" + destination + "个交叉点";
  }
  const items = [
    [pieceName, "移动的棋子"],
    [file, fileText],
    [action, actionText],
    [destination, destinationText],
  ];
  notationBreakdownElement.innerHTML = items.map(([token, text]) => '<div class="notation-token"><b>' + token + '</b><span>' + text + '</span></div>').join('');
}

document.querySelectorAll(".notation-example").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".notation-example").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderNotationLesson(button.dataset.notation, button.dataset.piece, button.dataset.color);
  });
});

moveHintsToggleElement?.addEventListener("change", () => {`,
    "notation behavior",
  );
  source = replaceOnce(
    source,
    `render();
initializeEngine();`,
    `render();
renderNotationLesson();
initializeEngine();`,
    "notation init",
  );
  await writeFile(path, source, "utf8");
}

console.log("Concrete route comparison and notation lesson added.");
