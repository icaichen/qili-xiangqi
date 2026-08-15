import { readFile, writeFile } from "node:fs/promises";

// app.js
{
  const path = "app.js";
  let source = await readFile(path, "utf8");
  source = source.replace(
    `    coachContentElement.innerHTML = '<article class="coach-card neutral"><span class="card-kicker">等待走棋</span><h3>只在有证据时解释</h3><p>系统会检查失去保护、悬子、捉双、牵制、串打、马腿、象眼、炮架和开放线路。没有命中规则时不会编造原因。</p></article>';`,
    `    coachContentElement.innerHTML = '<article class="coach-card neutral beginner-empty"><span class="card-kicker">初学者教练</span><h3>走一步，我告诉你真正该看什么</h3><p>先判断这步有没有问题，再只讲一个最重要的原因，并用棋盘主变化演示。引擎分数和技术数据默认隐藏。</p></article>';`,
  );

  const start = source.indexOf('  const evidenceSection = coachAnalysis.hasVerifiedReason');
  const end = source.indexOf('\n\n  coachContentElement.innerHTML =', start);
  if (start < 0 || end < 0) throw new Error("Missing evidence section");
  const replacement = `  const evidenceSection = coachAnalysis.hasVerifiedReason\n    ? '<details class="engine-details verified-evidence-panel">' +\n        '<summary>查看这段分析用了哪些可验证证据</summary>' +\n        '<div class="verified-evidence-content">' +\n          verifiedFactsHtml(coachAnalysis.chosenFacts, '你的走法没有命中直接战术规则。') +\n          comparisonFactsHtml(coachAnalysis.deterministicDifferences) +\n          (coachAnalysis.bestFacts.length ? '<div class="evidence-subsection"><strong>首选着的可验证作用</strong>' + verifiedFactsHtml(coachAnalysis.bestFacts) + '</div>' : '') +\n          (coachAnalysis.replyFacts.length ? '<div class="evidence-subsection"><strong>对手回应中的明确威胁：' + coachAnalysis.opponentMove + '</strong>' + verifiedFactsHtml(coachAnalysis.replyFacts) + '</div>' : '') +\n          routeComparisonHtml(coachAnalysis.routeComparisons) +\n        '</div>' +\n      '</details>'\n    : '';`;
  source = source.slice(0, start) + replacement + source.slice(end);
  await writeFile(path, source, "utf8");
}

// styles.css
{
  const path = "styles.css";
  let source = await readFile(path, "utf8");
  const marker = "/* Beginner AI coach */";
  if (!source.includes(marker)) {
    source += `\n\n${marker}\n.beginner-verdict-card {\n  padding: 17px;\n}\n\n.beginner-judgment {\n  display: inline-flex;\n  margin-bottom: 9px;\n  padding: 5px 9px;\n  border-radius: 999px;\n  font-size: 10px;\n  font-weight: 800;\n}\n\n.beginner-judgment.good {\n  color: #226142;\n  background: #dfeee5;\n}\n\n.beginner-judgment.warning {\n  color: #8a5a20;\n  background: #f5ead6;\n}\n\n.beginner-judgment.danger {\n  color: #9a4035;\n  background: #f5dfda;\n}\n\n.ai-teacher-card {\n  border-color: rgba(35, 75, 59, 0.2);\n  background: linear-gradient(180deg, #f3f8f4 0%, #edf4ef 100%);\n}\n\n.ai-teacher-card.loading {\n  opacity: 0.84;\n}\n\n.ai-teacher-card > h3 {\n  font-size: 16px;\n  line-height: 1.45;\n}\n\n.teacher-section {\n  margin-top: 14px;\n  padding-top: 12px;\n  border-top: 1px solid rgba(35, 75, 59, 0.1);\n}\n\n.teacher-section > strong {\n  display: block;\n  margin-bottom: 5px;\n  color: #274b3b;\n  font-size: 11px;\n}\n\n.teacher-section p {\n  font-size: 13px;\n  line-height: 1.75;\n}\n\n.show-me-section .button {\n  width: 100%;\n  margin-top: 10px;\n}\n\n.teacher-memory {\n  margin-top: 15px;\n  padding: 12px;\n  border-radius: 12px;\n  background: #fff;\n  box-shadow: inset 0 0 0 1px rgba(35, 75, 59, 0.08);\n}\n\n.teacher-memory span {\n  display: block;\n  margin-bottom: 5px;\n  color: #8a7657;\n  font-size: 9px;\n  font-weight: 800;\n  letter-spacing: 0.12em;\n}\n\n.teacher-memory strong {\n  color: #2c3f35;\n  font-size: 12px;\n  line-height: 1.65;\n}\n\n.teacher-confidence {\n  margin-top: 10px;\n  color: #89928c;\n  font-size: 9px;\n}\n\n.verified-evidence-panel {\n  margin-top: 0;\n}\n\n.verified-evidence-content {\n  padding-top: 10px;\n}\n\n.beginner-empty h3 {\n  font-size: 15px;\n}\n\n.ai-unavailable {\n  border-style: dashed;\n}\n`;
  }
  await writeFile(path, source, "utf8");
}

console.log("Beginner coach UI polished.");
