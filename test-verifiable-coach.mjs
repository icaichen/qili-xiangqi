globalThis.window = {};
await import("./coach-tools.js");
const tools = globalThis.window.XiangqiCoachTools;

const empty = () => Array.from({ length: 10 }, () => Array(9).fill(null));
const board = empty();
board[9][0] = { type: "rook", color: "red", label: "车" };
board[7][0] = { type: "pawn", color: "black", label: "卒" };
board[0][4] = { type: "general", color: "black", label: "将" };
board[9][4] = { type: "general", color: "red", label: "帅" };

const moves = {
  a0a1: { fromRow: 9, fromCol: 0, toRow: 8, toCol: 0 },
  a2a1: { fromRow: 7, fromCol: 0, toRow: 8, toCol: 0 },
};

const cloneBoard = (source) => source.map((row) => row.map((entry) => entry ? { ...entry } : null));
const applyMove = (source, move) => {
  const next = cloneBoard(source);
  const captured = next[move.toRow][move.toCol];
  next[move.toRow][move.toCol] = next[move.fromRow][move.fromCol];
  next[move.fromRow][move.fromCol] = null;
  return { board: next, captured };
};
const moveToUci = (move) => Object.entries(moves).find(([, candidate]) =>
  candidate.fromRow === move.fromRow && candidate.fromCol === move.fromCol && candidate.toRow === move.toRow && candidate.toCol === move.toCol
)?.[0];
const uciToMove = (uci, source) => {
  const move = moves[uci];
  if (!move) return null;
  return { ...move, piece: source[move.fromRow]?.[move.fromCol] };
};
const formatMove = (move) => moveToUci(move) === "a0a1" ? "车九进一" : "卒1进1";

const chosen = { ...moves.a0a1, piece: board[9][0] };
const beforeAnalysis = {
  lines: [{ move: "a0a1", parsedMove: chosen, numericScore: 20, depth: 8, pv: ["a0a1", "a2a1"] }],
};
const afterBoard = applyMove(board, chosen).board;
const reply = { ...moves.a2a1, piece: afterBoard[7][0] };
const afterAnalysis = {
  lines: [{ move: "a2a1", parsedMove: reply, numericScore: -20, depth: 8, pv: ["a2a1"] }],
};

const result = tools.buildCoachAnalysis({
  sourceBoard: board,
  move: chosen,
  beforeAnalysis,
  afterAnalysis,
  adapters: {
    cloneBoard,
    applyMove,
    isInCheck: () => false,
    isSquareAttacked: () => false,
    generateLegalMoves: () => [],
    formatMove,
    uciToMove,
    moveToUci,
    pieceValues: { general: 10000, rook: 900, cannon: 450, horse: 400, elephant: 220, advisor: 220, pawn: 100 },
    opposite: { red: "black", black: "red" },
  },
});

if (!result.selectedIsBest || !result.sameRoute) throw new Error("Best-move deduplication failed");
if (!result.routes.your.steps[1]?.facts.some((fact) => fact.type === "capture")) throw new Error("Board-derived capture event missing");
if (!result.signals?.chosen || !result.signals?.best) throw new Error("Position signals missing");
console.log(JSON.stringify({
  selectedIsBest: result.selectedIsBest,
  sameRoute: result.sameRoute,
  sequence: result.routes.your.sequence,
  events: result.routes.your.steps.map((step) => step.facts.map((fact) => fact.type)),
  signals: result.signals,
}, null, 2));
