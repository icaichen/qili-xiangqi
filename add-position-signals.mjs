import { readFile, writeFile } from "node:fs/promises";

const path = "coach-tools.js";
let source = await readFile(path, "utf8");

function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Missing target: ${label}`);
  source = source.replace(search, replacement);
}

replaceOnce(
  '  analyzeRoute,\n} from "./tactical-analyzer.js";',
  '  analyzeRoute,\n  statusAt,\n} from "./tactical-analyzer.js";',
  "statusAt import",
);

replaceOnce(
  'function buildCoachAnalysis({ sourceBoard, move, beforeAnalysis, afterAnalysis, adapters }) {',
  `function positionSignals(board, color, focusSquare, adapters) {\n  const opponent = adapters.opposite[color];\n  const legalMoves = adapters.generateLegalMoves(board, color);\n  const opponentLegalMoves = adapters.generateLegalMoves(board, opponent);\n  let attackedPieces = 0;\n  let loosePieces = 0;\n  const loosePieceLabels = [];\n  let developedActivePieces = 0;\n  const homeRow = color === \"red\" ? 9 : 0;\n\n  for (let row = 0; row < board.length; row += 1) {\n    for (let col = 0; col < board[row].length; col += 1) {\n      const piece = board[row][col];\n      if (!piece || piece.color !== color || piece.type === \"general\") continue;\n      const status = statusAt(board, row, col, adapters);\n      if (status?.attackers.length) attackedPieces += 1;\n      if (status?.attackers.length && !status.defenders.length) {\n        loosePieces += 1;\n        loosePieceLabels.push(piece.label);\n      }\n      if ([\"rook\", \"horse\", \"cannon\"].includes(piece.type) && row !== homeRow) developedActivePieces += 1;\n    }\n  }\n\n  const capturesAvailable = legalMoves.filter((candidate) => {\n    const target = board[candidate.toRow]?.[candidate.toCol];\n    return target && target.color === opponent;\n  }).length;\n  const movedPieceOptions = focusSquare\n    ? legalMoves.filter((candidate) => candidate.fromRow === focusSquare.row && candidate.fromCol === focusSquare.col).length\n    : null;\n\n  return {\n    legalMoves: legalMoves.length,\n    opponentLegalMoves: opponentLegalMoves.length,\n    capturesAvailable,\n    attackedPieces,\n    loosePieces,\n    loosePieceLabels: loosePieceLabels.slice(0, 5),\n    movedPieceOptions,\n    developedActivePieces,\n    inCheck: adapters.isInCheck(board, color),\n  };\n}\n\nfunction buildCoachAnalysis({ sourceBoard, move, beforeAnalysis, afterAnalysis, adapters }) {`,
  "position signals helper",
);

replaceOnce(
  '  const chosenTactics = analyzeMove(sourceBoard, move, adapters);\n  const bestTactics = analyzeMove(sourceBoard, bestMove, adapters);\n  const deterministicDifferences = selectedIsBest ? [] : compareMoveAnalyses(chosenTactics, bestTactics);',
  '  const chosenTactics = analyzeMove(sourceBoard, move, adapters);\n  const bestTactics = analyzeMove(sourceBoard, bestMove, adapters);\n  const chosenSignals = positionSignals(chosenTactics.afterBoard, mover?.color, { row: move.toRow, col: move.toCol }, adapters);\n  const bestSignals = positionSignals(bestTactics.afterBoard, mover?.color, { row: bestMove.toRow, col: bestMove.toCol }, adapters);\n  const deterministicDifferences = selectedIsBest ? [] : compareMoveAnalyses(chosenTactics, bestTactics);',
  "signals calculation",
);

replaceOnce(
  '    moveNotation: adapters.formatMove(move, sourceBoard),\n    bestMove: adapters.formatMove(bestMove, sourceBoard),',
  '    moveNotation: adapters.formatMove(move, sourceBoard),\n    moveRaw: { fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol },\n    bestMove: adapters.formatMove(bestMove, sourceBoard),\n    bestMoveRaw: { fromRow: bestMove.fromRow, fromCol: bestMove.fromCol, toRow: bestMove.toRow, toCol: bestMove.toCol },',
  "raw moves",
);

replaceOnce(
  '    routeComparisons,\n    sourceBoard: adapters.cloneBoard(sourceBoard),',
  '    routeComparisons,\n    signals: { chosen: chosenSignals, best: bestSignals },\n    sourceBoard: adapters.cloneBoard(sourceBoard),',
  "signals return",
);

await writeFile(path, source, "utf8");
console.log("Position signals added to coach analysis.");
