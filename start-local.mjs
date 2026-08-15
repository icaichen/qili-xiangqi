import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const configPath = join(root, "engine", "local-engine.json");
let config;

try {
  config = JSON.parse(await readFile(configPath, "utf8"));
} catch {
  console.error("Pikafish is not installed. Run: npm run setup:engine");
  process.exit(1);
}

async function loadLocalEnv() {
  try {
    const content = await readFile(join(root, ".env.local"), "utf8");
    const parsed = {};
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator <= 0) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      parsed[key] = value;
    }
    return parsed;
  } catch {
    return {};
  }
}

const localEnv = await loadLocalEnv();
const sharedEnv = {
  ...localEnv,
  ...process.env,
  XIANGQI_ENGINE_PATH: config.enginePath,
  XIANGQI_NETWORK_PATH: config.networkPath,
  XIANGQI_ENGINE_KIND: config.kind || "pikafish",
};

async function existingEngineHealth() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    const response = await fetch("http://127.0.0.1:8787/api/engine/health", { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

let engine = null;
const existing = await existingEngineHealth();
if (existing?.configured) {
  if (Number(existing.apiVersion || 0) < 3) {
    console.error("An older local service is already using port 8787. Stop that dev process and run npm run dev again to enable online multiplayer.");
    process.exit(1);
  }
  if (sharedEnv.GEMINI_API_KEY && !existing.coach?.configured) {
    console.error("An older Pikafish service is already using port 8787 without the AI coach key. Stop that dev process and run npm run dev again.");
    process.exit(1);
  }
  console.log("Reusing the existing Pikafish service on http://127.0.0.1:8787");
} else {
  engine = spawn(process.execPath, ["engine-server.mjs"], {
    cwd: root,
    env: sharedEnv,
    stdio: "inherit",
  });
}

const web = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev:web"], {
  cwd: root,
  env: sharedEnv,
  stdio: "inherit",
});

function shutdown(signal = "SIGTERM") {
  if (engine && !engine.killed) engine.kill(signal);
  if (!web.killed) web.kill(signal);
}

if (engine) {
  engine.on("exit", (code) => {
    if (code && code !== 0) console.error(`Engine server exited with code ${code}`);
    shutdown();
  });
}

web.on("exit", (code) => {
  if (code && code !== 0) console.error(`Web server exited with code ${code}`);
  shutdown();
});

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
