const landingPage = document.querySelector("#landingPage");
const appShell = document.querySelector(".app-shell");
const landingBoard = document.querySelector("#landingBoard");
const landingToast = document.querySelector("#landingToast");

let guestMode = false;
let wasSignedIn = false;
let toastTimer = null;

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

function showLanding() {
  document.body.classList.remove("auth-pending", "landing-guest-mode");
  document.body.classList.add("auth-landing");
  landingPage.hidden = false;
  landingPage.setAttribute("aria-hidden", "false");
  appShell?.setAttribute("aria-hidden", "true");
  renderDemoBoard();
}

function showProduct(view = null) {
  document.body.classList.remove("auth-pending", "auth-landing");
  if (guestMode) document.body.classList.add("landing-guest-mode");
  landingPage.hidden = true;
  landingPage.setAttribute("aria-hidden", "true");
  appShell?.removeAttribute("aria-hidden");
  if (view) {
    window.location.hash = view;
    window.XiangqiPlatform?.switchView?.(view);
  }
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

function syncAuthState(state = window.QiliAuth?.getState?.()) {
  const signedIn = Boolean(state?.signedIn);
  if (signedIn) {
    guestMode = false;
    wasSignedIn = true;
    showProduct();
    return;
  }
  if (wasSignedIn) {
    wasSignedIn = false;
    guestMode = false;
  }
  if (guestMode) showProduct();
  else showLanding();
}

async function handleSignIn(button) {
  const original = button.innerHTML;
  button.disabled = true;
  if (button.matches(".landing-login")) button.textContent = "正在打开…";
  try {
    await window.QiliAuth?.ready?.();
    const state = window.QiliAuth?.getState?.();
    if (!state?.enabled) {
      showToast("登录服务正在配置中，你可以先以游客身份体验完整对弈。");
      return;
    }
    await window.QiliAuth.openSignIn();
  } catch (error) {
    console.error("[landing-sign-in]", error);
    showToast("暂时无法打开登录，请稍后再试，或先体验一局。");
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

document.querySelectorAll("[data-landing-action]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.landingAction === "signin") {
      void handleSignIn(button);
      return;
    }
    if (button.dataset.landingAction === "mode") {
      guestMode = true;
      showProduct("online");
      selectOnlineTimeControl(button.dataset.timeControl || "600+0");
      return;
    }
    guestMode = true;
    showProduct("play");
  });
});

window.addEventListener("qili-clerk-state", (event) => syncAuthState(event.detail));

await window.QiliAuth?.ready?.().catch(() => null);
syncAuthState();
