import { readFile, writeFile } from "node:fs/promises";

const path = "apply-real-engine-integration.mjs";
let source = await readFile(path, "utf8");

const replacements = [
  [
    '  return `\\${pawns > 0 ? "+" : ""}\\${pawns.toFixed(2)}`;',
    '  return (pawns > 0 ? "+" : "") + pawns.toFixed(2);',
  ],
  [
    '  evaluationDisplayElement.innerHTML = `\\<span>局势</span><strong>\\${label}</strong>\\`;',
    '  evaluationDisplayElement.innerHTML = "<span>局势</span><strong>" + label + "</strong>";',
  ],
  [
    '  evaluationDisplayElement.innerHTML = `\\<span>\\${formatEngineScore(score)}</span><strong>\\${label}</strong>\\`;',
    '  evaluationDisplayElement.innerHTML = "<span>" + formatEngineScore(score) + "</span><strong>" + label + "</strong>";',
  ],
];

for (const [search, replacement] of replacements) {
  if (!source.includes(search)) {
    console.error(`Missing target: ${search}`);
    process.exit(1);
  }
  source = source.replace(search, replacement);
}

await writeFile(path, source, "utf8");
console.log("Remaining integration templates replaced.");
