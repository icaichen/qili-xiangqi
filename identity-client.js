const isLocalDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API = window.__QILI_ONLINE_API__ || (isLocalDev ? "http://127.0.0.1:8787" : window.location.origin);
const ACCOUNT_KEY = "qili-account-v1";

const REVIEW_LABELS = {
  red: { rook: "车", horse: "马", elephant: "相", advisor: "仕", general: "帅", cannon: "炮", pawn: "兵" },
  black: { rook: "车", horse: "马", elephant: "象", advisor: "士", general: "将", cannon: "炮", pawn: "卒" },
};
const REVIEW_RED_NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

let account = null;
let bootPromise = null;
let historyLoading = false;
let registeredClaimed = false;
let reviewShellReady = false;
let reviewGames = [];
let activeReviewGame = null;
let activeReviewAnalysis = null;
let reviewRequestId = 0;

function storedAccount() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "null");
  } catch {
    return null;
  }
}

function saveAccount(value) {
  account = value;
  if (value) {
    const stored = {
      accountToken: value.accountToken || null,
      user: value.user || null,
      ratings: value.ratings || null,
      registered: Boolean(value.registered || value.user?.registered),
    };
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(stored));
  } else {
    localStorage.removeItem(ACCOUNT_KEY);
  }
  renderIdentity();
}

async function getAuthToken() {
  if (window.QiliAuth?.isSignedIn?.()) {
    const clerkToken = await window.QiliAuth.getSessionToken().catch(() => null);
    if (clerkToken) return clerkToken;
  }
  return account?.accountToken || null;
}

async function apiRequest(path, options = {}, includeAuth = true) {
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (includeAuth) {
    const token = await getAuthToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || `Request failed (${response.status})`), { status: response.status });
  return payload;
}

function ratingRecord(pool) {
  return account?.ratings?.[pool] || { rating: 1200, games: 0, wins: 0, draws: 0, losses: 0 };
}

function renderRatings() {
  const rapid = ratingRecord("rapid");
  const blitz = ratingRecord("blitz");
  const rapidEl = document.querySelector("#profileRapidRating");
  const blitzEl = document.querySelector("#profileBlitzRating");
  const rapidMeta = document.querySelector("#profileRapidMeta");
  const blitzMeta = document.querySelector("#profileBlitzMeta");
  if (rapidEl) rapidEl.textContent = String(rapid.rating ?? 1200);
  if (blitzEl) blitzEl.textContent = String(blitz.rating ?? 1200);
  if (rapidMeta) rapidMeta.textContent = rapid.games ? `${rapid.games} 局 · ${rapid.wins}胜 ${rapid.draws}和 ${rapid.losses}负` : "初始 1200 · 尚无定级对局";
  if (blitzMeta) blitzMeta.textContent = blitz.games ? `${blitz.games} 局 · ${blitz.wins}胜 ${blitz.draws}和 ${blitz.losses}负` : "初始 1200 · 尚无定级对局";
}

function renderAuthControls() {
  const auth = window.QiliAuth?.getState?.() || { enabled: false, loaded: false, signedIn: false };
  const registered = Boolean(account?.user?.registered && auth.signedIn);
  const signIn = document.querySelector("#profileSignIn");
  const signOut = document.querySelector("#profileSignOut");
  const passkey = document.querySelector("#profileAddPasskey");
  const status = document.querySelector("#profileAuthStatus");

  if (signIn) signIn.classList.toggle("hidden", !auth.enabled || registered);
  if (signOut) signOut.classList.toggle("hidden", !registered);
  if (passkey) passkey.classList.toggle("hidden", !registered);

  if (status) {
    if (!auth.loaded) status.textContent = "正在检查登录服务…";
    else if (!auth.enabled) status.textContent = "正式登录尚未连接，当前仍可作为游客使用。";
    else if (registered) {
      const email = window.QiliAuth?.getPrimaryEmail?.();
      status.textContent = email ? `已登录 · ${email}` : "正式账户已登录，可在其他设备恢复。";
    } else {
      status.textContent = "登录后可在其他设备恢复历史棋局和 Rating。";
    }
  }
}

function renderIdentity() {
  const user = account?.user;
  const displayName = user?.displayName || "棋手";
  const registered = Boolean(user?.registered && window.QiliAuth?.isSignedIn?.());

  const profileName = document.querySelector("#profileDisplayName");
  if (profileName) profileName.textContent = displayName;

  const profileStatus = document.querySelector("#profileAccountStatus");
  if (profileStatus) {
    profileStatus.textContent = registered
      ? "正式棋手账户 · 可跨设备恢复"
      : user ? "游客棋手账户 · 仅此浏览器" : "正在建立棋手身份…";
  }

  const profileIdentityNote = document.querySelector("#profileIdentityNote");
  if (profileIdentityNote) {
    profileIdentityNote.textContent = registered
      ? "历史棋局与 Rating 已绑定正式账户。退出后可再次通过邮箱、Google 或 Passkey 恢复。"
      : "游客身份只保存在当前浏览器。登录时会把当前历史棋局和 Rating 原地认领到正式账户。";
  }

  const profileNameInput = document.querySelector("#profileNameInput");
  if (profileNameInput && document.activeElement !== profileNameInput) profileNameInput.value = displayName;

  const onlineNameInput = document.querySelector("#onlineDisplayName");
  if (onlineNameInput && document.activeElement !== onlineNameInput) onlineNameInput.value = displayName;

  renderRatings();
  renderAuthControls();
}

async function createGuest(displayName = "棋手") {
  const payload = await apiRequest("/api/identity/guest", {
    method: "POST",
    body: JSON.stringify({ displayName }),
  }, false);
  registeredClaimed = false;
  saveAccount({ accountToken: payload.accountToken, user: payload.user, ratings: payload.ratings, registered: false });
  return account;
}

async function claimClerkIdentity() {
  await window.QiliAuth?.ready?.();
  if (!window.QiliAuth?.isSignedIn?.()) return null;
  if (registeredClaimed && account?.user?.registered) return account;

  const sessionToken = await window.QiliAuth.getSessionToken();
  if (!sessionToken) throw new Error("无法取得登录 session");

  const stored = storedAccount();
  const guestToken = account?.accountToken || stored?.accountToken || "";
  const preferredName = window.QiliAuth.getDisplayName?.() || account?.user?.displayName || "棋手";
  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${sessionToken}`,
  };
  if (guestToken) headers["x-qili-guest-token"] = guestToken;

  const response = await fetch(`${API}/api/auth/claim`, {
    method: "POST",
    headers,
    body: JSON.stringify({ displayName: preferredName }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || `Account claim failed (${response.status})`), { status: response.status });

  registeredClaimed = true;
  saveAccount({ accountToken: null, user: payload.user, ratings: payload.ratings, registered: true });
  window.dispatchEvent(new CustomEvent("qili-account-claimed", { detail: { claimedGuest: payload.claimedGuest, restored: payload.restored } }));
  return account;
}

async function ensureIdentity() {
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    await window.QiliAuth?.ready?.().catch(() => null);

    if (window.QiliAuth?.isSignedIn?.()) {
      return claimClerkIdentity();
    }

    if (account?.accountToken && account?.user && !account.user.registered) return account;

    const stored = storedAccount();
    if (stored?.accountToken) {
      account = stored;
      try {
        const payload = await apiRequest("/api/identity/me");
        saveAccount({ accountToken: stored.accountToken, user: payload.user, ratings: payload.ratings, registered: false });
        return account;
      } catch (error) {
        if (error?.status !== 401) {
          account = stored;
          renderIdentity();
          throw error;
        }
        saveAccount(null);
      }
    }

    const preferredName = stored?.user?.displayName || document.querySelector("#onlineDisplayName")?.value || "棋手";
    return createGuest(preferredName);
  })().finally(() => {
    bootPromise = null;
  });

  return bootPromise;
}

async function syncDisplayName(value) {
  await ensureIdentity();
  const next = (String(value || "").trim() || account.user.displayName || "棋手").slice(0, 24);
  if (next === account.user.displayName) return account.user;
  const payload = await apiRequest("/api/identity/me/name", {
    method: "POST",
    body: JSON.stringify({ displayName: next }),
  });
  saveAccount({ ...account, user: payload.user, ratings: payload.ratings || account.ratings, registered: Boolean(payload.user?.registered) });
  return payload.user;
}

function relativeResult(game) {
  if (!game?.result) return "已结束";
  if (!game.result.winner) return "和棋";
  return game.result.winner === game.color ? "胜" : "负";
}

function resultReason(reason) {
  return {
    resignation: "认输",
    timeout: "超时",
    checkmate: "将死",
    "general-captured": "将帅被吃",
    "no-legal-moves": "无合法着",
    "draw-agreed": "协议和棋",
  }[reason] || reason || "结束";
}

function ratingDeltaText(game) {
  if (game.ratingDelta == null) return "未计分";
  const sign = game.ratingDelta > 0 ? "+" : "";
  const pool = game.ratingPool === "blitz" ? "Blitz" : "Rapid";
  return `${pool} ${sign}${game.ratingDelta}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function reviewInitialBoard() {
  const board = Array.from({ length: 10 }, () => Array(9).fill(null));
  const backRank = ["rook", "horse", "elephant", "advisor", "general", "advisor", "elephant", "horse", "rook"];
  backRank.forEach((type, col) => {
    board[0][col] = { type, color: "black", label: REVIEW_LABELS.black[type] };
    board[9][col] = { type, color: "red", label: REVIEW_LABELS.red[type] };
  });
  board[2][1] = { type: "cannon", color: "black", label: "炮" };
  board[2][7] = { type: "cannon", color: "black", label: "炮" };
  board[7][1] = { type: "cannon", color: "red", label: "炮" };
  board[7][7] = { type: "cannon", color: "red", label: "炮" };
  [0, 2, 4, 6, 8].forEach((col) => {
    board[3][col] = { type: "pawn", color: "black", label: "卒" };
    board[6][col] = { type: "pawn", color: "red", label: "兵" };
  });
  return board;
}

function reviewApplyMove(board, move) {
  const next = board.map((row) => row.map((entry) => entry ? { ...entry } : null));
  const moving = next[move.fromRow]?.[move.fromCol];
  if (!moving) return next;
  next[move.toRow][move.toCol] = moving;
  next[move.fromRow][move.fromCol] = null;
  return next;
}

function reviewBoardBefore(game, ply) {
  let board = reviewInitialBoard();
  const moves = Array.isArray(game?.moves) ? game.moves : [];
  for (let index = 0; index < Math.max(0, ply - 1) && index < moves.length; index += 1) {
    const move = moves[index]?.move;
    if (move) board = reviewApplyMove(board, move);
  }
  return board;
}

function reviewFileName(col, color) {
  return color === "red" ? REVIEW_RED_NUMERALS[8 - col] : String(col + 1);
}

function reviewDistanceName(distance, color) {
  return color === "red" ? REVIEW_RED_NUMERALS[distance - 1] : String(distance);
}

function reviewFormatMove(move, sourceBoard) {
  const moving = sourceBoard?.[move?.fromRow]?.[move?.fromCol] || move?.piece;
  if (!moving || !move) return "未知着法";
  const fromFile = reviewFileName(move.fromCol, moving.color);
  const toFile = reviewFileName(move.toCol, moving.color);
  const vertical = move.fromCol === move.toCol;
  let action;
  let destination;
  if (!vertical) {
    const movingForward = moving.color === "red" ? move.toRow < move.fromRow : move.toRow > move.fromRow;
    if (["horse", "elephant", "advisor"].includes(moving.type)) {
      action = movingForward ? "进" : "退";
      destination = toFile;
    } else if (move.fromRow === move.toRow) {
      action = "平";
      destination = toFile;
    } else {
      action = movingForward ? "进" : "退";
      destination = reviewDistanceName(Math.abs(move.toRow - move.fromRow), moving.color);
    }
  } else {
    const movingForward = moving.color === "red" ? move.toRow < move.fromRow : move.toRow > move.fromRow;
    action = movingForward ? "进" : "退";
    destination = reviewDistanceName(Math.abs(move.toRow - move.fromRow), moving.color);
  }
  return `${moving.label}${fromFile}${action}${destination}`;
}

function reviewLossLabel(loss) {
  const value = Number(loss || 0);
  if (value >= 220) return { text: "严重失误", cls: "danger" };
  if (value >= 100) return { text: "明显失误", cls: "warning" };
  if (value >= 35) return { text: "可改进", cls: "warning" };
  return { text: "细节", cls: "good" };
}

function reviewScoreText(value) {
  const number = Number(value || 0);
  if (Math.abs(number) >= 90000) return number > 0 ? "胜势" : "败势";
  const sign = number > 0 ? "+" : "";
  return `${sign}${(number / 100).toFixed(2)}`;
}

function ensureReviewStyles() {
  if (document.querySelector("#qiliReviewStyles")) return;
  const style = document.createElement("style");
  style.id = "qiliReviewStyles";
  style.textContent = `
    #reviewDropzone.platform-page{max-width:1560px;margin:0 auto}
    .review-game-list,.review-turn-list{display:grid;gap:8px;margin-top:16px}
    .review-game-row,.review-turn-row{width:100%;border:1px solid rgba(31,45,37,.09);border-radius:14px;background:#f7f8f5;padding:13px 14px;text-align:left;color:inherit;font:inherit;display:grid;gap:5px;transition:.16s ease}
    .review-game-row:hover,.review-turn-row:hover{background:#fff;border-color:rgba(35,75,59,.2);transform:translateY(-1px)}
    .review-game-row strong,.review-turn-row strong{font-size:12px}.review-game-row small,.review-turn-row small{color:#7d8781;font-size:10px;line-height:1.5}
    .review-game-row.active{border-color:rgba(35,75,59,.35);background:#edf4ef}
    .review-results{margin-top:18px;padding:24px}.review-results.hidden{display:none!important}
    .review-results-head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}.review-results-head h2{margin:5px 0}.review-results-head p{margin:0;color:#758079;line-height:1.6}
    .review-turn-row{grid-template-columns:auto 1fr auto;align-items:center}.review-turn-rank{width:44px;height:44px;display:grid;place-items:center;border-radius:12px;background:#f4e6df;color:#9a4035;font-size:10px;font-weight:800}.review-turn-main{display:grid;gap:4px}.review-turn-meta{text-align:right}.review-turn-meta b{display:block;color:#9a4035;font-size:12px}.review-turn-meta small{display:block}
    .review-board-note{margin-top:10px}.review-empty{padding:18px;border-radius:14px;background:#f6f8f5;color:#7b857e;font-size:12px;line-height:1.7}
    @media(max-width:900px){.review-results-head{display:block}.review-turn-row{grid-template-columns:auto 1fr}.review-turn-meta{grid-column:2;text-align:left}}
  `;
  document.head.appendChild(style);
}

function prepareReviewShell() {
  if (reviewShellReady) return;
  const root = document.querySelector("#reviewDropzone");
  if (!root) return;
  reviewShellReady = true;
  ensureReviewStyles();
  root.classList.remove("review-dropzone");
  root.classList.add("platform-page");
  root.innerHTML = `
    <div class="platform-page-header">
      <div><span class="eyebrow">REVIEW · 实战复盘</span><h1>从你刚下过的棋里，找到最该改的一步</h1><p>先用 Pikafish 扫描你自己的每一步，再把评价损失最大的转折点挑出来。不是随机题，也不是虚构建议。</p></div>
      <span id="reviewEngineStatus">选择一盘棋</span>
    </div>
    <div class="analysis-layout">
      <section class="platform-surface analysis-board-shell">
        <div id="reviewBoard" class="route-preview-board" aria-label="复盘棋盘"></div>
        <div class="route-preview-info review-board-note"><strong id="reviewBoardTitle">选择右侧一盘真人棋</strong><span id="reviewBoardNote">棋盘会停在关键着法之前，让你重新看当时的选择。</span></div>
      </section>
      <aside class="platform-surface analysis-side">
        <span class="eyebrow">你的真实棋局</span><h2>最近真人对局</h2>
        <p id="reviewGameMeta">读取账户中的永久棋谱数据库。</p>
        <div id="reviewGameList" class="review-game-list"><div class="review-empty">正在读取最近棋局…</div></div>
      </aside>
    </div>
    <section id="reviewResults" class="platform-surface review-results hidden">
      <div class="review-results-head"><div><span class="eyebrow">Pikafish 扫描结果</span><h2>关键转折点</h2><p id="reviewSummaryText"></p></div></div>
      <div id="reviewTurningPoints" class="review-turn-list"></div>
    </section>
  `;

  root.addEventListener("click", (event) => {
    const gameButton = event.target.closest("[data-review-game]");
    if (gameButton) {
      const game = reviewGames.find((item) => item.id === gameButton.dataset.reviewGame);
      if (game) void startReview(game);
      return;
    }
    const turnButton = event.target.closest("[data-review-ply]");
    if (turnButton && activeReviewGame && activeReviewAnalysis) {
      showReviewTurningPoint(Number(turnButton.dataset.reviewPly));
    }
  });

  renderReviewBoard(reviewInitialBoard(), null, false);
}

function renderReviewBoard(board, highlightMove = null, flipped = false) {
  const element = document.querySelector("#reviewBoard");
  if (!element) return;
  element.innerHTML = "";
  for (let visualRow = 0; visualRow < 10; visualRow += 1) {
    for (let visualCol = 0; visualCol < 9; visualCol += 1) {
      const row = flipped ? 9 - visualRow : visualRow;
      const col = flipped ? 8 - visualCol : visualCol;
      const cell = document.createElement("div");
      cell.className = "route-preview-cell";
      if (highlightMove?.fromRow === row && highlightMove?.fromCol === col) cell.classList.add("active-from");
      if (highlightMove?.toRow === row && highlightMove?.toCol === col) cell.classList.add("active-to");
      const entry = board[row]?.[col];
      if (entry) {
        const piece = document.createElement("span");
        piece.className = `route-preview-piece ${entry.color}`;
        piece.textContent = entry.label;
        cell.appendChild(piece);
      }
      element.appendChild(cell);
    }
  }
}

function renderReviewGameList() {
  prepareReviewShell();
  const list = document.querySelector("#reviewGameList");
  const meta = document.querySelector("#reviewGameMeta");
  if (!list) return;
  if (meta) meta.textContent = reviewGames.length ? `最近 ${reviewGames.length} 盘 · 选择一盘开始自动扫描` : "还没有可复盘的真人棋局。";
  if (!reviewGames.length) {
    list.innerHTML = '<div class="review-empty">完成一盘真人对局后，这里会直接出现，不需要手动上传棋谱。</div>';
    return;
  }
  list.innerHTML = reviewGames.map((game) => {
    const date = new Date(game.finishedAt);
    const when = Number.isNaN(date.getTime()) ? "" : date.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const result = relativeResult(game);
    const tc = game.timeControl?.label || `${game.timeControl?.baseSeconds || 0}+${game.timeControl?.incrementSeconds || 0}`;
    return `<button class="review-game-row${activeReviewGame?.id === game.id ? " active" : ""}" data-review-game="${escapeHtml(game.id)}">
      <strong>${result} · vs ${escapeHtml(game.opponent || "对手")}</strong>
      <small>${game.color === "red" ? "执红" : "执黑"} · ${escapeHtml(tc)} · ${Array.isArray(game.moves) ? game.moves.length : 0} 手 · ${escapeHtml(when)}</small>
    </button>`;
  }).join("");
}

async function loadReviewGames() {
  prepareReviewShell();
  const status = document.querySelector("#reviewEngineStatus");
  const list = document.querySelector("#reviewGameList");
  try {
    if (status) status.textContent = "读取棋局…";
    if (list && !reviewGames.length) list.innerHTML = '<div class="review-empty">正在读取最近棋局…</div>';
    await ensureIdentity();
    const payload = await apiRequest("/api/identity/me/games?limit=20");
    reviewGames = payload?.games || [];
    renderReviewGameList();
    if (status) status.textContent = reviewGames.length ? "选择一盘棋" : "暂无棋局";
  } catch (error) {
    if (status) status.textContent = "读取失败";
    if (list) list.innerHTML = `<div class="review-empty">${escapeHtml(error.message)}</div>`;
  }
}

async function startReview(game) {
  prepareReviewShell();
  const requestId = ++reviewRequestId;
  activeReviewGame = game;
  activeReviewAnalysis = null;
  renderReviewGameList();

  const status = document.querySelector("#reviewEngineStatus");
  const results = document.querySelector("#reviewResults");
  const summary = document.querySelector("#reviewSummaryText");
  const turns = document.querySelector("#reviewTurningPoints");
  const title = document.querySelector("#reviewBoardTitle");
  const note = document.querySelector("#reviewBoardNote");
  const flipped = game.color === "black";
  renderReviewBoard(reviewInitialBoard(), null, flipped);
  if (title) title.textContent = `vs ${game.opponent || "对手"} · ${game.color === "red" ? "执红" : "执黑"}`;
  if (note) note.textContent = "Pikafish 正在逐步检查你自己的着法。";
  if (status) status.textContent = "Pikafish 扫描中…";
  if (results) results.classList.remove("hidden");
  if (summary) summary.textContent = "正在扫描整盘，找评价变化最大的转折点。";
  if (turns) turns.innerHTML = '<div class="review-empty">分析中。棋局越长，需要检查的用户着法越多。</div>';

  try {
    const analysis = await window.XiangqiEngineClient.analyzeGame(game, { depth: 7, maxPlayerMoves: 36 });
    if (requestId !== reviewRequestId) return;
    activeReviewAnalysis = analysis;
    renderReviewResults();
    if (status) status.textContent = "复盘完成";
  } catch (error) {
    if (requestId !== reviewRequestId) return;
    if (status) status.textContent = "复盘失败";
    if (summary) summary.textContent = error.message;
    if (turns) turns.innerHTML = `<div class="review-empty">${escapeHtml(error.message)}</div>`;
    if (note) note.textContent = "确认 Pikafish 服务已连接后可以重新选择这盘棋。";
  }
}

function renderReviewResults() {
  if (!activeReviewGame || !activeReviewAnalysis) return;
  const summary = document.querySelector("#reviewSummaryText");
  const turns = document.querySelector("#reviewTurningPoints");
  const points = activeReviewAnalysis.turningPoints || [];
  if (summary) {
    summary.textContent = `检查了你自己的 ${activeReviewAnalysis.scannedPlayerMoves || 0} 步，从 ${activeReviewAnalysis.totalPlies || activeReviewGame.moves?.length || 0} 手棋里挑出最值得回看的 ${points.length} 个位置。`;
  }
  if (!turns) return;
  if (!points.length) {
    turns.innerHTML = '<div class="review-empty">这盘棋没有找到可比较的转折点。</div>';
    return;
  }

  turns.innerHTML = points.map((point, index) => {
    const board = reviewBoardBefore(activeReviewGame, point.ply);
    const actualMove = activeReviewGame.moves?.[point.ply - 1]?.move;
    const bestMove = window.XiangqiEngineClient.uciToMove(point.bestMove, board);
    const actualNotation = reviewFormatMove(actualMove, board);
    const bestNotation = bestMove ? reviewFormatMove(bestMove, board) : point.bestMove || "—";
    const severity = reviewLossLabel(point.loss);
    return `<button class="review-turn-row" data-review-ply="${point.ply}">
      <span class="review-turn-rank">#${index + 1}</span>
      <span class="review-turn-main"><strong>第 ${point.ply} 手 · ${escapeHtml(severity.text)}</strong><small>你下 ${escapeHtml(actualNotation)} · 首选 ${escapeHtml(bestNotation)}</small></span>
      <span class="review-turn-meta"><b>-${(Number(point.loss || 0) / 100).toFixed(2)}</b><small>${reviewScoreText(point.actualScore)} → 最佳 ${reviewScoreText(point.bestScore)}</small></span>
    </button>`;
  }).join("");

  showReviewTurningPoint(points[0].ply);
}

function showReviewTurningPoint(ply) {
  if (!activeReviewGame || !activeReviewAnalysis) return;
  const point = (activeReviewAnalysis.turningPoints || []).find((item) => Number(item.ply) === Number(ply));
  if (!point) return;
  const board = reviewBoardBefore(activeReviewGame, point.ply);
  const actualMove = activeReviewGame.moves?.[point.ply - 1]?.move;
  const bestMove = window.XiangqiEngineClient.uciToMove(point.bestMove, board);
  const actualNotation = reviewFormatMove(actualMove, board);
  const bestNotation = bestMove ? reviewFormatMove(bestMove, board) : point.bestMove || "—";
  const severity = reviewLossLabel(point.loss);
  renderReviewBoard(board, actualMove, activeReviewGame.color === "black");
  const title = document.querySelector("#reviewBoardTitle");
  const note = document.querySelector("#reviewBoardNote");
  if (title) title.textContent = `第 ${point.ply} 手之前 · ${severity.text}`;
  if (note) note.textContent = `你下：${actualNotation}。Pikafish 首选：${bestNotation}。评价损失约 ${(Number(point.loss || 0) / 100).toFixed(2)}。`;
}

function renderHistory(payload) {
  const count = document.querySelector("#profileGameCount");
  if (count) count.textContent = String(payload?.total ?? 0);

  if (payload?.ratings && account) {
    saveAccount({ ...account, ratings: payload.ratings });
  }

  const list = document.querySelector("#profileRecentGames");
  if (!list) return;
  const games = payload?.games || [];
  if (!games.length) {
    list.innerHTML = '<div class="profile-history-empty"><strong>还没有真人历史对局</strong><p>完成一盘真人棋后会自动出现在这里。</p></div>';
    return;
  }

  list.innerHTML = games.map((item) => {
    const date = new Date(item.finishedAt);
    const when = Number.isNaN(date.getTime()) ? "" : date.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const result = relativeResult(item);
    const cls = result === "胜" ? "win" : result === "负" ? "loss" : "draw";
    const tc = item.timeControl?.label || `${item.timeControl?.baseSeconds || 0}+${item.timeControl?.incrementSeconds || 0}`;
    const deltaClass = item.ratingDelta > 0 ? "up" : item.ratingDelta < 0 ? "down" : "flat";
    return `<article class="profile-history-row">
      <span class="profile-result ${cls}">${result}</span>
      <div><strong>${escapeHtml(item.opponent || "对手")}</strong><small>${item.color === "red" ? "执红" : "执黑"} · ${escapeHtml(tc)} · ${escapeHtml(resultReason(item.result?.reason))}</small></div>
      <div class="profile-history-meta"><span class="rating-delta ${deltaClass}">${ratingDeltaText(item)}</span><small>${Array.isArray(item.moves) ? item.moves.length : 0} 手 · ${escapeHtml(when)}</small></div>
    </article>`;
  }).join("");
}

async function loadHistory() {
  if (historyLoading) return;
  historyLoading = true;
  const list = document.querySelector("#profileRecentGames");
  if (list) list.dataset.loading = "true";
  try {
    await ensureIdentity();
    const payload = await apiRequest("/api/identity/me/games?limit=20");
    renderHistory(payload);
    return payload;
  } catch (error) {
    if (list) list.innerHTML = `<div class="profile-history-empty"><strong>历史棋局暂时无法读取</strong><p>${escapeHtml(error.message)}</p></div>`;
    return null;
  } finally {
    historyLoading = false;
    if (list) delete list.dataset.loading;
  }
}

function getAccountToken() {
  return account?.accountToken || null;
}

function getUser() {
  return account?.user || null;
}

function getRatings() {
  return account?.ratings || null;
}

document.querySelector("#profileSaveName")?.addEventListener("click", async () => {
  const input = document.querySelector("#profileNameInput");
  const status = document.querySelector("#profileNameStatus");
  try {
    if (status) status.textContent = "保存中…";
    await syncDisplayName(input?.value || "棋手");
    if (status) status.textContent = "已保存";
  } catch (error) {
    if (status) status.textContent = error.message;
  }
});

document.querySelector("#profileSignIn")?.addEventListener("click", async () => {
  const status = document.querySelector("#profileAuthStatus");
  try {
    if (status) status.textContent = "正在打开登录…";
    await window.QiliAuth?.openSignIn?.();
  } catch (error) {
    if (status) status.textContent = error.message;
  }
});

document.querySelector("#profileSignOut")?.addEventListener("click", async () => {
  const status = document.querySelector("#profileAuthStatus");
  try {
    if (status) status.textContent = "正在退出…";
    await window.QiliAuth?.signOut?.();
  } catch (error) {
    if (status) status.textContent = error.message;
  }
});

document.querySelector("#profileAddPasskey")?.addEventListener("click", async () => {
  const status = document.querySelector("#profileAuthStatus");
  try {
    if (status) status.textContent = "正在创建 Passkey…";
    await window.QiliAuth?.createPasskey?.();
    if (status) status.textContent = "Passkey 已添加。以后可用设备验证直接登录。";
  } catch (error) {
    if (status) status.textContent = error.message || "Passkey 创建失败";
  }
});

document.querySelectorAll('[data-view="profile"], [data-target-view="profile"]').forEach((button) => {
  button.addEventListener("click", () => void loadHistory());
});

document.querySelectorAll('[data-view="review"], [data-target-view="review"]').forEach((button) => {
  button.addEventListener("click", () => void loadReviewGames());
});

window.addEventListener("qili-game-finished", () => {
  void loadHistory();
  if (!document.querySelector("#reviewDropzone")?.classList.contains("hidden")) void loadReviewGames();
});
window.addEventListener("qili-clerk-state", (event) => {
  const signedIn = Boolean(event.detail?.signedIn);
  if (signedIn) {
    registeredClaimed = false;
    void claimClerkIdentity().then(() => {
      void loadHistory();
      if (!document.querySelector("#reviewDropzone")?.classList.contains("hidden")) void loadReviewGames();
    }).catch((error) => {
      const status = document.querySelector("#profileAuthStatus");
      if (status) status.textContent = error.message;
    });
  } else if (account?.user?.registered) {
    const previousName = account.user.displayName || "棋手";
    registeredClaimed = false;
    saveAccount(null);
    void createGuest(previousName).then(() => loadHistory()).catch(() => renderIdentity());
  } else {
    renderIdentity();
  }
});

window.QiliIdentity = {
  ensureIdentity,
  claimClerkIdentity,
  syncDisplayName,
  loadHistory,
  loadReviewGames,
  getAccountToken,
  getAuthToken,
  getUser,
  getRatings,
};

prepareReviewShell();
renderIdentity();
void ensureIdentity().then(() => {
  void loadHistory();
  if (window.location.hash === "#review") void loadReviewGames();
}).catch(() => renderIdentity());
