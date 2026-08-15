import { createClient } from "redis";
import pg from "pg";

const { Pool } = pg;
const ROOM_PREFIX = "qili:room:";
const TICKETS_KEY = "qili:matchmaking:tickets";
const DEFAULT_RATING = 1200;

let redisClient = null;
let pgPool = null;
let initialized = false;
let state = {
  redisConfigured: Boolean(process.env.REDIS_URL),
  redisReady: false,
  postgresConfigured: Boolean(process.env.DATABASE_URL),
  postgresReady: false,
  restoredRooms: 0,
  restoredTickets: 0,
};

function persistenceInfo() {
  return { ...state };
}

function serializableRoom(room) {
  const copy = structuredClone(room);
  if (copy.players?.red) copy.players.red.connected = false;
  if (copy.players?.black) copy.players.black.connected = false;
  delete copy.saved;
  return copy;
}

function ratingPoolForTimeControl(timeControl) {
  return Number(timeControl?.baseSeconds || 0) <= 300 ? "blitz" : "rapid";
}

function emptyRating(pool) {
  return { pool, rating: DEFAULT_RATING, games: 0, wins: 0, draws: 0, losses: 0 };
}

async function initializePersistence() {
  if (initialized) return persistenceInfo();
  initialized = true;

  if (process.env.REDIS_URL) {
    try {
      redisClient = createClient({ url: process.env.REDIS_URL });
      redisClient.on("error", (error) => console.error("[redis]", error?.message || error));
      await redisClient.connect();
      await redisClient.ping();
      state.redisReady = true;
    } catch (error) {
      console.error("[redis-init]", error);
      state.redisReady = false;
    }
  }

  if (process.env.DATABASE_URL) {
    try {
      pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
        max: 4,
      });

      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS qili_users (
          id TEXT PRIMARY KEY,
          token_hash TEXT UNIQUE,
          clerk_user_id TEXT UNIQUE,
          display_name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await pgPool.query("ALTER TABLE qili_users ALTER COLUMN token_hash DROP NOT NULL");
      await pgPool.query("ALTER TABLE qili_users ADD COLUMN IF NOT EXISTS clerk_user_id TEXT");
      await pgPool.query("CREATE UNIQUE INDEX IF NOT EXISTS qili_users_clerk_user_idx ON qili_users (clerk_user_id) WHERE clerk_user_id IS NOT NULL");

      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS online_games (
          id TEXT PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL,
          started_at TIMESTAMPTZ,
          finished_at TIMESTAMPTZ NOT NULL,
          time_control JSONB NOT NULL,
          red_name TEXT,
          black_name TEXT,
          result JSONB NOT NULL,
          moves JSONB NOT NULL,
          red_user_id TEXT REFERENCES qili_users(id) ON DELETE SET NULL,
          black_user_id TEXT REFERENCES qili_users(id) ON DELETE SET NULL
        )
      `);

      await pgPool.query("ALTER TABLE online_games ADD COLUMN IF NOT EXISTS red_user_id TEXT REFERENCES qili_users(id) ON DELETE SET NULL");
      await pgPool.query("ALTER TABLE online_games ADD COLUMN IF NOT EXISTS black_user_id TEXT REFERENCES qili_users(id) ON DELETE SET NULL");

      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS qili_ratings (
          user_id TEXT NOT NULL REFERENCES qili_users(id) ON DELETE CASCADE,
          pool TEXT NOT NULL CHECK (pool IN ('rapid', 'blitz')),
          rating INTEGER NOT NULL DEFAULT 1200,
          games INTEGER NOT NULL DEFAULT 0,
          wins INTEGER NOT NULL DEFAULT 0,
          draws INTEGER NOT NULL DEFAULT 0,
          losses INTEGER NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, pool)
        )
      `);

      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS rating_events (
          game_id TEXT PRIMARY KEY REFERENCES online_games(id) ON DELETE CASCADE,
          pool TEXT NOT NULL CHECK (pool IN ('rapid', 'blitz')),
          red_user_id TEXT NOT NULL REFERENCES qili_users(id) ON DELETE CASCADE,
          black_user_id TEXT NOT NULL REFERENCES qili_users(id) ON DELETE CASCADE,
          red_before INTEGER NOT NULL,
          red_after INTEGER NOT NULL,
          black_before INTEGER NOT NULL,
          black_after INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await pgPool.query("CREATE INDEX IF NOT EXISTS online_games_finished_at_idx ON online_games (finished_at DESC)");
      await pgPool.query("CREATE INDEX IF NOT EXISTS online_games_red_user_idx ON online_games (red_user_id, finished_at DESC)");
      await pgPool.query("CREATE INDEX IF NOT EXISTS online_games_black_user_idx ON online_games (black_user_id, finished_at DESC)");
      await pgPool.query("CREATE INDEX IF NOT EXISTS qili_ratings_user_idx ON qili_ratings (user_id)");
      state.postgresReady = true;
    } catch (error) {
      console.error("[postgres-init]", error);
      state.postgresReady = false;
    }
  }

  return persistenceInfo();
}

async function createUser({ id, tokenHash, displayName }) {
  if (!state.postgresReady || !pgPool) return null;
  const result = await pgPool.query(
    `INSERT INTO qili_users (id, token_hash, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (token_hash) DO UPDATE SET updated_at = NOW()
     RETURNING id, display_name, clerk_user_id, created_at, updated_at`,
    [id, tokenHash, displayName],
  );
  return result.rows[0] || null;
}

async function getUserByTokenHash(tokenHash) {
  if (!state.postgresReady || !pgPool || !tokenHash) return null;
  const result = await pgPool.query(
    "SELECT id, display_name, clerk_user_id, created_at, updated_at FROM qili_users WHERE token_hash = $1 LIMIT 1",
    [tokenHash],
  );
  return result.rows[0] || null;
}

async function getUserByClerkUserId(clerkUserId) {
  if (!state.postgresReady || !pgPool || !clerkUserId) return null;
  const result = await pgPool.query(
    "SELECT id, display_name, clerk_user_id, created_at, updated_at FROM qili_users WHERE clerk_user_id = $1 LIMIT 1",
    [clerkUserId],
  );
  return result.rows[0] || null;
}

async function claimClerkUser({ id, clerkUserId, guestTokenHash = null, displayName = "棋手" }) {
  if (!state.postgresReady || !pgPool || !clerkUserId) return null;
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT id, display_name, clerk_user_id, created_at, updated_at FROM qili_users WHERE clerk_user_id = $1 LIMIT 1 FOR UPDATE",
      [clerkUserId],
    );
    if (existing.rows.length) {
      await client.query("COMMIT");
      return { user: existing.rows[0], claimedGuest: false, restored: true };
    }

    if (guestTokenHash) {
      const guest = await client.query(
        "SELECT id, display_name, clerk_user_id, created_at, updated_at FROM qili_users WHERE token_hash = $1 LIMIT 1 FOR UPDATE",
        [guestTokenHash],
      );
      if (guest.rows.length && !guest.rows[0].clerk_user_id) {
        const updated = await client.query(
          `UPDATE qili_users
              SET clerk_user_id = $2,
                  token_hash = NULL,
                  display_name = CASE WHEN display_name = '棋手' AND $3 <> '' THEN $3 ELSE display_name END,
                  updated_at = NOW()
            WHERE id = $1
            RETURNING id, display_name, clerk_user_id, created_at, updated_at`,
          [guest.rows[0].id, clerkUserId, displayName],
        );
        await client.query("COMMIT");
        return { user: updated.rows[0], claimedGuest: true, restored: false };
      }
    }

    const created = await client.query(
      `INSERT INTO qili_users (id, token_hash, clerk_user_id, display_name)
       VALUES ($1, NULL, $2, $3)
       RETURNING id, display_name, clerk_user_id, created_at, updated_at`,
      [id, clerkUserId, displayName],
    );
    await client.query("COMMIT");
    return { user: created.rows[0], claimedGuest: false, restored: false };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
async function updateUserDisplayName(userId, displayName) {
  if (!state.postgresReady || !pgPool || !userId) return null;
  const result = await pgPool.query(
    `UPDATE qili_users SET display_name = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, display_name, clerk_user_id, created_at, updated_at`,
    [userId, displayName],
  );
  return result.rows[0] || null;
}

async function getRatingsForUser(userId) {
  const ratings = { rapid: emptyRating("rapid"), blitz: emptyRating("blitz") };
  if (!state.postgresReady || !pgPool || !userId) return ratings;
  const result = await pgPool.query(
    `SELECT pool, rating, games, wins, draws, losses
       FROM qili_ratings WHERE user_id = $1`,
    [userId],
  );
  for (const row of result.rows) {
    if (!ratings[row.pool]) continue;
    ratings[row.pool] = {
      pool: row.pool,
      rating: Number(row.rating),
      games: Number(row.games),
      wins: Number(row.wins),
      draws: Number(row.draws),
      losses: Number(row.losses),
    };
  }
  return ratings;
}

async function listGamesForUser(userId, limit = 20) {
  if (!state.postgresReady || !pgPool || !userId) return { games: [], total: 0 };
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  const [gamesResult, countResult] = await Promise.all([
    pgPool.query(
      `SELECT g.id, g.created_at, g.started_at, g.finished_at, g.time_control,
              g.red_name, g.black_name, g.red_user_id, g.black_user_id, g.result, g.moves,
              re.pool AS rating_pool,
              re.red_before, re.red_after, re.black_before, re.black_after
         FROM online_games g
         LEFT JOIN rating_events re ON re.game_id = g.id
        WHERE g.red_user_id = $1 OR g.black_user_id = $1
        ORDER BY g.finished_at DESC
        LIMIT $2`,
      [userId, safeLimit],
    ),
    pgPool.query(
      "SELECT COUNT(*)::int AS count FROM online_games WHERE red_user_id = $1 OR black_user_id = $1",
      [userId],
    ),
  ]);

  return {
    total: Number(countResult.rows[0]?.count || 0),
    games: gamesResult.rows.map((row) => {
      const isRed = row.red_user_id === userId;
      const before = row.rating_pool ? Number(isRed ? row.red_before : row.black_before) : null;
      const after = row.rating_pool ? Number(isRed ? row.red_after : row.black_after) : null;
      return {
        id: row.id,
        createdAt: row.created_at,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        timeControl: row.time_control,
        color: isRed ? "red" : "black",
        opponent: isRed ? (row.black_name || "黑方") : (row.red_name || "红方"),
        result: row.result,
        moves: row.moves,
        ratingPool: row.rating_pool || null,
        ratingBefore: before,
        ratingAfter: after,
        ratingDelta: before == null || after == null ? null : after - before,
      };
    }),
  };
}

async function saveRoom(room) {
  if (!state.redisReady || !redisClient || !room?.id) return false;
  const ttlSeconds = room.status === "finished" ? 86_400 : 60 * 60 * 24 * 7;
  await redisClient.set(`${ROOM_PREFIX}${room.id}`, JSON.stringify(serializableRoom(room)), { EX: ttlSeconds });
  return true;
}

async function loadRooms() {
  if (!state.redisReady || !redisClient) return [];
  const keys = await redisClient.keys(`${ROOM_PREFIX}*`);
  if (!keys.length) return [];
  const values = await redisClient.mGet(keys);
  const rooms = [];
  for (const raw of values) {
    if (!raw) continue;
    try {
      const room = JSON.parse(raw);
      if (!room?.id) continue;
      if (room.players?.red) room.players.red.connected = false;
      if (room.players?.black) room.players.black.connected = false;
      rooms.push(room);
    } catch (error) {
      console.error("[redis-room-parse]", error);
    }
  }
  state.restoredRooms = rooms.length;
  return rooms;
}

async function saveTickets(tickets) {
  if (!state.redisReady || !redisClient) return false;
  await redisClient.set(TICKETS_KEY, JSON.stringify(tickets), { EX: 60 * 60 * 6 });
  return true;
}

async function loadTickets() {
  if (!state.redisReady || !redisClient) return [];
  const raw = await redisClient.get(TICKETS_KEY);
  if (!raw) return [];
  try {
    const tickets = JSON.parse(raw);
    const recent = Array.isArray(tickets)
      ? tickets.filter((ticket) => Date.now() - Number(ticket?.createdAt || 0) < 6 * 60 * 60 * 1000)
      : [];
    state.restoredTickets = recent.length;
    return recent;
  } catch (error) {
    console.error("[redis-ticket-parse]", error);
    return [];
  }
}

function expectedScore(ratingA, ratingB) {
  return 1 / (1 + (10 ** ((ratingB - ratingA) / 400)));
}

function kFactor(games) {
  return Number(games || 0) < 20 ? 40 : 24;
}

async function applyRatingForFinishedGame(room) {
  const redUserId = room.players?.red?.userId || null;
  const blackUserId = room.players?.black?.userId || null;
  if (!state.postgresReady || !pgPool || !redUserId || !blackUserId || redUserId === blackUserId) return false;

  const pool = ratingPoolForTimeControl(room.timeControl);
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const already = await client.query("SELECT game_id FROM rating_events WHERE game_id = $1 LIMIT 1", [room.id]);
    if (already.rows.length) {
      await client.query("COMMIT");
      return false;
    }

    await client.query(
      `INSERT INTO qili_ratings (user_id, pool) VALUES ($1, $3), ($2, $3)
       ON CONFLICT (user_id, pool) DO NOTHING`,
      [redUserId, blackUserId, pool],
    );

    const current = await client.query(
      `SELECT user_id, rating, games, wins, draws, losses
         FROM qili_ratings
        WHERE pool = $1 AND user_id = ANY($2::text[])
        FOR UPDATE`,
      [pool, [redUserId, blackUserId]],
    );
    const red = current.rows.find((row) => row.user_id === redUserId);
    const black = current.rows.find((row) => row.user_id === blackUserId);
    if (!red || !black) throw new Error("Could not lock rating rows");

    const redBefore = Number(red.rating);
    const blackBefore = Number(black.rating);
    const winner = room.result?.winner || null;
    const redScore = winner === "red" ? 1 : winner === "black" ? 0 : 0.5;
    const blackScore = 1 - redScore;
    const redAfter = Math.max(100, Math.round(redBefore + kFactor(red.games) * (redScore - expectedScore(redBefore, blackBefore))));
    const blackAfter = Math.max(100, Math.round(blackBefore + kFactor(black.games) * (blackScore - expectedScore(blackBefore, redBefore))));
    const isDraw = winner == null;

    await client.query(
      `UPDATE qili_ratings
          SET rating = $3,
              games = games + 1,
              wins = wins + $4,
              draws = draws + $5,
              losses = losses + $6,
              updated_at = NOW()
        WHERE user_id = $1 AND pool = $2`,
      [redUserId, pool, redAfter, redScore === 1 ? 1 : 0, isDraw ? 1 : 0, redScore === 0 ? 1 : 0],
    );
    await client.query(
      `UPDATE qili_ratings
          SET rating = $3,
              games = games + 1,
              wins = wins + $4,
              draws = draws + $5,
              losses = losses + $6,
              updated_at = NOW()
        WHERE user_id = $1 AND pool = $2`,
      [blackUserId, pool, blackAfter, blackScore === 1 ? 1 : 0, isDraw ? 1 : 0, blackScore === 0 ? 1 : 0],
    );

    await client.query(
      `INSERT INTO rating_events (
         game_id, pool, red_user_id, black_user_id,
         red_before, red_after, black_before, black_after
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [room.id, pool, redUserId, blackUserId, redBefore, redAfter, blackBefore, blackAfter],
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function saveFinishedGame(room) {
  if (!state.postgresReady || !pgPool || room?.status !== "finished" || !room?.finishedAt) return false;
  await pgPool.query(
    `INSERT INTO online_games (
       id, created_at, started_at, finished_at, time_control, red_name, black_name,
       result, moves, red_user_id, black_user_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET
       finished_at = EXCLUDED.finished_at,
       result = EXCLUDED.result,
       moves = EXCLUDED.moves,
       red_name = EXCLUDED.red_name,
       black_name = EXCLUDED.black_name,
       red_user_id = EXCLUDED.red_user_id,
       black_user_id = EXCLUDED.black_user_id`,
    [
      room.id,
      new Date(room.createdAt),
      room.startedAt ? new Date(room.startedAt) : null,
      new Date(room.finishedAt),
      JSON.stringify(room.timeControl),
      room.players?.red?.name || null,
      room.players?.black?.name || null,
      JSON.stringify(room.result),
      JSON.stringify(room.moveHistory || []),
      room.players?.red?.userId || null,
      room.players?.black?.userId || null,
    ],
  );
  await applyRatingForFinishedGame(room);
  return true;
}

async function getFinishedGame(id) {
  if (!state.postgresReady || !pgPool) return null;
  const result = await pgPool.query(
    `SELECT g.id, g.created_at, g.started_at, g.finished_at, g.time_control,
            g.red_name, g.black_name, g.result, g.moves,
            re.pool AS rating_pool, re.red_before, re.red_after, re.black_before, re.black_after
       FROM online_games g
       LEFT JOIN rating_events re ON re.game_id = g.id
      WHERE g.id = $1 LIMIT 1`,
    [id],
  );
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    timeControl: row.time_control,
    players: { red: { name: row.red_name }, black: { name: row.black_name } },
    result: row.result,
    moves: row.moves,
    rating: row.rating_pool ? {
      pool: row.rating_pool,
      redBefore: Number(row.red_before),
      redAfter: Number(row.red_after),
      blackBefore: Number(row.black_before),
      blackAfter: Number(row.black_after),
    } : null,
  };
}

async function closePersistence() {
  try {
    if (redisClient?.isOpen) await redisClient.quit();
  } catch {}
  try {
    if (pgPool) await pgPool.end();
  } catch {}
}

export {
  initializePersistence,
  persistenceInfo,
  ratingPoolForTimeControl,
  createUser,
  getUserByTokenHash,
  getUserByClerkUserId,
  claimClerkUser,
  updateUserDisplayName,
  getRatingsForUser,
  listGamesForUser,
  saveRoom,
  loadRooms,
  saveTickets,
  loadTickets,
  saveFinishedGame,
  getFinishedGame,
  closePersistence,
};
