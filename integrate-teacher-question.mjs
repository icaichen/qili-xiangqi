import { readFile, writeFile } from "node:fs/promises";

const appPath = new URL("./app.js", import.meta.url);
const stylesPath = new URL("./styles.css", import.meta.url);

let app = await readFile(appPath, "utf8");
const oldBlock = `  const routeKey = analysis.selectedIsBest || analysis.sameRoute ? "your" : "best";\n  const confidenceLabel = ai.confidence === "high" ? "高" : ai.confidence === "medium" ? "中" : "低";\n  return '<article class="coach-card ai-teacher-card">' +\n    '<span class="card-kicker">AI 教练 · 初学者模式</span>' +\n    '<h3>' + ai.headline + '</h3>' +\n    '<div class="teacher-section"><strong>为什么？</strong><p>' + ai.coreReason + '</p></div>' +`;
const newBlock = `  const routeKey = analysis.selectedIsBest || analysis.sameRoute ? "your" : "best";\n  const confidenceLabel = ai.confidence === "high" ? "高" : ai.confidence === "medium" ? "中" : "低";\n  const lessonFocus = ai.teaching?.focus?.concept || "看清这一手的直接作用";\n  const lessonLevel = ai.teaching?.stage?.level ? ai.teaching.stage.level + "级重点" : "基础重点";\n  return '<article class="coach-card ai-teacher-card">' +\n    '<span class="card-kicker">AI 教练 · 初学者模式</span>' +\n    '<div class="teacher-focus"><span>' + lessonLevel + '</span><strong>' + lessonFocus + '</strong></div>' +\n    '<h3>' + ai.headline + '</h3>' +\n    '<div class="teacher-question"><span>先看棋盘</span><strong>' + ai.question + '</strong></div>' +\n    '<div class="teacher-section"><strong>答案与原因</strong><p>' + ai.coreReason + '</p></div>' +`;

if (!app.includes(oldBlock)) throw new Error("AI coach render block not found");
app = app.replace(oldBlock, newBlock);
await writeFile(appPath, app);

let styles = await readFile(stylesPath, "utf8");
styles += `\n\n.teacher-focus {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin-bottom: 12px;\n}\n\n.teacher-focus span {\n  flex: 0 0 auto;\n  padding: 4px 7px;\n  border-radius: 999px;\n  background: rgba(35, 75, 59, 0.09);\n  color: #42604f;\n  font-size: 9px;\n  font-weight: 800;\n}\n\n.teacher-focus strong {\n  color: #445249;\n  font-size: 11px;\n}\n\n.teacher-question {\n  margin: 12px 0;\n  padding: 13px 14px;\n  border: 1px solid rgba(168, 120, 54, 0.2);\n  border-radius: 13px;\n  background: #fbf6ea;\n}\n\n.teacher-question span {\n  display: block;\n  margin-bottom: 5px;\n  color: #9a7947;\n  font-size: 9px;\n  font-weight: 800;\n  letter-spacing: 0.08em;\n}\n\n.teacher-question strong {\n  color: #473f33;\n  font-size: 13px;\n  line-height: 1.55;\n}\n`;
await writeFile(stylesPath, styles);
console.log("Teacher question flow integrated.");
