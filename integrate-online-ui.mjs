import { readFile, writeFile } from "node:fs/promises";

const htmlPath = new URL("./index.html", import.meta.url);
const appPath = new URL("./app.js", import.meta.url);

let html = await readFile(htmlPath, "utf8");

if (!html.includes('id="openOnlinePlayButton"')) {
  html = html.replace(
    '<p class="level-note">这是训练用估算等级，不等同于天天象棋或其他平台积分。</p>',
    '<p class="level-note">这是训练用估算等级，不等同于天天象棋或其他平台积分。</p>\n' +
    '            <button id="openOnlinePlayButton" class="button button-primary action-wide online-entry-button">真人在线对弈</button>'
  );
}

if (!html.includes('id="onlineView"')) {
  const onlineView = `
      <section id="onlineView" class="platform-view platform-page online-page hidden">
        <div class="platform-page-header online-page-header">
          <div>
            <span class="eyebrow">LIVE · 真人在线</span>
            <h1>和真人下一盘</h1>
            <p>快速匹配，或者把房间码发给朋友。每一步都由服务器重新验证。</p>
          </div>
          <button id="onlineBackToComputer" class="button button-ghost">返回人机对弈</button>
        </div>

        <section id="onlineLobby" class="online-lobby">
          <div class="platform-surface online-lobby-card online-lobby-main">
            <span class="eyebrow">开始对局</span>
            <h2>真人对弈</h2>
            <label class="online-field">
              <span>你的名字</span>
              <input id="onlineDisplayName" type="text" maxlength="24" value="棋手" autocomplete="nickname" />
            </label>
            <label class="online-field">
              <span>时间制</span>
              <select id="onlineTimeControl">
                <option value="600+0">10 + 0 · 快棋</option>
                <option value="600+5">10 + 5 · 加秒</option>
                <option value="300+3">5 + 3 · 快速</option>
              </select>
            </label>
            <div class="online-primary-actions">
              <button id="onlineQuickMatch" class="button button-primary">快速匹配</button>
              <button id="onlineCancelMatch" class="button button-ghost">取消匹配</button>
            </div>
            <p id="onlineStatus" class="online-status">选择一种方式开始。</p>
          </div>

          <div class="online-lobby-side">
            <article class="platform-surface online-lobby-card">
              <span class="eyebrow">私人房间</span>
              <h3>创建房间</h3>
              <p>创建后会得到一个房间码，对方输入即可加入。</p>
              <button id="onlineCreateRoom" class="button button-ghost action-wide">创建房间</button>
            </article>
            <article class="platform-surface online-lobby-card">
              <span class="eyebrow">加入房间</span>
              <h3>输入房间码</h3>
              <div class="online-room-join">
                <input id="onlineRoomCode" type="text" maxlength="10" placeholder="例如 A1B2C3D4E5" />
                <button id="onlineJoinRoom" class="button button-secondary">加入</button>
              </div>
            </article>
          </div>
        </section>

        <section id="onlineGame" class="online-game hidden">
          <div class="online-game-layout">
            <aside class="platform-surface online-player-column">
              <div class="online-player-card black">
                <div class="online-player-token">将</div>
                <div><span>黑方</span><strong id="onlineBlackName">等待对手</strong></div>
                <b id="onlineBlackClock" class="online-clock">10:00</b>
              </div>
              <div class="online-room-meta">
                <span>房间</span>
                <strong id="onlineRoomCodeDisplay">—</strong>
                <button id="onlineCopyRoomCode" class="button button-ghost">复制房间码</button>
              </div>
              <div class="online-player-card red">
                <div class="online-player-token">帅</div>
                <div><span>红方</span><strong id="onlineRedName">红方</strong></div>
                <b id="onlineRedClock" class="online-clock">10:00</b>
              </div>
            </aside>

            <section class="platform-surface online-board-column">
              <div id="onlineGameState" class="online-game-state">等待对局开始</div>
              <div class="online-xiangqi-board" aria-label="真人中国象棋棋盘">
                <div class="online-board-river"><span>楚 河</span><span>汉 界</span></div>
                <div id="onlineBoardPoints"></div>
              </div>
              <div class="online-game-actions">
                <button id="onlineOfferDraw" class="button button-ghost">求和</button>
                <button id="onlineResign" class="button button-ghost">认输</button>
                <button id="onlineReturnLobby" class="button button-secondary">返回大厅</button>
              </div>
              <div id="onlineDrawOffer" class="online-draw-offer hidden">
                <strong>对手请求和棋</strong>
                <div>
                  <button id="onlineAcceptDraw" class="button button-primary">同意</button>
                  <button id="onlineDeclineDraw" class="button button-ghost">拒绝</button>
                </div>
              </div>
            </section>

            <aside class="platform-surface online-side-panel">
              <span class="eyebrow">对局记录</span>
              <h2>着法</h2>
              <div id="onlineMoveList" class="online-move-list">
                <div class="online-empty">还没有走子</div>
              </div>
              <div class="online-server-note">
                <strong>服务器裁判</strong>
                <p>走子、轮次和时钟由服务器决定。刷新页面会自动尝试回到本局。</p>
              </div>
            </aside>
          </div>
        </section>
      </section>
`;
  html = html.replace(
    '      <section id="trainView" class="platform-view platform-page hidden">',
    onlineView + '\n      <section id="trainView" class="platform-view platform-page hidden">'
  );
}

if (!html.includes('/online.css')) {
  html = html.replace(
    '<link rel="stylesheet" href="/brand-v2.css" />',
    '<link rel="stylesheet" href="/brand-v2.css" />\n    <link rel="stylesheet" href="/online.css" />'
  );
}
if (!html.includes('/online-client.js')) {
  html = html.replace(
    '<script type="module" src="/app.js"></script>',
    '<script type="module" src="/app.js"></script>\n    <script type="module" src="/online-client.js"></script>'
  );
}
await writeFile(htmlPath, html);

let app = await readFile(appPath, "utf8");
if (!app.includes('online: document.querySelector("#onlineView")')) {
  app = app.replace(
    'profile: document.querySelector("#profileView"),',
    'profile: document.querySelector("#profileView"),\n  online: document.querySelector("#onlineView"),'
  );
}
if (!app.includes('const navTarget = target === "online" ? "play" : target;')) {
  app = app.replace(
    'const target = platformViews[viewName] ? viewName : "home";\n  Object.entries(platformViews).forEach(([name, element]) => element?.classList.toggle("hidden", name !== target));\n  document.querySelectorAll(".platform-nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === target));\n  document.querySelector(".play-only-action")?.classList.toggle("hidden", target !== "play");\n  quickPlayButtonElement?.classList.toggle("hidden", target === "play");',
    'const target = platformViews[viewName] ? viewName : "home";\n  const navTarget = target === "online" ? "play" : target;\n  Object.entries(platformViews).forEach(([name, element]) => element?.classList.toggle("hidden", name !== target));\n  document.querySelectorAll(".platform-nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === navTarget));\n  document.querySelector(".play-only-action")?.classList.toggle("hidden", target !== "play");\n  quickPlayButtonElement?.classList.toggle("hidden", target === "play" || target === "online");'
  );
}
if (!app.includes('window.XiangqiPlatform = { switchView: switchPlatformView };')) {
  app = app.replace(
    'document.querySelectorAll(".platform-nav-item").forEach((item) => item.addEventListener("click", () => switchPlatformView(item.dataset.view)));',
    'window.XiangqiPlatform = { switchView: switchPlatformView };\n\ndocument.querySelectorAll(".platform-nav-item").forEach((item) => item.addEventListener("click", () => switchPlatformView(item.dataset.view)));'
  );
}
await writeFile(appPath, app);
console.log("Online multiplayer UI integrated");
