import { readFile, writeFile } from "node:fs/promises";

const curriculumPath = new URL("./xiangqi-teaching-curriculum.mjs", import.meta.url);
const appPath = new URL("./app.js", import.meta.url);

let curriculum = await readFile(curriculumPath, "utf8");
curriculum = curriculum.replace(
  'const value = Number(caseData?.engine?.gap ?? caseData?.engine?.evaluationGap ?? 0);',
  'const value = Number(caseData?.move?.gap ?? caseData?.engine?.gap ?? caseData?.engine?.evaluationGap ?? 0);',
);
await writeFile(curriculumPath, curriculum);

let app = await readFile(appPath, "utf8");
app = app.replace(
  '{ id: "board-position", text: "完整棋盘位置已提供；row 0 是黑方底线，row 9 是红方底线。" },',
  '{ id: "board-position", type: "board-position", text: "完整棋盘位置已提供；row 0 是黑方底线，row 9 是红方底线。" },',
);
app = app.replace(
  '{ id: "engine-choice", text: "你的走法：" + analysis.moveNotation + "；Pikafish首选：" + analysis.bestMove + "。" },',
  '{ id: "engine-choice", type: "engine-choice", text: "你的走法：" + analysis.moveNotation + "；Pikafish首选：" + analysis.bestMove + "。" },',
);
app = app.replace(
  '{ id: "engine-gap", text: "评价差：" + formatEngineScore(analysis.gap) + "；你的候选排名：" + (analysis.moveRank || "前五之外") + "。" },',
  '{ id: "engine-gap", type: "engine-gap", text: "评价差：" + formatEngineScore(analysis.gap) + "；你的候选排名：" + (analysis.moveRank || "前五之外") + "。" },',
);
app = app.replace(
  'id: prefix + "-" + (index + 1),\n      text: fact.title + "：" + fact.detail,',
  'id: prefix + "-" + (index + 1),\n      type: fact.type,\n      text: fact.title + "：" + fact.detail,',
);
app = app.replace(
  '(analysis.deterministicDifferences || []).forEach((text, index) => evidenceCatalog.push({ id: "difference-" + (index + 1), text }));',
  '(analysis.deterministicDifferences || []).forEach((text, index) => evidenceCatalog.push({ id: "difference-" + (index + 1), type: "comparison", text }));',
);
app = app.replace(
  '(analysis.routeComparisons || []).forEach((text, index) => evidenceCatalog.push({ id: "route-result-" + (index + 1), text }));',
  '(analysis.routeComparisons || []).forEach((text, index) => evidenceCatalog.push({ id: "route-result-" + (index + 1), type: text.includes("净失") ? "route-material-loss" : "route-material", text }));',
);
app = app.replace(
  'evidenceCatalog.push({ id: "signals-chosen", text: "你的走法后局面指标：" + JSON.stringify(analysis.signals?.chosen || {}) });',
  'evidenceCatalog.push({ id: "signals-chosen", type: "position-signals", text: "你的走法后局面指标：" + JSON.stringify(analysis.signals?.chosen || {}) });',
);
app = app.replace(
  'evidenceCatalog.push({ id: "signals-best", text: "首选着后局面指标：" + JSON.stringify(analysis.signals?.best || {}) });',
  'evidenceCatalog.push({ id: "signals-best", type: "position-signals", text: "首选着后局面指标：" + JSON.stringify(analysis.signals?.best || {}) });',
);
await writeFile(appPath, app);
console.log("Curriculum case wiring fixed.");
