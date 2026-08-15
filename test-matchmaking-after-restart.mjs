import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const API = "https://qili-xiangqi-production.up.railway.app";
const { ticketId } = JSON.parse(await readFile(join(tmpdir(), "qili-matchmaking-test.json"), "utf8"));

async function post(path, body) {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `${response.status} ${response.statusText}`);
  return payload;
}

const restored = await post("/api/online/matchmaking", { ticketId });
if (restored.status !== "waiting") throw new Error(`Expected restored waiting ticket, got ${restored.status}`);

const healthResponse = await fetch(`${API}/api/online/health`);
const health = await healthResponse.json();
if (!healthResponse.ok || !health.persistence?.redisReady) throw new Error("Redis is not ready after restart");

await post("/api/online/matchmaking/cancel", { ticketId });
console.log(JSON.stringify({
  matchmakingTicketRecoveredAfterRestart: true,
  restoredStatus: restored.status,
  restoredTicketsReported: health.persistence.restoredTickets,
  cancelledAfterTest: true,
}, null, 2));
