const isLocalDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API = window.__QILI_ONLINE_API__ || (isLocalDev ? "http://127.0.0.1:8787" : window.location.origin);
const ACCOUNT_KEY = "qili-account-v1";

let account = null;
let bootPromise = null;
let historyLoading = false;
let registeredClaimed = false;

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
  } catch (error) {
    if (list) list.innerHTML = `<div class="profile-history-empty"><strong>历史棋局暂时无法读取</strong><p>${escapeHtml(error.message)}</p></div>`;
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

window.addEventListener("qili-game-finished", () => void loadHistory());
window.addEventListener("qili-clerk-state", (event) => {
  const signedIn = Boolean(event.detail?.signedIn);
  if (signedIn) {
    registeredClaimed = false;
    void claimClerkIdentity().then(() => loadHistory()).catch((error) => {
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
  getAccountToken,
  getAuthToken,
  getUser,
  getRatings,
};

renderIdentity();
void ensureIdentity().then(() => loadHistory()).catch(() => renderIdentity());
