import { createHmac, timingSafeEqual } from "node:crypto";
// Billing env (Railway): PAYMENTS_PROVIDER=lemonsqueezy
// LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_WEBHOOK_SECRET
// LEMONSQUEEZY_VARIANT_MONTHLY, LEMONSQUEEZY_VARIANT_YEARLY, APP_URL
// Webhook URL: https://qilichess.com/api/billing/webhook (signing secret → LEMONSQUEEZY_WEBHOOK_SECRET)
import {
  initializePersistence,
  persistenceInfo,
  getSubscription,
  upsertSubscription,
  startServerTrial,
} from "./online-persistence.mjs";
import { authenticateAccount } from "./identity-service.mjs";

const TRIAL_DAYS = 7;
const LS_API = "https://api.lemonsqueezy.com/v1";

function json(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-qili-guest-token",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function paymentsConfig() {
  const provider = String(process.env.PAYMENTS_PROVIDER || "lemonsqueezy").toLowerCase();
  const lemonReady = Boolean(
    process.env.LEMONSQUEEZY_API_KEY
    && process.env.LEMONSQUEEZY_STORE_ID
    && process.env.LEMONSQUEEZY_VARIANT_MONTHLY
    && process.env.LEMONSQUEEZY_VARIANT_YEARLY,
  );
  const paddleReady = Boolean(
    process.env.PADDLE_API_KEY
    && (process.env.PADDLE_PRICE_MONTHLY || process.env.PADDLE_PRICE_ID_MONTHLY)
    && (process.env.PADDLE_PRICE_YEARLY || process.env.PADDLE_PRICE_ID_YEARLY),
  );
  const enabled = provider === "paddle" ? paddleReady : lemonReady;
  return {
    provider: enabled ? provider : null,
    enabled,
    overlay: provider === "lemonsqueezy",
    trialDays: TRIAL_DAYS,
    appUrl: process.env.APP_URL || "https://qilichess.com",
    plans: {
      monthly: { id: "monthly", label: "月付", price: process.env.PREMIUM_PRICE_MONTHLY || "¥19", period: "/月" },
      yearly: { id: "yearly", label: "年付", price: process.env.PREMIUM_PRICE_YEARLY || "¥148", period: "/年" },
    },
  };
}

async function readRaw(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function variantForPlan(plan) {
  return plan === "monthly"
    ? String(process.env.LEMONSQUEEZY_VARIANT_MONTHLY || "")
    : String(process.env.LEMONSQUEEZY_VARIANT_YEARLY || "");
}

function safeCheckoutOrigin(origin) {
  const fallback = String(paymentsConfig().appUrl || "https://qilichess.com").replace(/\/$/, "");
  if (!origin) return fallback;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    const allowed = host === "localhost"
      || host === "127.0.0.1"
      || host === "qilichess.com"
      || host === "www.qilichess.com"
      || host.endsWith(".up.railway.app");
    if (allowed && (url.protocol === "https:" || url.protocol === "http:")) {
      return `${url.protocol}//${url.host}`;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

async function createLemonCheckout(user, plan, origin, email) {
  const variantId = variantForPlan(plan);
  const storeId = String(process.env.LEMONSQUEEZY_STORE_ID || "");
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!variantId || !storeId || !apiKey) {
    const error = new Error("支付尚未配置。请设置 Lemon Squeezy 的 API Key、Store ID 和两个 Variant ID。");
    error.statusCode = 503;
    throw error;
  }
  const redirect = `${safeCheckoutOrigin(origin)}/#profile`;
  const response = await fetch(`${LS_API}/checkouts`, {
    method: "POST",
    headers: {
      accept: "application/vnd.api+json",
      "content-type": "application/vnd.api+json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_options: { embed: true, media: false, logo: true, button_color: "#ed482f" },
          checkout_data: {
            custom: { user_id: user.id },
            email: email || user.email || undefined,
            name: user.displayName || undefined,
          },
          product_options: {
            redirect_url: redirect,
            receipt_button_text: "回到棋理",
            receipt_thank_you_note: "欢迎使用棋理 Pro。引擎评估和 AI Coach 已经打开。",
          },
        },
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: variantId } },
        },
      },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  const url = payload?.data?.attributes?.url;
  if (!response.ok || !url) {
    const message = payload?.errors?.[0]?.detail || "无法创建结账页";
    const error = new Error(message);
    error.statusCode = 502;
    throw error;
  }
  return { url, provider: "lemonsqueezy" };
}

function lemonSignatureOk(raw, signature) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const digest = createHmac("sha256", secret).update(raw).digest("hex");
  const left = Buffer.from(digest);
  const right = Buffer.from(String(signature));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function planFromVariant(variantId) {
  if (String(variantId) === String(process.env.LEMONSQUEEZY_VARIANT_MONTHLY || "")) return "monthly";
  if (String(variantId) === String(process.env.LEMONSQUEEZY_VARIANT_YEARLY || "")) return "yearly";
  return "yearly";
}

async function applyLemonSubscription(userId, attrs = {}, eventName = "") {
  const status = String(attrs.status || "active");
  const ended = ["expired", "unpaid"].includes(status) || eventName === "subscription_expired";
  const periodEnd = attrs.ends_at || attrs.renews_at || null;
  return upsertSubscription(userId, {
    plan: ended ? "free" : planFromVariant(attrs.variant_id),
    status: ended ? "expired" : status,
    source: "paid",
    provider: "lemonsqueezy",
    providerCustomerId: attrs.customer_id ? String(attrs.customer_id) : null,
    providerSubscriptionId: attrs.id ? String(attrs.id) : null,
    currentPeriodEnd: periodEnd ? new Date(periodEnd) : null,
    trialEndsAt: attrs.trial_ends_at ? new Date(attrs.trial_ends_at) : null,
  });
}

async function handleLemonWebhook(raw, signature) {
  if (!lemonSignatureOk(raw, signature)) {
    const error = new Error("Invalid webhook signature");
    error.statusCode = 401;
    throw error;
  }
  const payload = JSON.parse(raw.toString("utf8"));
  const event = payload?.meta?.event_name || "";
  const userId = payload?.meta?.custom_data?.user_id || payload?.meta?.custom_data?.userId;
  const attrs = { ...(payload?.data?.attributes || {}), id: payload?.data?.id };
  if (!userId) return { ignored: true, reason: "missing-user" };
  if (event.startsWith("subscription_")) {
    await applyLemonSubscription(userId, attrs, event);
  }
  return { ok: true, event };
}

async function handleBillingRequest(request, response) {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (!url.pathname.startsWith("/api/billing/")) return false;

  try {
    if (!persistenceInfo().postgresReady) await initializePersistence();

    if (request.method === "GET" && url.pathname === "/api/billing/config") {
      json(response, 200, paymentsConfig());
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/billing/webhook") {
      const raw = await readRaw(request);
      const result = await handleLemonWebhook(raw, request.headers["x-signature"]);
      json(response, 200, result);
      return true;
    }

    if (request.method === "GET" && url.pathname === "/api/billing/entitlement") {
      const user = await authenticateAccount(request);
      if (!user) {
        json(response, 200, { plan: "free", pro: false, status: "free", source: null, trialUsed: false });
        return true;
      }
      json(response, 200, await getSubscription(user.id));
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/billing/trial") {
      const user = await authenticateAccount(request);
      if (!user) throw Object.assign(new Error("登录后才能试用"), { statusCode: 401 });
      json(response, 200, await startServerTrial(user.id));
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/billing/checkout") {
      const user = await authenticateAccount(request);
      if (!user) throw Object.assign(new Error("登录后才能开通 Pro"), { statusCode: 401 });
      if (String(process.env.PAYMENTS_PROVIDER || "lemonsqueezy").toLowerCase() === "paddle") {
        throw Object.assign(new Error("Paddle 结账尚未接通。当前请使用 Lemon Squeezy。"), { statusCode: 501 });
      }
      const body = JSON.parse((await readRaw(request)).toString("utf8") || "{}");
      const plan = body.plan === "monthly" ? "monthly" : "yearly";
      const checkout = await createLemonCheckout(user, plan, body.origin, body.email);
      json(response, 200, checkout);
      return true;
    }

    json(response, 404, { error: "Billing endpoint not found" });
    return true;
  } catch (error) {
    console.error("[billing]", error);
    json(response, Number(error?.statusCode || 500), {
      error: error instanceof Error ? error.message : "Billing error",
    });
    return true;
  }
}

async function userHasPro(userId) {
  if (!userId) return false;
  const entitlement = await getSubscription(userId);
  return Boolean(entitlement?.pro);
}

export { paymentsConfig, handleBillingRequest, userHasPro, getSubscription };
