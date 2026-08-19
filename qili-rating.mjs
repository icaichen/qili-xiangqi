const QILI_RATING_DEFAULT = 1500;
const QILI_RD_DEFAULT = 350;
const QILI_VOLATILITY_DEFAULT = 0.06;
const QILI_TAU = 0.5;
const QILI_SCALE = 173.7178;
const QILI_RATING_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
const QILI_MIN_RATING = 100;
const QILI_MAX_RATING = 4000;

const COMPUTER_LEVEL_SEEDS = Object.freeze({
  "800": { rating: 800, label: "入门" },
  "1000": { rating: 1000, label: "基础" },
  "1200": { rating: 1200, label: "进阶入门" },
  "1400": { rating: 1400, label: "稳定业余" },
  "1600": { rating: 1600, label: "较强业余" },
  "1800": { rating: 1800, label: "高水平业余" },
  "2000": { rating: 2000, label: "强手" },
  max: { rating: 2200, label: "最高强度" },
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRating(record = {}) {
  return {
    rating: Number.isFinite(Number(record.rating)) ? Number(record.rating) : QILI_RATING_DEFAULT,
    deviation: Number.isFinite(Number(record.deviation)) ? Math.max(30, Number(record.deviation)) : QILI_RD_DEFAULT,
    volatility: Number.isFinite(Number(record.volatility)) ? Math.max(0.0001, Number(record.volatility)) : QILI_VOLATILITY_DEFAULT,
  };
}

function toGlicko2(record) {
  const normalized = normalizeRating(record);
  return {
    mu: (normalized.rating - QILI_RATING_DEFAULT) / QILI_SCALE,
    phi: normalized.deviation / QILI_SCALE,
    sigma: normalized.volatility,
  };
}

function fromGlicko2(mu, phi, sigma) {
  return {
    rating: clamp(QILI_RATING_DEFAULT + QILI_SCALE * mu, QILI_MIN_RATING, QILI_MAX_RATING),
    deviation: clamp(QILI_SCALE * phi, 30, QILI_RD_DEFAULT),
    volatility: sigma,
  };
}

function g(phi) {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expectation(mu, opponentMu, opponentPhi) {
  return 1 / (1 + Math.exp(-g(opponentPhi) * (mu - opponentMu)));
}

function volatilityUpdate(phi, sigma, delta, variance, tau = QILI_TAU) {
  const a = Math.log(sigma * sigma);
  const epsilon = 0.000001;
  const f = (x) => {
    const ex = Math.exp(x);
    const top = ex * (delta * delta - phi * phi - variance - ex);
    const bottom = 2 * ((phi * phi + variance + ex) ** 2);
    return top / bottom - (x - a) / (tau * tau);
  };

  let A = a;
  let B;
  if (delta * delta > phi * phi + variance) {
    B = Math.log(delta * delta - phi * phi - variance);
  } else {
    let k = 1;
    B = a - k * tau;
    while (f(B) < 0) {
      k += 1;
      B = a - k * tau;
    }
  }

  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > epsilon) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  return Math.exp(A / 2);
}

function updateGlicko2(playerRecord, results = [], { tau = QILI_TAU } = {}) {
  const player = toGlicko2(playerRecord);
  if (!results.length) {
    const phiStar = Math.sqrt(player.phi * player.phi + player.sigma * player.sigma);
    return fromGlicko2(player.mu, phiStar, player.sigma);
  }

  const opponents = results.map((result) => ({
    score: clamp(Number(result.score), 0, 1),
    opponent: toGlicko2(result.opponent),
  }));

  let varianceInverse = 0;
  let scoreSum = 0;
  for (const item of opponents) {
    const weight = g(item.opponent.phi);
    const expected = expectation(player.mu, item.opponent.mu, item.opponent.phi);
    varianceInverse += weight * weight * expected * (1 - expected);
    scoreSum += weight * (item.score - expected);
  }

  if (!(varianceInverse > 0)) return normalizeRating(playerRecord);
  const variance = 1 / varianceInverse;
  const delta = variance * scoreSum;
  const sigmaPrime = volatilityUpdate(player.phi, player.sigma, delta, variance, tau);
  const phiStar = Math.sqrt(player.phi * player.phi + sigmaPrime * sigmaPrime);
  const phiPrime = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / variance);
  const muPrime = player.mu + phiPrime * phiPrime * scoreSum;
  return fromGlicko2(muPrime, phiPrime, sigmaPrime);
}

function inflateRatingForInactivity(record = {}, lastRatedAt = null, now = Date.now()) {
  const normalized = normalizeRating(record);
  const lastTime = lastRatedAt ? new Date(lastRatedAt).getTime() : NaN;
  if (!Number.isFinite(lastTime)) return normalized;
  const periods = Math.max(0, Math.floor((Number(now) - lastTime) / QILI_RATING_PERIOD_MS));
  if (!periods) return normalized;
  const player = toGlicko2(normalized);
  const phi = Math.sqrt(player.phi * player.phi + periods * player.sigma * player.sigma);
  return fromGlicko2(player.mu, phi, player.sigma);
}

function ratingStatus(record = {}) {
  const rating = normalizeRating(record);
  const games = Number(record.games || 0);
  const provisional = games < 10 || rating.deviation > 110;
  let stability = "高";
  if (rating.deviation > 200) stability = "低";
  else if (rating.deviation > 110) stability = "中";
  return { provisional, stability };
}

function publicRatingRecord(record = {}, pool = record.pool || null) {
  const normalized = normalizeRating(record);
  const status = ratingStatus(record);
  return {
    ...(pool ? { pool } : {}),
    rating: Math.round(normalized.rating),
    deviation: Math.round(normalized.deviation),
    volatility: Number(normalized.volatility.toFixed(6)),
    games: Number(record.games || 0),
    wins: Number(record.wins || 0),
    draws: Number(record.draws || 0),
    losses: Number(record.losses || 0),
    provisional: status.provisional,
    stability: status.stability,
  };
}

function computerSeed(level) {
  return COMPUTER_LEVEL_SEEDS[String(level)] || COMPUTER_LEVEL_SEEDS["1400"];
}

export {
  QILI_RATING_DEFAULT,
  QILI_RD_DEFAULT,
  QILI_VOLATILITY_DEFAULT,
  QILI_TAU,
  COMPUTER_LEVEL_SEEDS,
  normalizeRating,
  updateGlicko2,
  inflateRatingForInactivity,
  ratingStatus,
  publicRatingRecord,
  computerSeed,
};
