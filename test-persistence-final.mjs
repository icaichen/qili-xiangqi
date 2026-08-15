import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const API = "https://qili-xiangqi-production.up.railway.app";
const state = JSON.parse(await readFile(join(tmpdir(), "qili-persistence-test.json"), "utf8"));

async function request(path) {
  const response = await fetch(`${API}${path}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `${response.status} ${response.statusText}`);
  return payload;
}

const restored = await request(`/api/online/rooms/${state.roomId}?token=${encodeURIComponent(state.redToken)}`);
if (restored.room.id !== state.roomId) throw new Error("Restored room id mismatch");
if (restored.room.moveHistory.length !== 1) throw new Error("Restored move history mismatch");
if (restored.room.viewerColor !== "red") throw new Error("Original token did not survive restart");
if (restored.room.status !== "finished") throw new Error("Expected the restored test room to be finished");

await new Promise((resolve) => setTimeout(resolve, 800));
const archived = await request(`/api/online/games/${state.roomId}`);
const serialized = JSON.stringify(archived);
if (archived.game.id !== state.roomId) throw new Error("Archived game id mismatch");
if (archived.game.moves.length !== 1) throw new Error("Archived move history mismatch");
if (serialized.includes(state.redToken) || serialized.includes(state.blackToken) || serialized.includes("playerToken")) {
  throw new Error("Session token leaked into Postgres archive response");
}

const health = await request("/api/online/health");
console.log(JSON.stringify({
  roomId: state.roomId,
  roomRecoveredAfterProcessReplacement: true,
  restoredStatus: restored.room.status,
  restoredMoves: restored.room.moveHistory.length,
  originalSessionRecovered: restored.room.viewerColor === "red",
  postgresArchiveFound: archived.game.id === state.roomId,
  postgresMoves: archived.game.moves.length,
  tokenLeakInArchive: false,
  persistence: health.persistence,
}, null, 2));
