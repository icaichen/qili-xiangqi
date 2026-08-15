const isLocalDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const API = window.__QILI_ONLINE_API__ || (isLocalDev ? "http://127.0.0.1:8787" : window.location.origin);

const clerkZhCN = {
  locale: "zh-CN",
  backButton: "返回",
  dividerText: "或",
  footerActionLink__alternativePhoneCodeProvider: "改用短信验证码",
  footerActionLink__useAnotherMethod: "使用其他方式",
  footerPageLink__help: "帮助",
  footerPageLink__privacy: "隐私",
  footerPageLink__terms: "条款",
  formButtonPrimary: "继续",
  formButtonPrimary__verify: "验证",
  formFieldAction__forgotPassword: "忘记密码？",
  formFieldInputPlaceholder__emailAddress: "输入邮箱地址",
  formFieldInputPlaceholder__emailAddress_username: "输入邮箱或用户名",
  formFieldInputPlaceholder__password: "输入密码",
  formFieldInputPlaceholder__signUpPassword: "设置密码",
  formFieldLabel__emailAddress: "邮箱地址",
  formFieldLabel__emailAddress_username: "邮箱地址或用户名",
  formFieldLabel__password: "密码",
  signInEnterPasswordTitle: "输入密码",
  socialButtonsBlockButton: "使用 {{provider|titleize}} 继续",
  socialButtonsBlockButtonManyInView: "{{provider|titleize}}",
  signIn: {
    alternativeMethods: {
      actionLink: "获取帮助",
      actionText: "这些方式都无法使用？",
      blockButton__backupCode: "使用备用验证码",
      blockButton__emailCode: "向 {{identifier}} 发送邮箱验证码",
      blockButton__emailLink: "向 {{identifier}} 发送登录链接",
      blockButton__passkey: "使用 Passkey 登录",
      blockButton__password: "使用密码登录",
      blockButton__phoneCode: "向 {{identifier}} 发送短信验证码",
      blockButton__totp: "使用身份验证器",
      subtitle: "如果当前方式不可用，可以选择其他登录方式。",
      title: "使用其他方式",
    },
    emailCode: {
      formTitle: "邮箱验证码",
      resendButton: "没有收到验证码？重新发送",
      subtitle: "继续使用 {{applicationName}}",
      title: "查看你的邮箱",
    },
    emailCodeMfa: {
      formTitle: "邮箱验证码",
      resendButton: "没有收到验证码？重新发送",
      subtitle: "继续使用 {{applicationName}}",
      title: "查看你的邮箱",
    },
    forgotPassword: {
      formTitle: "重置密码验证码",
      resendButton: "没有收到验证码？重新发送",
      subtitle: "用于重置密码",
      subtitle_email: "请输入发送到邮箱的验证码",
      subtitle_phone: "请输入发送到手机的验证码",
      title: "重置密码",
    },
    password: {
      actionLink: "使用其他方式",
      subtitle: "输入与账户关联的密码",
      title: "输入密码",
    },
    start: {
      actionLink: "注册",
      actionLink__join_waitlist: "加入候补名单",
      actionLink__use_email: "使用邮箱",
      actionLink__use_email_username: "使用邮箱或用户名",
      actionLink__use_passkey: "改用 Passkey",
      actionLink__use_phone: "使用手机号",
      actionLink__use_username: "使用用户名",
      actionText: "还没有账户？",
      actionText__join_waitlist: "想提前使用？",
      subtitle: "欢迎回来，请登录继续",
      title: "登录 {{applicationName}}",
      titleCombined: "继续使用 {{applicationName}}",
    },
  },
  signUp: {
    continue: {
      actionLink: "登录",
      actionText: "已有账户？",
      subtitle: "请补充剩余信息以继续。",
      title: "完善账户信息",
    },
    emailCode: {
      formSubtitle: "输入发送到邮箱的验证码",
      formTitle: "邮箱验证码",
      resendButton: "没有收到验证码？重新发送",
      subtitle: "输入发送到邮箱的验证码",
      title: "验证邮箱",
    },
    start: {
      actionLink: "登录",
      actionLink__use_email: "改用邮箱",
      actionLink__use_phone: "改用手机号",
      actionText: "已有账户？",
      subtitle: "创建账户后即可跨设备恢复棋局与 Rating。",
      subtitleCombined: "创建账户后即可跨设备恢复棋局与 Rating。",
      title: "创建账户",
      titleCombined: "创建账户",
    },
  },
};

function localizeAuthEntry() {
  const signInButton = document.querySelector("#profileSignIn");
  if (signInButton) signInButton.textContent = "邮箱 / Google 登录";
}

localizeAuthEntry();

let config = { enabled: false, publishableKey: null };
let authState = { loaded: false, signedIn: false, user: null, session: null, error: null };
let readyPromise = null;

function emitAuthState() {
  window.dispatchEvent(new CustomEvent("qili-clerk-state", {
    detail: {
      enabled: Boolean(config.enabled),
      loaded: authState.loaded,
      signedIn: authState.signedIn,
      user: authState.user,
    },
  }));
}

function decodeClerkDomain(publishableKey) {
  try {
    const encoded = String(publishableKey || "").split("_")[2] || "";
    return atob(encoded).slice(0, -1);
  } catch {
    return "";
  }
}

function loadScript(src, attributes = {}) {
  return new Promise((resolve, reject) => {
    const existing = [...document.scripts].find((script) => script.src === src);
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve(existing);
      existing.addEventListener("load", () => resolve(existing), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    Object.entries(attributes).forEach(([key, value]) => script.setAttribute(key, value));
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve(script);
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

async function fetchConfig() {
  const response = await fetch(`${API}/api/auth/config`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Auth config failed (${response.status})`);
  return payload;
}

async function initialize() {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    try {
      config = await fetchConfig();
      if (!config.enabled || !config.publishableKey) {
        authState = { loaded: true, signedIn: false, user: null, session: null, error: null };
        emitAuthState();
        return authState;
      }

      const domain = decodeClerkDomain(config.publishableKey);
      if (!domain) throw new Error("Invalid Clerk publishable key");

      await loadScript(`https://${domain}/npm/@clerk/ui@1/dist/ui.browser.js`);
      await loadScript(`https://${domain}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, {
        "data-clerk-publishable-key": config.publishableKey,
      });

      if (!window.Clerk) throw new Error("ClerkJS did not initialize");
      await window.Clerk.load({
        ui: { ClerkUI: window.__internal_ClerkUICtor },
        localization: clerkZhCN,
      });

      const sync = ({ user = window.Clerk.user, session = window.Clerk.session } = {}) => {
        authState = {
          loaded: true,
          signedIn: Boolean(user && session),
          user: user || null,
          session: session || null,
          error: null,
        };
        emitAuthState();
      };

      sync();
      window.Clerk.addListener((emission) => sync(emission), { skipInitialEmit: true });
      return authState;
    } catch (error) {
      console.error("[auth-client]", error);
      authState = { loaded: true, signedIn: false, user: null, session: null, error: error.message };
      emitAuthState();
      return authState;
    }
  })();
  return readyPromise;
}

async function getSessionToken() {
  await initialize();
  if (!authState.signedIn || !window.Clerk?.session) return null;
  return window.Clerk.session.getToken();
}

function getDisplayName() {
  const user = authState.user;
  if (!user) return "";
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName.slice(0, 24);
  return String(user.primaryEmailAddress?.emailAddress || "").split("@")[0].slice(0, 24);
}

function getPrimaryEmail() {
  return authState.user?.primaryEmailAddress?.emailAddress || "";
}

async function openSignIn() {
  await initialize();
  if (!config.enabled || !window.Clerk) throw new Error("正式登录尚未配置");
  return window.Clerk.openSignIn();
}

async function signOut() {
  await initialize();
  if (!window.Clerk) return;
  await window.Clerk.signOut();
}

async function createPasskey() {
  await initialize();
  if (!authState.signedIn || !window.Clerk?.user) throw new Error("请先登录正式账户");
  return window.Clerk.user.createPasskey();
}

function isSignedIn() {
  return Boolean(authState.signedIn);
}

function isEnabled() {
  return Boolean(config.enabled);
}

function getState() {
  return { ...authState, enabled: Boolean(config.enabled) };
}

window.QiliAuth = {
  ready: initialize,
  getSessionToken,
  getDisplayName,
  getPrimaryEmail,
  openSignIn,
  signOut,
  createPasskey,
  isSignedIn,
  isEnabled,
  getState,
};

void initialize();
