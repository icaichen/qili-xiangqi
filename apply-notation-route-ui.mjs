import { readFile, writeFile } from "node:fs/promises";

const path = "app.js";
let source = await readFile(path, "utf8");

function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Missing target: ${label}`);
  source = source.replace(search, replacement);
}

replaceOnce(
  'const moveHintsToggleElement = document.querySelector("#moveHintsToggle");',
  'const moveHintsToggleElement = document.querySelector("#moveHintsToggle");\nconst notationBreakdownElement = document.querySelector("#notationBreakdown");',
  "notation element",
);

replaceOnce(
  '      opposite: OPPOSITE,\n    },',
  '      opposite: OPPOSITE,\n      generateLegalMoves,\n    },',
  "legal move adapter",
);

const renderStart = source.indexOf("function renderCoach()");
const renderEnd = source.indexOf("\nfunction render()", renderStart);
if (renderStart < 0 || renderEnd < 0) throw new Error("Missing renderCoach block");

const renderCoach = String.raw`function routeStepsHtml(steps) {
  if (!steps?.length) return '<li>引擎没有返回足够长的路线。</li>';
  return steps.slice(0, 5).map((step, index) =>
    '<li><strong>' + (index + 1) + '. ' + step.notation + '</strong>：' + step.explanation + '</li>'
  ).join('');
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

source = source.slice(0, renderStart) + renderCoach + source.slice(renderEnd);

replaceOnce(
  'moveHintsToggleElement.addEventListener("change", () => {',
  String.raw`function renderNotationLesson(notation = "车二进四", pieceType = "rook", color = "red") {
  if (!notationBreakdownElement) return;
  const chars = [...notation];
  const pieceName = chars[0] || "";
  const file = chars[1] || "";
  const action = chars[2] || "";
  const destination = chars[3] || "";
  const fileText = (color === "red" ? "红方第" : "黑方第") + file + "路；从走棋一方右侧数";
  const actionText = action === "进" ? "向对方方向移动" : action === "退" ? "向自己方向移动" : "横向移动";
  const usesDestinationFile = action === "平" || ["horse", "elephant", "advisor"].includes(pieceType);
  const destinationText = usesDestinationFile
    ? "落到第" + destination + "路"
    : "前进或后退" + destination + "个交叉点";
  const items = [
    [pieceName, "移动的棋子"],
    [file, fileText],
    [action, actionText],
    [destination, destinationText],
  ];
  notationBreakdownElement.innerHTML = items.map(([token, text]) =>
    '<div class="notation-token"><b>' + token + '</b><span>' + text + '</span></div>'
  ).join('');
}

document.querySelectorAll(".notation-example").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".notation-example").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderNotationLesson(button.dataset.notation, button.dataset.piece, button.dataset.color);
  });
});

moveHintsToggleElement.addEventListener("change", () => {`,
  "notation behavior",
);

replaceOnce(
  'render();\ninitializeEngine();',
  'render();\nrenderNotationLesson();\ninitializeEngine();',
  "notation init",
);

await writeFile(path, source, "utf8");
console.log("Notation UI and concrete route comparison connected.");
