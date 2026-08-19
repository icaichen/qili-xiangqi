const isLocalDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API = window.__QILI_ONLINE_API__ || (isLocalDev ? "http://127.0.0.1:8787" : window.location.origin);
const ACCOUNT_KEY = "qili-account-v1";
const COMPUTER_GAME_HISTORY_KEY = "qili-computer-games-v1";

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
let activeReviewDeep = null;
let reviewDeepRequestId = 0;
let reviewRequestId = 0;
let activeReviewPly = null;
let reviewRoutePlayback = null;
let reviewRetryState = null;

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

function loadComputerReviewGames() {
  try {
    const stored = JSON.parse(localStorage.getItem(COMPUTER_GAME_HISTORY_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter((game) => Array.isArray(game?.moves) && game.moves.length) : [];
  } catch {
    return [];
  }
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
    #reviewDropzone.platform-page.hidden{display:none!important}
    .review-game-list,.review-turn-list{display:grid;gap:8px;margin-top:16px}
    .review-game-row,.review-turn-row{width:100%;border:1px solid rgba(31,45,37,.09);border-radius:14px;background:#f7f8f5;padding:13px 14px;text-align:left;color:inherit;font:inherit;display:grid;gap:5px;transition:.16s ease}
    .review-game-row:hover,.review-turn-row:hover{background:#fff;border-color:rgba(35,75,59,.2);transform:translateY(-1px)}
    .review-game-row strong,.review-turn-row strong{font-size:12px}.review-game-row small,.review-turn-row small{color:#7d8781;font-size:10px;line-height:1.5}
    .review-game-row.active{border-color:rgba(35,75,59,.35);background:#edf4ef}
    .review-results{margin-top:18px;padding:24px}.review-results.hidden{display:none!important}
    .review-results-head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}.review-results-head h2{margin:5px 0}.review-results-head p{margin:0;color:#758079;line-height:1.6}
    .review-turn-row{grid-template-columns:auto 1fr auto;align-items:center}.review-turn-rank{width:44px;height:44px;display:grid;place-items:center;border-radius:12px;background:#f4e6df;color:#9a4035;font-size:10px;font-weight:800}.review-turn-main{display:grid;gap:4px}.review-turn-meta{text-align:right}.review-turn-meta b{display:block;color:#9a4035;font-size:12px}.review-turn-meta small{display:block}
    .review-board-note{margin-top:10px}.review-empty{padding:18px;border-radius:14px;background:#f6f8f5;color:#7b857e;font-size:12px;line-height:1.7}
    .review-why{margin-top:18px;padding:24px}.review-why.hidden{display:none!important}.review-why h2{margin:6px 0 8px}.review-why p{line-height:1.75;color:#536059}
    .review-why-summary{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0}.review-why-summary>div{padding:14px;border-radius:14px;background:#f6f8f5}.review-why-summary span{display:block;font-size:10px;color:#8a928d;margin-bottom:5px}.review-why-summary strong{font-size:13px}
    .review-why-section{padding:16px 0;border-top:1px solid rgba(31,45,37,.08)}.review-why-section strong{display:block;margin-bottom:7px}.review-why-section p{margin:0}
    .review-route-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.review-route-actions .button{min-width:160px}
    .review-confidence{margin-top:12px;font-size:10px;color:#858e88}.review-evidence-line{font-size:11px;color:#68736d;margin-top:8px}
    .review-why-loading{padding:18px;border-radius:14px;background:#f6f8f5;color:#6f7a73}

    #reviewDropzone.platform-page{display:grid;grid-template-columns:minmax(210px,250px) minmax(560px,1fr) minmax(360px,420px);grid-template-areas:"header header header" "games board why" "turns board why";gap:12px;align-items:start;max-width:1720px}
    #reviewDropzone>.platform-page-header{grid-area:header;margin-bottom:0}
    #reviewDropzone>.analysis-layout{display:contents}
    #reviewDropzone .analysis-board-shell{grid-area:board;position:sticky;top:12px;padding:16px}
    #reviewDropzone .analysis-side{grid-area:games;padding:16px;max-height:300px;overflow:auto}
    #reviewDropzone #reviewResults{grid-area:turns;margin-top:0;padding:16px;max-height:calc(100vh - 350px);overflow:auto}
    #reviewDropzone #reviewWhy{grid-area:why;position:sticky;top:12px;margin-top:0;padding:20px;max-height:calc(100vh - 24px);overflow:auto}
    #reviewDropzone .review-results-head h2{font-size:18px}
    #reviewDropzone .review-results-head p{font-size:10px}
    #reviewDropzone .review-turn-row{grid-template-columns:34px 1fr;gap:8px;padding:10px 11px}
    #reviewDropzone .review-turn-rank{width:30px;height:30px;border-radius:50%;font-size:9px}
    #reviewDropzone .review-turn-meta{display:none}
    #reviewDropzone .review-turn-main strong{font-size:11px}
    #reviewDropzone .review-turn-main small{font-size:9px}
    #reviewDropzone .review-why-summary{grid-template-columns:1fr;margin:12px 0}
    #reviewDropzone .review-why-summary strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:11px;line-height:1.55}
    #reviewDropzone .review-why-section{padding:12px 0}
    #reviewDropzone .review-why-section p{font-size:11px;line-height:1.65}
    #reviewDropzone .review-game-list{max-height:190px;overflow:auto}
    #reviewDropzone .review-board-note{margin-top:10px}
    #reviewDropzone .review-xiangqi-board{position:relative;width:min(100%,690px);aspect-ratio:8/9;margin:0 auto;border:8px solid #b98046;border-radius:6px;background:repeating-linear-gradient(0deg,rgba(112,70,30,.035) 0 1px,transparent 1px 4px),linear-gradient(135deg,#edc986,#ddb16a 55%,#e7bf79);box-shadow:inset 0 0 0 2px #f4d99f,inset 0 0 28px rgba(113,65,26,.14),0 14px 26px rgba(90,57,29,.18);user-select:none}
    #reviewDropzone .review-board-lines,#reviewDropzone .review-board-points{position:absolute;inset:6.2%;width:87.6%;height:87.6%}
    #reviewDropzone .review-board-lines{overflow:visible}
    #reviewDropzone .review-board-lines line{stroke:#68421f;stroke-width:1.5;opacity:.76;vector-effect:non-scaling-stroke}
    #reviewDropzone .review-board-lines text{fill:#68411e;font-family:"Noto Serif SC",serif;font-size:38px;font-weight:700;letter-spacing:.22em;text-anchor:middle}
    #reviewDropzone .review-board-point{position:absolute;width:10.4%;aspect-ratio:1;transform:translate(-50%,-50%);display:grid;place-items:center;border:0;border-radius:50%;padding:0;background:transparent}
    #reviewDropzone .review-board-point.active-from::after,#reviewDropzone .review-board-point.active-to::after{content:"";position:absolute;inset:4%;border-radius:50%;z-index:1}
    #reviewDropzone .review-board-point.active-from::after{background:rgba(53,119,184,.18)}
    #reviewDropzone .review-board-point.active-to::after{background:rgba(163,61,49,.23)}
    #reviewDropzone .review-board-piece{position:absolute;inset:5%;z-index:2;display:grid;place-items:center;border:2px solid currentColor;border-radius:50%;background:radial-gradient(circle at 34% 28%,#fff3cf 0%,#eccb8a 60%,#cf9b52 100%);box-shadow:inset 0 0 0 2px rgba(255,245,214,.72),0 3px 7px rgba(83,47,20,.28);font-family:"Noto Serif SC",serif;font-size:clamp(15px,2vw,28px);font-weight:700;line-height:1}
    #reviewDropzone .review-board-piece.red{color:#aa3025}
    #reviewDropzone .review-board-piece.black{color:#3b2f26}
    #reviewDropzone .review-turn-row.active{border-color:#b87851;background:#f7eadb;box-shadow:inset 3px 0 0 #a33d31}
    #reviewDropzone .review-key-nav,#reviewDropzone .review-route-dock{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;padding:9px 10px;border:1px solid #e3cfb5;border-radius:8px;background:#fbf2e4}
    #reviewDropzone .review-key-nav button,#reviewDropzone .review-route-dock button{border:1px solid #d8bea0;border-radius:6px;padding:6px 9px;background:#fff9ef;color:#674f3c;font:inherit;font-size:10px;cursor:pointer}
    #reviewDropzone .review-key-nav button:disabled,#reviewDropzone .review-route-dock button:disabled{opacity:.35;cursor:default}
    #reviewDropzone .review-key-nav span,#reviewDropzone .review-route-dock span{color:#7a6a5a;font-size:10px;font-weight:800}
    #reviewDropzone .review-route-dock.hidden{display:none!important}
    #reviewDropzone .review-route-dock-copy{min-width:0;display:grid;gap:2px}
    #reviewDropzone .review-route-dock-copy small{color:#948473;font-size:9px}
    #reviewDropzone .review-route-dock-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
    #reviewDropzone .review-route-controls{display:flex;align-items:center;gap:6px;flex-shrink:0}
    #reviewDropzone .review-quick-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
    #reviewDropzone .review-quick-actions .button{flex:1 1 120px}
    #reviewDropzone .review-retry-feedback{margin-top:12px;padding:11px 12px;border-radius:9px;background:#f5efe4;color:#665646;font-size:11px;line-height:1.6}
    #reviewDropzone .review-retry-feedback.good{background:#eaf4ed;color:#356046}
    #reviewDropzone .review-board-point.retry-selected::after{content:"";position:absolute;inset:2%;border:3px solid rgba(43,99,156,.55);border-radius:50%;z-index:1}
    #reviewDropzone .review-board-point.retry-legal::before{content:"";position:absolute;width:28%;height:28%;border-radius:50%;background:rgba(48,120,73,.5);z-index:1}
    @media(max-width:1180px){#reviewDropzone.platform-page{grid-template-columns:220px minmax(500px,1fr);grid-template-areas:"header header" "games board" "turns board" "why why"}#reviewDropzone #reviewWhy{position:relative;top:auto;max-height:none}}
    @media(max-width:900px){.review-why-summary{grid-template-columns:1fr}.review-results-head{display:block}.review-turn-row{grid-template-columns:auto 1fr}.review-turn-meta{grid-column:2;text-align:left}}
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
        <div class="route-preview-info review-board-note"><strong id="reviewBoardTitle">选择右侧一盘棋</strong><span id="reviewBoardNote">棋盘会停在关键着法之前，让你重新看当时的选择。</span></div>
        <div class="review-key-nav">
          <button type="button" data-review-key-nav="prev" disabled>← 上一个关键点</button>
          <span id="reviewKeyPosition">—</span>
          <button type="button" data-review-key-nav="next" disabled>下一个关键点 →</button>
        </div>
        <div id="reviewRouteDock" class="review-route-dock hidden">
          <div class="review-route-dock-copy"><small id="reviewRouteKind">路线</small><strong id="reviewRouteMove">从关键局面开始</strong></div>
          <div class="review-route-controls">
            <button type="button" data-review-route-step="prev">←</button>
            <span id="reviewRouteStep">0 / 0</span>
            <button type="button" data-review-route-step="next">→</button>
            <button type="button" data-review-route-exit>回到关键局面</button>
          </div>
        </div>
      </section>
      <aside class="platform-surface analysis-side">
        <span class="eyebrow">你的棋局</span><h2>最近对局</h2>
        <p id="reviewGameMeta">真人对局与本机 Pikafish 对局都会出现在这里。</p>
        <div id="reviewGameList" class="review-game-list"><div class="review-empty">正在读取最近棋局…</div></div>
      </aside>
    </div>
    <section id="reviewResults" class="platform-surface review-results hidden">
      <div class="review-results-head"><div><span class="eyebrow">Pikafish 扫描结果</span><h2>关键转折点</h2><p id="reviewSummaryText"></p></div></div>
      <div id="reviewTurningPoints" class="review-turn-list"></div>
    </section>
    <section id="reviewWhy" class="platform-surface review-why hidden">
      <span id="reviewPanelEyebrow" class="eyebrow">REVIEW · 当前关键点</span>
      <h2 id="reviewWhyTitle">这一手发生了什么？</h2>
      <div id="reviewWhyContent" class="review-why-loading">先快速看你的走法和更好的选择；想真正理解时，再点“学懂这一步”。</div>
    </section>
  `;

  root.addEventListener("click", (event) => {
    const gameButton = event.target.closest("[data-review-game]");
    if (gameButton) {
      const game = reviewGames.find((item) => item.id === gameButton.dataset.reviewGame);
      if (game) void startReview(game);
      return;
    }
    const routeButton = event.target.closest("[data-review-route]");
    if (routeButton && activeReviewDeep?.analysis) {
      startReviewRoutePlayback(routeButton.dataset.reviewRoute);
      return;
    }
    if (event.target.closest("[data-review-learn]")) {
      void learnReviewTurningPoint();
      return;
    }
    if (event.target.closest("[data-review-quick-best]")) {
      startQuickBestRoute();
      return;
    }
    if (event.target.closest("[data-review-retry]")) {
      startReviewRetry();
      return;
    }
    const boardPoint = event.target.closest("[data-review-board-row]");
    if (boardPoint && reviewRetryState) {
      handleReviewRetryPoint(Number(boardPoint.dataset.reviewBoardRow), Number(boardPoint.dataset.reviewBoardCol));
      return;
    }
    const keyNav = event.target.closest("[data-review-key-nav]");
    if (keyNav && activeReviewAnalysis) {
      const points = reviewDisplayPoints();
      const index = points.findIndex((item) => Number(item.ply) === Number(activeReviewPly));
      const targetIndex = keyNav.dataset.reviewKeyNav === "prev" ? index - 1 : index + 1;
      if (points[targetIndex]) void showReviewTurningPoint(points[targetIndex].ply);
      return;
    }
    const routeStep = event.target.closest("[data-review-route-step]");
    if (routeStep && reviewRoutePlayback) {
      stepReviewRoute(routeStep.dataset.reviewRouteStep === "prev" ? -1 : 1);
      return;
    }
    if (event.target.closest("[data-review-route-exit]")) {
      exitReviewRoutePlayback();
      return;
    }
    const turnButton = event.target.closest("[data-review-ply]");
    if (turnButton && activeReviewGame && activeReviewAnalysis) {
      void showReviewTurningPoint(Number(turnButton.dataset.reviewPly));
    }
  });

  renderReviewBoard(reviewInitialBoard(), null, false);
}

function renderReviewBoard(board, highlightMove = null, flipped = false) {
  const element = document.querySelector("#reviewBoard");
  if (!element) return;
  element.className = "review-xiangqi-board";
  element.innerHTML = "";
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "review-board-lines");
  svg.setAttribute("viewBox", "0 0 800 900");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const addLine = (x1, y1, x2, y2) => {
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", String(x1)); line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2)); line.setAttribute("y2", String(y2));
    svg.appendChild(line);
  };
  for (let row = 0; row <= 9; row += 1) addLine(0, row * 100, 800, row * 100);
  addLine(0, 0, 0, 900); addLine(800, 0, 800, 900);
  for (let col = 1; col <= 7; col += 1) {
    const x = col * 100;
    addLine(x, 0, x, 400); addLine(x, 500, x, 900);
  }
  addLine(300, 0, 500, 200); addLine(500, 0, 300, 200);
  addLine(300, 700, 500, 900); addLine(500, 700, 300, 900);
  const addText = (x, text) => {
    const node = document.createElementNS(ns, "text");
    node.setAttribute("x", String(x)); node.setAttribute("y", "470");
    node.textContent = text; svg.appendChild(node);
  };
  addText(175, "楚 河"); addText(625, "汉 界");
  element.appendChild(svg);
  const pointLayer = document.createElement("div");
  pointLayer.className = "review-board-points";
  element.appendChild(pointLayer);
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const visualRow = flipped ? 9 - row : row;
      const visualCol = flipped ? 8 - col : col;
      const point = document.createElement("div");
      point.className = "review-board-point";
      point.dataset.reviewBoardRow = String(row);
      point.dataset.reviewBoardCol = String(col);
      point.style.left = ((visualCol / 8) * 100) + "%";
      point.style.top = ((visualRow / 9) * 100) + "%";
      if (highlightMove?.fromRow === row && highlightMove?.fromCol === col) point.classList.add("active-from");
      if (highlightMove?.toRow === row && highlightMove?.toCol === col) point.classList.add("active-to");
      if (reviewRetryState?.selected?.row === row && reviewRetryState?.selected?.col === col) point.classList.add("retry-selected");
      if (reviewRetryState?.legal?.some((move) => move.toRow === row && move.toCol === col)) point.classList.add("retry-legal");
      const entry = board[row]?.[col];
      if (entry) {
        const piece = document.createElement("span");
        piece.className = "review-board-piece " + entry.color;
        piece.textContent = entry.label;
        point.appendChild(piece);
      }
      pointLayer.appendChild(point);
    }
  }
}

function renderReviewGameList() {
  prepareReviewShell();
  const list = document.querySelector("#reviewGameList");
  const meta = document.querySelector("#reviewGameMeta");
  if (!list) return;
  if (meta) meta.textContent = reviewGames.length ? `最近 ${reviewGames.length} 盘 · 选择一盘开始自动扫描` : "还没有可复盘的棋局。";
  if (!reviewGames.length) {
    list.innerHTML = '<div class="review-empty">完成一盘真人或电脑对局后，这里会直接出现，不需要手动上传棋谱。</div>';
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
  const localGames = loadComputerReviewGames();
  try {
    if (status) status.textContent = "读取棋局…";
    if (list && !reviewGames.length) list.innerHTML = '<div class="review-empty">正在读取最近棋局…</div>';
    let remoteGames = [];
    try {
      await ensureIdentity();
      const payload = await apiRequest("/api/identity/me/games?limit=20");
      remoteGames = payload?.games || [];
    } catch (error) {
      if (!localGames.length && !isLocalDev) throw error;
    }
    const localIds = new Set(localGames.map((game) => game.id));
    reviewGames = [...localGames, ...remoteGames.filter((game) => !localIds.has(game.id))]
      .sort((a, b) => Number(new Date(b.finishedAt)) - Number(new Date(a.finishedAt)))
      .slice(0, 30);
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
  activeReviewDeep = null;
  activeReviewPly = null;
  reviewRoutePlayback = null;
  reviewRetryState = null;
  reviewDeepRequestId += 1;
  document.querySelector("#reviewRouteDock")?.classList.add("hidden");
  renderReviewGameList();
  document.querySelector("#reviewWhy")?.classList.add("hidden");

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

function reviewDisplayPoints() {
  return [...(activeReviewAnalysis?.turningPoints || [])].sort((a, b) => Number(a.ply) - Number(b.ply));
}

function updateReviewKeyNavigation() {
  const points = reviewDisplayPoints();
  const index = points.findIndex((item) => Number(item.ply) === Number(activeReviewPly));
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
  const points = reviewDisplayPoints();
  if (summary) {
    summary.textContent = `从你自己的 ${activeReviewAnalysis.scannedPlayerMoves || 0} 步里筛出 ${points.length} 个关键位置。按实战顺序逐个看，不按引擎分数堆报告。`;
  }
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
  if (!activeReviewPly || !points.some((item) => Number(item.ply) === Number(activeReviewPly))) {
    void showReviewTurningPoint(points[0].ply);
  } else {
    updateReviewKeyNavigation();
  }
}

function activeReviewPoint() {
  return (activeReviewAnalysis?.turningPoints || []).find((item) => Number(item.ply) === Number(activeReviewPly)) || null;
}

function renderReviewQuick(point, options = {}) {
  const root = document.querySelector("#reviewWhy");
  const eyebrow = document.querySelector("#reviewPanelEyebrow");
  const title = document.querySelector("#reviewWhyTitle");
  const content = document.querySelector("#reviewWhyContent");
  if (!root || !content || !activeReviewGame || !point) return;
  const board = reviewBoardBefore(activeReviewGame, point.ply);
  const actualMove = activeReviewGame.moves?.[point.ply - 1]?.move;
  const bestMove = window.XiangqiEngineClient.uciToMove(point.bestMove, board);
  const actualNotation = reviewFormatMove(actualMove, board);
  const bestNotation = bestMove ? reviewFormatMove(bestMove, board) : point.bestMove || "—";
  const severity = reviewLossLabel(point.loss);
  root.classList.remove("hidden");
  if (eyebrow) eyebrow.textContent = options.retry ? "RETRY · 自己再想一次" : "REVIEW · 当前关键点";
  if (title) title.textContent = options.retry ? "如果重来一次，你会怎么走？" : `第 ${point.ply} 手 · ${severity.text}`;
  content.className = "";
  const attempt = options.attempt;
  const feedback = attempt
    ? `<div class="review-retry-feedback${attempt.correct ? " good" : ""}"><strong>${attempt.correct ? "找到了更好的着法" : "这步合法，但还不是 Pikafish 的首选"}</strong><br>${escapeHtml(attempt.notation)}${attempt.correct ? " 正是这个关键局面的最佳选择。" : "。可以再试一次，或者直接看变化。"}</div>`
    : "";
  const comparison = options.retry
    ? `<div class="review-why-section"><strong>先别看答案</strong><p>棋盘已经回到你走错之前。选一枚自己的棋，走出你现在认为更好的着法。</p></div>`
    : `<div class="review-why-summary"><div><span>你的走法</span><strong>${escapeHtml(actualNotation)}</strong></div><div><span>更好的选择</span><strong>${escapeHtml(bestNotation)}</strong></div></div>`;
  content.innerHTML = `
    ${comparison}
    ${feedback}
    <div class="review-quick-actions">
      <button class="button button-ghost" data-review-retry>${options.retry ? "重新开始" : "重试这一步"}</button>
      <button class="button button-ghost" data-review-quick-best>看最佳变化</button>
      <button class="button button-primary" data-review-learn>学懂这一步</button>
    </div>
  `;
}

function renderReviewWhy(deep) {
  const root = document.querySelector("#reviewWhy");
  const eyebrow = document.querySelector("#reviewPanelEyebrow");
  const title = document.querySelector("#reviewWhyTitle");
  const content = document.querySelector("#reviewWhyContent");
  if (!root || !content || !deep?.analysis) return;
  const analysis = deep.analysis;
  const ai = deep.ai;
  const deterministic = [...(analysis.deterministicDifferences || []), ...(analysis.routeComparisons || [])].filter(Boolean);
  const directFact = analysis.replyFacts?.[0]?.detail || analysis.chosenFacts?.find((item) => item.severity === "warning")?.detail || "";
  const explanation = ai?.coreReason || directFact || deterministic[0] || "这一步的坏处不是立刻发生。用下面两条路线在棋盘上逐步比较，更容易看见差异在哪里出现。";
  const comparison = ai?.comparison || deterministic.find((item) => item !== explanation) || "重点不是第一步的分数，而是哪条路线先让你失去主动、子力或安全的应对。";
  const showMe = ai?.showMe || "分别播放两条路线。每走一步都问：谁获得了新的强制手？谁开始必须应对？";
  const remember = ai?.remember || "复杂局面不要背最佳着。比较两条候选路线最早出现的实际差异。";
  const confidence = ai?.confidence === "high" ? "高" : ai?.confidence === "medium" ? "中" : "低";
  root.classList.remove("hidden");
  if (eyebrow) eyebrow.textContent = "LEARN · 学懂这一步";
  if (title) title.textContent = `为什么 ${analysis.bestMove} 比 ${analysis.moveNotation} 更好？`;
  content.className = "";
  content.innerHTML = `
    <div class="review-why-summary">
      <div><span>你的走法</span><strong>${escapeHtml(analysis.moveNotation)}</strong></div>
      <div><span>更好的选择</span><strong>${escapeHtml(analysis.bestMove)}</strong></div>
    </div>
    <div class="review-why-section"><strong>为什么？</strong><p>${escapeHtml(explanation)}</p></div>
    <div class="review-why-section"><strong>差异从哪里开始？</strong><p>${escapeHtml(comparison)}</p></div>
    <div class="review-why-section"><strong>在棋盘上看什么？</strong><p>${escapeHtml(showMe)}</p>
      <div class="review-route-actions">
        <button class="button button-ghost" data-review-route="your">播放我的路线</button>
        <button class="button button-primary" data-review-route="best">播放更好路线</button>
      </div>
    </div>
    <div class="review-why-section"><strong>这一盘记住</strong><p>${escapeHtml(remember)}</p></div>
    ${deep.aiAvailable ? `<div class="review-confidence">解释置信度：${confidence}${ai?.status === "uncertain" ? " · 已保留不确定性" : ""}</div>` : '<div class="review-confidence">当前未启用 AI 深度解释；路线与棋盘仍来自真实 Pikafish 分析。</div>'}
    ${deep.aiError ? `<div class="review-evidence-line">AI 请求失败：${escapeHtml(deep.aiError)}</div>` : ""}
  `;
}

function reviewRouteBoard(sourceBoard, route, count) {
  let board = sourceBoard.map((row) => row.map((entry) => entry ? { ...entry } : null));
  const steps = route?.steps || [];
  for (let index = 0; index < count && index < steps.length; index += 1) board = reviewApplyMove(board, steps[index].move);
  return board;
}

function reviewRouteFromPv(sourceBoard, pv) {
  let board = sourceBoard.map((row) => row.map((entry) => entry ? { ...entry } : null));
  const steps = [];
  for (const uci of (Array.isArray(pv) ? pv : []).slice(0, 10)) {
    const move = window.XiangqiEngineClient.uciToMove(uci, board);
    if (!move) break;
    const notation = reviewFormatMove(move, board);
    steps.push({ move, notation, uci });
    board = reviewApplyMove(board, move);
  }
  return { steps };
}

function renderReviewRoutePlayback() {
  if (!reviewRoutePlayback) return;
  const analysis = activeReviewDeep?.analysis;
  const route = reviewRoutePlayback.route || analysis?.routes?.[reviewRoutePlayback.key];
  const sourceBoard = reviewRoutePlayback.sourceBoard || analysis?.sourceBoard;
  if (!route || !sourceBoard) return;
  const steps = route.steps || [];
  reviewRetryState = null;
  reviewRoutePlayback.index = Math.max(0, Math.min(steps.length, reviewRoutePlayback.index));
  const board = reviewRouteBoard(sourceBoard, route, reviewRoutePlayback.index);
  const highlight = reviewRoutePlayback.index > 0 ? steps[reviewRoutePlayback.index - 1]?.move : null;
  renderReviewBoard(board, highlight, activeReviewGame?.color === "black");
  document.querySelector("#reviewRouteDock")?.classList.remove("hidden");
  const kind = document.querySelector("#reviewRouteKind");
  const move = document.querySelector("#reviewRouteMove");
  const step = document.querySelector("#reviewRouteStep");
  const prev = document.querySelector('[data-review-route-step="prev"]');
  const next = document.querySelector('[data-review-route-step="next"]');
  if (kind) kind.textContent = reviewRoutePlayback.title || (reviewRoutePlayback.key === "best" ? "更好路线" : "你的实战路线");
  if (move) move.textContent = reviewRoutePlayback.index === 0 ? "从关键局面开始" : (steps[reviewRoutePlayback.index - 1]?.notation || "继续");
  if (step) step.textContent = reviewRoutePlayback.index + " / " + steps.length;
  if (prev) prev.disabled = reviewRoutePlayback.index <= 0;
  if (next) next.disabled = reviewRoutePlayback.index >= steps.length;
}

function startReviewRoutePlayback(key) {
  const analysis = activeReviewDeep?.analysis;
  const route = analysis?.routes?.[key];
  if (!route?.steps?.length || !analysis?.sourceBoard) return;
  reviewRoutePlayback = {
    key,
    index: 0,
    route,
    sourceBoard: analysis.sourceBoard,
    title: key === "best" ? "更好路线" : "你的实战路线",
  };
  renderReviewRoutePlayback();
}

function startQuickBestRoute() {
  if (!activeReviewGame) return;
  const point = activeReviewPoint();
  if (!point) return;
  const sourceBoard = reviewBoardBefore(activeReviewGame, point.ply);
  const pv = point.bestPv?.length ? point.bestPv : point.bestMove ? [point.bestMove] : [];
  const route = reviewRouteFromPv(sourceBoard, pv);
  if (!route.steps.length) return;
  reviewRoutePlayback = { key: "best", index: 0, route, sourceBoard, title: "Pikafish 最佳变化" };
  renderReviewRoutePlayback();
}

function stepReviewRoute(delta) {
  if (!reviewRoutePlayback) return;
  reviewRoutePlayback.index += delta;
  renderReviewRoutePlayback();
}

function exitReviewRoutePlayback() {
  reviewRoutePlayback = null;
  reviewRetryState = null;
  document.querySelector("#reviewRouteDock")?.classList.add("hidden");
  if (!activeReviewGame || !activeReviewPly) return;
  const point = activeReviewPoint();
  if (!point) return;
  const board = reviewBoardBefore(activeReviewGame, point.ply);
  const actualMove = activeReviewGame.moves?.[point.ply - 1]?.move;
  renderReviewBoard(board, actualMove, activeReviewGame.color === "black");
}

function startReviewRetry() {
  if (!activeReviewGame) return;
  const point = activeReviewPoint();
  if (!point) return;
  reviewDeepRequestId += 1;
  activeReviewDeep = null;
  reviewRoutePlayback = null;
  document.querySelector("#reviewRouteDock")?.classList.add("hidden");
  const board = reviewBoardBefore(activeReviewGame, point.ply);
  reviewRetryState = { board, selected: null, legal: [] };
  renderReviewBoard(board, null, activeReviewGame.color === "black");
  const note = document.querySelector("#reviewBoardNote");
  if (note) note.textContent = "轮到你。先自己找一手更好的走法。";
  renderReviewQuick(point, { retry: true });
}

function handleReviewRetryPoint(row, col) {
  if (!reviewRetryState || !activeReviewGame) return;
  const point = activeReviewPoint();
  if (!point) return;
  const board = reviewRetryState.board;
  const chosen = reviewRetryState.legal.find((move) => move.toRow === row && move.toCol === col);
  if (reviewRetryState.selected && chosen) {
    const notation = reviewFormatMove(chosen, board);
    const uci = window.XiangqiEngineClient.moveToUci(chosen);
    const correct = uci === point.bestMove;
    const nextBoard = reviewApplyMove(board, chosen);
    reviewRetryState = null;
    renderReviewBoard(nextBoard, chosen, activeReviewGame.color === "black");
    const note = document.querySelector("#reviewBoardNote");
    if (note) note.textContent = correct ? `你找到了：${notation}。这是 Pikafish 的首选。` : `你尝试了 ${notation}。这步合法，但不是首选。`;
    renderReviewQuick(point, { attempt: { notation, correct } });
    return;
  }
  const entry = board[row]?.[col];
  if (!entry || entry.color !== activeReviewGame.color) return;
  const legalMoves = window.QiliTutorialRules?.legalMovesForPiece?.(board, row, col) || [];
  reviewRetryState.selected = { row, col };
  reviewRetryState.legal = legalMoves;
  renderReviewBoard(board, null, activeReviewGame.color === "black");
}

async function learnReviewTurningPoint() {
  if (!activeReviewGame) return;
  const point = activeReviewPoint();
  if (!point) return;
  const gameId = activeReviewGame.id;
  const board = reviewBoardBefore(activeReviewGame, point.ply);
  const actualMove = activeReviewGame.moves?.[point.ply - 1]?.move;
  if (!actualMove) return;
  reviewRetryState = null;
  reviewRoutePlayback = null;
  document.querySelector("#reviewRouteDock")?.classList.add("hidden");
  const requestId = ++reviewDeepRequestId;
  activeReviewDeep = null;
  const root = document.querySelector("#reviewWhy");
  const eyebrow = document.querySelector("#reviewPanelEyebrow");
  const title = document.querySelector("#reviewWhyTitle");
  const content = document.querySelector("#reviewWhyContent");
  root?.classList.remove("hidden");
  if (eyebrow) eyebrow.textContent = "LEARN · 学懂这一步";
  if (title) title.textContent = "正在理解为什么";
  if (content) {
    content.className = "review-why-loading";
    content.textContent = "正在比较你的走法与更好的路线，并寻找真正导致局势分开的原因。";
  }
  try {
    if (!window.QiliReviewCoach?.analyzePosition) throw new Error("深度复盘模块尚未加载");
    const deep = await window.QiliReviewCoach.analyzePosition(board, actualMove, { depth: 12, routeLimit: 10 });
    if (requestId !== reviewDeepRequestId || activeReviewGame?.id !== gameId || Number(activeReviewPly) !== Number(point.ply)) return;
    activeReviewDeep = { ...deep, ply: point.ply };
    const note = document.querySelector("#reviewBoardNote");
    if (note && deep.analysis) note.textContent = `你走 ${deep.analysis.moveNotation} · 更推荐 ${deep.analysis.bestMove}`;
    renderReviewWhy(activeReviewDeep);
  } catch (error) {
    if (requestId !== reviewDeepRequestId || activeReviewGame?.id !== gameId) return;
    if (title) title.textContent = "这个局面暂时无法深入解释";
    if (content) {
      content.className = "review-why-loading";
      content.textContent = `深度解释暂时不可用：${error instanceof Error ? error.message : "未知错误"}`;
    }
  }
}

function showReviewTurningPoint(ply) {
  if (!activeReviewGame || !activeReviewAnalysis) return;
  const point = (activeReviewAnalysis.turningPoints || []).find((item) => Number(item.ply) === Number(ply));
  if (!point) return;
  activeReviewPly = point.ply;
  reviewDeepRequestId += 1;
  activeReviewDeep = null;
  reviewRetryState = null;
  reviewRoutePlayback = null;
  document.querySelector("#reviewRouteDock")?.classList.add("hidden");
  const board = reviewBoardBefore(activeReviewGame, point.ply);
  const actualMove = activeReviewGame.moves?.[point.ply - 1]?.move;
  const bestMove = window.XiangqiEngineClient.uciToMove(point.bestMove, board);
  const actualNotation = reviewFormatMove(actualMove, board);
  const bestNotation = bestMove ? reviewFormatMove(bestMove, board) : point.bestMove || "—";
  const severity = reviewLossLabel(point.loss);
  renderReviewBoard(board, actualMove, activeReviewGame.color === "black");
  updateReviewKeyNavigation();
  const title = document.querySelector("#reviewBoardTitle");
  const note = document.querySelector("#reviewBoardNote");
  if (title) title.textContent = `第 ${point.ply} 手之前 · ${severity.text}`;
  if (note) note.textContent = `你走 ${actualNotation} · 更好的选择是 ${bestNotation}`;
  renderReviewQuick(point);
}


// QILI GAME REVIEW V3 — board-first dual pane
let reviewCursorPly = 0;
let reviewAutoplayTimer = null;

function ensureGameReviewV3Styles() {
  if (document.querySelector('#qiliGameReviewV3Styles')) return;
  const style = document.createElement('style');
  style.id = 'qiliGameReviewV3Styles';
  style.textContent = `
    #reviewDropzone.platform-page{display:block!important;max-width:1540px!important;margin:0 auto!important;padding:12px 18px 24px!important}
    #reviewDropzone .game-review-topbar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:12px;padding:0 2px}
    #reviewDropzone .game-review-brand{display:flex;align-items:center;gap:10px;min-width:0}
    #reviewDropzone .game-review-brand strong{font-size:16px;letter-spacing:-.02em}
    #reviewDropzone .game-review-brand span{font-size:10px;color:#7b847f}
    #reviewDropzone .game-review-picker{display:flex;align-items:center;gap:10px;min-width:280px;justify-content:flex-end}
    #reviewDropzone .game-review-picker select{max-width:330px;width:100%;border:1px solid rgba(31,45,37,.12);border-radius:9px;background:#fff;padding:9px 11px;font:inherit;font-size:11px;color:#334139;outline:none}
    #reviewDropzone .game-review-shell{display:grid;grid-template-columns:minmax(620px,1.5fr) minmax(390px,.72fr);gap:16px;align-items:stretch;height:calc(100vh - 92px);min-height:690px;max-height:900px}
    #reviewDropzone .game-review-board-pane{background:#f3f0ea;border:1px solid rgba(31,45,37,.1);border-radius:16px;padding:14px;display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden}
    #reviewDropzone .game-review-board-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:10px;flex:0 0 auto}
    #reviewDropzone .game-review-board-head strong{font-size:12px}.game-review-board-head span{font-size:10px;color:#7d8580}
    #reviewDropzone .game-review-board-stage{display:grid;grid-template-columns:32px minmax(0,1fr);gap:10px;align-items:center;justify-items:center;min-height:0;flex:1 1 auto;overflow:hidden}
    #reviewDropzone .review-eval-bar{position:relative;width:28px;height:min(100%,720px);min-height:0;align-self:stretch;border-radius:8px;overflow:hidden;background:#2d2c29;border:1px solid rgba(0,0,0,.15)}
    #reviewDropzone .review-eval-fill{position:absolute;left:0;right:0;bottom:0;height:50%;background:#f6f5f1;transition:height .22s ease}
    #reviewDropzone .review-eval-mid{position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(128,128,128,.6)}
    #reviewDropzone .review-eval-label{position:absolute;z-index:2;top:6px;left:0;right:0;text-align:center;font-size:9px;font-weight:800;color:#34342f;text-shadow:0 1px 0 rgba(255,255,255,.7)}
    #reviewDropzone #reviewBoard{align-self:center;justify-self:center}
    #reviewDropzone .review-xiangqi-board{position:relative!important;height:min(100%,720px)!important;width:auto!important;max-width:100%!important;aspect-ratio:8/9;margin:0 auto!important;flex:0 1 auto}
    #reviewDropzone .review-move-arrow{position:absolute;inset:6.2%;width:87.6%;height:87.6%;pointer-events:none;z-index:3;overflow:visible}
    #reviewDropzone .review-board-footer{padding:9px 4px 0;display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex:0 0 auto}
    #reviewDropzone .review-board-footer strong{display:block;font-size:11px}.review-board-footer span{display:block;color:#7a837d;font-size:10px;line-height:1.45;margin-top:2px}
    #reviewDropzone .review-route-dock{margin:9px 0 0!important;flex:0 0 auto}

    #reviewDropzone .game-review-side{position:relative;background:#242320;color:#f4f3ee;border-radius:16px;border:1px solid rgba(0,0,0,.18);display:flex!important;flex-direction:column;min-height:0;overflow:hidden}
    #reviewDropzone .game-review-side-head{display:flex;align-items:center;justify-content:space-between;padding:13px 16px 10px;border-bottom:1px solid rgba(255,255,255,.07);flex:0 0 auto}
    #reviewDropzone .game-review-side-head strong{font-size:14px}.game-review-side-head span{font-size:9px;color:#99988f}
    #reviewDropzone #reviewWhy{grid-area:auto!important;order:0!important;display:block!important;position:static!important;top:auto!important;margin:0!important;padding:14px 16px 13px!important;background:transparent!important;border:0!important;border-bottom:1px solid rgba(255,255,255,.07)!important;border-radius:0!important;color:#f4f3ee;max-height:250px!important;overflow:auto!important;flex:0 0 auto}
    #reviewDropzone #reviewWhy .eyebrow{color:#a9aaa2;font-size:9px}
    #reviewDropzone #reviewWhy h2{font-size:17px;margin:5px 0 9px;color:#fff;line-height:1.25}
    #reviewDropzone #reviewWhy p{color:#d2d1ca;font-size:11px;line-height:1.5}
    #reviewDropzone #reviewWhy .review-why-summary{grid-template-columns:1fr 1fr!important;gap:8px;margin:9px 0}
    #reviewDropzone #reviewWhy .review-why-summary>div{background:#302f2b;border:1px solid rgba(255,255,255,.07);padding:9px 10px;border-radius:9px}
    #reviewDropzone #reviewWhy .review-why-summary span{color:#9b9a93}.game-review-side #reviewWhy .review-why-summary strong{font-size:12px;line-height:1.3;color:#fff;-webkit-line-clamp:2}
    #reviewDropzone #reviewWhy .review-why-section{border-color:rgba(255,255,255,.07);padding:9px 0}
    #reviewDropzone #reviewWhy .review-confidence,#reviewDropzone #reviewWhy .review-evidence-line{color:#9d9c95}
    #reviewDropzone .review-quick-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
    #reviewDropzone .review-quick-actions .button{min-width:0!important;flex:1 1 105px;border-radius:8px;padding:8px 9px;font-size:10px}
    #reviewDropzone .review-quick-actions .button-primary{background:#79a73e;border-color:#79a73e;color:#fff}
    #reviewDropzone .review-quick-actions .button-ghost{background:#373630;border-color:#4a4943;color:#f2f1eb}
    #reviewDropzone .review-move-grade{display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:#36352f;padding:5px 8px;font-size:9px;color:#cbc9c1;margin-bottom:6px}
    #reviewDropzone .review-move-grade b{color:#fff}

    #reviewDropzone .review-moves-wrap{order:1!important;flex:1 1 auto;min-height:180px;overflow:auto!important;border-bottom:1px solid rgba(255,255,255,.07);padding:7px 10px 8px;scrollbar-gutter:stable}
    #reviewDropzone .review-move-pair{display:grid;grid-template-columns:30px 1fr 1fr;gap:4px;align-items:center;min-height:30px}
    #reviewDropzone .review-move-number{font-size:9px;color:#77766f;text-align:right;padding-right:5px}
    #reviewDropzone .review-move-button{border:0;background:transparent;color:#d8d7d0;border-radius:6px;padding:6px 7px;text-align:left;font:inherit;font-size:10px;cursor:pointer;display:flex;align-items:center;gap:5px;min-width:0}
    #reviewDropzone .review-move-button:hover{background:#302f2b}.review-move-button.active{background:#45433c;color:#fff}
    #reviewDropzone .review-move-button .notation{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.review-move-button .mark{flex:0 0 auto;font-size:10px;font-weight:900}
    #reviewDropzone .review-move-button .mark.bad{color:#ff665d}.review-move-button .mark.warn{color:#f4b04a}.review-move-button .mark.good{color:#88b95a}.review-move-button .mark.neutral{color:#8a8a82}

    #reviewDropzone .review-eval-graph{order:2!important;position:relative;flex:0 0 82px;margin:10px 14px 4px;border-radius:8px;background:#302f2b;border:1px solid rgba(255,255,255,.06);overflow:hidden;min-height:0}
    #reviewDropzone .review-eval-graph svg{display:block;width:100%;height:82px}.review-eval-graph .axis{stroke:#6a6962;stroke-width:1}.review-eval-graph .curve{fill:none;stroke:#deddd6;stroke-width:2}.review-eval-graph .cursor{stroke:#f1b96c;stroke-width:1.5}.review-eval-graph circle{cursor:pointer;stroke:#242320;stroke-width:1.5}.review-eval-graph circle.bad{fill:#ef6057}.review-eval-graph circle.warn{fill:#e9a43d}.review-eval-graph circle.good{fill:#88b95a}.review-eval-graph circle.neutral{fill:#8a8a82}
    #reviewDropzone .review-playback-progress{order:3!important;position:static!important;flex:0 0 auto;text-align:right;padding:2px 16px 0;color:#8f8e87;font-size:9px;pointer-events:none}
    #reviewDropzone .review-playback-controls{order:4!important;flex:0 0 auto;display:grid;grid-template-columns:46px 46px 1fr 46px 46px;gap:7px;padding:7px 14px 12px}
    #reviewDropzone .review-playback-controls button{border:1px solid rgba(255,255,255,.08);border-radius:8px;background:#373630;color:#ecebe5;font-size:17px;height:40px;cursor:pointer}
    #reviewDropzone .review-playback-controls button:hover{background:#44433c}.review-playback-controls button:disabled{opacity:.3;cursor:default}.review-playback-controls .play{font-size:15px}
    #reviewDropzone .review-retry-feedback{background:#34332e;color:#deddd6}.game-review-side .review-retry-feedback.good{background:#2d4131;color:#dcecdc}

    @media(max-width:1050px){#reviewDropzone .game-review-shell{grid-template-columns:1fr;min-height:0}#reviewDropzone .game-review-side{min-height:720px}.game-review-board-stage{grid-template-columns:28px minmax(0,1fr)!important}.review-eval-bar{min-height:500px!important}}
    @media(max-width:680px){#reviewDropzone.platform-page{padding:8px!important}.game-review-topbar{align-items:flex-start!important;flex-direction:column}.game-review-picker{width:100%;min-width:0!important}.game-review-shell{gap:8px!important}.game-review-board-pane{padding:8px!important;border-radius:11px!important}.game-review-side{border-radius:11px!important}.review-eval-bar{display:none}.game-review-board-stage{display:block!important}.review-xiangqi-board{max-height:none!important}.review-playback-controls{grid-template-columns:42px 42px 1fr 42px 42px!important}}
  `;
  document.head.appendChild(style);
}

function reviewBoardAfterPly(game, ply) {
  let board = reviewInitialBoard();
  const moves = Array.isArray(game?.moves) ? game.moves : [];
  const count = Math.max(0, Math.min(Number(ply) || 0, moves.length));
  for (let index = 0; index < count; index += 1) {
    const move = moves[index]?.move;
    if (move) board = reviewApplyMove(board, move);
  }
  return board;
}

function reviewAssessmentAt(ply) {
  return (activeReviewAnalysis?.assessments || []).find((item) => Number(item.ply) === Number(ply)) || null;
}

activeReviewPoint = function() {
  return reviewAssessmentAt(activeReviewPly);
}

function reviewAssessmentMark(assessment) {
  if (!assessment) return { text: '', cls: 'neutral' };
  const loss = Number(assessment.loss || 0);
  if (loss >= 220) return { text: '??', cls: 'bad' };
  if (loss >= 100) return { text: '?', cls: 'bad' };
  if (loss >= 35) return { text: '?!', cls: 'warn' };
  if (loss <= 12) return { text: '✓', cls: 'good' };
  return { text: '•', cls: 'neutral' };
}

function reviewEntries(game = activeReviewGame) {
  if (!game) return [];
  let board = reviewInitialBoard();
  const assessments = new Map((activeReviewAnalysis?.assessments || []).map((item) => [Number(item.ply), item]));
  return (game.moves || []).map((item, index) => {
    const ply = index + 1;
    const move = item?.move;
    const notation = move ? reviewFormatMove(move, board) : '—';
    const piece = move ? board[move.fromRow]?.[move.fromCol] : null;
    const entry = { ply, move, notation, color: piece?.color || (ply % 2 ? 'red' : 'black'), assessment: assessments.get(ply) || null };
    if (move) board = reviewApplyMove(board, move);
    return entry;
  });
}

function drawReviewMoveArrow(move, kind = 'actual') {
  if (!move) return;
  const element = document.querySelector('#reviewBoard');
  if (!element) return;
  const flipped = activeReviewGame?.color === 'black';
  const visual = (row, col) => ({
    x: (flipped ? 8 - col : col) * 100,
    y: (flipped ? 9 - row : row) * 100,
  });
  const from = visual(move.fromRow, move.fromCol);
  const to = visual(move.toRow, move.toCol);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'review-move-arrow');
  svg.setAttribute('viewBox', '0 0 800 900');
  svg.setAttribute('preserveAspectRatio', 'none');
  const defs = document.createElementNS(ns, 'defs');
  const marker = document.createElementNS(ns, 'marker');
  const markerId = 'review-arrow-' + Math.random().toString(36).slice(2);
  marker.setAttribute('id', markerId); marker.setAttribute('viewBox', '0 0 10 10'); marker.setAttribute('refX', '8'); marker.setAttribute('refY', '5'); marker.setAttribute('markerWidth', '6'); marker.setAttribute('markerHeight', '6'); marker.setAttribute('orient', 'auto-start-reverse');
  const arrow = document.createElementNS(ns, 'path');
  arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  arrow.setAttribute('fill', kind === 'best' ? '#7bab49' : '#e2a44b');
  marker.appendChild(arrow); defs.appendChild(marker); svg.appendChild(defs);
  const line = document.createElementNS(ns, 'line');
  line.setAttribute('x1', String(from.x)); line.setAttribute('y1', String(from.y)); line.setAttribute('x2', String(to.x)); line.setAttribute('y2', String(to.y));
  line.setAttribute('stroke', kind === 'best' ? '#7bab49' : '#e2a44b'); line.setAttribute('stroke-width', '15'); line.setAttribute('stroke-linecap', 'round'); line.setAttribute('opacity', '.82'); line.setAttribute('marker-end', 'url(#' + markerId + ')');
  svg.appendChild(line); element.appendChild(svg);
}

renderReviewGameList = function() {
  prepareReviewShell();
  const select = document.querySelector('#reviewGameSelect');
  if (!select) return;
  if (!reviewGames.length) {
    select.innerHTML = '<option value="">还没有可复盘的棋局</option>';
    select.disabled = true;
    return;
  }
  select.disabled = false;
  select.innerHTML = reviewGames.map((game) => {
    const result = relativeResult(game);
    const whenDate = new Date(game.finishedAt);
    const when = Number.isNaN(whenDate.getTime()) ? '' : whenDate.toLocaleDateString([], { month: '2-digit', day: '2-digit' });
    return '<option value="' + escapeHtml(game.id) + '"' + (activeReviewGame?.id === game.id ? ' selected' : '') + '>' + escapeHtml(result + ' · vs ' + (game.opponent || '对手') + ' · ' + (game.moves?.length || 0) + ' 手 · ' + when) + '</option>';
  }).join('');
}

prepareReviewShell = function() {
  if (reviewShellReady) return;
  const root = document.querySelector('#reviewDropzone');
  if (!root) return;
  reviewShellReady = true;
  ensureReviewStyles();
  ensureGameReviewV3Styles();
  root.classList.remove('review-dropzone');
  root.classList.add('platform-page');
  root.innerHTML = `
    <div class="game-review-topbar">
      <div class="game-review-brand"><strong>复盘</strong><span>Game Review · Pikafish</span></div>
      <div class="game-review-picker"><span id="reviewEngineStatus">读取棋局…</span><select id="reviewGameSelect" aria-label="选择复盘棋局"><option>读取中…</option></select></div>
    </div>
    <div class="game-review-shell">
      <section class="game-review-board-pane">
        <div class="game-review-board-head"><strong id="reviewBoardTitle">选择一盘棋</strong><span id="reviewBoardHeadMeta">棋盘为中心的逐手复盘</span></div>
        <div class="game-review-board-stage">
          <div class="review-eval-bar"><div id="reviewEvalFill" class="review-eval-fill"></div><div class="review-eval-mid"></div><div id="reviewEvalLabel" class="review-eval-label">0.0</div></div>
          <div id="reviewBoard" class="route-preview-board" aria-label="复盘棋盘"></div>
        </div>
        <div class="review-board-footer"><div><strong id="reviewBoardMove">初始局面</strong><span id="reviewBoardNote">选择棋谱中的任意一步，棋盘会同步跳转。</span></div><span id="reviewBoardSide"></span></div>
        <div id="reviewRouteDock" class="review-route-dock hidden">
          <div class="review-route-dock-copy"><small id="reviewRouteKind">路线</small><strong id="reviewRouteMove">从关键局面开始</strong></div>
          <div class="review-route-controls">
            <button type="button" data-review-route-step="prev">←</button><span id="reviewRouteStep">0 / 0</span><button type="button" data-review-route-step="next">→</button><button type="button" data-review-route-exit>回到实战</button>
          </div>
        </div>
      </section>
      <aside class="game-review-side">
        <div class="game-review-side-head"><strong>Game Review</strong><span id="reviewSideMeta">逐手查看</span></div>
        <section id="reviewWhy" class="review-why">
          <span id="reviewPanelEyebrow" class="eyebrow">REVIEW</span>
          <h2 id="reviewWhyTitle">正在准备复盘</h2>
          <div id="reviewWhyContent" class="review-why-loading">Pikafish 会先扫描整盘，然后你可以像回放录像一样逐手查看。</div>
        </section>
        <div id="reviewMoveList" class="review-moves-wrap"></div>
        <div id="reviewEvalGraph" class="review-eval-graph"></div>
        <div id="reviewPlaybackProgress" class="review-playback-progress">0 / 0</div>
        <div class="review-playback-controls">
          <button type="button" data-review-nav="first" title="回到开局">|‹</button>
          <button type="button" data-review-nav="prev" title="上一手">‹</button>
          <button type="button" class="play" data-review-nav="play" title="自动播放">▶</button>
          <button type="button" data-review-nav="next" title="下一手">›</button>
          <button type="button" data-review-nav="last" title="到终局">›|</button>
        </div>
      </aside>
    </div>
  `;
  root.addEventListener('change', (event) => {
    if (event.target.matches('#reviewGameSelect')) {
      const game = reviewGames.find((item) => item.id === event.target.value);
      if (game) void startReview(game);
    }
  });
  root.addEventListener('click', (event) => {
    const moveButton = event.target.closest('[data-review-move]');
    if (moveButton) { stopReviewAutoplay(); setReviewCursor(Number(moveButton.dataset.reviewMove)); return; }
    const graphPoint = event.target.closest('[data-review-graph-ply]');
    if (graphPoint) { stopReviewAutoplay(); setReviewCursor(Number(graphPoint.dataset.reviewGraphPly)); return; }
    const nav = event.target.closest('[data-review-nav]');
    if (nav) { handleReviewNav(nav.dataset.reviewNav); return; }
    if (event.target.closest('[data-review-next-key]')) { stopReviewAutoplay(); jumpReviewKey(1); return; }
    if (event.target.closest('[data-review-prev-key]')) { stopReviewAutoplay(); jumpReviewKey(-1); return; }
    const routeButton = event.target.closest('[data-review-route]');
    if (routeButton && activeReviewDeep?.analysis) { startReviewRoutePlayback(routeButton.dataset.reviewRoute); return; }
    if (event.target.closest('[data-review-learn]')) { void learnReviewTurningPoint(); return; }
    if (event.target.closest('[data-review-quick-best]')) { startQuickBestRoute(); return; }
    if (event.target.closest('[data-review-retry]')) { startReviewRetry(); return; }
    const boardPoint = event.target.closest('[data-review-board-row]');
    if (boardPoint && reviewRetryState) { handleReviewRetryPoint(Number(boardPoint.dataset.reviewBoardRow), Number(boardPoint.dataset.reviewBoardCol)); return; }
    const routeStep = event.target.closest('[data-review-route-step]');
    if (routeStep && reviewRoutePlayback) { stepReviewRoute(routeStep.dataset.reviewRouteStep === 'prev' ? -1 : 1); return; }
    if (event.target.closest('[data-review-route-exit]')) { exitReviewRoutePlayback(); }
  });
  renderReviewBoard(reviewInitialBoard(), null, false);
}

loadReviewGames = async function() {
  prepareReviewShell();
  const status = document.querySelector('#reviewEngineStatus');
  const localGames = loadComputerReviewGames();
  try {
    if (status) status.textContent = '读取棋局…';
    let remoteGames = [];
    try {
      await ensureIdentity();
      const payload = await apiRequest('/api/identity/me/games?limit=20');
      remoteGames = payload?.games || [];
    } catch (error) {
      if (!localGames.length && !isLocalDev) throw error;
    }
    const localIds = new Set(localGames.map((game) => game.id));
    reviewGames = [...localGames, ...remoteGames.filter((game) => !localIds.has(game.id))].sort((a, b) => Number(new Date(b.finishedAt)) - Number(new Date(a.finishedAt))).slice(0, 30);
    renderReviewGameList();
    if (!reviewGames.length) {
      if (status) status.textContent = '暂无棋局';
      const title = document.querySelector('#reviewWhyTitle');
      const content = document.querySelector('#reviewWhyContent');
      if (title) title.textContent = '还没有可复盘的棋局';
      if (content) content.textContent = '完成一盘真人或电脑对局后，这里会直接进入 Game Review。';
      return;
    }
    if (status) status.textContent = activeReviewAnalysis ? '复盘完成' : '选择棋局';
    if (!activeReviewGame) void startReview(reviewGames[0]);
  } catch (error) {
    if (status) status.textContent = '读取失败';
    const title = document.querySelector('#reviewWhyTitle');
    const content = document.querySelector('#reviewWhyContent');
    if (title) title.textContent = '棋局读取失败';
    if (content) content.textContent = error.message;
  }
}

startReview = async function(game) {
  prepareReviewShell();
  stopReviewAutoplay();
  const requestId = ++reviewRequestId;
  activeReviewGame = game;
  activeReviewAnalysis = null;
  activeReviewDeep = null;
  activeReviewPly = null;
  reviewCursorPly = 0;
  reviewRoutePlayback = null;
  reviewRetryState = null;
  reviewDeepRequestId += 1;
  document.querySelector('#reviewRouteDock')?.classList.add('hidden');
  renderReviewGameList();
  const status = document.querySelector('#reviewEngineStatus');
  const title = document.querySelector('#reviewBoardTitle');
  const moveTitle = document.querySelector('#reviewBoardMove');
  const note = document.querySelector('#reviewBoardNote');
  const coachTitle = document.querySelector('#reviewWhyTitle');
  const coachContent = document.querySelector('#reviewWhyContent');
  const flipped = game.color === 'black';
  renderReviewBoard(reviewInitialBoard(), null, flipped);
  if (title) title.textContent = (relativeResult(game) + ' · vs ' + (game.opponent || '对手'));
  if (moveTitle) moveTitle.textContent = 'Pikafish 正在扫描整盘';
  if (note) note.textContent = '扫描完成后可以逐手回放，并直接跳到关键失误。';
  if (status) status.textContent = 'Pikafish 扫描中…';
  if (coachTitle) coachTitle.textContent = '正在生成 Game Review';
  if (coachContent) { coachContent.className = 'review-why-loading'; coachContent.textContent = '先检查你自己的每一步，再标出最值得回看的位置。'; }
  renderRawMoveListDuringScan();
  renderReviewEvalGraph();
  updateReviewPlaybackControls();
  try {
    const analysis = await window.XiangqiEngineClient.analyzeGame(game, { depth: 7, maxPlayerMoves: 36 });
    if (requestId !== reviewRequestId) return;
    activeReviewAnalysis = analysis;
    renderReviewResults();
    if (status) status.textContent = '复盘完成';
  } catch (error) {
    if (requestId !== reviewRequestId) return;
    if (status) status.textContent = '复盘失败';
    if (coachTitle) coachTitle.textContent = '复盘失败';
    if (coachContent) coachContent.textContent = error.message;
    if (note) note.textContent = '确认 Pikafish 服务已连接后重新选择这盘棋。';
  }
}

function renderRawMoveListDuringScan() {
  const list = document.querySelector('#reviewMoveList');
  if (!list || !activeReviewGame) return;
  const entries = reviewEntries(activeReviewGame);
  list.innerHTML = reviewMovePairsHtml(entries, false);
}

function reviewMovePairsHtml(entries, includeAssessment = true) {
  const pairs = [];
  for (let index = 0; index < entries.length; index += 2) {
    const red = entries[index];
    const black = entries[index + 1];
    const button = (entry) => {
      if (!entry) return '<span></span>';
      const mark = includeAssessment ? reviewAssessmentMark(entry.assessment) : { text: '', cls: 'neutral' };
      return '<button type="button" class="review-move-button' + (Number(reviewCursorPly) === Number(entry.ply) ? ' active' : '') + '" data-review-move="' + entry.ply + '"><span class="notation">' + escapeHtml(entry.notation) + '</span>' + (mark.text ? '<span class="mark ' + mark.cls + '">' + mark.text + '</span>' : '') + '</button>';
    };
    pairs.push('<div class="review-move-pair"><span class="review-move-number">' + (Math.floor(index / 2) + 1) + '.</span>' + button(red) + button(black) + '</div>');
  }
  return pairs.join('');
}

function renderReviewMoveList() {
  const list = document.querySelector('#reviewMoveList');
  if (!list || !activeReviewGame) return;
  list.innerHTML = reviewMovePairsHtml(reviewEntries(activeReviewGame), true);
  const active = list.querySelector('[data-review-move="' + reviewCursorPly + '"]');
  active?.scrollIntoView?.({ block: 'nearest' });
}

renderReviewResults = function() {
  if (!activeReviewGame || !activeReviewAnalysis) return;
  renderReviewMoveList();
  renderReviewEvalGraph();
  const keys = reviewDisplayPoints();
  const first = keys[0]?.ply || activeReviewAnalysis.assessments?.[0]?.ply || Math.min(1, activeReviewGame.moves.length);
  setReviewCursor(first);
}

function reviewCurrentEvaluation() {
  const assessments = [...(activeReviewAnalysis?.assessments || [])].sort((a, b) => Number(a.ply) - Number(b.ply));
  let current = null;
  for (const item of assessments) {
    if (Number(item.ply) <= Number(reviewCursorPly)) current = item;
    else break;
  }
  return current;
}

function updateReviewEvalBar() {
  const assessment = reviewCurrentEvaluation();
  const fill = document.querySelector('#reviewEvalFill');
  const label = document.querySelector('#reviewEvalLabel');
  const score = Math.max(-1200, Math.min(1200, Number(assessment?.actualScore || 0)));
  const pct = 50 + (score / 1200) * 46;
  if (fill) fill.style.height = Math.max(4, Math.min(96, pct)) + '%';
  if (label) label.textContent = reviewScoreText(score);
}

function renderReviewEvalGraph() {
  const root = document.querySelector('#reviewEvalGraph');
  if (!root) return;
  const assessments = activeReviewAnalysis?.assessments || [];
  const total = Math.max(1, activeReviewGame?.moves?.length || 1);
  if (!assessments.length) { root.innerHTML = '<div style="padding:26px 12px;color:#77766f;font-size:10px">局势曲线将在扫描完成后出现</div>'; return; }
  const points = assessments.map((item) => {
    const x = (Number(item.ply) / total) * 100;
    const score = Math.max(-1200, Math.min(1200, Number(item.actualScore || 0)));
    const y = 50 - (score / 1200) * 38;
    const mark = reviewAssessmentMark(item);
    return { item, x, y, mark };
  });
  const path = points.map((point) => point.x.toFixed(2) + ',' + point.y.toFixed(2)).join(' ');
  const cursorX = (Number(reviewCursorPly || 0) / total) * 100;
  root.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="局势曲线"><line class="axis" x1="0" y1="50" x2="100" y2="50"></line><polyline class="curve" points="' + path + '"></polyline><line class="cursor" x1="' + cursorX + '" y1="0" x2="' + cursorX + '" y2="100"></line>' + points.map((point) => '<circle class="' + point.mark.cls + '" data-review-graph-ply="' + point.item.ply + '" cx="' + point.x + '" cy="' + point.y + '" r="2.1"></circle>').join('') + '</svg>';
}

renderReviewQuick = function(point, options = {}) {
  const root = document.querySelector('#reviewWhy');
  const eyebrow = document.querySelector('#reviewPanelEyebrow');
  const title = document.querySelector('#reviewWhyTitle');
  const content = document.querySelector('#reviewWhyContent');
  if (!root || !content || !activeReviewGame || !point) return;
  const board = reviewBoardBefore(activeReviewGame, point.ply);
  const actualMove = activeReviewGame.moves?.[point.ply - 1]?.move;
  const bestMove = window.XiangqiEngineClient.uciToMove(point.bestMove, board);
  const actualNotation = reviewFormatMove(actualMove, board);
  const bestNotation = bestMove ? reviewFormatMove(bestMove, board) : point.bestMove || '—';
  const severity = reviewLossLabel(point.loss);
  const mark = reviewAssessmentMark(point);
  root.classList.remove('hidden');
  if (eyebrow) eyebrow.textContent = options.retry ? 'RETRY · 自己再想一次' : 'REVIEW · 第 ' + point.ply + ' 手';
  if (title) title.textContent = options.retry ? '如果重来一次，你会怎么走？' : severity.text;
  content.className = '';
  const attempt = options.attempt;
  const feedback = attempt ? '<div class="review-retry-feedback' + (attempt.correct ? ' good' : '') + '"><strong>' + (attempt.correct ? '找到了更好的着法' : '这步合法，但还不是 Pikafish 的首选') + '</strong><br>' + escapeHtml(attempt.notation) + (attempt.correct ? ' 正是当前首选。' : '。可以再试一次，或者直接看变化。') + '</div>' : '';
  const comparison = options.retry
    ? '<div class="review-why-section"><strong>先别看答案</strong><p>棋盘已经回到这一步之前。直接在左边棋盘走出你现在认为更好的着法。</p></div>'
    : '<div class="review-move-grade"><b>' + mark.text + '</b><span>局势 ' + escapeHtml(reviewScoreText(point.actualScore)) + '</span></div><div class="review-why-summary"><div><span>你的走法</span><strong>' + escapeHtml(actualNotation) + '</strong></div><div><span>更好的选择</span><strong>' + escapeHtml(bestNotation) + '</strong></div></div>';
  content.innerHTML = comparison + feedback + '<div class="review-quick-actions"><button class="button button-ghost" data-review-retry>' + (options.retry ? '重新开始' : '重试') + '</button><button class="button button-ghost" data-review-quick-best>看变化</button><button class="button button-primary" data-review-learn>学懂这一步</button><button class="button button-ghost" data-review-next-key>下一关键点 →</button></div>';
}

function renderReviewPassiveMove(entry) {
  const eyebrow = document.querySelector('#reviewPanelEyebrow');
  const title = document.querySelector('#reviewWhyTitle');
  const content = document.querySelector('#reviewWhyContent');
  if (eyebrow) eyebrow.textContent = 'REVIEW · 第 ' + entry.ply + ' 手';
  if (title) title.textContent = entry.color === activeReviewGame?.color ? '你的着法' : '对手的着法';
  if (content) {
    content.className = '';
    content.innerHTML = '<div class="review-why-section"><strong>' + escapeHtml(entry.notation) + '</strong><p>' + (entry.color === activeReviewGame?.color ? '这一步没有被标记为主要转折点。继续逐手查看，或跳到下一个关键位置。' : '这是对手的回应。继续下一手，看看你的应对。') + '</p></div><div class="review-quick-actions"><button class="button button-primary" data-review-next-key>下一关键点 →</button></div>';
  }
}

function setReviewCursor(ply) {
  if (!activeReviewGame) return;
  const total = activeReviewGame.moves?.length || 0;
  const nextPly = Math.max(0, Math.min(total, Number(ply) || 0));
  reviewCursorPly = nextPly;
  activeReviewPly = nextPly || null;
  reviewDeepRequestId += 1;
  activeReviewDeep = null;
  reviewRetryState = null;
  reviewRoutePlayback = null;
  document.querySelector('#reviewRouteDock')?.classList.add('hidden');
  const board = reviewBoardAfterPly(activeReviewGame, nextPly);
  const currentMove = nextPly > 0 ? activeReviewGame.moves?.[nextPly - 1]?.move : null;
  renderReviewBoard(board, currentMove, activeReviewGame.color === 'black');
  if (currentMove) drawReviewMoveArrow(currentMove, 'actual');
  const entries = reviewEntries(activeReviewGame);
  const entry = entries[nextPly - 1] || null;
  const boardMove = document.querySelector('#reviewBoardMove');
  const note = document.querySelector('#reviewBoardNote');
  const side = document.querySelector('#reviewBoardSide');
  if (boardMove) boardMove.textContent = entry ? ('第 ' + nextPly + ' 手 · ' + entry.notation) : '初始局面';
  if (note) note.textContent = entry ? '黄色箭头是实战着法。右侧棋谱可以点击任意一步。' : '从开局开始逐手回放。';
  if (side) side.textContent = activeReviewGame.color === 'red' ? '你执红' : '你执黑';
  const assessment = reviewAssessmentAt(nextPly);
  if (assessment) renderReviewQuick(assessment);
  else if (entry) renderReviewPassiveMove(entry);
  else {
    const eyebrow = document.querySelector('#reviewPanelEyebrow');
    const title = document.querySelector('#reviewWhyTitle');
    const content = document.querySelector('#reviewWhyContent');
    if (eyebrow) eyebrow.textContent = 'REVIEW · 开局';
    if (title) title.textContent = '从第一手开始';
    if (content) content.innerHTML = '<div class="review-why-section"><p>用下方按钮逐手回放，或直接跳到下一关键点。</p></div><div class="review-quick-actions"><button class="button button-primary" data-review-next-key>第一个关键点 →</button></div>';
  }
  renderReviewMoveList();
  renderReviewEvalGraph();
  updateReviewEvalBar();
  updateReviewPlaybackControls();
  const sideMeta = document.querySelector('#reviewSideMeta');
  if (sideMeta) sideMeta.textContent = nextPly + ' / ' + total + ' 手';
}

showReviewTurningPoint = function(ply) {
  setReviewCursor(ply);
}

function jumpReviewKey(direction = 1) {
  const points = reviewDisplayPoints();
  if (!points.length) return;
  let target = null;
  if (direction > 0) target = points.find((item) => Number(item.ply) > Number(reviewCursorPly)) || points[points.length - 1];
  else target = [...points].reverse().find((item) => Number(item.ply) < Number(reviewCursorPly)) || points[0];
  if (target) setReviewCursor(target.ply);
}

function stopReviewAutoplay() {
  if (reviewAutoplayTimer) clearInterval(reviewAutoplayTimer);
  reviewAutoplayTimer = null;
  updateReviewPlaybackControls();
}

function toggleReviewAutoplay() {
  if (reviewAutoplayTimer) { stopReviewAutoplay(); return; }
  const total = activeReviewGame?.moves?.length || 0;
  if (!total) return;
  if (reviewCursorPly >= total) setReviewCursor(0);
  reviewAutoplayTimer = setInterval(() => {
    if (!activeReviewGame) { stopReviewAutoplay(); return; }
    const end = activeReviewGame.moves?.length || 0;
    if (reviewCursorPly >= end) { stopReviewAutoplay(); return; }
    setReviewCursor(reviewCursorPly + 1);
  }, 900);
  updateReviewPlaybackControls();
}

function handleReviewNav(action) {
  if (!activeReviewGame) return;
  const total = activeReviewGame.moves?.length || 0;
  if (action === 'play') { toggleReviewAutoplay(); return; }
  stopReviewAutoplay();
  if (action === 'first') setReviewCursor(0);
  if (action === 'prev') setReviewCursor(reviewCursorPly - 1);
  if (action === 'next') setReviewCursor(reviewCursorPly + 1);
  if (action === 'last') setReviewCursor(total);
}

function updateReviewPlaybackControls() {
  const total = activeReviewGame?.moves?.length || 0;
  const first = document.querySelector('[data-review-nav="first"]');
  const prev = document.querySelector('[data-review-nav="prev"]');
  const next = document.querySelector('[data-review-nav="next"]');
  const last = document.querySelector('[data-review-nav="last"]');
  const play = document.querySelector('[data-review-nav="play"]');
  const progress = document.querySelector('#reviewPlaybackProgress');
  if (first) first.disabled = reviewCursorPly <= 0;
  if (prev) prev.disabled = reviewCursorPly <= 0;
  if (next) next.disabled = reviewCursorPly >= total;
  if (last) last.disabled = reviewCursorPly >= total;
  if (play) play.textContent = reviewAutoplayTimer ? '❚❚' : '▶';
  if (progress) progress.textContent = reviewCursorPly + ' / ' + total;
}

startQuickBestRoute = function() {
  if (!activeReviewGame) return;
  const point = activeReviewPoint();
  if (!point) return;
  const sourceBoard = reviewBoardBefore(activeReviewGame, point.ply);
  const pv = point.bestPv?.length ? point.bestPv : point.bestMove ? [point.bestMove] : [];
  const route = reviewRouteFromPv(sourceBoard, pv);
  if (!route.steps.length) return;
  reviewRoutePlayback = { key: 'best', index: 0, route, sourceBoard, title: 'Pikafish 最佳变化', returnMode: 'review' };
  renderReviewRoutePlayback();
}

startReviewRoutePlayback = function(key) {
  const analysis = activeReviewDeep?.analysis;
  const route = analysis?.routes?.[key];
  if (!route?.steps?.length || !analysis?.sourceBoard) return;
  reviewRoutePlayback = { key, index: 0, route, sourceBoard: analysis.sourceBoard, title: key === 'best' ? '更好路线' : '你的实战路线', returnMode: 'learn' };
  renderReviewRoutePlayback();
}

renderReviewRoutePlayback = function() {
  if (!reviewRoutePlayback) return;
  const route = reviewRoutePlayback.route;
  const sourceBoard = reviewRoutePlayback.sourceBoard;
  if (!route || !sourceBoard) return;
  const steps = route.steps || [];
  reviewRetryState = null;
  reviewRoutePlayback.index = Math.max(0, Math.min(steps.length, reviewRoutePlayback.index));
  const board = reviewRouteBoard(sourceBoard, route, reviewRoutePlayback.index);
  const highlight = reviewRoutePlayback.index > 0 ? steps[reviewRoutePlayback.index - 1]?.move : null;
  renderReviewBoard(board, highlight, activeReviewGame?.color === 'black');
  if (highlight) drawReviewMoveArrow(highlight, reviewRoutePlayback.key === 'best' ? 'best' : 'actual');
  document.querySelector('#reviewRouteDock')?.classList.remove('hidden');
  const kind = document.querySelector('#reviewRouteKind');
  const move = document.querySelector('#reviewRouteMove');
  const step = document.querySelector('#reviewRouteStep');
  const prev = document.querySelector('[data-review-route-step="prev"]');
  const next = document.querySelector('[data-review-route-step="next"]');
  if (kind) kind.textContent = reviewRoutePlayback.title || '变化路线';
  if (move) move.textContent = reviewRoutePlayback.index === 0 ? '从关键局面开始' : (steps[reviewRoutePlayback.index - 1]?.notation || '继续');
  if (step) step.textContent = reviewRoutePlayback.index + ' / ' + steps.length;
  if (prev) prev.disabled = reviewRoutePlayback.index <= 0;
  if (next) next.disabled = reviewRoutePlayback.index >= steps.length;
}

exitReviewRoutePlayback = function() {
  const mode = reviewRoutePlayback?.returnMode;
  reviewRoutePlayback = null;
  reviewRetryState = null;
  document.querySelector('#reviewRouteDock')?.classList.add('hidden');
  const board = reviewBoardAfterPly(activeReviewGame, reviewCursorPly);
  const move = reviewCursorPly > 0 ? activeReviewGame?.moves?.[reviewCursorPly - 1]?.move : null;
  renderReviewBoard(board, move, activeReviewGame?.color === 'black');
  if (move) drawReviewMoveArrow(move, 'actual');
  if (mode !== 'learn') {
    const point = activeReviewPoint();
    if (point) renderReviewQuick(point);
  }
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
if (window.location.hash === "#review") void loadReviewGames();
void ensureIdentity().then(() => {
  void loadHistory();
}).catch(() => renderIdentity());
