import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialBoard, generateLegalMoves, legalMovesForPiece } from './index.mjs';

test('mobile adapter uses the existing legal move engine', () => {
  const board = createInitialBoard();
  assert.equal(board.length, 10);
  assert.equal(board[0].length, 9);
  assert.equal(legalMovesForPiece(board, 9, 0).length, 2);
  assert.ok(generateLegalMoves(board, 'red').length > 0);
});
