const landingPage = document.querySelector("#landingPage");
const legalPage = document.querySelector("#legalPage");
const appShell = document.querySelector(".app-shell");
const landingBoard = document.querySelector("#landingBoard");
const landingToast = document.querySelector("#landingToast");
const bootSplash = document.querySelector("#bootSplash");

const APP_VIEWS = new Set(["home", "play", "online", "train", "learn", "review", "analysis", "profile", "kids"]);
const LEGAL_VIEWS = new Set(["pricing", "privacy", "terms"]);

const GUEST_KEY = "qili-guest-shell";

let guestMode = readGuestFlag();
let wasSignedIn = false;
let toastTimer = null;
let applyingRoute = false;
let lastRouteKey = "";
let pendingPricing = false;
let signInIntent = null;

function readGuestFlag() {
  try {
    return sessionStorage.getItem(GUEST_KEY) === "1";
  } catch {
    return false;
  }
}

function writeGuestFlag(on) {
  guestMode = Boolean(on);
  try {
    if (guestMode) sessionStorage.setItem(GUEST_KEY, "1");
    else sessionStorage.removeItem(GUEST_KEY);
  } catch {
    /* ignore */
  }
}

const demoPieces = [
  [0, 0, "車", "black"], [0, 1, "馬", "black"], [0, 4, "將", "black"], [0, 8, "車", "black"],
  [2, 1, "砲", "black"], [2, 7, "砲", "black"], [3, 0, "卒", "black"], [3, 4, "卒", "black"], [3, 8, "卒", "black"],
  [5, 4, "兵", "red"], [6, 0, "兵", "red"], [6, 8, "兵", "red"], [7, 4, "炮", "red"], [7, 7, "炮", "red"],
  [8, 2, "馬", "red"], [9, 0, "車", "red"], [9, 3, "仕", "red"], [9, 4, "帥", "red"], [9, 8, "車", "red"],
];

function renderDemoBoard() {
  if (!landingBoard || landingBoard.childElementCount) return;
  demoPieces.forEach(([row, col, label, color], index) => {
    const piece = document.createElement("span");
    piece.className = `landing-piece ${color}${index === 12 ? " landing-piece-focus" : ""}`;
    piece.textContent = label;
    piece.style.setProperty("--row", row);
    piece.style.setProperty("--col", col);
    piece.setAttribute("aria-hidden", "true");
    landingBoard.appendChild(piece);
  });
}

function showToast(message) {
  if (!landingToast) return;
  window.clearTimeout(toastTimer);
  landingToast.textContent = message;
  landingToast.classList.add("show");
  toastTimer = window.setTimeout(() => landingToast.classList.remove("show"), 3200);
}

function isSignedIn() {
  return Boolean(window.QiliAuth?.isSignedIn?.());
}

function currentRoute() {
  const path = (location.pathname.replace(/\/+$/, "") || "/");
  if (path === "/pricing" || path === "/privacy" || path === "/terms") return path.slice(1);
  const hash = location.hash.replace(/^#/, "").split("?")[0];
  if (LEGAL_VIEWS.has(hash)) return hash;
  if (APP_VIEWS.has(hash)) return hash;
  if (hash === "landingFeatures") return "landingFeatures";
  return "landing";
}

function urlFor(route) {
  if (LEGAL_VIEWS.has(route)) return `/${route}`;
  if (APP_VIEWS.has(route)) return `/#${route}`;
  if (route === "landingFeatures") return "/#landingFeatures";
  return "/";
}

function setUrl(route, { replace = false } = {}) {
  const url = urlFor(route);
  const current = `${location.pathname}${location.hash}` || "/";
  if (current === url || (url === "/" && current === "/")) return;
  history[replace ? "replaceState" : "pushState"](null, "", url);
}

function hideSplash() {
  document.body.classList.remove("auth-pending");
  if (bootSplash) bootSplash.hidden = true;
}

function setPageTitle(route) {
  const titles = {
    pricing: "定价 · 棋理 Qili",
    privacy: "隐私政策 · 棋理 Qili",
    terms: "使用条款 · 棋理 Qili",
  };
  document.title = titles[route] || "棋理 Qili · 在线中国象棋";
}

function leaveAppOverlays() {
  document.body.classList.remove(
    "modal-open",
    "play-mode",
    "analysis-mode",
    "online-mode",
    "online-table-active",
  );
  document.querySelector("#kidsView")?.classList.add("hidden");
  document.querySelector("#premiumModal")?.classList.add("hidden");
}

function showLanding(anchor = null) {
  hideSplash();
  writeGuestFlag(false);
  signInIntent = null;
  leaveAppOverlays();
  document.body.classList.remove("in-app", "legal-mode", "landing-guest-mode");
  document.body.classList.add("auth-landing");
  landingPage.hidden = false;
  landingPage.setAttribute("aria-hidden", "false");
  if (legalPage) {
    legalPage.hidden = true;
    legalPage.setAttribute("aria-hidden", "true");
  }
  appShell?.setAttribute("aria-hidden", "true");
  setPageTitle("landing");
  renderDemoBoard();
  if (anchor === "landingFeatures") {
    document.querySelector("#landingFeatures")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    window.scrollTo(0, 0);
  }
}

function showLegal(route) {
  hideSplash();
  leaveAppOverlays();
  document.body.classList.remove("in-app", "auth-landing", "landing-guest-mode", "auth-pending");
  document.body.classList.add("legal-mode");
  landingPage.hidden = true;
  landingPage.setAttribute("aria-hidden", "true");
  if (legalPage) {
    legalPage.hidden = false;
    legalPage.setAttribute("aria-hidden", "false");
  }
  appShell?.setAttribute("aria-hidden", "true");
  document.querySelectorAll(".legal-article").forEach((article) => {
    article.hidden = article.id !== `legal${route[0].toUpperCase()}${route.slice(1)}`;
  });
  const signedIn = isSignedIn();
  legalPage?.querySelectorAll("[data-legal-app]").forEach((button) => {
    button.hidden = !signedIn;
  });
  legalPage?.querySelectorAll("[data-landing-action='signin']").forEach((button) => {
    button.hidden = signedIn;
  });
  setPageTitle(route);
  window.scrollTo(0, 0);
}

function showProduct(view = "home") {
  hideSplash();
  const target = APP_VIEWS.has(view) ? view : "home";
  document.body.classList.remove("auth-pending", "auth-landing", "legal-mode");
  document.body.classList.add("in-app");
  document.body.classList.toggle("landing-guest-mode", guestMode && !isSignedIn());
  landingPage.hidden = true;
  landingPage.setAttribute("aria-hidden", "true");
  if (legalPage) {
    legalPage.hidden = true;
    legalPage.setAttribute("aria-hidden", "true");
  }
  appShell?.removeAttribute("aria-hidden");
  document.querySelector("#guestSessionBar")?.classList.toggle("hidden", isSignedIn());
  setPageTitle(target);
  window.XiangqiPlatform?.switchView?.(target);
}

function selectOnlineTimeControl(value) {
  let attempts = 0;
  const applySelection = () => {
    const select = document.querySelector("#onlineTimeControl");
    attempts += 1;
    if (select) {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    if (attempts < 60) window.setTimeout(applySelection, 50);
  };
  applySelection();
}

function applyRoute({ replace = true } = {}) {
  const route = currentRoute();
  const signedIn = isSignedIn();
  const key = `${location.pathname}${location.hash}|${route}|${signedIn}|${guestMode}`;
  if (applyingRoute || key === lastRouteKey) return;
  applyingRoute = true;
  lastRouteKey = key;
  try {
    if (LEGAL_VIEWS.has(route)) {
      if (location.pathname !== `/${route}`) setUrl(route, { replace: true });
      showLegal(route);
      return;
    }
    if (signedIn) {
      writeGuestFlag(false);
      if (route === "landing" || route === "landingFeatures") {
        setUrl("home", { replace: true });
        showProduct("home");
        return;
      }
      showProduct(route);
      return;
    }
    if (route === "landingFeatures") {
      showLanding("landingFeatures");
      return;
    }
    if (APP_VIEWS.has(route) && guestMode) {
      showProduct(route);
      return;
    }
    if (APP_VIEWS.has(route) && !guestMode) {
      setUrl("landing", { replace: true });
      showLanding();
      return;
    }
    showLanding();
  } finally {
    applyingRoute = false;
  }
}

function navigate(route, { replace = false } = {}) {
  lastRouteKey = "";
  setUrl(route, { replace });
  applyRoute({ replace });
}

function enterGuest(view = "play") {
  writeGuestFlag(true);
  wasSignedIn = false;
  signInIntent = "stay";
  navigate(view);
}

async function handleSignIn(button, intent = "landing") {
  signInIntent = intent;
  const original = button?.innerHTML;
  if (button) {
    button.disabled = true;
    if (button.matches(".landing-login, .landing-cta")) button.textContent = "正在打开登录…";
  }
  try {
    await window.QiliAuth?.ready?.();
    const state = window.QiliAuth?.getState?.();
    if (!state?.enabled || !window.QiliAuth?.openSignIn) {
      showToast("登录还没接上。要先下棋请点「先体验人机对局」。");
      return;
    }
    await window.QiliAuth.openSignIn();
  } catch (error) {
    console.error("[landing-sign-in]", error);
    showToast("暂时无法打开登录。请稍后再试，或点「先体验人机对局」。");
  } finally {
    if (button) {
      button.disabled = false;
      if (original) button.innerHTML = original;
    }
  }
}

function openPricingCheckout() {
  guestMode = false;
  pendingPricing = false;
  navigate("profile");
  window.QiliPremium?.open?.("coach");
}

function handlePricingCta() {
  if (isSignedIn()) {
    openPricingCheckout();
    return;
  }
  pendingPricing = true;
  void handleSignIn(document.querySelector("[data-pricing-cta]"), "pricing");
}

function syncAuthState(state = window.QiliAuth?.getState?.()) {
  const signedIn = Boolean(state?.signedIn);
  if (signedIn) {
    wasSignedIn = true;
    if (pendingPricing || signInIntent === "pricing") {
      openPricingCheckout();
      return;
    }
    const route = currentRoute();
    if (LEGAL_VIEWS.has(route)) {
      writeGuestFlag(false);
      showLegal(route);
      return;
    }
    const stayInApp = guestMode && APP_VIEWS.has(route);
    writeGuestFlag(false);
    const target = stayInApp || signInIntent === "stay" ? (APP_VIEWS.has(route) ? route : "home") : "home";
    signInIntent = null;
    lastRouteKey = "";
    setUrl(target, { replace: true });
    showProduct(target);
    return;
  }
  if (wasSignedIn) {
    wasSignedIn = false;
    writeGuestFlag(false);
    lastRouteKey = "";
    setUrl("landing", { replace: true });
    showLanding();
    return;
  }
  applyRoute();
}

document.addEventListener("click", (event) => {
  const homeLink = event.target.closest("[data-legal-home], .landing-brand[href='/'], .landing-brand[href='#landingTop']");
  if (homeLink && event.button === 0 && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    if (isSignedIn()) navigate("home");
    else navigate("landing");
    return;
  }

  const legalApp = event.target.closest("[data-legal-app]");
  if (legalApp) {
    event.preventDefault();
    navigate("home");
    return;
  }

  const pricingCta = event.target.closest("[data-pricing-cta]");
  if (pricingCta) {
    event.preventDefault();
    handlePricingCta();
    return;
  }

  const actionButton = event.target.closest("[data-landing-action]");
  if (actionButton) {
    event.preventDefault();
    const action = actionButton.dataset.landingAction;
    if (action === "signin") {
      void handleSignIn(actionButton, "landing");
      return;
    }
    if (action === "mode") {
      enterGuest("online");
      selectOnlineTimeControl(actionButton.dataset.timeControl || "600+0");
      return;
    }
    if (action === "guest") {
      enterGuest("play");
      return;
    }
    return;
  }

  const link = event.target.closest('a[href="/pricing"], a[href="/privacy"], a[href="/terms"], a[href="/"], a[href="#landingFeatures"], a[href="#landingTop"]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
  const href = link.getAttribute("href");
  event.preventDefault();
  if (href === "/pricing") navigate("pricing");
  else if (href === "/privacy") navigate("privacy");
  else if (href === "/terms") navigate("terms");
  else if (href === "#landingFeatures") navigate("landingFeatures");
  else if (isSignedIn()) navigate("home");
  else navigate("landing");
});

document.querySelector("#appBrand")?.addEventListener("click", (event) => {
  event.preventDefault();
  if (isSignedIn()) navigate("home");
  else {
    guestMode = false;
    navigate("landing");
  }
});

window.addEventListener("qili-clerk-state", (event) => syncAuthState(event.detail));
window.addEventListener("popstate", () => {
  lastRouteKey = "";
  applyRoute();
});
window.addEventListener("hashchange", () => {
  lastRouteKey = "";
  applyRoute();
});

window.QiliShell = {
  navigate,
  showLanding,
  showProduct,
  enterGuest,
  openSignIn: (button) => handleSignIn(button || document.querySelector("#topbarSignIn"), guestMode ? "stay" : "landing"),
  isGuest: () => guestMode && !isSignedIn(),
};

void window.QiliAuth?.ready?.()
  .then(() => syncAuthState())
  .catch(() => {
    hideSplash();
    applyRoute();
  });
