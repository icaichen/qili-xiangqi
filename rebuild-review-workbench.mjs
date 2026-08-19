import { readFile, writeFile, unlink } from "node:fs/promises";

const path = new URL("./identity-client.js", import.meta.url);
let source = await readFile(path, "utf8");

function replaceBetween(startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Missing end marker: ${endMarker}`);
  source = source.slice(0, start) + replacement + "\n\n" + source.slice(end);
}

function replaceOnce(before, after) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Expected one match, got ${count}: ${before.slice(0, 80)}`);
  source = source.replace(before, after);
}

replaceOnce(
  "let reviewDeepRequestId = 0;\nlet reviewRequestId = 0;",
  "let reviewDeepRequestId = 0;\nlet reviewRequestId = 0;\nlet activeReviewPly = null;\nlet reviewRoutePlayback = null;",
);

replaceBetween("function ensureReviewStyles() {", "function prepareReviewShell() {", `function ensureReviewStyles() {
  if (document.querySelector("#qiliReviewStyles")) return;
  const style = document.createElement("style");
  style.id = "qiliReviewStyles";
  style.textContent = \`
    #reviewDropzone.platform-page{max-width:1720px;margin:0 auto;padding:0 2px 28px}
    .review-workbench-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:12px;padding:18px 20px;border:1px solid rgba(132,91,50,.12);border-radius:10px;background:rgba(255,249,239,.82)}
    .review-workbench-head h1{margin:3px 0 4px;font-size:26px}.review-workbench-head p{margin:0;color:#7d7062;font-size:11px}.review-workbench-head>span{padding:6px 10px;border-radius:999px;background:#f1e4d1;color:#795e42;font-size:10px;font-weight:800}
    .review-workbench{display:grid;grid-template-columns:minmax(210px,250px) minmax(540px,1fr) minmax(340px,420px);gap:12px;align-items:start}
    .review-rail,.review-board-stage,.review-coach-panel{min-width:0}.review-board-stage,.review-coach-panel{position:sticky;top:12px}
    .review-rail{display:grid;gap:10px}.review-rail-block{padding:16px}.review-rail-block h2{margin:4px 0 6px;font-size:17px}.review-rail-block>p{margin:0;color:#8a7d70;font-size:10px;line-height:1.55}
    .review-game-list,.review-turn-list{display:grid;gap:7px;margin-top:12px}.review-game-list{max-height:220px;overflow:auto}.review-turn-list{max-height:calc(100vh - 430px);overflow:auto}
    .review-game-row,.review-turn-row{width:100%;border:1px solid rgba(86,67,49,.1);border-radius:8px;background:#fbf7ef;padding:10px 11px;text-align:left;color:inherit;font:inherit;display:grid;gap:3px;transition:.14s ease;cursor:pointer}
    .review-game-row:hover,.review-turn-row:hover{border-color:#d4b894;background:#fffaf2}.review-game-row.active,.review-turn-row.active{border-color:#b67a54;background:#f7eadb;box-shadow:inset 3px 0 0 #a33d31}
    .review-game-row strong,.review-turn-row strong{font-size:11px}.review-game-row small,.review-turn-row small{color:#8d8175;font-size:9px;line-height:1.45}
    .review-turn-row{grid-template-columns:34px 1fr;align-items:center}.review-turn-rank{width:28px;height:28px;display:grid;place-items:center;border-radius:50%;background:#f0dfce;color:#963b2f;font-size:9px;font-weight:900}.review-turn-main{display:grid;gap:2px}
    .review-results.hidden{display:none!important}.review-results-head h2{margin:4px 0 3px}.review-results-head p{margin:0;color:#8a7d70;font-size:9px;line-height:1.5}.review-empty{padding:13px;border-radius:8px;background:#f7f3ec;color:#82786d;font-size:10px;line-height:1.6}
    .review-board-stage{padding:16px;background:#fffaf1}.review-stage-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:10px}.review-stage-copy strong,.review-stage-copy span{display:block}.review-stage-copy strong{font-size:15px}.review-stage-copy span{margin-top:3px;color:#8a7c6e;font-size:10px;line-height:1.45}
    .review-key-nav{display:flex;align-items:center;gap:7px}.review-key-nav button{border:1px solid #ddc7aa;border-radius:7px;padding:7px 9px;background:#fff7e9;color:#6c5642;font:inherit;font-size:10px;cursor:pointer}.review-key-nav button:disabled{opacity:.35;cursor:default}.review-key-nav span{min-width:42px;text-align:center;color:#7a6a5a;font-size:10px;font-weight:800}
    .review-xiangqi-board{position:relative;width:min(100%,690px);aspect-ratio:8/9;margin:0 auto;border:8px solid #b98046;border-radius:6px;background:repeating-linear-gradient(0deg,rgba(112,70,30,.035) 0 1px,transparent 1px 4px),linear-gradient(135deg,#edc986,#ddb16a 55%,#e7bf79);box-shadow:inset 0 0 0 2px #f4d99f,inset 0 0 28px rgba(113,65,26,.14),0 14px 26px rgba(90,57,29,.18);user-select:none}
    .review-board-lines,.review-board-points{position:absolute;inset:6.2%;width:87.6%;height:87.6%}.review-board-lines{overflow:visible}.review-board-lines line{stroke:#68421f;stroke-width:1.5;opacity:.76;vector-effect:non-scaling-stroke}.review-board-lines text{fill:#68411e;font-family:\"Noto Serif SC\",serif;font-size:38px;font-weight:700;letter-spacing:.22em;text-anchor:middle}
    .review-board-point{position:absolute;width:10.4%;aspect-ratio:1;transform:translate(-50%,-50%);display:grid;place-items:center;border:0;border-radius:50%;padding:0;background:transparent}.review-board-point.active-from::after,.review-board-point.active-to::after{content:\"\";position:absolute;inset:4%;border-radius:50%;z-index:1}.review-board-point.active-from::after{background:rgba(53,119,184,.18)}.review-board-point.active-to::after{background:rgba(163,61,49,.23)}
    .review-board-piece{position:absolute;inset:5%;z-index:2;display:grid;place-items:center;border:2px solid currentColor;border-radius:50%;background:radial-gradient(circle at 34% 28%,#fff3cf 0%,#eccb8a 60%,#cf9b52 100%);box-shadow:inset 0 0 0 2px rgba(255,245,214,.72),0 3px 7px rgba(83,47,20,.28);font-family:\"Noto Serif SC\",serif;font-size:clamp(15px,2vw,28px);font-weight:700;line-height:1}.review-board-piece.red{color:#aa3025}.review-board-piece.black{color:#3b2f26}
    .review-route-dock{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;padding:10px 12px;border:1px solid #e4cfb2;border-radius:8px;background:#f9efdf}.review-route-dock.hidden{display:none!important}.review-route-dock-copy span,.review-route-dock-copy strong{display:block}.review-route-dock-copy span{color:#948473;font-size:9px}.review-route-dock-copy strong{margin-top:2px;font-size:11px}.review-route-controls{display:flex;align-items:center;gap:6px}.review-route-controls button{border:1px solid #d8bea0;border-radius:6px;padding:6px 9px;background:#fff9ef;color:#674f3c;font:inherit;font-size:10px;cursor:pointer}.review-route-controls button:disabled{opacity:.35}.review-route-controls b{min-width:40px;text-align:center;font-size:10px}
    .review-coach-panel{padding:20px;max-height:calc(100vh - 24px);overflow:auto}.review-coach-panel.hidden{display:block!important}.review-coach-panel h2{margin:5px 0 14px;font-size:21px}.review-why-loading{padding:15px;border-radius:8px;background:#f7f3ec;color:#756c62;font-size:11px;line-height:1.7}
    .review-move-compare{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}.review-move-compare>div{padding:11px;border:1px solid #ead7bd;border-radius:8px;background:#fcf5e9}.review-move-compare span,.review-move-compare strong{display:block}.review-move-compare span{color:#958675;font-size:9px}.review-move-compare strong{margin-top:4px;font-size:13px}.review-move-compare .better{border-color:#cdddcf;background:#f0f6f1;color:#315e49}
    .review-why-section{padding:13px 0;border-top:1px solid rgba(95,70,45,.11)}.review-why-section>span{display:block;margin-bottom:6px;color:#8d3229;font-size:9px;font-weight:900;letter-spacing:.08em}.review-why-section p{margin:0;color:#51483f;font-size:12px;line-height:1.75}.review-why-section.remember{padding:12px;border:1px solid #ead7bd;border-radius:8px;background:#fbf2e4}.review-why-section.remember>span{color:#7a654e}
    .review-route-choice{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.review-route-choice button{width:100%}.review-confidence,.review-evidence-line{margin-top:9px;color:#978a7c;font-size:9px;line-height:1.5}
    @media(max-width:1280px){.review-workbench{grid-template-columns:220px minmax(500px,1fr) 340px}.review-board-stage{position:relative;top:auto}.review-coach-panel{position:relative;top:auto;max-height:none}}
    @media(max-width:980px){.review-workbench{grid-template-columns:1fr}.review-rail{grid-template-columns:1fr 1fr}.review-board-stage,.review-coach-panel{position:relative;top:auto}.review-turn-list,.review-game-list{max-height:230px}.review-coach-panel{max-height:none}}
  \`;
  document.head.appendChild(style);
}`);

replaceBetween("function prepareReviewShell() {", "function renderReviewBoard(board, highlightMove = null, flipped = false) {", `function prepareReviewShell() {
  if (reviewShellReady) return;
  const root = document.querySelector("#reviewDropzone");
  if (!root) return;
  reviewShellReady = true;
  ensureReviewStyles();
  root.classList.remove("review-dropzone");
  root.classList.add("platform-page");
  root.innerHTML = \`
    <div class="review-workbench-head">
      <div><span class="eyebrow">REVIEW · 实战复盘</span><h1>复盘一盘棋，不是读一份报告</h1><p>棋盘保持在眼前。一次只看一个关键局面，再理解为什么。</p></div>
      <span id="reviewEngineStatus">选择一盘棋</span>
    </div>
    <div class="review-workbench">
      <aside class="review-rail">
        <section class="platform-surface review-rail-block">
          <span class="eyebrow">棋局</span><h2>最近对局</h2>
          <p id="reviewGameMeta">真人和电脑对局都会出现在这里。</p>
          <div id="reviewGameList" class="review-game-list"><div class="review-empty">正在读取最近棋局…</div></div>
        </section>
        <section id="reviewResults" class="platform-surface review-rail-block review-results hidden">
          <div class="review-results-head"><span class="eyebrow">关键节点</span><h2>这盘先看这些</h2><p id="reviewSummaryText"></p></div>
          <div id="reviewTurningPoints" class="review-turn-list"></div>
        </section>
      </aside>

      <section class="platform-surface review-board-stage">
        <div class="review-stage-head">
          <div class="review-stage-copy"><strong id="reviewBoardTitle">选择一盘棋</strong><span id="reviewBoardNote">棋盘会停在关键着法之前。</span></div>
          <div class="review-key-nav">
            <button type="button" data-review-key-nav="prev" disabled>← 上一个</button>
            <span id="reviewKeyPosition">—</span>
            <button type="button" data-review-key-nav="next" disabled>下一个 →</button>
          </div>
        </div>
        <div id="reviewBoard" class="review-xiangqi-board" aria-label="复盘棋盘"></div>
        <div id="reviewRouteDock" class="review-route-dock hidden">
          <div class="review-route-dock-copy"><span id="reviewRouteKind">路线</span><strong id="reviewRouteMove">从关键局面开始</strong></div>
          <div class="review-route-controls">
            <button type="button" data-review-route-step="prev">←</button>
            <b id="reviewRouteStep">0 / 0</b>
            <button type="button" data-review-route-step="next">→</button>
            <button type="button" data-review-route-exit>回到关键局面</button>
          </div>
        </div>
      </section>

      <aside id="reviewWhy" class="platform-surface review-coach-panel">
        <span class="eyebrow">WHY · 棋理</span>
        <h2 id="reviewWhyTitle">先选一个关键局面</h2>
        <div id="reviewWhyContent" class="review-why-loading">右边只解释当前棋盘。不会把整盘分析一次堆给你。</div>
      </aside>
    </div>
  \`;

  root.addEventListener("click", (event) => {
    const gameButton = event.target.closest("[data-review-game]");
    if (gameButton) {
      const game = reviewGames.find((item) => item.id === gameButton.dataset.reviewGame);
      if (game) void startReview(game);
      return;
    }

    const turnButton = event.target.closest("[data-review-ply]");
    if (turnButton && activeReviewGame && activeReviewAnalysis) {
      void showReviewTurningPoint(Number(turnButton.dataset.reviewPly));
      return;
    }

    const keyNav = event.target.closest("[data-review-key-nav]");
    if (keyNav && activeReviewAnalysis) {
      const points = reviewKeyPoints();
      const currentIndex = points.findIndex((point) => Number(point.ply) === Number(activeReviewPly));
      const nextIndex = keyNav.dataset.reviewKeyNav === "prev" ? currentIndex - 1 : currentIndex + 1;
      const target = points[nextIndex];
      if (target) void showReviewTurningPoint(target.ply);
      return;
    }

    const routeChoice = event.target.closest("[data-review-route-play]");
    if (routeChoice && activeReviewDeep?.analysis) {
      startReviewRoutePlayback(routeChoice.dataset.reviewRoutePlay);
      return;
    }

    const routeStep = event.target.closest("[data-review-route-step]");
    if (routeStep && reviewRoutePlayback) {
      stepReviewRoute(routeStep.dataset.reviewRouteStep === "prev" ? -1 : 1);
      return;
    }

    if (event.target.closest("[data-review-route-exit]")) {
      exitReviewRoutePlayback();
    }
  });

  renderReviewBoard(reviewInitialBoard(), null, false);
}`);

replaceBetween("function renderReviewBoard(board, highlightMove = null, flipped = false) {", "function renderReviewGameList() {", `function renderReviewBoard(board, highlightMove = null, flipped = false) {
  const element = document.querySelector("#reviewBoard");
  if (!element) return;
  element.innerHTML = \`
    <svg class="review-board-lines" viewBox="0 0 800 900" preserveAspectRatio="none" aria-hidden="true">
      <g>
        <line x1="0" y1="0" x2="800" y2="0"/><line x1="0" y1="100" x2="800" y2="100"/><line x1="0" y1="200" x2="800" y2="200"/><line x1="0" y1="300" x2="800" y2="300"/><line x1="0" y1="400" x2="800" y2="400"/><line x1="0" y1="500" x2="800" y2="500"/><line x1="0" y1="600" x2="800" y2="600"/><line x1="0" y1="700" x2="800" y2="700"/><line x1="0" y1="800" x2="800" y2="800"/><line x1="0" y1="900" x2="800" y2="900"/>
        <line x1="0" y1="0" x2="0" y2="900"/><line x1="100" y1="0" x2="100" y2="400"/><line x1="100" y1="500" x2="100" y2="900"/><line x1="200" y1="0" x2="200" y2="400"/><line x1="200" y1="500" x2="200" y2="900"/><line x1="300" y1="0" x2="300" y2="400"/><line x1="300" y1="500" x2="300" y2="900"/><line x1="400" y1="0" x2="400" y2="400"/><line x1="400" y1="500" x2="400" y2="900"/><line x1="500" y1="0" x2="500" y2="400"/><line x1="500" y1="500" x2="500" y2="900"/><line x1="600" y1="0" x2="600" y2="400"/><line x1="600" y1="500" x2="600" y2="900"/><line x1="700" y1="0" x2="700" y2="400"/><line x1="700" y1="500" x2="700" y2="900"/><line x1="800" y1="0" x2="800" y2="900"/>
        <line x1="300" y1="0" x2="500" y2="200"/><line x1="500" y1="0" x2="300" y2="200"/><line x1="300" y1="700" x2="500" y2="900"/><line x1="500" y1="700" x2="300" y2="900"/>
      </g>
      <text x="175" y="470">楚 河</text><text x="625" y="470">汉 界</text>
    </svg>
    <div class="review-board-points"></div>
  \`;
  const points = element.querySelector(".review-board-points");
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const visualRow = flipped ? 9 - row : row;
      const visualCol = flipped ? 8 - col : col;
      const point = document.createElement("div");
      point.className = "review-board-point";
      point.style.left = ((visualCol / 8) * 100) + "%";
      point.style.top = ((visualRow / 9) * 100) + "%";
      if (highlightMove?.fromRow === row && highlightMove?.fromCol === col) point.classList.add("active-from");
      if (highlightMove?.toRow === row && highlightMove?.toCol === col) point.classList.add("active-to");
      const entry = board[row]?.[col];
      if (entry) {
        const piece = document.createElement("span");
        piece.className = "review-board-piece " + entry.color;
        piece.textContent = entry.label;
        point.appendChild(piece);
      }
      points.appendChild(point);
    }
  }
}`);

replaceOnce(
  '  document.querySelector("#reviewWhy")?.classList.add("hidden");',
  '  document.querySelector("#reviewWhy")?.classList.remove("hidden");\n  document.querySelector("#reviewRouteDock")?.classList.add("hidden");\n  activeReviewPly = null;\n  reviewRoutePlayback = null;',
);

replaceBetween("function renderReviewResults() {", "function renderHistory(payload) {", `function reviewKeyPoints() {
  return [...(activeReviewAnalysis?.turningPoints || [])].sort((a, b) => Number(a.ply) - Number(b.ply));
}

function updateReviewKeyNavigation() {
  const points = reviewKeyPoints();
  const index = points.findIndex((point) => Number(point.ply) === Number(activeReviewPly));
  const position = document.querySelector("#reviewKeyPosition");
  const prev = document.querySelector('[data-review-key-nav="prev"]');
  const next = document.querySelector('[data-review-key-nav="next"]');
  if (position) position.textContent = index >= 0 ? (index + 1) + " / " + points.length : "—";
  if (prev) prev.disabled = index <= 0;
  if (next) next.disabled = index < 0 || index >= points.length - 1;
  document.querySelectorAll("[data-review-ply]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.reviewPly) === Number(activeReviewPly));
  });
}

function renderReviewResults() {
  if (!activeReviewGame || !activeReviewAnalysis) return;
  const summary = document.querySelector("#reviewSummaryText");
  const turns = document.querySelector("#reviewTurningPoints");
  const points = reviewKeyPoints();
  if (summary) summary.textContent = points.length
    ? `从你自己的 ${activeReviewAnalysis.scannedPlayerMoves || 0} 步中筛出 ${points.length} 个关键位置，按实战顺序看。`
    : "这盘棋没有找到明显的关键转折。";
  if (!turns) return;
  if (!points.length) {
    turns.innerHTML = '<div class="review-empty">这盘棋没有找到可比较的转折点。</div>';
    return;
  }

  turns.innerHTML = points.map((point, index) => {
    const board = reviewBoardBefore(activeReviewGame, point.ply);
    const actualMove = activeReviewGame.moves?.[point.ply - 1]?.move;
    const actualNotation = reviewFormatMove(actualMove, board);
    const severity = reviewLossLabel(point.loss);
    return `<button class="review-turn-row${Number(activeReviewPly) === Number(point.ply) ? " active" : ""}" data-review-ply="${point.ply}">
      <span class="review-turn-rank">${index + 1}</span>
      <span class="review-turn-main"><strong>第 ${point.ply} 手 · ${escapeHtml(severity.text)}</strong><small>你走了 ${escapeHtml(actualNotation)}</small></span>
    </button>`;
  }).join("");

  if (!activeReviewPly || !points.some((point) => Number(point.ply) === Number(activeReviewPly))) {
    void showReviewTurningPoint(points[0].ply);
  } else {
    updateReviewKeyNavigation();
  }
}

function renderReviewWhy(deep) {
  const root = document.querySelector("#reviewWhy");
  const title = document.querySelector("#reviewWhyTitle");
  const content = document.querySelector("#reviewWhyContent");
  if (!root || !content || !deep?.analysis) return;

  const analysis = deep.analysis;
  const ai = deep.ai;
  const deterministic = [
    ...(analysis.deterministicDifferences || []),
    ...(analysis.routeComparisons || []),
  ].filter(Boolean);
  const directFact = analysis.replyFacts?.[0]?.detail || analysis.chosenFacts?.find((item) => item.severity === "warning")?.detail || "";
  const explanation = ai?.coreReason || directFact || deterministic[0] || "这一步的坏处不是立刻发生。用下面两条路线在棋盘上逐步比较，更容易看见差异在哪里出现。";
  const comparison = ai?.comparison || deterministic.find((item) => item !== explanation) || "重点不是第一步的分数，而是哪条路线先让你失去主动、子力或安全的应对。";
  const showMe = ai?.showMe || "分别播放两条路线。每走一步都问：谁获得了新的强制手？谁开始必须应对？";
  const remember = ai?.remember || "复杂局面不要背最佳着。比较两条候选路线最早出现的实际差异。";
  const confidence = ai?.confidence === "high" ? "高" : ai?.confidence === "medium" ? "中" : "低";

  root.classList.remove("hidden");
  if (title) title.textContent = "为什么这一步值得停下来？";
  content.className = "";
  content.innerHTML = `
    <div class="review-move-compare">
      <div><span>你的走法</span><strong>${escapeHtml(analysis.moveNotation)}</strong></div>
      <div class="better"><span>更好的选择</span><strong>${escapeHtml(analysis.bestMove)}</strong></div>
    </div>
    <div class="review-why-section"><span>WHY · 为什么</span><p>${escapeHtml(explanation)}</p></div>
    <div class="review-why-section"><span>差异从哪里开始</span><p>${escapeHtml(comparison)}</p></div>
    <div class="review-why-section"><span>在棋盘上看什么</span><p>${escapeHtml(showMe)}</p>
      <div class="review-route-choice">
        <button class="button button-ghost" data-review-route-play="your">播放我的路线</button>
        <button class="button button-primary" data-review-route-play="best">播放更好路线</button>
      </div>
    </div>
    <div class="review-why-section remember"><span>这一盘记住</span><p>${escapeHtml(remember)}</p></div>
    ${deep.aiAvailable ? `<div class="review-confidence">解释置信度：${confidence}${ai?.status === "uncertain" ? " · 证据不足时已保留不确定性" : ""}</div>` : '<div class="review-confidence">当前未启用 AI 深度解释；路线与棋盘仍来自真实 Pikafish 分析。</div>'}
    ${deep.aiError ? `<div class="review-evidence-line">AI 请求失败：${escapeHtml(deep.aiError)}</div>` : ""}
  `;
}

function routeBoardAt(sourceBoard, route, stepCount) {
  let board = sourceBoard.map((row) => row.map((entry) => entry ? { ...entry } : null));
  const steps = route?.steps || [];
  for (let index = 0; index < stepCount && index < steps.length; index += 1) {
    board = reviewApplyMove(board, steps[index].move);
  }
  return board;
}

function renderReviewRoutePlayback() {
  if (!reviewRoutePlayback || !activeReviewDeep?.analysis) return;
  const analysis = activeReviewDeep.analysis;
  const route = analysis.routes?.[reviewRoutePlayback.key];
  if (!route) return;
  const steps = route.steps || [];
  reviewRoutePlayback.index = Math.max(0, Math.min(steps.length, reviewRoutePlayback.index));
  const board = routeBoardAt(analysis.sourceBoard, route, reviewRoutePlayback.index);
  const focusMove = reviewRoutePlayback.index < steps.length
    ? steps[reviewRoutePlayback.index]?.move
    : steps.at(-1)?.move || null;
  renderReviewBoard(board, focusMove, activeReviewGame?.color === "black");

  const dock = document.querySelector("#reviewRouteDock");
  const kind = document.querySelector("#reviewRouteKind");
  const move = document.querySelector("#reviewRouteMove");
  const step = document.querySelector("#reviewRouteStep");
  const prev = document.querySelector('[data-review-route-step="prev"]');
  const next = document.querySelector('[data-review-route-step="next"]');
  dock?.classList.remove("hidden");
  if (kind) kind.textContent = reviewRoutePlayback.key === "best" ? "更好路线" : "你的实战路线";
  if (move) move.textContent = reviewRoutePlayback.index === 0
    ? "从关键局面开始"
    : (steps[reviewRoutePlayback.index - 1]?.notation || "继续看下一步");
  if (step) step.textContent = reviewRoutePlayback.index + " / " + steps.length;
  if (prev) prev.disabled = reviewRoutePlayback.index <= 0;
  if (next) next.disabled = reviewRoutePlayback.index >= steps.length;
}

function startReviewRoutePlayback(key) {
  const route = activeReviewDeep?.analysis?.routes?.[key];
  if (!route?.steps?.length) return;
  reviewRoutePlayback = { key, index: 0 };
  renderReviewRoutePlayback();
}

function stepReviewRoute(delta) {
  if (!reviewRoutePlayback) return;
  reviewRoutePlayback.index += delta;
  renderReviewRoutePlayback();
}

function exitReviewRoutePlayback() {
  reviewRoutePlayback = null;
  document.querySelector("#reviewRouteDock")?.classList.add("hidden");
  if (!activeReviewGame || !activeReviewPly) return;
  const point = (activeReviewAnalysis?.turningPoints || []).find((item) => Number(item.ply) === Number(activeReviewPly));
  if (!point) return;
  const board = reviewBoardBefore(activeReviewGame, point.ply);
  const actualMove = activeReviewGame.moves?.[point.ply - 1]?.move;
  renderReviewBoard(board, actualMove, activeReviewGame.color === "black");
}

async function showReviewTurningPoint(ply) {
  if (!activeReviewGame || !activeReviewAnalysis) return;
  const point = (activeReviewAnalysis.turningPoints || []).find((item) => Number(item.ply) === Number(ply));
  if (!point) return;
  const gameId = activeReviewGame.id;
  activeReviewPly = point.ply;
  reviewRoutePlayback = null;
  document.querySelector("#reviewRouteDock")?.classList.add("hidden");
  updateReviewKeyNavigation();

  const board = reviewBoardBefore(activeReviewGame, point.ply);
  const actualMove = activeReviewGame.moves?.[point.ply - 1]?.move;
  const actualNotation = reviewFormatMove(actualMove, board);
  const severity = reviewLossLabel(point.loss);
  renderReviewBoard(board, actualMove, activeReviewGame.color === "black");

  const title = document.querySelector("#reviewBoardTitle");
  const note = document.querySelector("#reviewBoardNote");
  const whyTitle = document.querySelector("#reviewWhyTitle");
  const whyContent = document.querySelector("#reviewWhyContent");
  if (title) title.textContent = `第 ${point.ply} 手之前 · ${severity.text}`;
  if (note) note.textContent = `你当时走了 ${actualNotation}。先看棋盘，再看右侧 WHY。`;
  if (!actualMove) return;

  const requestId = ++reviewDeepRequestId;
  activeReviewDeep = null;
  if (whyTitle) whyTitle.textContent = "正在重新看这个局面";
  if (whyContent) {
    whyContent.className = "review-why-loading";
    whyContent.textContent = "正在深入比较两条路线。这里不会先给你一串引擎数字，而是先找真正改变局面的原因。";
  }

  try {
    if (!window.QiliReviewCoach?.analyzePosition) throw new Error("深度复盘模块尚未加载");
    const deep = await window.QiliReviewCoach.analyzePosition(board, actualMove, { depth: 12, routeLimit: 10 });
    if (requestId !== reviewDeepRequestId || activeReviewGame?.id !== gameId || Number(activeReviewPly) !== Number(point.ply)) return;
    activeReviewDeep = { ...deep, ply: point.ply };
    if (note && deep.analysis) note.textContent = `你走 ${deep.analysis.moveNotation} · 深度分析更推荐 ${deep.analysis.bestMove}`;
    renderReviewWhy(activeReviewDeep);
  } catch (error) {
    if (requestId !== reviewDeepRequestId || activeReviewGame?.id !== gameId) return;
    if (whyTitle) whyTitle.textContent = "这个局面暂时无法深入解释";
    if (whyContent) {
      whyContent.className = "review-why-loading";
      whyContent.textContent = `深度解释暂时不可用：${error instanceof Error ? error.message : "未知错误"}`;
    }
  }
}`);

await writeFile(path, source, "utf8");
await unlink(new URL(import.meta.url));
console.log("Review rebuilt as a board-first workbench.");
