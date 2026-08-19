import { createHash, randomBytes, randomUUID } from "node:crypto";
import { verifyToken } from "@clerk/backend";
import {
  createUser,
  getUserByTokenHash,
  getUserByClerkUserId,
  claimClerkUser,
  updateUserDisplayName,
  getRatingsForUser,
  getComputerRatings,
  recordComputerCalibration,
  listGamesForUser,
  initializePersistence,
  persistenceInfo,
} from "./online-persistence.mjs";

function json(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-qili-guest-token",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > 50_000) throw Object.assign(new Error("Request body is too large"), { statusCode: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function cleanName(value, fallback = "棋手") {
  const name = (typeof value === "string" ? value.trim() : "") || fallback;
  return name.slice(0, 24);
}

function hashToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

function bearerToken(request) {
  const header = String(request.headers.authorization || "");
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    displayName: row.display_name,
    registered: Boolean(row.clerk_user_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function clerkConfig() {
  return {
    enabled: Boolean(process.env.CLERK_PUBLISHABLE_KEY && (process.env.CLERK_SECRET_KEY || process.env.CLERK_JWT_KEY)),
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY || null,
  };
}

async function verifyClerkSessionToken(token) {
  if (!token) return null;
  const options = {};
  if (process.env.CLERK_SECRET_KEY) options.secretKey = process.env.CLERK_SECRET_KEY;
  if (process.env.CLERK_JWT_KEY) options.jwtKey = process.env.CLERK_JWT_KEY.replace(/\\n/g, "\n");
  const authorizedParties = String(process.env.CLERK_AUTHORIZED_PARTIES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (authorizedParties.length) options.authorizedParties = authorizedParties;
  if (!options.secretKey && !options.jwtKey) return null;
  try {
    return await verifyToken(token, options);
  } catch {
    return null;
  }
}

async function authenticateAccount(request) {
  const token = bearerToken(request);
  if (!token) return null;

  const guest = await getUserByTokenHash(hashToken(token));
  if (guest) return publicUser(guest);

  const clerkSession = await verifyClerkSessionToken(token);
  if (!clerkSession?.sub) return null;
  const user = await getUserByClerkUserId(clerkSession.sub);
  return user ? publicUser(user) : null;
}

async function requireAccount(request) {
  const user = await authenticateAccount(request);
  if (!user) throw Object.assign(new Error("Invalid or missing account session"), { statusCode: 401 });
  return user;
}

async function ratingsFor(userId) {
  return getRatingsForUser(userId);
}

async function handleIdentityRequest(request, response) {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  const isIdentity = url.pathname.startsWith("/api/identity/");
  const isAuth = url.pathname.startsWith("/api/auth/");
  if (!isIdentity && !isAuth) return false;

  try {
    if (request.method === "GET" && url.pathname === "/api/auth/config") {
      json(response, 200, clerkConfig());
      return true;
    }

    let persistence = persistenceInfo();
    if (!persistence.postgresReady) {
      await initializePersistence();
      persistence = persistenceInfo();
    }
    if (!persistence.postgresReady) {
      const message = persistence.postgresConfigured
        ? "Identity database failed to initialize"
        : "Identity database is not configured";
      throw Object.assign(new Error(message), { statusCode: 503 });
    }

    if (request.method === "GET" && url.pathname === "/api/identity/computer-levels") {
      json(response, 200, { levels: await getComputerRatings() });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/claim") {
      if (!clerkConfig().enabled) throw Object.assign(new Error("Registered login is not configured"), { statusCode: 503 });
      const sessionToken = bearerToken(request);
      const verified = await verifyClerkSessionToken(sessionToken);
      if (!verified?.sub) throw Object.assign(new Error("Invalid Clerk session"), { statusCode: 401 });
      const body = await readJson(request);
      const guestToken = String(request.headers["x-qili-guest-token"] || "").trim();
      const claimed = await claimClerkUser({
        id: randomUUID(),
        clerkUserId: verified.sub,
        guestTokenHash: guestToken ? hashToken(guestToken) : null,
        displayName: cleanName(body.displayName),
      });
      if (!claimed?.user) throw Object.assign(new Error("Could not claim account"), { statusCode: 500 });
      const user = publicUser(claimed.user);
      json(response, 200, {
        user,
        ratings: await ratingsFor(user.id),
        claimedGuest: claimed.claimedGuest,
        restored: claimed.restored,
      });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/identity/guest") {
      const body = await readJson(request);
      const accountToken = randomBytes(32).toString("base64url");
      const user = await createUser({
        id: randomUUID(),
        tokenHash: hashToken(accountToken),
        displayName: cleanName(body.displayName),
      });
      if (!user) throw Object.assign(new Error("Could not create identity"), { statusCode: 500 });
      json(response, 201, { accountToken, user: publicUser(user), ratings: await ratingsFor(user.id) });
      return true;
    }

    if (request.method === "GET" && url.pathname === "/api/identity/me") {
      const user = await requireAccount(request);
      json(response, 200, { user, ratings: await ratingsFor(user.id) });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/identity/me/computer-result") {
      const user = await requireAccount(request);
      const body = await readJson(request);
      const gameId = String(body.gameId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100);
      const level = String(body.level || "").slice(0, 12);
      const winner = body.winner == null ? null : String(body.winner);
      if (!gameId || !["red", "black", null].includes(winner)) {
        throw Object.assign(new Error("Invalid computer game result"), { statusCode: 400 });
      }
      const calibration = await recordComputerCalibration({ gameId, userId: user.id, level, winner });
      json(response, 200, { calibration, levels: await getComputerRatings() });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/identity/me/name") {
      const user = await requireAccount(request);
      const body = await readJson(request);
      const displayName = cleanName(body.displayName, user.displayName);
      const updated = await updateUserDisplayName(user.id, displayName);
      json(response, 200, { user: publicUser(updated), ratings: await ratingsFor(user.id) });
      return true;
    }

    if (request.method === "GET" && url.pathname === "/api/identity/me/games") {
      const user = await requireAccount(request);
      const [history, ratings] = await Promise.all([
        listGamesForUser(user.id, Number(url.searchParams.get("limit") || 20)),
        ratingsFor(user.id),
      ]);
      json(response, 200, { user, ratings, ...history });
      return true;
    }

    json(response, 404, { error: "Identity endpoint not found" });
    return true;
  } catch (error) {
    console.error("[identity]", error);
    json(response, Number(error?.statusCode || 500), {
      error: error instanceof Error ? error.message : "Identity error",
    });
    return true;
  }
}

export { handleIdentityRequest, authenticateAccount, hashToken, verifyClerkSessionToken, clerkConfig };
