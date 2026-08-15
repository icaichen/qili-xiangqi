import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeOnlineService, closeOnlineService, handleOnlineRequest, serviceInfo } from "./online-game-service.mjs";
import { handleIdentityRequest } from "./identity-service.mjs";

const PORT = Number(process.env.PORT || 10000);
const HOST = process.env.HOST || "0.0.0.0";
const DIST_DIR = fileURLToPath(new URL("./dist/", import.meta.url));

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

await initializeOnlineService();

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

  if (request.url?.startsWith("/api/identity/") || request.url?.startsWith("/api/auth/")) {
    if (await handleIdentityRequest(request, response)) return;
  }

  if (request.url?.startsWith("/api/online/")) {
    if (await handleOnlineRequest(request, response)) return;
  }

  if (request.method === "GET" && request.url === "/health") {
    json(response, 200, { ok: true, online: serviceInfo() });
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

  if (candidate.startsWith(DIST_DIR) && await sendFile(request, response, candidate)) return;
  await sendFile(request, response, join(DIST_DIR, "index.html"));
});

server.listen(PORT, HOST, () => {
  console.log(`Qili public online server listening on http://${HOST}:${PORT}`);
});

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const force = setTimeout(() => process.exit(1), 3000);
  force.unref();
  server.close(async () => {
    await closeOnlineService();
    clearTimeout(force);
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
