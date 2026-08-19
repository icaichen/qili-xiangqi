import assert from "node:assert/strict";
import { updateGlicko2 } from "./qili-rating.mjs";
import "./qili-bot-calibration.mjs";
import "./online-persistence.mjs";
import "./identity-service.mjs";

const updated = updateGlicko2(
  { rating: 1500, deviation: 200, volatility: 0.06 },
  [
    { score: 1, opponent: { rating: 1400, deviation: 30, volatility: 0.06 } },
    { score: 0, opponent: { rating: 1550, deviation: 100, volatility: 0.06 } },
    { score: 0, opponent: { rating: 1700, deviation: 300, volatility: 0.06 } },
  ],
);

assert.ok(Math.abs(updated.rating - 1464.06) < 0.1, `rating ${updated.rating}`);
assert.ok(Math.abs(updated.deviation - 151.52) < 0.1, `RD ${updated.deviation}`);
assert.ok(Math.abs(updated.volatility - 0.059996) < 0.00001, `volatility ${updated.volatility}`);

const fresh = { rating: 1500, deviation: 350, volatility: 0.06 };
const loser = updateGlicko2(fresh, [{ score: 0, opponent: fresh }]);
const winner = updateGlicko2(fresh, [{ score: 1, opponent: fresh }]);
assert.ok(loser.rating < 1500 && winner.rating > 1500);
assert.ok(Math.abs((loser.rating + winner.rating) - 3000) < 0.01);
assert.ok(Math.abs(loser.deviation - winner.deviation) < 0.01);

console.log(JSON.stringify({
  officialExample: {
    rating: Number(updated.rating.toFixed(2)),
    deviation: Number(updated.deviation.toFixed(2)),
    volatility: Number(updated.volatility.toFixed(6)),
  },
  freshHeadToHead: {
    loser: { rating: Math.round(loser.rating), deviation: Math.round(loser.deviation) },
    winner: { rating: Math.round(winner.rating), deviation: Math.round(winner.deviation) },
  },
}));
