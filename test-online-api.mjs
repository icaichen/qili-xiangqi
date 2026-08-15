import { spawn } from "node:child_process";

const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`;
const child = spawn(process.execPath, ["engine-server.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, ENGINE_PORT: String(PORT), XIANGQI_ENGINE_PATH: "", XIANGQI_NETWORK_PATH: "" },
  stdio: ["ignore", "pipe", "pipe"],
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function json(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${payload.error || JSON.stringify(payload)}`);
  return payload;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { return await json("/api/engine/health"); } catch { await sleep(100); }
  }
  throw new Error("test server did not start");
}

try {
  const health = await waitForServer();
  assert(health.apiVersion === 3, "apiVersion should be 3");
  assert(health.online?.enabled, "online service should be enabled");

  const created = await json("/api/online/rooms", {
    method: "POST",
    body: JSON.stringify({ displayName: "API-A", timeControl: { baseSeconds: 600, incrementSeconds: 0 } }),
  });
  assert(created.room.status === "waiting", "created room should wait for opponent");

  const joined = await json(`/api/online/rooms/${created.room.id}/join`, {
    method: "POST",
    body: JSON.stringify({ displayName: "API-B" }),
  });
  assert(joined.room.status === "active", "room should become active after join");

  const afterRed = await json(`/api/online/rooms/${created.room.id}/action`, {
    method: "POST",
    body: JSON.stringify({
      type: "move",
      playerToken: created.playerToken,
      move: { fromRow: 6, fromCol: 0, toRow: 5, toCol: 0 },
    }),
  });
  assert(afterRed.room.currentTurn === "black", "turn should be black after red move");

  const afterBlack = await json(`/api/online/rooms/${created.room.id}/action`, {
    method: "POST",
    body: JSON.stringify({
      type: "move",
      playerToken: joined.playerToken,
      move: { fromRow: 3, fromCol: 0, toRow: 4, toCol: 0 },
    }),
  });
  assert(afterBlack.room.moveHistory.length === 2, "API should store both plies");

  const abort = new AbortController();
  const sse = await fetch(`${BASE}/api/online/rooms/${created.room.id}/events?token=${encodeURIComponent(created.playerToken)}`, { signal: abort.signal });
  assert(sse.ok && sse.headers.get("content-type")?.includes("text/event-stream"), "SSE endpoint should respond with event stream");
  const reader = sse.body.getReader();
  const first = await reader.read();
  const initialText = new TextDecoder().decode(first.value || new Uint8Array());
  assert(initialText.includes("event: state"), "SSE should send initial state event");
  abort.abort();

  const ticketA = await json("/api/online/matchmaking", {
    method: "POST",
    body: JSON.stringify({ displayName: "M-A", timeControl: { baseSeconds: 300, incrementSeconds: 3 } }),
  });
  assert(ticketA.status === "waiting", "first matchmaking ticket should wait");
  const ticketB = await json("/api/online/matchmaking", {
    method: "POST",
    body: JSON.stringify({ displayName: "M-B", timeControl: { baseSeconds: 300, incrementSeconds: 3 } }),
  });
  assert(ticketB.status === "matched" && ticketB.roomId, "second ticket should match");
  const ticketAPoll = await json("/api/online/matchmaking", {
    method: "POST",
    body: JSON.stringify({ ticketId: ticketA.ticketId }),
  });
  assert(ticketAPoll.status === "matched" && ticketAPoll.playerToken, "first player should receive matched room and token");

  console.log(JSON.stringify({
    apiVersion: health.apiVersion,
    online: health.online,
    roomId: created.room.id,
    moveCount: afterBlack.room.moveHistory.length,
    sseInitialEvent: true,
    matchmakingRoom: ticketB.roomId,
  }, null, 2));
} finally {
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(1500),
  ]);
}
