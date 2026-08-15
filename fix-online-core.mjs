import { readFile, writeFile } from "node:fs/promises";
const path = new URL("./online-room-core.mjs", import.meta.url);
let text = await readFile(path, "utf8");
const marker = '  if (!color) throw Object.assign(new Error("Invalid player token"), { statusCode: 403 });\n';
if (!text.includes('const requiresActive = ["resign", "offerDraw", "acceptDraw", "declineDraw"]')) {
  text = text.replace(marker, marker + '  const requiresActive = ["resign", "offerDraw", "acceptDraw", "declineDraw"];\n  if (requiresActive.includes(body?.type) && room.status !== "active") throw Object.assign(new Error("Game is not active"), { statusCode: 409 });\n');
}
await writeFile(path, text);
console.log("Online action status guards added");
