import { readFile, writeFile } from "node:fs/promises";
const path = "upgrade-app-only.generated.mjs";
let source = await readFile(path, "utf8");
const oldBlock = '    `  moveCountElement.textContent = \\`${history.length} 手\\`;\n  undoButtonElement.disabled = history.length === 0 || locked;`,\n    `  moveCountElement.textContent = \\`${history.length} 手\\`;\n  undoStepButtonElement.disabled = history.length === 0 || locked;\n  undoButtonElement.disabled = history.length === 0 || locked;\n  resumeButtonElement.classList.toggle("hidden", !pausedAfterUndo);`,';
const newBlock = '    "  moveCountElement.textContent = `${history.length} 手`;\\n  undoButtonElement.disabled = history.length === 0 || locked;",\n    "  moveCountElement.textContent = `${history.length} 手`;\\n  undoStepButtonElement.disabled = history.length === 0 || locked;\\n  undoButtonElement.disabled = history.length === 0 || locked;\\n  resumeButtonElement.classList.toggle(\\\"hidden\\\", !pausedAfterUndo);",';
if (!source.includes(oldBlock)) throw new Error("history replacement block not found");
source = source.replace(oldBlock, newBlock);
await writeFile(path, source, "utf8");
