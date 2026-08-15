const BASE = "https://qili-xiangqi-production.up.railway.app";

async function request(path, options = {}, accountToken = null) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(accountToken ? { authorization: `Bearer ${accountToken}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${payload.error || JSON.stringify(payload)}`);
  return payload;
}

const a = await request("/api/identity/guest", {
  method: "POST",
  body: JSON.stringify({ displayName: "身份测试A" }),
});
const b = await request("/api/identity/guest", {
  method: "POST",
  body: JSON.stringify({ displayName: "身份测试B" }),
});

const meA = await request("/api/identity/me", {}, a.accountToken);
const meB = await request("/api/identity/me", {}, b.accountToken);
if (meA.user.id === meB.user.id) throw new Error("Two guest accounts resolved to the same user");

const created = await request("/api/online/rooms", {
  method: "POST",
  body: JSON.stringify({ timeControl: { baseSeconds: 600, incrementSeconds: 0 } }),
}, a.accountToken);
const joined = await request(`/api/online/rooms/${created.room.id}/join`, {
  method: "POST",
  body: JSON.stringify({}),
}, b.accountToken);

await request(`/api/online/rooms/${created.room.id}/action`, {
  method: "POST",
  body: JSON.stringify({
    type: "move",
    playerToken: created.playerToken,
    move: { fromRow: 6, fromCol: 0, toRow: 5, toCol: 0 },
  }),
}, a.accountToken);

await request(`/api/online/rooms/${created.room.id}/action`, {
  method: "POST",
  body: JSON.stringify({
    type: "move",
    playerToken: joined.playerToken,
    move: { fromRow: 3, fromCol: 0, toRow: 4, toCol: 0 },
  }),
}, b.accountToken);

const finished = await request(`/api/online/rooms/${created.room.id}/action`, {
  method: "POST",
  body: JSON.stringify({ type: "resign", playerToken: created.playerToken }),
}, a.accountToken);

const historyA = await request("/api/identity/me/games?limit=10", {}, a.accountToken);
const historyB = await request("/api/identity/me/games?limit=10", {}, b.accountToken);
const gameA = historyA.games.find((game) => game.id === created.room.id);
const gameB = historyB.games.find((game) => game.id === created.room.id);
if (!gameA || !gameB) throw new Error("Finished game is missing from one or both user histories");
if (gameA.color !== "red" || gameB.color !== "black") throw new Error("Game color ownership is incorrect");
if (gameA.result?.winner !== "black" || gameB.result?.winner !== "black") throw new Error("Game result was not archived correctly");

const publicGame = await request(`/api/online/games/${created.room.id}`);
const serialized = JSON.stringify(publicGame);
if (serialized.includes(a.accountToken) || serialized.includes(b.accountToken)) throw new Error("Account token leaked into public game archive");

const renamed = await request("/api/identity/me/name", {
  method: "POST",
  body: JSON.stringify({ displayName: "身份测试A-改名" }),
}, a.accountToken);

console.log(JSON.stringify({
  identitiesDistinct: meA.user.id !== meB.user.id,
  redNameFromAccount: created.room.players.red?.name,
  blackNameFromAccount: joined.room.players.black?.name,
  roomId: created.room.id,
  finished: finished.room.status,
  moves: finished.room.moveHistory.length,
  redHistoryFound: Boolean(gameA),
  blackHistoryFound: Boolean(gameB),
  redPerspective: gameA.color,
  blackPerspective: gameB.color,
  winner: gameA.result?.winner,
  redOpponent: gameA.opponent,
  blackOpponent: gameB.opponent,
  redTotalGames: historyA.total,
  blackTotalGames: historyB.total,
  renamePersisted: renamed.user.displayName === "身份测试A-改名",
  accountTokenLeak: false,
}, null, 2));
