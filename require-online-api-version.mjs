import { readFile, writeFile } from "node:fs/promises";
const path = new URL("./start-local.mjs", import.meta.url);
let text = await readFile(path, "utf8");
const marker = 'if (existing?.configured) {\n';
if (!text.includes('Number(existing.apiVersion || 0) < 3')) {
  text = text.replace(marker, marker + '  if (Number(existing.apiVersion || 0) < 3) {\n    console.error("An older local service is already using port 8787. Stop that dev process and run npm run dev again to enable online multiplayer.");\n    process.exit(1);\n  }\n');
}
await writeFile(path, text);
console.log("Online API version guard added");
