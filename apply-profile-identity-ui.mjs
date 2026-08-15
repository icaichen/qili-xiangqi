import { readFile, writeFile } from "node:fs/promises";

const htmlPath = new URL("./index.html", import.meta.url);
let html = await readFile(htmlPath, "utf8");

const startNeedle = '      <section id="profileView" class="platform-view platform-page hidden">';
const start = html.indexOf(startNeedle);
if (start < 0) throw new Error("profileView start not found");
const end = html.indexOf("      </section>", start);
if (end < 0) throw new Error("profileView end not found");
const endPos = end + "      </section>".length;

const profile = `      <section id="profileView" class="platform-view platform-page hidden">
        <div class="platform-page-header"><div><span class="eyebrow">PROFILE · 我的</span><h1>你的棋手档案</h1><p>每一盘真人棋都会属于这个身份。Rating 下一步接入，这里先只显示真实数据。</p></div><span id="profileAccountStatus">正在建立棋手身份…</span></div>
        <div class="profile-grid">
          <article class="platform-surface profile-identity">
            <div class="profile-avatar">帅</div>
            <div class="profile-identity-copy"><span class="eyebrow">棋手档案</span><h2 id="profileDisplayName">棋手</h2><p>匿名账户会保存在当前浏览器；账户 token 不会写入历史棋谱。</p></div>
            <div class="profile-name-editor">
              <input id="profileNameInput" type="text" maxlength="24" value="棋手" autocomplete="nickname" aria-label="棋手昵称" />
              <button id="profileSaveName" class="button button-ghost">保存昵称</button>
              <small id="profileNameStatus"></small>
            </div>
          </article>
          <article class="platform-surface profile-stat"><span>平台棋力</span><strong>—</strong><small>Rating 下一步接入</small></article>
          <article class="platform-surface profile-stat"><span>完成真人对局</span><strong id="profileGameCount">0</strong><small>来自永久棋谱数据库</small></article>
          <article class="platform-surface ability-card"><div><span class="eyebrow">能力画像</span><h2>不是一个总分，而是六项能力</h2></div><div class="ability-empty"><span>将军识别</span><span>吃子判断</span><span>保护意识</span><span>交换判断</span><span>杀法计算</span><span>布局基础</span></div><p>有足够真实对局后才显示能力百分比，不使用虚构数据。</p></article>
          <article class="platform-surface recent-games-card profile-history-card">
            <div class="profile-history-head"><div><span class="eyebrow">最近对局</span><h2>真人历史棋局</h2></div><button class="button button-ghost platform-jump" data-target-view="online">再下一盘</button></div>
            <div id="profileRecentGames" class="profile-history-list"><div class="profile-history-empty"><strong>正在读取历史棋局…</strong></div></div>
          </article>
        </div>
      </section>`;

html = html.slice(0, start) + profile + html.slice(endPos);

const onlineScript = '    <script type="module" src="/online-client.js"></script>';
if (!html.includes(onlineScript)) throw new Error("online client script not found");
html = html.replace(onlineScript, '    <script type="module" src="/identity-client.js"></script>\n' + onlineScript);
await writeFile(htmlPath, html, "utf8");

const cssPath = new URL("./brand-v2.css", import.meta.url);
let css = await readFile(cssPath, "utf8");
const marker = "/* Identity + real game history */";
if (!css.includes(marker)) {
  css += `\n\n${marker}
.profile-identity {
  grid-column: span 2;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(260px, 340px);
  align-items: center;
  gap: 18px;
}
.profile-identity-copy h2 { margin: 3px 0 5px; font-size: 24px; }
.profile-identity-copy p { margin: 0; font-size: 12px; line-height: 1.6; }
.profile-name-editor { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; }
.profile-name-editor input {
  width: 100%;
  min-height: 40px;
  padding: 9px 11px;
  border: 1px solid var(--brand-line);
  border-radius: 9px;
  color: var(--brand-text);
  background: #fff;
  font: inherit;
}
.profile-name-editor small { grid-column: 1 / -1; min-height: 16px; color: var(--brand-muted); font-size: 10px; }
.profile-history-card { grid-column: 1 / -1; }
.profile-history-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.profile-history-head h2 { margin: 3px 0 0; font-size: 20px; }
.profile-history-list { display: grid; border-top: 1px solid var(--brand-line); }
.profile-history-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 13px 2px;
  border-bottom: 1px solid var(--brand-line);
}
.profile-result { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; color: #fff; font-size: 12px; font-weight: 850; }
.profile-result.win { background: var(--brand-jade); }
.profile-result.loss { background: var(--brand-red); }
.profile-result.draw { color: #333; background: var(--brand-yellow); }
.profile-history-row strong { display: block; font-size: 13px; }
.profile-history-row small { display: block; margin-top: 3px; color: var(--brand-muted); font-size: 10px; }
.profile-history-meta { text-align: right; }
.profile-history-meta span { color: #47433d; font-size: 11px; font-weight: 700; }
.profile-history-empty { padding: 26px 2px; color: var(--brand-muted); }
.profile-history-empty strong { color: var(--brand-text); font-size: 13px; }
.profile-history-empty p { margin: 5px 0 0; font-size: 11px; }
@media (max-width: 1320px) {
  .profile-identity { grid-template-columns: auto 1fr; }
  .profile-name-editor { grid-column: 1 / -1; }
}
`;
  await writeFile(cssPath, css, "utf8");
}

console.log("profile identity UI ready");
