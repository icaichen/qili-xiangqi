const BASE = "https://qili-xiangqi-production.up.railway.app";

async function json(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(body)}`);
  return body;
}

const health = await json("/api/online/health");
const created = await json("/api/online/rooms", {
  method: "POST",
  body: JSON.stringify({ displayName: "公网A", timeControl: { baseSeconds: 600, incrementSeconds: 5 } }),
});
const joined = await json(`/api/online/rooms/${created.room.id}/join`, {
  method: "POST",
  body: JSON.stringify({ displayName: "公网B" }),
});

await json(`/api/online/rooms/${created.room.id}/action`, {
  method: "POST",
  body: JSON.stringify({
    type: "move",
    playerToken: created.playerToken,
    move: { fromRow: 6, fromCol: 0, toRow: 5, toCol: 0 },
  }),
});

const afterRed = await json(`/api/online/rooms/${created.room.id}?token=${joined.playerToken}`);

await json(`/api/online/rooms/${created.room.id}/action`, {
  method: "POST",
  body: JSON.stringify({
    type: "move",
    playerToken: joined.playerToken,
    move: { fromRow: 3, fromCol: 0, toRow: 4, toCol: 0 },
  }),
});

const final = await json(`/api/online/rooms/${created.room.id}?token=${created.playerToken}`);

console.log(JSON.stringify({
  health,
  roomId: created.room.id,
  red: created.color,
  black: joined.color,
  status: final.room.status,
  moves: final.room.moveHistory.length,
  currentTurn: final.room.currentTurn,
  players: [final.room.players.red?.name, final.room.players.black?.name],
  afterRedTurn: afterRed.room.currentTurn,
}, null, 2));
