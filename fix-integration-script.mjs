import { readFile, writeFile } from "node:fs/promises";

const path = "apply-real-engine-integration.mjs";
let source = await readFile(path, "utf8");

const replacements = [
  [
    '  return `${pawns > 0 ? "+" : ""}${pawns.toFixed(2)}`;',
    '  return `\\${pawns > 0 ? "+" : ""}\\${pawns.toFixed(2)}`;',
  ],
  [
    '    engineStateElement.textContent = `连接失败：${engineError}`;',
    '    engineStateElement.textContent = "连接失败：" + engineError;',
  ],
  [
    '    summary: `${facts.join("；")}。${chosenScore == null ? "这步未进入引擎前五候选。" : `相比最佳着约损失 ${formatEngineScore(Math.max(0, gap))}。`}`,' ,
    '    summary: facts.join("；") + "。" + (chosenScore == null ? "这步未进入引擎前五候选。" : "相比最佳着约损失 " + formatEngineScore(Math.max(0, gap)) + "。"),',
  ],
  [
    '    bestReason: `${bestFacts.join("；")}。${variation ? `引擎主变化：${variation}。` : ""}`,' ,
    '    bestReason: bestFacts.join("；") + "。" + (variation ? "引擎主变化：" + variation + "。" : ""),',
  ],
  [
    '    engineStateElement.textContent = `引擎错误：${engineError}`;',
    '    engineStateElement.textContent = "引擎错误：" + engineError;',
  ],
  [
    '  evaluationDisplayElement.innerHTML = `<span>局势</span><strong>${label}</strong>`;',
    '  evaluationDisplayElement.innerHTML = `\\<span>局势</span><strong>\\${label}</strong>\\`;',
  ],
  [
    '  evaluationDisplayElement.innerHTML = `<span>${formatEngineScore(score)}</span><strong>${label}</strong>`;',
    '  evaluationDisplayElement.innerHTML = `\\<span>\\${formatEngineScore(score)}</span><strong>\\${label}</strong>\\`;',
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
console.log("Integration script syntax targets fixed.");
