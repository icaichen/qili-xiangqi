import { analyzeMove } from "./tactical-analyzer.js";

const values = { general: 10000, rook: 900, cannon: 450, horse: 420, elephant: 220, advisor: 220, pawn: 100 };
const opposite = { red: "black", black: "red" };
const labels = {
  red: { general: "帅", rook: "车", cannon: "炮", horse: "马", elephant: "相", advisor: "仕", pawn: "兵" },
  black: { general: "将", rook: "车", cannon: "炮", horse: "马", elephant: "象", advisor: "士", pawn: "卒" },
};
const piece = (type, color) => ({ type, color, label: labels[color][type] });
const empty = () => Array.from({ length: 10 }, () => Array(9).fill(null));
const cloneBoard = (board) => board.map((row) => row.map((entry) => entry ? { ...entry } : null));
const applyMove = (board, move) => {
  const next = cloneBoard(board);
  const captured = next[move.toRow][move.toCol];
  next[move.toRow][move.toCol] = next[move.fromRow][move.fromCol];
  next[move.fromRow][move.fromCol] = null;
  return { board: next, captured };
};
const adapters = {
  cloneBoard,
  applyMove,
  pieceValues: values,
  opposite,
  isInCheck: () => false,
};

function baseBoard() {
  const board = empty();
  board[0][4] = piece("general", "black");
  board[9][4] = piece("general", "red");
  return board;
}

const results = {};

{
  const board = baseBoard();
  board[5][4] = piece("rook", "red");
  board[5][0] = piece("rook", "red");
  board[1][4] = piece("rook", "black");
  const analysis = analyzeMove(board, { fromRow: 5, fromCol: 0, toRow: 4, toCol: 0 }, adapters);
  results.lostProtection = analysis.facts.map((fact) => fact.type);
}

{
  const board = baseBoard();
  board[7][4] = piece("horse", "red");
  board[4][3] = piece("rook", "black");
  board[5][4] = piece("cannon", "black");
  const analysis = analyzeMove(board, { fromRow: 7, fromCol: 4, toRow: 6, toCol: 2 }, adapters);
  results.fork = analysis.facts.map((fact) => fact.type);
}

{
  const board = baseBoard();
  board[4][0] = piece("rook", "red");
  board[4][2] = piece("pawn", "red");
  board[4][5] = piece("horse", "black");
  const analysis = analyzeMove(board, { fromRow: 4, fromCol: 2, toRow: 3, toCol: 2 }, adapters);
  results.openRookLine = analysis.facts.map((fact) => fact.type);
}

{
  const board = baseBoard();
  board[5][4] = piece("rook", "red");
  board[4][4] = piece("pawn", "red");
  board[3][4] = piece("cannon", "black");
  board[0][4] = piece("general", "black");
  const analysis = analyzeMove(board, { fromRow: 4, fromCol: 4, toRow: 4, toCol: 3 }, adapters);
  results.pin = analysis.facts.map((fact) => fact.type);
}

const expected = {
  lostProtection: "lost-protection",
  fork: "fork",
  openRookLine: "open-rook-line",
  pin: "pin",
};

for (const [name, type] of Object.entries(expected)) {
  if (!results[name].includes(type)) {
    console.error(JSON.stringify(results, null, 2));
    throw new Error(`${name} did not detect ${type}`);
  }
}

console.log(JSON.stringify(results, null, 2));
