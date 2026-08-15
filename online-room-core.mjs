import { randomBytes, randomUUID } from "node:crypto";
import { RED, BLACK, OPPOSITE, createInitialBoard, applyMove, validateMove, gameStatus } from "./xiangqi-server-rules.mjs";

const rooms = new Map();
const makeToken = () => randomBytes(18).toString("base64url");
const cleanName = (value, fallback = "棋手") => ((typeof value === "string" ? value.trim() : "") || fallback).slice(0, 24);

function normalizeTimeControl(value) {
  const options = [
    { baseSeconds: 600, incrementSeconds: 0, label: "10+0" },
    { baseSeconds: 600, incrementSeconds: 5, label: "10+5" },
    { baseSeconds: 300, incrementSeconds: 3, label: "5+3" },
  ];
  return options.find((item) => item.baseSeconds === Number(value?.baseSeconds) && item.incrementSeconds === Number(value?.incrementSeconds)) || options[0];
}

function newPlayer(name, suppliedToken = null, userId = null) {
  return {
    id: randomUUID(),
    token: suppliedToken || makeToken(),
    userId: userId || null,
    name: cleanName(name),
    connected: false,
  };
}

function createRoom({
  redName = "红方",
  redToken = null,
  redUserId = null,
  blackName = null,
  blackToken = null,
  blackUserId = null,
  timeControl,
} = {}) {
  const id = randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  const tc = normalizeTimeControl(timeControl);
  const now = Date.now();
  const room = {
    id, status: blackName ? "active" : "waiting", createdAt: now, updatedAt: now,
    startedAt: blackName ? now : null, finishedAt: null, timeControl: tc,
    players: {
      red: newPlayer(redName, redToken, redUserId),
      black: blackName ? newPlayer(blackName, blackToken, blackUserId) : null,
    },
    board: createInitialBoard(), currentTurn: RED, moveHistory: [],
    clocks: { redMs: tc.baseSeconds * 1000, blackMs: tc.baseSeconds * 1000 },
    turnStartedAt: blackName ? now : null, drawOfferBy: null, result: null,
  };
  rooms.set(id, room);
  return room;
}

function restoreRoom(room) {
  if (!room?.id || !Array.isArray(room.board)) return null;
  if (room.players?.red) room.players.red.connected = false;
  if (room.players?.black) room.players.black.connected = false;
  rooms.set(room.id, room);
  return room;
}

function getRoom(id) { return rooms.get(id) || null; }
function allRooms() { return [...rooms.values()]; }

function colorForToken(room, token) {
  if (room.players.red?.token === token) return RED;
  if (room.players.black?.token === token) return BLACK;
  return null;
}

function clockView(room, now = Date.now()) {
  let { redMs, blackMs } = room.clocks;
  if (room.status === "active" && room.turnStartedAt) {
    const elapsed = Math.max(0, now - room.turnStartedAt);
    if (room.currentTurn === RED) redMs = Math.max(0, redMs - elapsed);
    else blackMs = Math.max(0, blackMs - elapsed);
  }
  return { redMs, blackMs, serverNow: now };
}

function snapshot(room, token = null) {
  return {
    id: room.id, status: room.status, timeControl: room.timeControl,
    viewerColor: colorForToken(room, token),
    players: {
      red: room.players.red ? { name: room.players.red.name, connected: room.players.red.connected } : null,
      black: room.players.black ? { name: room.players.black.name, connected: room.players.black.connected } : null,
    },
    board: room.board, currentTurn: room.currentTurn, moveHistory: room.moveHistory,
    clocks: clockView(room), drawOfferBy: room.drawOfferBy, result: room.result,
  };
}

function settleClock(room, now = Date.now()) {
  if (room.status !== "active" || !room.turnStartedAt) return;
  const key = room.currentTurn === RED ? "redMs" : "blackMs";
  room.clocks[key] = Math.max(0, room.clocks[key] - Math.max(0, now - room.turnStartedAt));
  room.turnStartedAt = now;
  if (room.clocks[key] <= 0) finishRoom(room, { winner: OPPOSITE[room.currentTurn], reason: "timeout" });
}

function finishRoom(room, result) {
  if (room.status === "finished") return;
  room.status = "finished"; room.result = result; room.finishedAt = Date.now(); room.updatedAt = room.finishedAt; room.turnStartedAt = null; room.drawOfferBy = null;
}

function joinRoom(room, name, suppliedToken = null, userId = null) {
  if (room.status !== "waiting" || room.players.black) throw Object.assign(new Error("Room is not available"), { statusCode: 409 });
  room.players.black = newPlayer(name || "黑方", suppliedToken, userId);
  room.status = "active";
  room.startedAt = Date.now();
  room.turnStartedAt = room.startedAt;
  room.updatedAt = room.startedAt;
  return room.players.black;
}

function applyPlayerAction(room, token, body) {
  const color = colorForToken(room, token);
  if (!color) throw Object.assign(new Error("Invalid player token"), { statusCode: 403 });
  const requiresActive = ["resign", "offerDraw", "acceptDraw", "declineDraw"];
  if (requiresActive.includes(body?.type) && room.status !== "active") throw Object.assign(new Error("Game is not active"), { statusCode: 409 });
  if (body?.type === "resign") { finishRoom(room, { winner: OPPOSITE[color], reason: "resignation" }); return; }
  if (body?.type === "offerDraw") { room.drawOfferBy = color; room.updatedAt = Date.now(); return; }
  if (body?.type === "declineDraw") { if (room.drawOfferBy && room.drawOfferBy !== color) room.drawOfferBy = null; return; }
  if (body?.type === "acceptDraw") {
    if (!room.drawOfferBy || room.drawOfferBy === color) throw Object.assign(new Error("No opponent draw offer"), { statusCode: 409 });
    finishRoom(room, { winner: null, reason: "draw-agreed" }); return;
  }
  if (body?.type !== "move") throw Object.assign(new Error("Unknown action"), { statusCode: 400 });
  if (room.status !== "active") throw Object.assign(new Error("Game is not active"), { statusCode: 409 });
  const now = Date.now(); settleClock(room, now);
  if (room.status !== "active") return;
  if (room.currentTurn !== color) throw Object.assign(new Error("Not your turn"), { statusCode: 409 });
  const checked = validateMove(room.board, color, body.move);
  if (!checked.ok) throw Object.assign(new Error(`Illegal move: ${checked.reason}`), { statusCode: 400 });
  const moving = room.board[checked.move.fromRow][checked.move.fromCol];
  const moved = applyMove(room.board, checked.move);
  room.moveHistory.push({ ply: room.moveHistory.length + 1, color, move: checked.move, piece: moving?.label || null, captured: moved.captured?.label || null, at: now });
  room.board = moved.board; room.clocks[color === RED ? "redMs" : "blackMs"] += room.timeControl.incrementSeconds * 1000;
  room.currentTurn = OPPOSITE[color]; room.turnStartedAt = now; room.drawOfferBy = null; room.updatedAt = now;
  const state = gameStatus(room.board, room.currentTurn);
  if (state.over) finishRoom(room, { winner: state.winner, reason: state.reason });
}

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.status === "active" && room.turnStartedAt) {
      const clocks = clockView(room, now);
      if ((room.currentTurn === RED ? clocks.redMs : clocks.blackMs) <= 0) settleClock(room, now);
    }
  }
}, 1000).unref?.();

export { RED, BLACK, normalizeTimeControl, createRoom, restoreRoom, getRoom, allRooms, joinRoom, colorForToken, snapshot, applyPlayerAction };
