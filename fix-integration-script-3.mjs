import { readFile, writeFile } from "node:fs/promises";

const path = "apply-real-engine-integration.mjs";
let source = await readFile(path, "utf8");

const oldBlock = `  source = replaceOnce(
    source,
    '<option value="beginner">入门 · 随机应对</option>\\n               <option value="intermediate" selected>进阶 · 战术优先</option>\\n               <option value="advanced">高手 · 两层搜索</option>',
    '<option value="beginner">入门 · Pikafish 浅层</option>\\n               <option value="intermediate" selected>进阶 · Pikafish 标准</option>\\n               <option value="advanced">高手 · Pikafish 深度分析</option>',
    "difficulty labels",
  );`;

const newBlock = `  source = replaceOnce(source, '<option value="beginner">入门 · 随机应对</option>', '<option value="beginner">入门 · Pikafish 浅层</option>', "beginner label");
  source = replaceOnce(source, '<option value="intermediate" selected>进阶 · 战术优先</option>', '<option value="intermediate" selected>进阶 · Pikafish 标准</option>', "intermediate label");
  source = replaceOnce(source, '<option value="advanced">高手 · 两层搜索</option>', '<option value="advanced">高手 · Pikafish 深度分析</option>', "advanced label");`;

if (!source.includes(oldBlock)) throw new Error("Difficulty patch block not found");
source = source.replace(oldBlock, newBlock);
source = source.replace("await patchServer();\nawait patchIndex();", "await patchIndex();");

await writeFile(path, source, "utf8");
console.log("Integration script updated for current files.");
