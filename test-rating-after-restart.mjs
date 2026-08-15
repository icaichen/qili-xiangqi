import { readFile } from "node:fs/promises";

const BASE = "https://qili-xiangqi-production.up.railway.app";
const STATE = new URL("./.rating-test-state.json", import.meta.url);
const state = JSON.parse(await readFile(STATE, "utf8"));

async function me(token) {
  const response = await fetch(`${BASE}/api/identity/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${payload.error || JSON.stringify(payload)}`);
  return payload;
}

async function history(token) {
  const response = await fetch(`${BASE}/api/identity/me/games?limit=5`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${payload.error || JSON.stringify(payload)}`);
  return payload;
}

const red = await me(state.redToken);
const black = await me(state.blackToken);
const redHistory = await history(state.redToken);
const blackHistory = await history(state.blackToken);
const redGame = redHistory.games.find((game) => game.id === state.roomId);
const blackGame = blackHistory.games.find((game) => game.id === state.roomId);

if (red.ratings?.rapid?.rating !== state.expectedRed) throw new Error(`Red rating duplicated: ${red.ratings?.rapid?.rating}`);
if (black.ratings?.rapid?.rating !== state.expectedBlack) throw new Error(`Black rating duplicated: ${black.ratings?.rapid?.rating}`);
if (red.ratings?.rapid?.games !== 1 || black.ratings?.rapid?.games !== 1) throw new Error("Game count duplicated after process replacement");
if (redGame?.ratingDelta !== -20 || blackGame?.ratingDelta !== 20) throw new Error("Rating event changed after process replacement");

console.log(JSON.stringify({
  roomId: state.roomId,
  ratingIdempotentAfterProcessReplacement: true,
  redRating: red.ratings.rapid.rating,
  blackRating: black.ratings.rapid.rating,
  redGames: red.ratings.rapid.games,
  blackGames: black.ratings.rapid.games,
  eventStillSingle: redGame.ratingDelta === -20 && blackGame.ratingDelta === 20,
}, null, 2));
