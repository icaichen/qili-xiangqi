import { readFile, writeFile } from "node:fs/promises";

const htmlPath = new URL("./index.html", import.meta.url);
let html = await readFile(htmlPath, "utf8");

const htmlReplacements = [
  [
`<div class="platform-page-header"><div><span class="eyebrow">PROFILE · 我的</span><h1>你的棋手档案</h1><p>真人对局会自动进入独立 Rapid / Blitz 等级分，并永久记录每盘分数变化。</p></div><span id="profileAccountStatus">正在建立棋手身份…</span></div>`,
`<div class="platform-page-header"><div><span class="eyebrow">PROFILE · 我的</span><h1>你的棋手档案</h1><p>游客可以直接下棋；登录后，历史棋局与 Rapid / Blitz Rating 可以在其他设备恢复。</p></div><span id="profileAccountStatus">正在建立棋手身份…</span></div>`,
  ],
  [
`<div class="profile-identity-copy"><span class="eyebrow">棋手档案</span><h2 id="profileDisplayName">棋手</h2><p>匿名账户会保存在当前浏览器；账户 token 不会写入历史棋谱。</p></div>`,
`<div class="profile-identity-copy"><span class="eyebrow">棋手档案</span><h2 id="profileDisplayName">棋手</h2><p id="profileIdentityNote">游客身份只保存在当前浏览器。登录时会把当前历史棋局和 Rating 原地认领到正式账户。</p></div>`,
  ],
  [
`            <div class="profile-name-editor">
              <input id="profileNameInput" type="text" maxlength="24" value="棋手" autocomplete="nickname" aria-label="棋手昵称" />
              <button id="profileSaveName" class="button button-ghost">保存昵称</button>
              <small id="profileNameStatus"></small>
            </div>`,
`            <div class="profile-name-editor">
              <input id="profileNameInput" type="text" maxlength="24" value="棋手" autocomplete="nickname" aria-label="棋手昵称" />
              <button id="profileSaveName" class="button button-ghost">保存昵称</button>
              <small id="profileNameStatus"></small>
            </div>
            <div class="profile-auth-actions">
              <div>
                <button id="profileSignIn" class="button button-primary hidden">登录 / 注册</button>
                <button id="profileAddPasskey" class="button button-ghost hidden">添加 Passkey</button>
                <button id="profileSignOut" class="button button-ghost hidden">退出登录</button>
              </div>
              <small id="profileAuthStatus">正在检查登录服务…</small>
            </div>`,
  ],
  [
`    <script type="module" src="/app.js"></script>
    <script type="module" src="/identity-client.js"></script>`,
`    <script type="module" src="/app.js"></script>
    <script type="module" src="/auth-client.js"></script>
    <script type="module" src="/identity-client.js"></script>`,
  ],
];

for (const [before, after] of htmlReplacements) {
  if (!html.includes(before)) throw new Error(`HTML anchor not found: ${before.slice(0, 100)}`);
  html = html.replace(before, after);
}
await writeFile(htmlPath, html, "utf8");

const cssPath = new URL("./brand-v2.css", import.meta.url);
let css = await readFile(cssPath, "utf8");
const marker = "/* Registered account controls */";
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.profile-auth-actions {\n  grid-column: 2 / -1;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 14px;\n  padding-top: 14px;\n  border-top: 1px solid var(--brand-line);\n}\n.profile-auth-actions > div { display: flex; flex-wrap: wrap; gap: 8px; }\n.profile-auth-actions > small { color: var(--brand-muted); font-size: 10px; text-align: right; line-height: 1.5; }\n.profile-auth-actions .hidden { display: none !important; }\n@media (max-width: 1320px) {\n  .profile-auth-actions { grid-column: 1 / -1; align-items: flex-start; flex-direction: column; }\n  .profile-auth-actions > small { text-align: left; }\n}\n`;
  await writeFile(cssPath, css, "utf8");
}

console.log("Clerk profile UI added");
