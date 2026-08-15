import { readFile, writeFile } from "node:fs/promises";

const path = "index.html";
let source = await readFile(path, "utf8");
source = source.replace("<strong>实时教练</strong>\n                <span>每步解释关键原因</span>", "<strong>棋理分析</strong>\n                <span>只显示可验证证据</span>");
await writeFile(path, source, "utf8");
