import { readFile, writeFile } from "node:fs/promises";

const htmlPath = new URL("./index.html", import.meta.url);
let html = await readFile(htmlPath, "utf8");
const replacements = [
  [
    '        <div class="platform-page-header"><div><span class="eyebrow">PROFILE · 我的</span><h1>你的棋手档案</h1><p>每一盘真人棋都会属于这个身份。Rating 下一步接入，这里先只显示真实数据。</p></div><span id="profileAccountStatus">正在建立棋手身份…</span></div>',
    '        <div class="platform-page-header"><div><span class="eyebrow">PROFILE · 我的</span><h1>你的棋手档案</h1><p>真人对局会自动进入独立 Rapid / Blitz 等级分，并永久记录每盘分数变化。</p></div><span id="profileAccountStatus">正在建立棋手身份…</span></div>',
  ],
  [
    '          <article class="platform-surface profile-stat"><span>平台棋力</span><strong>—</strong><small>Rating 下一步接入</small></article>\n          <article class="platform-surface profile-stat"><span>完成真人对局</span><strong id="profileGameCount">0</strong><small>来自永久棋谱数据库</small></article>',
    '          <article class="platform-surface profile-stat rating-stat"><span>Rapid</span><strong id="profileRapidRating">1200</strong><small id="profileRapidMeta">初始 1200 · 尚无定级对局</small></article>\n          <article class="platform-surface profile-stat rating-stat"><span>Blitz</span><strong id="profileBlitzRating">1200</strong><small id="profileBlitzMeta">初始 1200 · 尚无定级对局</small></article>\n          <article class="platform-surface profile-stat"><span>完成真人对局</span><strong id="profileGameCount">0</strong><small>来自永久棋谱数据库</small></article>',
  ],
];
for (const [before, after] of replacements) {
  if (!html.includes(before)) throw new Error(`Expected profile snippet not found: ${before.slice(0, 120)}`);
  html = html.replace(before, after);
}
await writeFile(htmlPath, html, "utf8");

const cssPath = new URL("./brand-v2.css", import.meta.url);
let css = await readFile(cssPath, "utf8");
const marker = "/* Rating UI */";
if (!css.includes(marker)) {
  css += `\n\n${marker}
.rating-stat strong { font-variant-numeric: tabular-nums; }
.rating-stat small { line-height: 1.45; }
.rating-delta { font-variant-numeric: tabular-nums; }
.profile-history-meta .rating-delta.up { color: var(--brand-jade); }
.profile-history-meta .rating-delta.down { color: var(--brand-red); }
.profile-history-meta .rating-delta.flat { color: var(--brand-muted); }
`;
  await writeFile(cssPath, css, "utf8");
}

console.log("rating profile UI ready");
