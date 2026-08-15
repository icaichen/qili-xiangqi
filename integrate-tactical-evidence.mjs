import { readFile, writeFile } from "node:fs/promises";

const root = process.cwd();

function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`Missing range: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

{
  const path = `${root}/app.js`;
  let source = await readFile(path, "utf8");
  const replacement = `function candidateRowsHtml(candidates) {
  return candidates.map((candidate) =>
    '<div class="candidate-row"><span class="candidate-rank">' + candidate.rank + '</span><strong>' + candidate.notation + (candidate.selected ? ' · 你的选择' : '') + '</strong><span class="candidate-score">' + candidate.score + '</span></div>'
  ).join('');
}

function verifiedFactsHtml(facts, emptyText = "没有命中可验证规则。") {
  if (!facts?.length) return '<div class="verified-empty">' + emptyText + '</div>';
  return '<div class="verified-fact-list">' + facts.map((entry) =>
    '<article class="verified-fact ' + entry.severity + '">' +
      '<div class="verified-fact-heading"><strong>' + entry.title + '</strong><span>' + entry.confidence + '</span></div>' +
      '<p>' + entry.detail + '</p>' +
    '</article>'
  ).join('') + '</div>';
}

function comparisonFactsHtml(items) {
  if (!items?.length) return '';
  return '<div class="verified-differences">' + items.map((item) => '<p>' + item + '</p>').join('') + '</div>';
}

function routeComparisonHtml(items) {
  if (!items?.length) return '';
  return '<div class="route-material-summary"><strong>当前主变化中的子力结果</strong>' + items.map((item) => '<p>' + item + '</p>').join('') + '</div>';
}

function renderCoach() {
  if (!analysisToggleElement.checked) {
    coachContentElement.innerHTML = '<article class="coach-card neutral"><span class="card-kicker">实时分析已关闭</span><h3>独立思考模式</h3><p>打开后只显示确定性规则命中的棋理证据，以及折叠的原始引擎数据。</p></article>';
    return;
  }

  if (!coachAnalysis) {
    coachContentElement.innerHTML = '<article class="coach-card neutral"><span class="card-kicker">等待走棋</span><h3>只在有证据时解释</h3><p>系统会检查失去保护、悬子、捉双、牵制、串打、马腿、象眼、炮架和开放线路。没有命中规则时不会编造原因。</p></article>';
    return;
  }

  const qualityClass = coachAnalysis.quality === "good" ? "good" : "warning";
  const rankText = coachAnalysis.moveRank ? '第 ' + coachAnalysis.moveRank + ' 候选' : '未进入前五候选';
  const routeButtons =
    '<div class="route-view-actions">' +
      '<button class="button button-ghost route-preview-trigger" data-route="your">' + (coachAnalysis.selectedIsBest ? '在棋盘查看主变化' : '在棋盘查看你的路线') + '</button>' +
      (coachAnalysis.sameRoute ? '' : '<button class="button button-primary route-preview-trigger" data-route="best">在棋盘查看首选路线</button>') +
    '</div>';

  const evidenceSection = coachAnalysis.hasVerifiedReason
    ? '<article class="coach-card evidence-card">' +
        '<span class="card-kicker">确定性分析</span><h3>这步命中的棋理证据</h3>' +
        verifiedFactsHtml(coachAnalysis.chosenFacts, '你的走法没有命中直接战术规则。') +
        comparisonFactsHtml(coachAnalysis.deterministicDifferences) +
        (coachAnalysis.bestFacts.length ? '<div class="evidence-subsection"><strong>首选着的可验证作用</strong>' + verifiedFactsHtml(coachAnalysis.bestFacts) + '</div>' : '') +
        (coachAnalysis.replyFacts.length ? '<div class="evidence-subsection"><strong>对手回应中的明确威胁：' + coachAnalysis.opponentMove + '</strong>' + verifiedFactsHtml(coachAnalysis.replyFacts) + '</div>' : '') +
        routeComparisonHtml(coachAnalysis.routeComparisons) +
      '</article>'
    : '<article class="coach-card neutral no-evidence-card">' +
        '<span class="card-kicker">未发现确定性原因</span><h3>当前没有命中可验证战术规则</h3>' +
        '<p>Pikafish给出了排名和分数，但没有提供人类可读原因。这里不会把主变化本身冒充成解释。</p>' +
      '</article>';

  coachContentElement.innerHTML =
    '<article class="coach-card ' + qualityClass + '">' +
      '<span class="card-kicker">引擎比较</span>' +
      '<h3>' + coachAnalysis.moveNotation + ' · ' + rankText + '</h3>' +
      '<p>' + coachAnalysis.verdict + '</p>' +
      '<div class="engine-fact-grid">' +
        '<div><span>你的评价</span><strong>' + formatEngineScore(coachAnalysis.chosenScore) + '</strong></div>' +
        '<div><span>首选评价</span><strong>' + formatEngineScore(coachAnalysis.bestScore) + '</strong></div>' +
        '<div><span>评价差</span><strong>' + formatEngineScore(coachAnalysis.gap) + '</strong></div>' +
      '</div>' +
    '</article>' +
    evidenceSection +
    '<details class="engine-details raw-engine-panel">' +
      '<summary>查看Pikafish原始数据与主变化</summary>' +
      '<div class="raw-engine-content">' +
        '<p><strong>对手首选回应：</strong>' + coachAnalysis.rawEngine.opponentMove + '</p>' +
        '<p><strong>你的路线：</strong>' + coachAnalysis.rawEngine.yourSequence + '</p>' +
        (coachAnalysis.sameRoute ? '' : '<p><strong>首选路线：</strong>' + coachAnalysis.rawEngine.bestSequence + '</p>') +
        routeButtons +
        '<div class="candidate-list">' + candidateRowsHtml(coachAnalysis.candidates) + '</div>' +
        '<p class="engine-detail-line">' + coachAnalysis.engineDetail + '</p>' +
      '</div>' +
    '</details>';
}

`;
  source = replaceRange(source, "function candidateRowsHtml(candidates) {", "function render() {", replacement, "coach renderer");
  await writeFile(path, source, "utf8");
}

{
  const path = `${root}/index.html`;
  let source = await readFile(path, "utf8");
  source = source.replace("<h2>为什么？</h2>", "<h2>棋理证据</h2>");
  source = source.replace(
    '<span class="card-kicker">教练提示</span>\n              <h3>不只告诉你最佳着法</h3>\n              <p>走出第一步后，我会解释你的意图、潜在问题，以及更好的候选方案。</p>',
    '<span class="card-kicker">确定性分析</span>\n              <h3>只展示可验证证据</h3>\n              <p>没有命中战术规则时，不会生成“为什么”的文字解释。</p>',
  );
  await writeFile(path, source, "utf8");
}

{
  const path = `${root}/styles.css`;
  let source = await readFile(path, "utf8");
  if (!source.includes(".verified-fact-list")) {
    source += `

.verified-fact-list {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.verified-fact {
  padding: 11px 12px;
  border: 1px solid rgba(35, 75, 59, 0.15);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
}

.verified-fact.warning {
  border-color: rgba(166, 67, 53, 0.22);
  background: rgba(255, 246, 243, 0.9);
}

.verified-fact-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 5px;
}

.verified-fact-heading strong {
  font-size: 12px;
}

.verified-fact-heading span {
  color: #748079;
  font-size: 9px;
  font-weight: 700;
}

.verified-fact p,
.verified-differences p,
.route-material-summary p,
.raw-engine-content p {
  margin: 0;
}

.verified-empty {
  margin-top: 9px;
  padding: 10px 12px;
  border-radius: 11px;
  color: #6f7972;
  background: rgba(255, 255, 255, 0.62);
  font-size: 11px;
}

.verified-differences {
  display: grid;
  gap: 6px;
  margin-top: 10px;
  padding: 10px 12px;
  border-left: 3px solid #a84f40;
  border-radius: 0 10px 10px 0;
  background: rgba(255, 255, 255, 0.62);
}

.verified-differences p {
  color: #66443d;
  font-size: 11px;
  line-height: 1.55;
}

.evidence-subsection {
  display: grid;
  gap: 7px;
  margin-top: 13px;
  padding-top: 12px;
  border-top: 1px solid rgba(35, 75, 59, 0.12);
  font-size: 11px;
}

.route-material-summary {
  display: grid;
  gap: 5px;
  margin-top: 12px;
  padding: 11px 12px;
  border-radius: 11px;
  background: #f8f3e8;
}

.route-material-summary p {
  color: #695a43;
  font-size: 11px;
  line-height: 1.55;
}

.raw-engine-panel {
  margin-top: 0;
}

.raw-engine-content {
  display: grid;
  gap: 9px;
  padding-top: 10px;
}

.raw-engine-content p {
  overflow-wrap: anywhere;
  color: #68736c;
  font-size: 10px;
  line-height: 1.6;
}

.engine-detail-line {
  padding-top: 8px;
  border-top: 1px solid rgba(31, 45, 37, 0.08);
}
`;
  }
  await writeFile(path, source, "utf8");
}

console.log("Tactical evidence UI integrated.");
