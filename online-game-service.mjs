import { randomBytes } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  RED, BLACK, normalizeTimeControl, createRoom, restoreRoom, getRoom, allRooms, joinRoom,
  colorForToken, snapshot, applyPlayerAction,
} from "./online-room-core.mjs";
import {
  initializePersistence,
  persistenceInfo,
  saveRoom,
  loadRooms,
  saveTickets,
  loadTickets,
  saveFinishedGame,
  getFinishedGame,
  closePersistence,
} from "./online-persistence.mjs";
import { authenticateAccount } from "./identity-service.mjs";

const connections = new Map();
const tickets = new Map();
const DATA_DIR = join(process.cwd(), "data");
const GAMES_FILE = join(DATA_DIR, "online-games.jsonl");
const makeToken = () => randomBytes(18).toString("base64url");
let onlineInitialized = false;
let onlineInitPromise = null;

function json(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > 100_000) throw Object.assign(new Error("Request body is too large"), { statusCode: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function initializeOnlineService() {
  if (onlineInitialized) return serviceInfo();
  if (onlineInitPromise) return onlineInitPromise;
  onlineInitPromise = (async () => {
    await initializePersistence();
    const restoredRooms = await loadRooms();
    for (const room of restoredRooms) restoreRoom(room);
    const restoredTickets = await loadTickets();
    for (const ticket of restoredTickets) {
      if (!ticket?.id) continue;
      tickets.set(ticket.id, ticket);
    }
    onlineInitialized = true;
    return serviceInfo();
  })().catch((error) => {
    onlineInitPromise = null;
    console.error("[online-init]", error);
    onlineInitialized = true;
    return serviceInfo();
  });
  return onlineInitPromise;
}

async function closeOnlineService() {
  await closePersistence();
}

function connectionBucket(roomId, token) {
  if (!connections.has(roomId)) connections.set(roomId, new Map());
  const roomMap = connections.get(roomId);
  if (!roomMap.has(token)) roomMap.set(token, new Set());
  return roomMap.get(token);
}

function sendEvent(response, event, payload) {
  if (!response.destroyed && !response.writableEnded) {
    response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  }
}

function broadcast(room, event = "state") {
  const roomMap = connections.get(room.id);
  if (!roomMap) return;
  for (const [token, responses] of roomMap) {
    const payload = snapshot(room, token);
    for (const response of responses) sendEvent(response, event, payload);
  }
}

function attach(room, token, response) {
  const color = colorForToken(room, token);
  if (!color) throw Object.assign(new Error("Invalid player token"), { statusCode: 403 });
  const bucket = connectionBucket(room.id, token);
  bucket.add(response);
  room.players[color].connected = true;
  sendEvent(response, "state", snapshot(room, token));
  broadcast(room, "presence");

  const cleanup = () => {
    bucket.delete(response);
    if (!bucket.size) {
      connections.get(room.id)?.delete(token);
      room.players[color].connected = false;
      broadcast(room, "presence");
    }
  };
  response.on("close", cleanup);
  response.on("error", cleanup);
}

async function fallbackSaveFinishedGame(room) {
  await mkdir(DATA_DIR, { recursive: true });
  const record = {
    id: room.id,
    finishedAt: room.finishedAt,
    timeControl: room.timeControl,
    players: {
      red: room.players.red ? { name: room.players.red.name } : null,
      black: room.players.black ? { name: room.players.black.name } : null,
    },
    result: room.result,
    moves: room.moveHistory,
  };
  await appendFile(GAMES_FILE, `${JSON.stringify(record)}\n`, "utf8");
}

async function persistIfFinished(room) {
  if (room.status !== "finished" || room.saved) return;
  room.saved = true;
  try {
    await saveRoom(room);
    const storedInPostgres = await saveFinishedGame(room);
    if (!storedInPostgres) await fallbackSaveFinishedGame(room);
  } catch (error) {
    room.saved = false;
    console.error("[online-save]", error);
  }
}

async function persistTickets() {
  try {
    await saveTickets([...tickets.values()]);
  } catch (error) {
    console.error("[matchmaking-save]", error);
  }
}

function ticketSnapshot(ticket) {
  return {
    ticketId: ticket.id,
    status: ticket.status,
    roomId: ticket.roomId,
    color: ticket.color,
    playerToken: ticket.status === "matched" ? ticket.playerToken : undefined,
    timeControl: ticket.timeControl,
  };
}

function createMatchTicket(name, timeControl, userId = null) {
  const ticket = {
    id: makeToken(),
    playerToken: makeToken(),
    userId: userId || null,
    name: (String(name || "棋手").trim() || "棋手").slice(0, 24),
    timeControl: normalizeTimeControl(timeControl),
    createdAt: Date.now(),
    status: "waiting",
    roomId: null,
    color: null,
  };
  const key = `${ticket.timeControl.baseSeconds}+${ticket.timeControl.incrementSeconds}`;
  const opponent = [...tickets.values()].find((item) =>
    item.status === "waiting" &&
    `${item.timeControl.baseSeconds}+${item.timeControl.incrementSeconds}` === key
  );
  tickets.set(ticket.id, ticket);
  if (opponent) {
    const room = createRoom({
      redName: opponent.name,
      redToken: opponent.playerToken,
      redUserId: opponent.userId || null,
      blackName: ticket.name,
      blackToken: ticket.playerToken,
      blackUserId: ticket.userId || null,
      timeControl: ticket.timeControl,
    });
    opponent.status = "matched";
    opponent.roomId = room.id;
    opponent.color = RED;
    ticket.status = "matched";
    ticket.roomId = room.id;
    ticket.color = BLACK;
  }
  return ticket;
}

function serviceInfo() {
  return {
    enabled: true,
    transport: "sse",
    waitingPlayers: [...tickets.values()].filter((ticket) => ticket.status === "waiting").length,
    persistence: persistenceInfo(),
  };
}

async function handleOnlineRequest(request, response) {
  await initializeOnlineService();
  const url = new URL(request.url, "http://127.0.0.1");
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "api" || parts[1] !== "online") return false;

  try {
    if (request.method === "GET" && url.pathname === "/api/online/health") {
      json(response, 200, serviceInfo());
      return true;
    }

    if (request.method === "GET" && parts.length === 4 && parts[2] === "games") {
      const game = await getFinishedGame(parts[3]);
      if (!game) throw Object.assign(new Error("Game not found"), { statusCode: 404 });
      json(response, 200, { game });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/online/rooms") {
      const body = await readJson(request);
      const account = await authenticateAccount(request);
      const room = createRoom({
        redName: account?.displayName || body.displayName || "红方",
        redUserId: account?.id || null,
        timeControl: body.timeControl,
      });
      await saveRoom(room);
      json(response, 201, { room: snapshot(room, room.players.red.token), playerToken: room.players.red.token, color: RED });
      return true;
    }

    if (request.method === "POST" && parts.length === 5 && parts[2] === "rooms" && parts[4] === "join") {
      const room = getRoom(parts[3]);
      if (!room) throw Object.assign(new Error("Room not found"), { statusCode: 404 });
      const body = await readJson(request);
      const account = await authenticateAccount(request);
      const player = joinRoom(room, account?.displayName || body.displayName || "黑方", null, account?.id || null);
      await saveRoom(room);
      broadcast(room, "started");
      json(response, 200, { room: snapshot(room, player.token), playerToken: player.token, color: BLACK });
      return true;
    }

    if (request.method === "GET" && parts.length === 4 && parts[2] === "rooms") {
      const room = getRoom(parts[3]);
      if (!room) throw Object.assign(new Error("Room not found"), { statusCode: 404 });
      json(response, 200, { room: snapshot(room, url.searchParams.get("token")) });
      return true;
    }

    if (request.method === "GET" && parts.length === 5 && parts[2] === "rooms" && parts[4] === "events") {
      const room = getRoom(parts[3]);
      if (!room) throw Object.assign(new Error("Room not found"), { statusCode: 404 });
      const token = url.searchParams.get("token");
      if (!colorForToken(room, token)) throw Object.assign(new Error("Invalid player token"), { statusCode: 403 });
      response.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "access-control-allow-origin": "*",
      });
      response.flushHeaders?.();
      attach(room, token, response);
      return true;
    }

    if (request.method === "POST" && parts.length === 5 && parts[2] === "rooms" && parts[4] === "action") {
      const room = getRoom(parts[3]);
      if (!room) throw Object.assign(new Error("Room not found"), { statusCode: 404 });
      const body = await readJson(request);
      applyPlayerAction(room, body.playerToken, body);
      await saveRoom(room);
      broadcast(room, room.status === "finished" ? "finished" : body.type);
      await persistIfFinished(room);
      json(response, 200, { room: snapshot(room, body.playerToken) });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/online/matchmaking") {
      const body = await readJson(request);
      if (body.ticketId) {
        const ticket = tickets.get(body.ticketId);
        if (!ticket) throw Object.assign(new Error("Matchmaking ticket not found"), { statusCode: 404 });
        json(response, 200, ticketSnapshot(ticket));
        return true;
      }
      const account = await authenticateAccount(request);
      const ticket = createMatchTicket(
        account?.displayName || body.displayName,
        body.timeControl,
        account?.id || null,
      );
      if (ticket.status === "matched" && ticket.roomId) {
        const room = getRoom(ticket.roomId);
        if (room) await saveRoom(room);
      }
      await persistTickets();
      json(response, 200, ticketSnapshot(ticket));
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/online/matchmaking/cancel") {
      const body = await readJson(request);
      const ticket = tickets.get(body.ticketId);
      if (ticket?.status === "waiting") tickets.delete(ticket.id);
      await persistTickets();
      json(response, 200, { cancelled: Boolean(ticket) });
      return true;
    }

    json(response, 404, { error: "Online endpoint not found" });
    return true;
  } catch (error) {
    console.error("[online]", error);
    json(response, Number(error?.statusCode || 500), { error: error instanceof Error ? error.message : "Online game error" });
    return true;
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [roomId, roomMap] of connections) {
    const room = getRoom(roomId);
    if (!room) continue;
    for (const [token, responses] of roomMap) {
      const payload = snapshot(room, token);
      for (const response of responses) sendEvent(response, "clock", payload);
    }
  }
  for (const room of allRooms()) {
    if (room.status === "finished") void persistIfFinished(room);
  }
  let ticketsChanged = false;
  for (const [id, ticket] of tickets) {
    if (now - ticket.createdAt > 10 * 60 * 1000) {
      tickets.delete(id);
      ticketsChanged = true;
    }
  }
  if (ticketsChanged) void persistTickets();
}, 1000).unref?.();

export { initializeOnlineService, closeOnlineService, handleOnlineRequest, serviceInfo };
