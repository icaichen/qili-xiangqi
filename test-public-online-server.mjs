import { spawn } from "node:child_process";

const port = 10081;
const child = spawn(process.execPath, ["public-online-server.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
  stdio: ["ignore", "pipe", "pipe"],
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const base = `http://127.0.0.1:${port}`;

async function waitForHealth() {
  for (let i = 0; i < 30; i += 1) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return response.json();
    } catch {}
    await wait(100);
  }
  throw new Error("Public server did not start");
}

try {
  const health = await waitForHealth();
  const home = await fetch(`${base}/`);
  const homeText = await home.text();
  if (!home.ok || !homeText.includes("棋理")) throw new Error("Static frontend not served");

  const onlineHealth = await fetch(`${base}/api/online/health`).then((r) => r.json());
  if (!onlineHealth.enabled) throw new Error("Online API not enabled");

  const created = await fetch(`${base}/api/online/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName: "远端A", timeControl: { baseSeconds: 300, incrementSeconds: 3 } }),
  }).then((r) => r.json());

  const joined = await fetch(`${base}/api/online/rooms/${created.room.id}/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName: "远端B" }),
  }).then((r) => r.json());

  if (joined.room.status !== "active") throw new Error("Remote room did not become active");

  console.log(JSON.stringify({
    health,
    staticSite: true,
    onlineApi: onlineHealth,
    roomId: created.room.id,
    players: [joined.room.players.red.name, joined.room.players.black.name],
    status: joined.room.status,
  }, null, 2));
} finally {
  child.kill("SIGTERM");
}
