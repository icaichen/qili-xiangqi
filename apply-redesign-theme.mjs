import { readFile, writeFile } from "node:fs/promises";
const url = new URL("./index.html", import.meta.url);
let html = await readFile(url, "utf8");
if (!html.includes('/redesign.css')) {
  html = html.replace('<link rel="stylesheet" href="/styles.css" />', '<link rel="stylesheet" href="/styles.css" />\n    <link rel="stylesheet" href="/redesign.css" />');
}
html = html.replace('<div class="brand-mark">棋</div>', '<div class="brand-mark">帅</div>');
html = html.replace('<span>在线中国象棋</span>', '<span>中国象棋 · XIANGQI</span>');
html = html.replace('下一盘，然后知道自己该练什么。', '每天进步一点点');
html = html.replace('棋理把对局、Pikafish 复盘、分级学习和针对训练连成一条路径。不是只给最佳着，而是长期找到你的薄弱点。', '下棋 → 找弱点 → 针对训练 → 学习 → 再下棋。把每一盘真正变成下一步该练什么。');
html = html.replace('<span>今日建议</span><strong>先完成一盘对局</strong>', '<span>今日棋局</span><strong>先下一盘，再开始学习</strong>');
await writeFile(url, html);
console.log('Xiangqi visual redesign linked');
