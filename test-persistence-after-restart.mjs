import { readFile } from "node:fs/promises";
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

const state = JSON.parse(await readFile(STATE_FILE, "utf8"));
const restored = await request(`/api/online/rooms/${state.roomId}?token=${encodeURIComponent(state.redToken)}`);

if (restored.room.id !== state.roomId) throw new Error("Restored room id mismatch");
if (restored.room.moveHistory.length !== 1) throw new Error("Restored move history mismatch");
if (restored.room.viewerColor !== "red") throw new Error("Original session token no longer identifies red player");
if (restored.room.players.red?.name !== "持久化红方" || restored.room.players.black?.name !== "持久化黑方") {
  throw new Error("Restored players mismatch");
}

const finished = await request(`/api/online/rooms/${state.roomId}/action`, {
  method: "POST",
  body: JSON.stringify({ type: "resign", playerToken: state.blackToken }),
});
if (finished.room.status !== "finished" || finished.room.result?.winner !== "red") {
  throw new Error("Could not finish restored room");
}

await new Promise((resolve) => setTimeout(resolve, 400));
const archived = await request(`/api/online/games/${state.roomId}`);
const archivedJson = JSON.stringify(archived);
if (archived.game.id !== state.roomId) throw new Error("Postgres game id mismatch");
if (archived.game.moves.length !== 1) throw new Error("Postgres move history mismatch");
if (archivedJson.includes(state.redToken) || archivedJson.includes(state.blackToken) || archivedJson.includes("playerToken")) {
  throw new Error("Session token leaked into permanent game history");
}

const health = await request("/api/online/health");
console.log(JSON.stringify({
  roomId: state.roomId,
  restoredStatus: restored.room.status,
  restoredMoves: restored.room.moveHistory.length,
  restoredViewerColor: restored.room.viewerColor,
  finishedResult: finished.room.result,
  postgresGameFound: archived.game.id === state.roomId,
  postgresMoves: archived.game.moves.length,
  tokenLeakInHistory: false,
  persistence: health.persistence,
}, null, 2));
