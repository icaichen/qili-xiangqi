import { createHmac, timingSafeEqual } from "node:crypto";
// Billing env (Railway): PAYMENTS_PROVIDER=paddle
// PADDLE_API_KEY, PADDLE_CLIENT_TOKEN, PADDLE_WEBHOOK_SECRET
// PADDLE_PRICE_MONTHLY, PADDLE_PRICE_YEARLY, PADDLE_ENV=sandbox|production, APP_URL
// Webhook URL: https://qilichess.com/api/billing/webhook
import {
  initializePersistence,
  persistenceInfo,
  getSubscription,
  upsertSubscription,
  startServerTrial,
} from "./online-persistence.mjs";
import { authenticateAccount } from "./identity-service.mjs";

const TRIAL_DAYS = 7;

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

function paddleApiBase() {
  return String(process.env.PADDLE_ENV || "").toLowerCase() === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

function priceForPlan(plan) {
  return plan === "monthly"
    ? String(process.env.PADDLE_PRICE_MONTHLY || process.env.PADDLE_PRICE_ID_MONTHLY || "")
    : String(process.env.PADDLE_PRICE_YEARLY || process.env.PADDLE_PRICE_ID_YEARLY || "");
}

function paymentsConfig() {
  const paddleReady = Boolean(
    process.env.PADDLE_API_KEY
    && priceForPlan("monthly")
    && priceForPlan("yearly"),
  );
  return {
    provider: paddleReady ? "paddle" : null,
    enabled: paddleReady,
    overlay: true,
    trialDays: TRIAL_DAYS,
    appUrl: process.env.APP_URL || "https://qilichess.com",
    environment: String(process.env.PADDLE_ENV || "").toLowerCase() === "sandbox" ? "sandbox" : "production",
    clientToken: paddleReady ? (process.env.PADDLE_CLIENT_TOKEN || null) : null,
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

async function createPaddleCheckout(user, plan, origin) {
  const priceId = priceForPlan(plan);
  const apiKey = process.env.PADDLE_API_KEY;
  if (!priceId || !apiKey) {
    const error = new Error("支付尚未配置。请设置 Paddle 的 API Key 和两个 Price ID。");
    error.statusCode = 503;
    throw error;
  }
  const redirect = `${safeCheckoutOrigin(origin)}/#profile`;
  const payload = {
    items: [{ price_id: priceId, quantity: 1 }],
    custom_data: { user_id: user.id, plan },
    checkout: { success_url: redirect },
  };
  const response = await fetch(`${paddleApiBase()}/transactions`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "paddle-version": "1",
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  const transaction = body?.data;
  const url = transaction?.checkout?.url;
  if (!response.ok || !transaction?.id) {
    const message = body?.error?.detail || "无法创建结账页";
    const error = new Error(message);
    error.statusCode = 502;
    throw error;
  }
  return {
    url: url || null,
    transactionId: transaction.id,
    provider: "paddle",
  };
}

function paddleSignatureOk(raw, header) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET || process.env.PADDLE_NOTIFICATION_SECRET;
  if (!secret || !header) return false;
  const parts = {};
  for (const piece of String(header).split(";")) {
    const separator = piece.indexOf("=");
    if (separator <= 0) continue;
    parts[piece.slice(0, separator).trim()] = piece.slice(separator + 1).trim();
  }
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;
  const digest = createHmac("sha256", secret).update(`${ts}:${raw.toString("utf8")}`).digest("hex");
  const left = Buffer.from(digest);
  const right = Buffer.from(h1);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function planFromPriceId(priceId) {
  if (String(priceId) === priceForPlan("monthly")) return "monthly";
  if (String(priceId) === priceForPlan("yearly")) return "yearly";
  return "yearly";
}

function paddleUserId(data = {}) {
  return data?.custom_data?.user_id
    || data?.custom_data?.userId
    || data?.transaction?.custom_data?.user_id
    || null;
}

function paddlePriceId(data = {}) {
  return data?.items?.[0]?.price?.id
    || data?.items?.[0]?.price_id
    || data?.subscription?.items?.[0]?.price?.id
    || null;
}

function paddlePeriodEnd(data = {}) {
  return data?.current_billing_period?.ends_at
    || data?.next_billed_at
    || data?.billing_period?.ends_at
    || null;
}

async function applyPaddleSubscription(userId, data = {}, eventType = "") {
  const status = String(data.status || "active");
  const ended = ["canceled", "cancelled", "expired", "inactive"].includes(status)
    && eventType === "subscription.canceled"
    && !paddlePeriodEnd(data);
  const periodEnd = paddlePeriodEnd(data);
  return upsertSubscription(userId, {
    plan: ended ? "free" : planFromPriceId(paddlePriceId(data)),
    status: ended ? "expired" : status,
    source: "paid",
    provider: "paddle",
    providerCustomerId: data.customer_id ? String(data.customer_id) : null,
    providerSubscriptionId: data.id ? String(data.id) : null,
    currentPeriodEnd: periodEnd ? new Date(periodEnd) : null,
  });
}

async function handlePaddleWebhook(raw, signature) {
  if (!paddleSignatureOk(raw, signature)) {
    const error = new Error("Invalid webhook signature");
    error.statusCode = 401;
    throw error;
  }
  const payload = JSON.parse(raw.toString("utf8"));
  const event = payload?.event_type || payload?.eventType || "";
  const data = payload?.data || {};
  const userId = paddleUserId(data);
  if (!userId) return { ignored: true, reason: "missing-user", event };
  if (event.startsWith("subscription.")) {
    await applyPaddleSubscription(userId, data, event);
  } else if (event === "transaction.completed") {
    const subscriptionId = data.subscription_id || data.subscriptionId;
    await upsertSubscription(userId, {
      plan: planFromPriceId(paddlePriceId(data)),
      status: "active",
      source: "paid",
      provider: "paddle",
      providerCustomerId: data.customer_id ? String(data.customer_id) : null,
      providerSubscriptionId: subscriptionId ? String(subscriptionId) : null,
      currentPeriodEnd: paddlePeriodEnd(data) ? new Date(paddlePeriodEnd(data)) : null,
    });
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
      const result = await handlePaddleWebhook(raw, request.headers["paddle-signature"]);
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
      const body = JSON.parse((await readRaw(request)).toString("utf8") || "{}");
      const plan = body.plan === "monthly" ? "monthly" : "yearly";
      const checkout = await createPaddleCheckout(user, plan, body.origin);
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
