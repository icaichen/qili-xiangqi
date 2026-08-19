import {
  QILI_RD_DEFAULT,
  QILI_VOLATILITY_DEFAULT,
  COMPUTER_LEVEL_SEEDS,
  publicRatingRecord,
  updateGlicko2,
  inflateRatingForInactivity,
} from "./qili-rating.mjs";

function seedComputerRatings() {
  const output = {};
  for (const [levelId, seed] of Object.entries(COMPUTER_LEVEL_SEEDS)) {
    const record = publicRatingRecord({
      rating: seed.rating,
      deviation: QILI_RD_DEFAULT,
      volatility: QILI_VOLATILITY_DEFAULT,
      games: 0,
      wins: 0,
      draws: 0,
      losses: 0,
    });
    output[levelId] = {
      level: levelId,
      label: seed.label,
      unbounded: Boolean(seed.unbounded),
      ...record,
      calibrated: false,
    };
  }
  return output;
}

async function loadComputerRatings(pgPool) {
  const output = seedComputerRatings();
  if (!pgPool) return output;
  const result = await pgPool.query(
    `SELECT level_id, rating, deviation, volatility, games, wins, draws, losses
       FROM qili_bot_ratings`,
  );
  for (const row of result.rows) {
    const seed = COMPUTER_LEVEL_SEEDS[row.level_id];
    if (!seed) continue;
    const record = publicRatingRecord(row);
    output[row.level_id] = {
      level: row.level_id,
      label: seed.label,
      unbounded: Boolean(seed.unbounded),
      ...record,
      calibrated: !record.provisional,
    };
  }
  return output;
}

async function recordComputerCalibration(pgPool, { gameId, userId, level, winner }) {
  const levelId = String(level || "");
  if (!pgPool || !gameId || !userId || !COMPUTER_LEVEL_SEEDS[levelId]) {
    return { accepted: false, reason: "invalid" };
  }

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const duplicate = await client.query(
      "SELECT game_id FROM qili_bot_rating_events WHERE game_id = $1 LIMIT 1",
      [gameId],
    );
    if (duplicate.rows.length) {
      await client.query("COMMIT");
      return { accepted: false, reason: "duplicate" };
    }

    const recentSample = await client.query(
      `SELECT game_id FROM qili_bot_rating_events
        WHERE user_id = $1
          AND level_id = $2
          AND created_at >= NOW() - INTERVAL '24 hours'
        LIMIT 1`,
      [userId, levelId],
    );
    if (recentSample.rows.length) {
      await client.query("COMMIT");
      return { accepted: false, reason: "daily-sample-limit" };
    }

    const userResult = await client.query(
      `SELECT pool, rating, deviation, volatility, last_rated_at, games, wins, draws, losses
         FROM qili_ratings
        WHERE user_id = $1 AND games >= 3`,
      [userId],
    );
    const eligibleUsers = userResult.rows
      .map((row) => ({ ...row, ...inflateRatingForInactivity(row, row.last_rated_at) }))
      .sort((a, b) => Number(a.deviation) - Number(b.deviation) || Number(b.games) - Number(a.games));
    if (!eligibleUsers.length) {
      await client.query("COMMIT");
      return { accepted: false, reason: "player-provisional" };
    }

    const botResult = await client.query(
      `SELECT level_id, rating, deviation, volatility, games, wins, draws, losses
         FROM qili_bot_ratings
        WHERE level_id = $1
        FOR UPDATE`,
      [levelId],
    );
    const bot = botResult.rows[0];
    if (!bot) throw new Error("Computer rating level is missing");

    const user = eligibleUsers[0];
    const botScore = winner === "black" ? 1 : winner === "red" ? 0 : 0.5;
    const botNext = updateGlicko2(bot, [{ score: botScore, opponent: user }]);
    const isDraw = botScore === 0.5;

    await client.query(
      `UPDATE qili_bot_ratings
          SET rating = $2,
              deviation = $3,
              volatility = $4,
              games = games + 1,
              wins = wins + $5,
              draws = draws + $6,
              losses = losses + $7,
              updated_at = NOW()
        WHERE level_id = $1`,
      [
        levelId,
        Math.round(botNext.rating),
        botNext.deviation,
        botNext.volatility,
        botScore === 1 ? 1 : 0,
        isDraw ? 1 : 0,
        botScore === 0 ? 1 : 0,
      ],
    );
    await client.query(
      `INSERT INTO qili_bot_rating_events
        (game_id, level_id, user_id, user_rating, user_deviation, score)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [gameId, levelId, userId, Math.round(Number(user.rating)), Number(user.deviation), botScore],
    );

    await client.query("COMMIT");
    const publicRecord = publicRatingRecord({
      ...bot,
      rating: Math.round(botNext.rating),
      deviation: botNext.deviation,
      volatility: botNext.volatility,
      games: Number(bot.games) + 1,
      wins: Number(bot.wins) + (botScore === 1 ? 1 : 0),
      draws: Number(bot.draws) + (isDraw ? 1 : 0),
      losses: Number(bot.losses) + (botScore === 0 ? 1 : 0),
    });
    return {
      accepted: true,
      level: levelId,
      rating: publicRecord,
      calibrated: !publicRecord.provisional,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export { seedComputerRatings, loadComputerRatings, recordComputerCalibration };
