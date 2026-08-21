const STORE_KEY = "qili-premium-v1";
const TRIAL_DAYS = 7;
const isLocalDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API_BASE = window.__QILI_ENGINE_API__ || window.__QILI_ONLINE_API__ || (isLocalDev ? "http://127.0.0.1:8787" : window.location.origin);

const PLANS = {
  monthly: { id: "monthly", label: "月付", price: "¥19", period: "/月", note: "随时可停" },
  yearly: { id: "yearly", label: "年付", price: "¥148", period: "/年", note: "相当于 ¥12.3 / 月" },
};

const FEATURES = {
  coach: {
    title: "AI Coach",
    blurb: "每一步的为什么、更好的选择、棋理建议。",
  },
  engine: {
    title: "引擎评估",
    blurb: "评估条、首选着、候选着。分析页可以摆棋，引擎要 Pro。",
  },
  reviewScan: {
    title: "引擎复盘",
    blurb: "仍可逐手回放自己的棋。Pikafish 扫描和讲解要 Pro。",
  },
};

let cached = loadCache();
let billingConfig = {
  enabled: false,
  overlay: true,
  trialDays: TRIAL_DAYS,
  provider: null,
  plans: PLANS,
};
let syncing = false;
let actionBusy = false;

function emptyEntitlement() {
  return {
    plan: "free",
    source: null,
    status: "free",
    pro: false,
    expiresAt: null,
    provider: null,
    planId: null,
    trialUsed: false,
  };
}

function loadCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (raw && (raw.plan === "free" || raw.plan === "pro")) return { ...emptyEntitlement(), ...raw };
  } catch {
    /* ignore */
  }
  return emptyEntitlement();
}

function saveCache(value) {
  localStorage.setItem(STORE_KEY, JSON.stringify(value));
}

function isSignedIn() {
  return Boolean(window.QiliAuth?.isSignedIn?.());
}

function isPro() {
  const entitlement = cached;
  if (!entitlement?.pro && entitlement?.plan !== "pro") return false;
  if (entitlement.expiresAt && Number(entitlement.expiresAt) < Date.now()) {
    cached = {
      ...entitlement,
      plan: "free",
      pro: false,
      status: entitlement.source === "trial" ? "trial-ended" : "free",
      trialUsed: Boolean(entitlement.trialUsed || entitlement.source === "trial"),
    };
    saveCache(cached);
    return false;
  }
  return true;
}

function can(feature) {
  if (!FEATURES[feature]) return true;
  return isPro();
}

function daysLeft() {
  if (!isPro() || !cached.expiresAt) return null;
  return Math.max(0, Math.ceil((Number(cached.expiresAt) - Date.now()) / 86400000));
}

function status() {
  const pro = isPro();
  let label = "免费";
  if (pro && cached.source === "trial") label = "Pro 试用中";
  else if (pro) label = "棋理 Pro";
  else if (cached.status === "trial-ended" || cached.source === "trial-ended" || cached.trialUsed) label = "试用已结束";
  return {
    ...cached,
    pro,
    label,
    features: FEATURES,
    plans: billingConfig.plans || PLANS,
    checkoutEnabled: Boolean(billingConfig.enabled),
    trialDays: billingConfig.trialDays || TRIAL_DAYS,
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setNote(text) {
  const note = document.querySelector("#premiumModalNote");
  if (note) note.textContent = text;
}

async function billingRequest(path, options = {}) {
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  try {
    if (isSignedIn()) await window.QiliIdentity?.claimClerkIdentity?.().catch(() => null);
    const token = await window.QiliIdentity?.getAuthToken?.();
    if (token) headers.authorization = `Bearer ${token}`;
  } catch {
    /* guest or missing identity */
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(payload.error || `请求失败 (${response.status})`), {
      status: response.status,
      code: payload.code,
    });
  }
  return payload;
}

function applyEntitlement(payload = {}) {
  cached = {
    ...emptyEntitlement(),
    plan: payload.pro || payload.plan === "pro" ? "pro" : "free",
    source: payload.source || null,
    status: payload.status || (payload.pro ? "active" : "free"),
    pro: Boolean(payload.pro),
    expiresAt: payload.expiresAt || null,
    provider: payload.provider || null,
    planId: payload.planId || null,
    trialUsed: Boolean(
      payload.trialUsed
      || payload.source === "trial"
      || payload.source === "paid"
      || payload.status === "trial-ended",
    ),
    syncedAt: Date.now(),
  };
  saveCache(cached);
  window.dispatchEvent(new CustomEvent("qili-premium-change", { detail: status() }));
  render();
  return cached;
}

async function refresh() {
  if (syncing) return cached;
  syncing = true;
  try {
    const [entitlement, config] = await Promise.all([
      billingRequest("/api/billing/entitlement").catch(() => emptyEntitlement()),
      billingRequest("/api/billing/config").catch(() => billingConfig),
    ]);
    billingConfig = {
      ...billingConfig,
      ...config,
      plans: {
        monthly: { ...PLANS.monthly, ...(config?.plans?.monthly || {}) },
        yearly: { ...PLANS.yearly, ...(config?.plans?.yearly || {}) },
      },
    };
    return applyEntitlement(entitlement);
  } finally {
    syncing = false;
  }
}

function promptSignIn(message) {
  setNote(message || "登录后才能试用或开通 Pro。先到「我的」登录。");
  window.XiangqiPlatform?.switchView?.("profile");
  window.QiliAuth?.openSignIn?.();
}

function defaultModalNote() {
  if (isPro()) return "你已经在 Pro 里。引擎评估和 AI Coach 已打开。";
  if (!isSignedIn()) return "登录后才能试用或开通。试用按账号计算，每人一次。";
  if (cached.trialUsed || cached.status === "trial-ended") {
    return billingConfig.enabled
      ? "试用已经用过。选月付或年付即可继续使用引擎和 AI Coach。"
      : "试用已经用过。支付通道接通后即可开通月付或年付。";
  }
  return billingConfig.enabled
    ? "下棋和回放始终免费。选月付或年付开通老师，也可以先试用 7 天。"
    : "支付通道即将接通。现在可以先开 7 天试用。";
}

function ensureModal() {
  if (document.querySelector("#premiumModal")) return;
  const modal = document.createElement("div");
  modal.id = "premiumModal";
  modal.className = "premium-modal hidden";
  modal.innerHTML = `
    <button class="premium-backdrop" data-premium-close type="button" aria-label="关闭"></button>
    <section class="premium-dialog" role="dialog" aria-modal="true" aria-labelledby="premiumModalTitle">
      <header>
        <div>
          <span class="eyebrow">棋理 Pro</span>
          <h2 id="premiumModalTitle">把老师请到棋盘边</h2>
        </div>
        <button class="premium-close" data-premium-close type="button" aria-label="关闭">×</button>
      </header>
      <p class="premium-lead">下棋、回放棋谱始终免费。评估条、首选着和 AI 讲解是 Pro。</p>
      <div class="premium-plan-grid">
        <button type="button" class="premium-plan" data-premium-plan="monthly">
          <span>月付</span>
          <strong>${escapeHtml(PLANS.monthly.price)}</strong>
          <small>/月</small>
        </button>
        <button type="button" class="premium-plan recommended" data-premium-plan="yearly">
          <span>年付 · 更划算</span>
          <strong>${escapeHtml(PLANS.yearly.price)}</strong>
          <small>/年 · 约 ¥12.3 / 月</small>
        </button>
      </div>
      <p id="premiumModalNote" class="premium-note">${escapeHtml(defaultModalNote())}</p>
      <button type="button" class="button button-primary action-wide" data-premium-trial>开始 7 天试用</button>
    </section>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-premium-close]")) closeModal();
    if (event.target.closest("[data-premium-plan]")) {
      void startCheckout(event.target.closest("[data-premium-plan]").dataset.premiumPlan);
    }
    if (event.target.closest("[data-premium-trial]")) void startTrial();
  });
}

function syncModalCopy() {
  const monthly = document.querySelector('[data-premium-plan="monthly"] strong');
  const yearly = document.querySelector('[data-premium-plan="yearly"] strong');
  const trialButton = document.querySelector("[data-premium-trial]");
  if (monthly) monthly.textContent = billingConfig.plans?.monthly?.price || PLANS.monthly.price;
  if (yearly) yearly.textContent = billingConfig.plans?.yearly?.price || PLANS.yearly.price;
  if (trialButton) {
    const hideTrial = isPro() || cached.trialUsed || cached.status === "trial-ended";
    trialButton.hidden = hideTrial;
    trialButton.disabled = actionBusy;
    trialButton.textContent = isSignedIn() ? "开始 7 天试用" : "登录后试用 7 天";
  }
  document.querySelectorAll("[data-premium-plan]").forEach((button) => {
    button.disabled = actionBusy;
  });
}

function openModal(feature) {
  ensureModal();
  const spec = FEATURES[feature] || { title: "棋理 Pro", blurb: "AI Coach 与引擎评估需要 Pro。" };
  const title = document.querySelector("#premiumModalTitle");
  const lead = document.querySelector(".premium-lead");
  if (title) title.textContent = spec.title;
  if (lead) lead.textContent = spec.blurb + " 下棋和逐手回放仍然免费。";
  setNote(defaultModalNote());
  syncModalCopy();
  document.querySelector("#premiumModal")?.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal() {
  document.querySelector("#premiumModal")?.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function requireFeature(feature) {
  if (can(feature)) return true;
  openModal(feature);
  return false;
}

function featureFromRequired(detail = {}) {
  const text = `${detail.code || ""} ${detail.feature || ""} ${detail.message || ""}`;
  if (/coach|讲解/i.test(text)) return "coach";
  if (/review|复盘/i.test(text)) return "reviewScan";
  return "engine";
}

async function startTrial() {
  if (actionBusy) return;
  if (isPro()) {
    setNote("你已经在 Pro 里。");
    return;
  }
  if (!isSignedIn()) {
    promptSignIn("登录后才能试用。试用按账号计算，每人一次。");
    return;
  }
  actionBusy = true;
  syncModalCopy();
  setNote("正在开通 7 天试用…");
  try {
    const entitlement = await billingRequest("/api/billing/trial", { method: "POST", body: "{}" });
    applyEntitlement(entitlement);
    closeModal();
  } catch (error) {
    if (error?.status === 401) promptSignIn(error.message);
    else setNote(error instanceof Error ? error.message : "试用失败，请稍后重试。");
  } finally {
    actionBusy = false;
    syncModalCopy();
  }
}

let paddleInitialized = false;

async function loadPaddleOverlay() {
  if (!billingConfig.clientToken) return null;
  if (window.Paddle?.Checkout && paddleInitialized) return window.Paddle;
  if (!document.querySelector("script[data-qili-paddle]")) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
      script.async = true;
      script.dataset.qiliPaddle = "1";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  if (!window.Paddle?.Initialize) return null;
  if (!paddleInitialized) {
    const options = {
      token: billingConfig.clientToken,
      eventCallback(event) {
        if (event?.name === "checkout.completed") {
          void refresh();
          closeModal();
        }
      },
    };
    if (billingConfig.environment === "sandbox") options.environment = "sandbox";
    window.Paddle.Initialize(options);
    paddleInitialized = true;
  }
  return window.Paddle;
}

function openCheckoutUrl(url) {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) window.location.assign(url);
}

async function startCheckout(planId) {
  if (actionBusy) return;
  const plan = billingConfig.plans?.[planId] || PLANS[planId] || PLANS.yearly;
  if (isPro() && cached.source !== "trial") {
    setNote("你已经开通棋理 Pro。");
    return;
  }
  if (!isSignedIn()) {
    promptSignIn("登录后才能开通。先到「我的」登录，再回来开通 Pro。");
    return;
  }
  if (!billingConfig.enabled) {
    setNote(`${plan.label} ${plan.price}${plan.period} 的支付通道即将接通。你可以先用 7 天试用。`);
    return;
  }
  actionBusy = true;
  syncModalCopy();
  setNote("正在打开结账页…");
  try {
    const checkout = await billingRequest("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({
        plan: planId === "monthly" ? "monthly" : "yearly",
        origin: window.location.origin,
        email: window.QiliAuth?.getPrimaryEmail?.() || undefined,
      }),
    });
    if (!checkout?.transactionId && !checkout?.url) throw new Error("没有拿到结账地址");
    try {
      const paddle = await loadPaddleOverlay();
      if (checkout.provider === "paddle" && paddle?.Checkout?.open && checkout.transactionId) {
        const openPayload = {
          transactionId: checkout.transactionId,
          settings: {
            displayMode: "overlay",
            theme: "light",
            locale: "zh-CN",
            successUrl: `${window.location.origin}/#profile`,
          },
        };
        const email = window.QiliAuth?.getPrimaryEmail?.();
        if (email) openPayload.customer = { email };
        paddle.Checkout.open(openPayload);
        setNote("请在结账页完成支付。完成后会自动回到棋理。");
        return;
      }
    } catch {
      /* overlay optional */
    }
    if (!checkout.url) throw new Error("没有拿到结账地址");
    openCheckoutUrl(checkout.url);
    setNote("已打开结账页。支付完成后回到「我的」，Pro 会自动打开。");
  } catch (error) {
    if (error?.status === 401) promptSignIn(error.message);
    else setNote(error instanceof Error ? error.message : "无法打开结账页。");
  } finally {
    actionBusy = false;
    syncModalCopy();
  }
}

function lockedCardHtml(feature) {
  const spec = FEATURES[feature] || FEATURES.coach;
  return `<article class="coach-empty premium-lock-card">
    <h3>${escapeHtml(spec.title)} 是 Pro</h3>
    <p>${escapeHtml(spec.blurb)} 免费仍可下棋、摆棋、回放棋谱。</p>
    <button type="button" class="button button-primary" data-open-premium="${feature}">开通棋理 Pro</button>
  </article>`;
}

function profileHtml() {
  const current = status();
  const left = daysLeft();
  let stateLine = "下棋、学习、回放棋谱免费。评估条、首选着和 AI 讲解需要 Pro。";
  if (current.pro && current.source === "trial") {
    stateLine = `试用剩余 ${left} 天。引擎评估和 AI Coach 已打开。`;
  } else if (current.pro) {
    stateLine = "引擎评估和 AI Coach 已打开。";
  } else if (current.trialUsed || current.status === "trial-ended") {
    stateLine = "试用已结束。开通月付或年付即可继续使用引擎和 AI Coach。";
  }
  const monthly = current.plans?.monthly || PLANS.monthly;
  const yearly = current.plans?.yearly || PLANS.yearly;
  let action = `<button type="button" class="button button-primary action-wide" data-open-premium="coach">开通 Pro 或试用 7 天</button>`;
  if (current.pro) {
    action = current.source === "trial"
      ? `<button type="button" class="button button-primary action-wide" data-open-premium="coach">把试用转成月付或年付</button>`
      : `<small>订阅由收款通道管理。到期前会自动续费，可随时取消。</small>`;
  } else if (!isSignedIn()) {
    action = `<button type="button" class="button button-primary action-wide" data-open-premium="coach">登录后开通 Pro</button>`;
  } else if (current.trialUsed || current.status === "trial-ended") {
    action = `<button type="button" class="button button-primary action-wide" data-open-premium="coach">开通棋理 Pro</button>`;
  }
  return `
    <div class="premium-card-head">
      <div>
        <span class="eyebrow">棋理 Pro</span>
        <h2>${current.pro ? escapeHtml(current.label) : "免费是棋桌，Pro 是老师"}</h2>
      </div>
      <span class="premium-pill ${current.pro ? "on" : ""}">${escapeHtml(current.label)}</span>
    </div>
    <p>${escapeHtml(stateLine)}</p>
    <div class="premium-split">
      <div>
        <strong>免费</strong>
        <ul>
          <li>和电脑、真人下棋</li>
          <li>学习中心</li>
          <li>儿童模式</li>
          <li>历史棋局与逐手回放</li>
          <li>摆盘研究</li>
        </ul>
      </div>
      <div>
        <strong>Pro</strong>
        <ul>
          <li>AI Coach 讲解</li>
          <li>评估条与首选着</li>
          <li>整盘引擎复盘</li>
        </ul>
      </div>
    </div>
    <div class="premium-plan-row">
      <div><b>${escapeHtml(monthly.price)}</b><span>每月</span></div>
      <div><b>${escapeHtml(yearly.price)}</b><span>每年 · 更划算</span></div>
    </div>
    ${action}
  `;
}

function bind(root) {
  root?.querySelector("[data-open-premium]")?.addEventListener("click", () => openModal("coach"));
}

function render() {
  ensureModal();
  syncModalCopy();
  const card = document.querySelector("#profilePremiumCard");
  if (card) {
    card.innerHTML = profileHtml();
    bind(card);
  }
  document.querySelectorAll("[data-open-premium]").forEach((button) => {
    if (button.closest("#profilePremiumCard")) return;
    if (button.dataset.premiumBound) return;
    button.dataset.premiumBound = "1";
    button.addEventListener("click", () => openModal(button.dataset.openPremium || "coach"));
  });
}

window.QiliPremium = {
  features: FEATURES,
  plans: PLANS,
  isPro,
  can,
  require: requireFeature,
  status,
  refresh,
  lockedCardHtml,
  open: openModal,
  render,
};

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-premium]");
  if (!button) return;
  event.preventDefault();
  openModal(button.dataset.openPremium || "coach");
});

window.addEventListener("qili-clerk-state", () => {
  if (!isSignedIn()) applyEntitlement(emptyEntitlement());
  void refresh();
});
window.addEventListener("qili-account-claimed", () => void refresh());
window.addEventListener("qili-premium-change", render);
window.addEventListener("qili-premium-required", (event) => {
  openModal(featureFromRequired(event.detail || {}));
});
window.addEventListener("hashchange", () => {
  if (window.location.hash === "#profile") void refresh();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void refresh();
});

void refresh();
new MutationObserver(() => {
  const profile = document.querySelector("#profileView");
  if (profile && !profile.classList.contains("hidden")) render();
}).observe(document.querySelector("#profileView") || document.body, { attributes: true, attributeFilter: ["class"] });

render();
