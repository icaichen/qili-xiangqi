import { createRoom, joinRoom, snapshot, applyPlayerAction } from "./online-room-core.mjs";
import { createInitialBoard, validateMove } from "./xiangqi-server-rules.mjs";

const assert = (condition, message) => { if (!condition) throw new Error(message); };

const initial = createInitialBoard();
assert(validateMove(initial, "red", { fromRow: 6, fromCol: 0, toRow: 5, toCol: 0 }).ok, "red pawn forward should be legal");
assert(!validateMove(initial, "red", { fromRow: 6, fromCol: 0, toRow: 6, toCol: 1 }).ok, "red pawn sideways before river should be illegal");

const room = createRoom({ redName: "A", timeControl: { baseSeconds: 600, incrementSeconds: 5 } });
const redToken = room.players.red.token;
let waitingResignBlocked = false;
try { applyPlayerAction(room, redToken, { type: "resign" }); } catch (error) { waitingResignBlocked = error.statusCode === 409; }
assert(waitingResignBlocked, "waiting room resign must be blocked");

const black = joinRoom(room, "B");
const blackToken = black.token;
assert(room.status === "active", "room should start after black joins");
applyPlayerAction(room, redToken, { type: "move", move: { fromRow: 6, fromCol: 0, toRow: 5, toCol: 0 } });
assert(room.currentTurn === "black", "turn should pass to black");
assert(room.moveHistory.length === 1, "move history should contain one ply");

let wrongTurnBlocked = false;
try { applyPlayerAction(room, redToken, { type: "move", move: { fromRow: 6, fromCol: 2, toRow: 5, toCol: 2 } }); } catch (error) { wrongTurnBlocked = error.statusCode === 409; }
assert(wrongTurnBlocked, "second red move must be blocked");

applyPlayerAction(room, blackToken, { type: "move", move: { fromRow: 3, fromCol: 0, toRow: 4, toCol: 0 } });
assert(room.currentTurn === "red", "turn should return to red");
applyPlayerAction(room, redToken, { type: "offerDraw" });
assert(room.drawOfferBy === "red", "draw offer should be recorded");
applyPlayerAction(room, blackToken, { type: "acceptDraw" });
assert(room.status === "finished" && room.result.reason === "draw-agreed", "draw agreement should finish game");

console.log(JSON.stringify({
  roomId: room.id,
  status: room.status,
  result: room.result,
  moves: room.moveHistory.length,
  redClockMs: snapshot(room, redToken).clocks.redMs,
  blackClockMs: snapshot(room, blackToken).clocks.blackMs,
}, null, 2));
