import { writeFile } from "node:fs/promises";

const BASE = "https://qili-xiangqi-production.up.railway.app";
const STATE = new URL("./.rating-test-state.json", import.meta.url);

async function request(path, options = {}, token = null) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${payload.error || JSON.stringify(payload)}`);
  return payload;
}

const red = await request("/api/identity/guest", {
  method: "POST",
  body: JSON.stringify({ displayName: "Rating测试红" }),
});
const black = await request("/api/identity/guest", {
  method: "POST",
  body: JSON.stringify({ displayName: "Rating测试黑" }),
});

if (red.ratings?.rapid?.rating !== 1500 || black.ratings?.rapid?.rating !== 1500) throw new Error("New account Rapid Qili rating is not 1500");
if (!red.ratings?.rapid?.provisional || !black.ratings?.rapid?.provisional) throw new Error("New account should be provisional");

const created = await request("/api/online/rooms", {
  method: "POST",
  body: JSON.stringify({ timeControl: { baseSeconds: 600, incrementSeconds: 0 } }),
}, red.accountToken);
const joined = await request(`/api/online/rooms/${created.room.id}/join`, {
  method: "POST",
  body: JSON.stringify({}),
}, black.accountToken);

await request(`/api/online/rooms/${created.room.id}/action`, {
  method: "POST",
  body: JSON.stringify({
    type: "move",
    playerToken: created.playerToken,
    move: { fromRow: 6, fromCol: 0, toRow: 5, toCol: 0 },
  }),
}, red.accountToken);
await request(`/api/online/rooms/${created.room.id}/action`, {
  method: "POST",
  body: JSON.stringify({
    type: "move",
    playerToken: joined.playerToken,
    move: { fromRow: 3, fromCol: 0, toRow: 4, toCol: 0 },
  }),
}, black.accountToken);
await request(`/api/online/rooms/${created.room.id}/action`, {
  method: "POST",
  body: JSON.stringify({ type: "resign", playerToken: created.playerToken }),
}, red.accountToken);

const redMe = await request("/api/identity/me", {}, red.accountToken);
const blackMe = await request("/api/identity/me", {}, black.accountToken);
const redHistory = await request("/api/identity/me/games?limit=5", {}, red.accountToken);
const blackHistory = await request("/api/identity/me/games?limit=5", {}, black.accountToken);
const redGame = redHistory.games.find((game) => game.id === created.room.id);
const blackGame = blackHistory.games.find((game) => game.id === created.room.id);

if (redMe.ratings?.rapid?.rating !== 1338) throw new Error(`Expected red 1338, got ${redMe.ratings?.rapid?.rating}`);
if (blackMe.ratings?.rapid?.rating !== 1662) throw new Error(`Expected black 1662, got ${blackMe.ratings?.rapid?.rating}`);
if (redMe.ratings?.rapid?.deviation !== 290 || blackMe.ratings?.rapid?.deviation !== 290) throw new Error("First-game RD is incorrect");
if (redMe.ratings?.rapid?.games !== 1 || blackMe.ratings?.rapid?.games !== 1) throw new Error("Rapid game count is not 1");
if (redMe.ratings?.blitz?.rating !== 1500 || blackMe.ratings?.blitz?.rating !== 1500) throw new Error("Blitz rating changed during Rapid game");
if (redGame?.ratingDelta !== -162 || blackGame?.ratingDelta !== 162) throw new Error("History Qili rating delta is incorrect");

await writeFile(STATE, JSON.stringify({
  roomId: created.room.id,
  redToken: red.accountToken,
  blackToken: black.accountToken,
  expectedRed: 1338,
  expectedBlack: 1662,
}), { mode: 0o600 });

console.log(JSON.stringify({
  roomId: created.room.id,
  pool: redGame.ratingPool,
  redRating: redMe.ratings.rapid.rating,
  blackRating: blackMe.ratings.rapid.rating,
  redDeviation: redMe.ratings.rapid.deviation,
  blackDeviation: blackMe.ratings.rapid.deviation,
  redDelta: redGame.ratingDelta,
  blackDelta: blackGame.ratingDelta,
  redRecord: `${redMe.ratings.rapid.wins}-${redMe.ratings.rapid.draws}-${redMe.ratings.rapid.losses}`,
  blackRecord: `${blackMe.ratings.rapid.wins}-${blackMe.ratings.rapid.draws}-${blackMe.ratings.rapid.losses}`,
  blitzUnchanged: redMe.ratings.blitz.rating === 1500 && blackMe.ratings.blitz.rating === 1500,
  tokensPrinted: false,
}, null, 2));
