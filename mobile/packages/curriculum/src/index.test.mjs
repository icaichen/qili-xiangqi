import assert from 'node:assert/strict';
import test from 'node:test';
import {
  KIDS_CHAPTERS,
  KIDS_PIECE_COLORS,
  KIDS_PLAYABLE_LESSONS,
} from './index.mjs';
import * as rootCurriculum from '../../../../xiangqi-teaching-curriculum.mjs';
import {
  applyMove,
  generateLegalMoves,
  isInCheck,
  validateMove,
} from '../../xiangqi-core/src/index.mjs';

function boardFor(lesson) {
  const board = Array.from({ length: 10 }, () => Array(9).fill(null));
  for (const [row, col, type, color] of lesson.pieces) {
    assert.equal(board[row][col], null, `${lesson.id} duplicates piece at ${row},${col}`);
    board[row][col] = { type, color };
  }
  return board;
}

test('mobile and web export the same 26 playable lesson objects', () => {
  assert.strictEqual(KIDS_PLAYABLE_LESSONS, rootCurriculum.KIDS_PLAYABLE_LESSONS);
  assert.equal(KIDS_CHAPTERS.length, 3);
  assert.equal(KIDS_PLAYABLE_LESSONS.length, 26);
  assert.equal(KIDS_CHAPTERS.reduce((sum, chapter) => sum + chapter.lessonCount, 0), 26);
  assert.deepEqual(KIDS_PIECE_COLORS, { RED: 'red', BLACK: 'black' });
});

test('playable lesson indexes, chapter slices and concept mapping stay aligned', () => {
  assert.equal(new Set(KIDS_PLAYABLE_LESSONS.map((lesson) => lesson.id)).size, 26);

  for (const chapter of KIDS_CHAPTERS) {
    const lessons = KIDS_PLAYABLE_LESSONS.slice(chapter.lessonStart, chapter.lessonStart + chapter.lessonCount);
    assert.equal(lessons.length, chapter.lessonCount);
    assert.deepEqual(lessons.map((lesson) => lesson.chapterId), Array(chapter.lessonCount).fill(chapter.id));
    assert.deepEqual(lessons.map((lesson) => lesson.chapterLessonIndex), chapter.conceptIds.map((_, index) => index));
    assert.deepEqual(lessons.map((lesson) => lesson.conceptId), chapter.conceptIds);
    assert.equal(lessons.at(-1).finale, true, `${chapter.id} must finish on its finale lesson`);
  }

  assert.deepEqual(KIDS_PLAYABLE_LESSONS.map((lesson) => lesson.lessonIndex), Array.from({ length: 26 }, (_, index) => index));
});

test('all playable lessons are framework-neutral structured data with valid board coordinates', () => {
  assert.doesNotThrow(() => structuredClone(KIDS_PLAYABLE_LESSONS));

  for (const lesson of KIDS_PLAYABLE_LESSONS) {
    for (const field of ['id', 'icon', 'title', 'subtitle', 'prompt', 'tip', 'success', 'conceptId']) {
      assert.equal(typeof lesson[field], 'string', `${lesson.id}.${field}`);
      assert.ok(lesson[field].length > 0, `${lesson.id}.${field} must not be empty`);
    }
    assert.ok(lesson.pieces.length > 0, `${lesson.id} must define a playable board`);
    for (const [row, col, type, color] of lesson.pieces) {
      assert.ok(Number.isInteger(row) && row >= 0 && row < 10, `${lesson.id} row ${row}`);
      assert.ok(Number.isInteger(col) && col >= 0 && col < 9, `${lesson.id} col ${col}`);
      assert.ok(['rook', 'horse', 'elephant', 'advisor', 'general', 'cannon', 'pawn'].includes(type), `${lesson.id} type ${type}`);
      assert.ok(['red', 'black'].includes(color), `${lesson.id} color ${color}`);
    }

    if (lesson.mode === 'piece-tour') assert.ok(lesson.piecesToMeet?.length > 0);
    if (lesson.mode === 'identify-sequence') assert.ok(lesson.sequence?.length > 0);
    if (lesson.mode === 'zone') assert.deepEqual(lesson.zone, { minRow: 7, maxRow: 9, minCol: 3, maxCol: 5 });
    if (lesson.mode === 'identify') assert.equal(lesson.identify?.length, 2);
    if (lesson.mode === 'move') assert.equal(lesson.expected?.length, 4);
    if (lesson.mode === 'mini-game') assert.ok(lesson.expectedMoves?.length > 1);
  }
});

test('every authored move target remains legal under the shared Xiangqi rules', () => {
  for (const lesson of KIDS_PLAYABLE_LESSONS.filter((entry) => entry.expected || entry.expectedMoves)) {
    const expected = lesson.mode === 'mini-game' ? lesson.expectedMoves[0] : lesson.expected;
    const board = boardFor(lesson);
    const [fromRow, fromCol, toRow, toCol] = expected;
    const moving = board[fromRow][fromCol];
    assert.ok(moving, `${lesson.id} must have a piece on its expected source`);
    const result = validateMove(board, moving.color, { fromRow, fromCol, toRow, toCol });
    assert.equal(result.ok, true, `${lesson.id} target must be legal: ${result.reason ?? ''}`);

    if (lesson.verifyCheck || lesson.verifyMate) {
      const next = applyMove(board, result.move).board;
      assert.equal(isInCheck(next, 'black'), true, `${lesson.id} must check black`);
      if (lesson.verifyMate) assert.equal(generateLegalMoves(next, 'black').length, 0, `${lesson.id} must mate black`);
    }
  }
});

test('scripted exchange replies stay legal and preserve the authored sequence', () => {
  for (const lesson of KIDS_PLAYABLE_LESSONS.filter((entry) => entry.autoReply)) {
    let board = boardFor(lesson);
    const first = lesson.expected;
    const firstResult = validateMove(board, board[first[0]][first[1]].color, {
      fromRow: first[0], fromCol: first[1], toRow: first[2], toCol: first[3],
    });
    assert.equal(firstResult.ok, true, `${lesson.id} first move`);
    board = applyMove(board, firstResult.move).board;

    const reply = lesson.autoReply;
    const replyResult = validateMove(board, board[reply[0]][reply[1]].color, {
      fromRow: reply[0], fromCol: reply[1], toRow: reply[2], toCol: reply[3],
    });
    assert.equal(replyResult.ok, true, `${lesson.id} auto reply`);
  }
});

test('the mini-game has one legal forced reply and its second authored move checkmates', () => {
  const lesson = KIDS_PLAYABLE_LESSONS.find((entry) => entry.mode === 'mini-game');
  assert.ok(lesson);
  let board = boardFor(lesson);
  const [first, finish] = lesson.expectedMoves;
  const firstResult = validateMove(board, 'red', {
    fromRow: first[0], fromCol: first[1], toRow: first[2], toCol: first[3],
  });
  assert.equal(firstResult.ok, true);
  board = applyMove(board, firstResult.move).board;
  assert.equal(isInCheck(board, 'black'), true);

  const replies = generateLegalMoves(board, 'black').filter((reply) => {
    const afterReply = applyMove(board, reply).board;
    const finishResult = validateMove(afterReply, 'red', {
      fromRow: finish[0], fromCol: finish[1], toRow: finish[2], toCol: finish[3],
    });
    if (!finishResult.ok) return false;
    const finalBoard = applyMove(afterReply, finishResult.move).board;
    return isInCheck(finalBoard, 'black') && generateLegalMoves(finalBoard, 'black').length === 0;
  });

  assert.equal(replies.length, 1);
});
