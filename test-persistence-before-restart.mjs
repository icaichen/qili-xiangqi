import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const API = "https://qili-xiangqi-production.up.railway.app";
const STATE_FILE = join(tmpdir(), "qili-persistence-test.json");

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `${response.status} ${response.statusText}`);
  return payload;
}

const created = await request("/api/online/rooms", {
  method: "POST",
  body: JSON.stringify({ displayName: "持久化红方", timeControl: { baseSeconds: 600, incrementSeconds: 5 } }),
});
const joined = await request(`/api/online/rooms/${created.room.id}/join`, {
  method: "POST",
  body: JSON.stringify({ displayName: "持久化黑方" }),
});

await request(`/api/online/rooms/${created.room.id}/action`, {
  method: "POST",
  body: JSON.stringify({
    type: "move",
    playerToken: created.playerToken,
    move: { fromRow: 9, fromCol: 0, toRow: 8, toCol: 0 },
  }),
});

const afterMove = await request(`/api/online/rooms/${created.room.id}?token=${encodeURIComponent(created.playerToken)}`);
if (afterMove.room.moveHistory.length !== 1 || afterMove.room.currentTurn !== "black") {
  throw new Error("Room state did not persist before restart");
}

await writeFile(STATE_FILE, JSON.stringify({
  roomId: created.room.id,
  redToken: created.playerToken,
  blackToken: joined.playerToken,
}), { mode: 0o600 });

console.log(JSON.stringify({
  roomId: created.room.id,
  status: afterMove.room.status,
  moves: afterMove.room.moveHistory.length,
  nextTurn: afterMove.room.currentTurn,
  stateStoredLocally: true,
}, null, 2));
