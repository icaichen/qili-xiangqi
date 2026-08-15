import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./online-persistence.mjs", import.meta.url);
let source = await readFile(path, "utf8");

const replacements = [
  [
`          token_hash TEXT UNIQUE NOT NULL,
          display_name TEXT NOT NULL,`,
`          token_hash TEXT UNIQUE,
          clerk_user_id TEXT UNIQUE,
          display_name TEXT NOT NULL,`,
  ],
  [
`      await pgPool.query(\`
        CREATE TABLE IF NOT EXISTS online_games (`,
`      await pgPool.query("ALTER TABLE qili_users ALTER COLUMN token_hash DROP NOT NULL");
      await pgPool.query("ALTER TABLE qili_users ADD COLUMN IF NOT EXISTS clerk_user_id TEXT");
      await pgPool.query("CREATE UNIQUE INDEX IF NOT EXISTS qili_users_clerk_user_idx ON qili_users (clerk_user_id) WHERE clerk_user_id IS NOT NULL");

      await pgPool.query(\`
        CREATE TABLE IF NOT EXISTS online_games (`,
  ],
  [
`     RETURNING id, display_name, created_at, updated_at`,
`     RETURNING id, display_name, clerk_user_id, created_at, updated_at`,
  ],
  [
`    "SELECT id, display_name, created_at, updated_at FROM qili_users WHERE token_hash = $1 LIMIT 1",`,
`    "SELECT id, display_name, clerk_user_id, created_at, updated_at FROM qili_users WHERE token_hash = $1 LIMIT 1",`,
  ],
  [
`     RETURNING id, display_name, created_at, updated_at`,
`     RETURNING id, display_name, clerk_user_id, created_at, updated_at`,
  ],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`Expected persistence snippet not found: ${before.slice(0, 100)}`);
  source = source.replace(before, after);
}

const anchor = `async function updateUserDisplayName(userId, displayName) {`;
if (!source.includes(anchor)) throw new Error("updateUserDisplayName anchor not found");

const additions = [
  'async function getUserByClerkUserId(clerkUserId) {',
  '  if (!state.postgresReady || !pgPool || !clerkUserId) return null;',
  '  const result = await pgPool.query(',
  '    "SELECT id, display_name, clerk_user_id, created_at, updated_at FROM qili_users WHERE clerk_user_id = $1 LIMIT 1",',
  '    [clerkUserId],',
  '  );',
  '  return result.rows[0] || null;',
  '}',
  '',
  'async function claimClerkUser({ id, clerkUserId, guestTokenHash = null, displayName = "棋手" }) {',
  '  if (!state.postgresReady || !pgPool || !clerkUserId) return null;',
  '  const client = await pgPool.connect();',
  '  try {',
  '    await client.query("BEGIN");',
  '    const existing = await client.query(',
  '      "SELECT id, display_name, clerk_user_id, created_at, updated_at FROM qili_users WHERE clerk_user_id = $1 LIMIT 1 FOR UPDATE",',
  '      [clerkUserId],',
  '    );',
  '    if (existing.rows.length) {',
  '      await client.query("COMMIT");',
  '      return { user: existing.rows[0], claimedGuest: false, restored: true };',
  '    }',
  '',
  '    if (guestTokenHash) {',
  '      const guest = await client.query(',
  '        "SELECT id, display_name, clerk_user_id, created_at, updated_at FROM qili_users WHERE token_hash = $1 LIMIT 1 FOR UPDATE",',
  '        [guestTokenHash],',
  '      );',
  '      if (guest.rows.length && !guest.rows[0].clerk_user_id) {',
  '        const updated = await client.query(',
  '          `UPDATE qili_users',
  '              SET clerk_user_id = $2,',
  '                  token_hash = NULL,',
  "                  display_name = CASE WHEN display_name = '棋手' AND $3 <> '' THEN $3 ELSE display_name END,",
  '                  updated_at = NOW()',
  '            WHERE id = $1',
  '            RETURNING id, display_name, clerk_user_id, created_at, updated_at`,',
  '          [guest.rows[0].id, clerkUserId, displayName],',
  '        );',
  '        await client.query("COMMIT");',
  '        return { user: updated.rows[0], claimedGuest: true, restored: false };',
  '      }',
  '    }',
  '',
  '    const created = await client.query(',
  '      `INSERT INTO qili_users (id, token_hash, clerk_user_id, display_name)',
  '       VALUES ($1, NULL, $2, $3)',
  '       RETURNING id, display_name, clerk_user_id, created_at, updated_at`,',
  '      [id, clerkUserId, displayName],',
  '    );',
  '    await client.query("COMMIT");',
  '    return { user: created.rows[0], claimedGuest: false, restored: false };',
  '  } catch (error) {',
  '    await client.query("ROLLBACK").catch(() => {});',
  '    throw error;',
  '  } finally {',
  '    client.release();',
  '  }',
  '}',
  '',
].join("\n");

source = source.replace(anchor, `${additions}${anchor}`);

const exportBefore = `  getUserByTokenHash,
  updateUserDisplayName,`;
const exportAfter = `  getUserByTokenHash,
  getUserByClerkUserId,
  claimClerkUser,
  updateUserDisplayName,`;
if (!source.includes(exportBefore)) throw new Error("Persistence export anchor not found");
source = source.replace(exportBefore, exportAfter);

await writeFile(path, source, "utf8");
console.log("Clerk persistence migration added");
