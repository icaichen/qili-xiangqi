import { readFile, writeFile } from "node:fs/promises";

const path = "app.js";
let source = await readFile(path, "utf8");

function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Missing target: ${label}`);
  source = source.replace(search, replacement);
}

replaceOnce(
  'let routePreviewState = { route: null, index: 0, title: "" };',
  'let routePreviewState = { route: null, index: 0, title: "" };\nlet aiCoachConfigured = false;\nlet aiCoachServerAvailable = false;\nlet aiCoachModel = "";\nlet aiCoachRequestId = 0;',
  "AI coach state",
);

replaceOnce(
  '    engineConnected = true;\n    engineError = null;\n    engineStateElement.textContent = health.ready ? "Pikafish 已连接" : "Pikafish 已就绪";',
  '    engineConnected = true;\n    engineError = null;\n    aiCoachServerAvailable = Number(health.apiVersion || 0) >= 2;\n    aiCoachConfigured = Boolean(health.coach?.configured);\n    aiCoachModel = health.coach?.model || "";\n    engineStateElement.textContent = health.ready ? "Pikafish 已连接" : "Pikafish 已就绪";',
  "coach health state",
);

replaceOnce(
  'function renderCoach() {',
  `function compactBoardForAi(sourceBoard) {\n  return sourceBoard.map((row) => row.map((entry) => entry ? entry.color + \":\" + entry.type + \":\" + entry.label : null));\n}\n\nfunction buildAiCoachCase(analysis) {\n  const evidenceCatalog = [\n    { id: \"board-position\", text: \"完整棋盘位置已提供；row 0 是黑方底线，row 9 是红方底线。\" },\n    { id: \"engine-choice\", text: \"你的走法：\" + analysis.moveNotation + \"；Pikafish首选：\" + analysis.bestMove + \"。\" },\n    { id: \"engine-gap\", text: \"评价差：\" + formatEngineScore(analysis.gap) + \"；你的候选排名：\" + (analysis.moveRank || \"前五之外\") + \"。\" },\n  ];\n\n  const addFacts = (prefix, facts) => {\n    (facts || []).forEach((fact, index) => evidenceCatalog.push({\n      id: prefix + \"-\" + (index + 1),\n      text: fact.title + \"：\" + fact.detail,\n    }));\n  };\n  addFacts(\"chosen-fact\", analysis.chosenFacts);\n  addFacts(\"best-fact\", analysis.bestFacts);\n  addFacts(\"reply-fact\", analysis.replyFacts);\n  (analysis.deterministicDifferences || []).forEach((text, index) => evidenceCatalog.push({ id: \"difference-\" + (index + 1), text }));\n  (analysis.routeComparisons || []).forEach((text, index) => evidenceCatalog.push({ id: \"route-result-\" + (index + 1), text }));\n  evidenceCatalog.push({ id: \"signals-chosen\", text: \"你的走法后局面指标：\" + JSON.stringify(analysis.signals?.chosen || {}) });\n  evidenceCatalog.push({ id: \"signals-best\", text: \"首选着后局面指标：\" + JSON.stringify(analysis.signals?.best || {}) });\n\n  const routeForAi = (route, prefix) => (route?.steps || []).slice(0, 8).map((step, index) => {\n    const id = prefix + \"-\" + (index + 1);\n    const text = step.notation + (step.facts?.length ? \"；确定事实：\" + step.facts.map((fact) => fact.title + \"（\" + fact.detail + \"）\").join(\"；\") : \"\");\n    evidenceCatalog.push({ id, text });\n    return { id, notation: step.notation, facts: step.facts?.map((fact) => ({ type: fact.type, title: fact.title, detail: fact.detail })) || [] };\n  });\n\n  return {\n    move: {\n      notation: analysis.moveNotation,\n      bestMove: analysis.bestMove,\n      selectedIsBest: analysis.selectedIsBest,\n      rank: analysis.moveRank,\n      gap: analysis.gap,\n      raw: analysis.moveRaw,\n      bestRaw: analysis.bestMoveRaw,\n    },\n    engine: {\n      chosenScore: analysis.chosenScore,\n      bestScore: analysis.bestScore,\n      opponentMove: analysis.opponentMove,\n    },\n    board: compactBoardForAi(analysis.sourceBoard),\n    signals: analysis.signals || {},\n    routes: {\n      your: routeForAi(analysis.routes?.your, \"your-route\"),\n      best: routeForAi(analysis.routes?.best, \"best-route\"),\n    },\n    evidenceCatalog,\n  };\n}\n\nfunction requestAiCoachExplanation(analysis) {\n  const requestId = ++aiCoachRequestId;\n  if (!aiCoachServerAvailable) {\n    analysis.aiCoach = { state: \"unavailable\", reason: \"restart\" };\n    renderCoach();\n    return;\n  }\n  if (!aiCoachConfigured) {\n    analysis.aiCoach = { state: \"unavailable\", reason: \"key\" };\n    renderCoach();\n    return;\n  }\n\n  analysis.aiCoach = { state: \"loading\" };\n  renderCoach();\n  engineClient.explainCoach(buildAiCoachCase(analysis)).then((result) => {\n    if (requestId !== aiCoachRequestId || coachAnalysis !== analysis) return;\n    analysis.aiCoach = { state: \"ready\", ...result };\n    renderCoach();\n  }).catch((error) => {\n    if (requestId !== aiCoachRequestId || coachAnalysis !== analysis) return;\n    analysis.aiCoach = { state: \"error\", message: error instanceof Error ? error.message : \"AI教练请求失败\" };\n    renderCoach();\n  });\n}\n\nfunction beginnerVerdictHtml(analysis) {\n  if (analysis.selectedIsBest) return '<span class=\"beginner-judgment good\">这步很好</span><h3>' + analysis.moveNotation + ' 就是当前首选</h3><p>这一步不用纠正。下面只看它最值得你理解的棋理。</p>';\n  if (analysis.gap < 30) return '<span class=\"beginner-judgment good\">这步没错</span><h3>' + analysis.moveNotation + ' 可以下</h3><p>它和 ' + analysis.bestMove + ' 的评价非常接近。重点不是记住“唯一答案”，而是理解两种选择有什么不同。</p>';\n  if (analysis.gap < 100) return '<span class=\"beginner-judgment warning\">可以下，但有更准确的选择</span><h3>先比较 ' + analysis.moveNotation + ' 和 ' + analysis.bestMove + '</h3><p>你的走法没有立刻输棋，但首选着更稳或更主动。下面只解释最重要的区别。</p>';\n  return '<span class=\"beginner-judgment danger\">这步需要注意</span><h3>' + analysis.bestMove + ' 明显更好</h3><p>这次不是小差别。先看你的走法给了对手什么机会，再看首选着怎么避免。</p>';\n}\n\nfunction aiCoachHtml(analysis) {\n  const ai = analysis.aiCoach;\n  if (!ai || ai.state === \"loading\") {\n    return '<article class=\"coach-card ai-teacher-card loading\"><span class=\"card-kicker\">AI 教练 · 初学者模式</span><h3>正在把计算翻译成棋理…</h3><p>不是复述主变化，而是在比较两条路线里最值得你学的一件事。</p></article>';\n  }\n  if (ai.state === \"unavailable\") {\n    const message = ai.reason === \"restart\"\n      ? '本地引擎服务还是旧版本。重启 npm run dev 后才会出现 AI 教练接口。'\n      : 'AI 教练接口已经接好，但服务器没有 GEMINI_API_KEY。Pikafish 和确定性分析仍可正常使用。';\n    return '<article class=\"coach-card neutral ai-unavailable\"><span class=\"card-kicker\">AI 教练未启用</span><h3>目前只能显示可验证分析</h3><p>' + message + '</p></article>';\n  }\n  if (ai.state === \"error\") {\n    return '<article class=\"coach-card warning\"><span class=\"card-kicker\">AI 教练请求失败</span><h3>这次只保留确定性分析</h3><p>' + ai.message + '</p></article>';\n  }\n\n  const routeKey = analysis.selectedIsBest || analysis.sameRoute ? \"your\" : \"best\";\n  const confidenceLabel = ai.confidence === \"high\" ? \"高\" : ai.confidence === \"medium\" ? \"中\" : \"低\";\n  return '<article class=\"coach-card ai-teacher-card\">' +\n    '<span class=\"card-kicker\">AI 教练 · 初学者模式</span>' +\n    '<h3>' + ai.headline + '</h3>' +\n    '<div class=\"teacher-section\"><strong>为什么？</strong><p>' + ai.coreReason + '</p></div>' +\n    '<div class=\"teacher-section\"><strong>和另一手差在哪里？</strong><p>' + ai.comparison + '</p></div>' +\n    '<div class=\"teacher-section show-me-section\"><strong>给我看</strong><p>' + ai.showMe + '</p><button class=\"button button-primary route-preview-trigger\" data-route=\"' + routeKey + '\">在棋盘上走给我看</button></div>' +\n    '<div class=\"teacher-memory\"><span>下次记住</span><strong>' + ai.remember + '</strong></div>' +\n    '<div class=\"teacher-confidence\">解释置信度：' + confidenceLabel + (ai.status === \"uncertain\" ? ' · AI明确标记为不确定' : '') + '</div>' +\n  '</article>';\n}\n\nfunction renderCoach() {`,
  "AI coach helpers",
);

const oldRenderCore = `  const qualityClass = coachAnalysis.quality === "good" ? "good" : "warning";\n  const rankText = coachAnalysis.moveRank ? '第 ' + coachAnalysis.moveRank + ' 候选' : '未进入前五候选';`;
replaceOnce(
  oldRenderCore,
  `  const qualityClass = coachAnalysis.quality === \"good\" ? \"good\" : \"warning\";\n  const rankText = coachAnalysis.moveRank ? '第 ' + coachAnalysis.moveRank + ' 候选' : '未进入前五候选';`,
  "render preamble normalization",
);

replaceOnce(
  `  coachContentElement.innerHTML =\n    '<article class="coach-card ' + qualityClass + '">' +\n      '<span class="card-kicker">引擎比较</span>' +\n      '<h3>' + coachAnalysis.moveNotation + ' · ' + rankText + '</h3>' +\n      '<p>' + coachAnalysis.verdict + '</p>' +\n      '<div class="engine-fact-grid">' +\n        '<div><span>你的评价</span><strong>' + formatEngineScore(coachAnalysis.chosenScore) + '</strong></div>' +\n        '<div><span>首选评价</span><strong>' + formatEngineScore(coachAnalysis.bestScore) + '</strong></div>' +\n        '<div><span>评价差</span><strong>' + formatEngineScore(coachAnalysis.gap) + '</strong></div>' +\n      '</div>' +\n    '</article>' +\n    evidenceSection +\n    '<details class="engine-details raw-engine-panel">' +`,
  `  coachContentElement.innerHTML =\n    '<article class="coach-card beginner-verdict-card ' + qualityClass + '">' + beginnerVerdictHtml(coachAnalysis) + '</article>' +\n    aiCoachHtml(coachAnalysis) +\n    evidenceSection +\n    '<details class="engine-details raw-engine-panel">' +`,
  "beginner render top",
);

replaceOnce(
  `      '<div class="raw-engine-content">' +\n        '<p><strong>对手首选回应：</strong>' + coachAnalysis.rawEngine.opponentMove + '</p>' +`,
  `      '<div class="raw-engine-content">' +\n        '<div class="engine-fact-grid">' +\n          '<div><span>你的评价</span><strong>' + formatEngineScore(coachAnalysis.chosenScore) + '</strong></div>' +\n          '<div><span>首选评价</span><strong>' + formatEngineScore(coachAnalysis.bestScore) + '</strong></div>' +\n          '<div><span>评价差</span><strong>' + formatEngineScore(coachAnalysis.gap) + '</strong></div>' +\n        '</div>' +\n        '<p><strong>候选排名：</strong>' + rankText + '</p>' +\n        '<p><strong>对手首选回应：</strong>' + coachAnalysis.rawEngine.opponentMove + '</p>' +`,
  "move engine facts into details",
);

replaceOnce(
  `      coachAnalysis = buildCoachAnalysis(sourceBoard, move, before, after);\n      engineEvaluationCp = -(after.lines[0]?.numericScore ?? 0);\n      renderCoach();`,
  `      coachAnalysis = buildCoachAnalysis(sourceBoard, move, before, after);\n      engineEvaluationCp = -(after.lines[0]?.numericScore ?? 0);\n      requestAiCoachExplanation(coachAnalysis);\n      renderCoach();`,
  "request AI explanation",
);

await writeFile(path, source, "utf8");
console.log("Beginner AI coach UI integrated.");
