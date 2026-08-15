import { readFile, writeFile } from "node:fs/promises";
const path = "app.js";
let source = await readFile(path, "utf8");
source = source.replace(
  "'<button class=\"button button-ghost route-preview-trigger\" data-route=\"your\">在棋盘查看你的路线</button>' +",
  "'<button class=\"button button-ghost route-preview-trigger\" data-route=\"your\">' + (coachAnalysis.selectedIsBest ? '在棋盘查看主变化' : '在棋盘查看你的路线') + '</button>' +",
);
source = source.replace(
  '  if (event.key === "Escape" && !notationModalElement?.classList.contains("hidden")) closeNotationLesson();',
  '  if (event.key === "Escape" && !notationModalElement?.classList.contains("hidden")) closeNotationLesson();\n  if (event.key === "Escape" && !routePreviewModalElement?.classList.contains("hidden")) closeRoutePreview();',
);
await writeFile(path, source, "utf8");
