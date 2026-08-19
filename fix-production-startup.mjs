import { readFile, writeFile } from "node:fs/promises";

const path = "app.js";
let source = await readFile(path, "utf8");

const replacements = [
  ["coachContentElement.addEventListener", "coachContentElement?.addEventListener"],
  ["newGameButtonElement.addEventListener", "newGameButtonElement?.addEventListener"],
  ["undoStepButtonElement.addEventListener", "undoStepButtonElement?.addEventListener"],
  ["undoButtonElement.addEventListener", "undoButtonElement?.addEventListener"],
  ["resumeButtonElement.addEventListener", "resumeButtonElement?.addEventListener"],
  ["flipButtonElement.addEventListener", "flipButtonElement?.addEventListener"],
  ["analysisToggleElement.addEventListener", "analysisToggleElement?.addEventListener"],
  ["moveHintsToggleElement.addEventListener", "moveHintsToggleElement?.addEventListener"],
  ["levelSelectElement.addEventListener", "levelSelectElement?.addEventListener"],
];

for (const [search, replacement] of replacements) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${search} expected once, found ${count}`);
  source = source.replace(search, replacement);
}

await writeFile(path, source, "utf8");
console.log(`Updated ${replacements.length} startup listeners in ${path}`);
