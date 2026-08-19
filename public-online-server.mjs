import { createServer, request as httpRequest } from "node:http";
import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeOnlineService, closeOnlineService, handleOnlineRequest, serviceInfo } from "./online-game-service.mjs";
import { authenticateAccount, handleIdentityRequest } from "./identity-service.mjs";

const PORT = Number(process.env.PORT || 10000);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT_DIR = fileURLToPath(new URL("./", import.meta.url));
const DIST_DIR = fileURLToPath(new URL("./dist/", import.meta.url));
const ENGINE_CONFIG_PATH = fileURLToPath(new URL("./engine/local-engine.json", import.meta.url));
const ENGINE_INTERNAL_PORT = Number(process.env.QILI_ENGINE_INTERNAL_PORT || 8787);
const REVIEW_RATE_WINDOW_MS = 10 * 60 * 1000;
const REVIEW_RATE_LIMIT = 10;

const reviewRate = new Map();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function sendFile(request, response, absolutePath) {
  try {
    const info = await stat(absolutePath);
    if (!info.isFile()) return false;
    const body = request.method === "HEAD" ? null : await readFile(absolutePath);
    response.writeHead(200, {
      "content-type": MIME[extname(absolutePath).toLowerCase()] || "application/octet-stream",
      "cache-control": absolutePath.endsWith("index.html") ? "no-cache" : "public, max-age=3600",
    });
    response.end(body);
    return true;
  } catch {
    return false;
  }
}

function runtimePath(value) {
  if (!value) return "";
  return isAbsolute(value) ? value : join(ROOT_DIR, value);
}

function requestIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.socket.remoteAddress || "unknown";
}

function allowReviewRequest(accountId, ip) {
  const now = Date.now();
  const key = `${accountId || "unknown"}:${ip || "unknown"}`;
  const current = reviewRate.get(key);
  if (!current || now - current.startedAt >= REVIEW_RATE_WINDOW_MS) {
    reviewRate.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= REVIEW_RATE_LIMIT) return false;
  current.count += 1;
  return true;
}

function localEngineHealth(timeoutMs = 800) {
  return new Promise((resolve) => {
    const request = httpRequest({
      hostname: "127.0.0.1",
      port: ENGINE_INTERNAL_PORT,
      path: "/api/engine/health",
      method: "GET",
      timeout: timeoutMs,
    }, (upstream) => {
      const chunks = [];
      upstream.on("data", (chunk) => chunks.push(chunk));
      upstream.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch {
          resolve(null);
        }
      });
    });
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve(null));
    request.end();
  });
}

async function waitForEngineService(attempts = 24) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const health = await localEngineHealth();
    if (health) return health;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

let engineProcess = null;
let engineStartupError = null;
let shuttingDown = false;

async function ensureEngineService() {
  const existing = await localEngineHealth();
  if (existing) {
    console.log(`Reusing Xiangqi engine service on 127.0.0.1:${ENGINE_INTERNAL_PORT}`);
    return existing;
  }

  try {
    const config = JSON.parse(await readFile(ENGINE_CONFIG_PATH, "utf8"));
    const enginePath = runtimePath(config.enginePath);
    const networkPath = runtimePath(config.networkPath);
    if (!enginePath) throw new Error("Engine runtime path is missing");

    engineProcess = spawn(process.execPath, ["engine-server.mjs"], {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        ENGINE_PORT: String(ENGINE_INTERNAL_PORT),
        XIANGQI_ENGINE_PATH: enginePath,
        XIANGQI_NETWORK_PATH: networkPath,
        XIANGQI_ENGINE_KIND: config.kind || "pikafish",
      },
      stdio: "inherit",
    });
    engineProcess.on("exit", (code, signal) => {
      if (!shuttingDown) console.error(`[engine-service] exited code=${code} signal=${signal}`);
    });
    engineProcess.on("error", (error) => {
      engineStartupError = error.message;
      console.error("[engine-service]", error);
    });

    const health = await waitForEngineService();
    if (!health) throw new Error("Xiangqi engine service did not become ready");
    console.log(`Xiangqi engine ready on 127.0.0.1:${ENGINE_INTERNAL_PORT} (${config.kind || "unknown"})`);
    return health;
  } catch (error) {
    engineStartupError = error instanceof Error ? error.message : String(error);
    console.error("[engine-service] unavailable:", engineStartupError);
    return null;
  }
}

function proxyToEngine(request, response) {
  return new Promise((resolve) => {
    const headers = { ...request.headers, host: `127.0.0.1:${ENGINE_INTERNAL_PORT}` };
    delete headers.connection;

    const upstream = httpRequest({
      hostname: "127.0.0.1",
      port: ENGINE_INTERNAL_PORT,
      path: request.url,
      method: request.method,
      headers,
    }, (upstreamResponse) => {
      const responseHeaders = { ...upstreamResponse.headers };
      delete responseHeaders.connection;
      response.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
      upstreamResponse.pipe(response);
      upstreamResponse.on("end", () => resolve(true));
    });

    upstream.on("error", (error) => {
      if (!response.headersSent) {
        json(response, 503, {
          error: "Xiangqi engine service is unavailable",
          detail: engineStartupError || error.message,
        });
      } else {
        response.end();
      }
      resolve(true);
    });

    request.pipe(upstream);
  });
}

await initializeOnlineService();
const engineInfo = await ensureEngineService();

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type, authorization, x-qili-guest-token",
    });
    response.end();
    return;
  }

  if (request.method === "POST" && request.url === "/api/engine/analyze-game") {
    const account = await authenticateAccount(request).catch(() => null);
    if (!account) {
      json(response, 401, { error: "请先建立棋手身份再进行整盘复盘" });
      return;
    }
    if (!allowReviewRequest(account.id, requestIp(request))) {
      json(response, 429, { error: "复盘请求过于频繁，请稍后再试" });
      return;
    }
  }

  if (request.url?.startsWith("/api/engine/") || request.url?.startsWith("/api/coach/")) {
    if (!engineInfo && !(await localEngineHealth())) {
      json(response, 503, {
        error: "Xiangqi engine service is unavailable",
        detail: engineStartupError || "Engine runtime was not prepared during build",
      });
      return;
    }
    await proxyToEngine(request, response);
    return;
  }

  if (request.url?.startsWith("/api/identity/") || request.url?.startsWith("/api/auth/")) {
    if (await handleIdentityRequest(request, response)) return;
  }

  if (request.url?.startsWith("/api/online/")) {
    if (await handleOnlineRequest(request, response)) return;
  }

  if (request.method === "GET" && request.url === "/health") {
    json(response, 200, {
      ok: true,
      online: serviceInfo(),
      engine: await localEngineHealth(),
      engineError: engineStartupError,
    });
    return;
  }

  if (request.url?.startsWith("/api/")) {
    json(response, 404, { error: "API endpoint not found." });
    return;
  }

  if (!["GET", "HEAD"].includes(request.method || "")) {
    json(response, 405, { error: "Method not allowed" });
    return;
  }

  const url = new URL(request.url || "/", "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const normalized = normalize(pathname).replace(/^([/\\])+/, "");
  const candidate = join(DIST_DIR, normalized || "index.html");
  const isAssetRequest = pathname.startsWith("/assets/") || /\/[^/]+\.[^/]+$/.test(pathname);

  if (candidate.startsWith(DIST_DIR) && await sendFile(request, response, candidate)) return;
  if (isAssetRequest) {
    response.writeHead(404, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(request.method === "HEAD" ? undefined : "Not found");
    return;
  }
  await sendFile(request, response, join(DIST_DIR, "index.html"));
});

server.listen(PORT, HOST, () => {
  console.log(`Qili public online server listening on http://${HOST}:${PORT}`);
});

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const force = setTimeout(() => process.exit(1), 3000);
  force.unref();
  if (engineProcess && !engineProcess.killed) engineProcess.kill("SIGTERM");
  server.close(async () => {
    await closeOnlineService();
    clearTimeout(force);
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
