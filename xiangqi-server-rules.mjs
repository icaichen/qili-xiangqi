const ROWS = 10;
const COLS = 9;
const RED = "red";
const BLACK = "black";
const OPPOSITE = { red: BLACK, black: RED };

const LABELS = {
  red: { rook: "车", horse: "马", elephant: "相", advisor: "仕", general: "帅", cannon: "炮", pawn: "兵" },
  black: { rook: "车", horse: "马", elephant: "象", advisor: "士", general: "将", cannon: "炮", pawn: "卒" },
};

function piece(type, color) {
  return { type, color, label: LABELS[color][type] };
}

function createInitialBoard() {
  const board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  const backRank = ["rook", "horse", "elephant", "advisor", "general", "advisor", "elephant", "horse", "rook"];
  backRank.forEach((type, col) => {
    board[0][col] = piece(type, BLACK);
    board[9][col] = piece(type, RED);
  });
  board[2][1] = piece("cannon", BLACK);
  board[2][7] = piece("cannon", BLACK);
  board[7][1] = piece("cannon", RED);
  board[7][7] = piece("cannon", RED);
  for (const col of [0, 2, 4, 6, 8]) {
    board[3][col] = piece("pawn", BLACK);
    board[6][col] = piece("pawn", RED);
  }
  return board;
}

function cloneBoard(board) {
  return board.map((row) => row.map((entry) => entry ? { ...entry } : null));
}

function inside(row, col) {
  return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function insidePalace(row, col, color) {
  const rowOk = color === RED ? row >= 7 && row <= 9 : row >= 0 && row <= 2;
  return rowOk && col >= 3 && col <= 5;
}

function crossedRiver(row, color) {
  return color === RED ? row <= 4 : row >= 5;
}

function pushIfAvailable(moves, board, row, col, color) {
  if (!inside(row, col)) return;
  const target = board[row][col];
  if (!target || target.color !== color) moves.push({ toRow: row, toCol: col });
}

function generatePseudoMoves(board, row, col) {
  const current = board[row]?.[col];
  if (!current) return [];
  const moves = [];
  const { color, type } = current;

  if (type === "rook" || type === "cannon") {
    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      let r = row + dr;
      let c = col + dc;
      let screen = false;
      while (inside(r, c)) {
        const target = board[r][c];
        if (type === "rook") {
          if (!target) moves.push({ toRow: r, toCol: c });
          else {
            if (target.color !== color) moves.push({ toRow: r, toCol: c });
            break;
          }
        } else if (!screen) {
          if (!target) moves.push({ toRow: r, toCol: c });
          else screen = true;
        } else if (target) {
          if (target.color !== color) moves.push({ toRow: r, toCol: c });
          break;
        }
        r += dr;
        c += dc;
      }
    }
  }

  if (type === "horse") {
    const patterns = [
      [-2,-1,-1,0],[-2,1,-1,0],[2,-1,1,0],[2,1,1,0],
      [-1,-2,0,-1],[1,-2,0,-1],[-1,2,0,1],[1,2,0,1],
    ];
    for (const [dr, dc, lr, lc] of patterns) {
      if (!inside(row + lr, col + lc) || board[row + lr][col + lc]) continue;
      pushIfAvailable(moves, board, row + dr, col + dc, color);
    }
  }

  if (type === "elephant") {
    for (const [dr, dc] of [[-2,-2],[-2,2],[2,-2],[2,2]]) {
      const toRow = row + dr;
      const toCol = col + dc;
      const eyeRow = row + dr / 2;
      const eyeCol = col + dc / 2;
      const staysHome = color === RED ? toRow >= 5 : toRow <= 4;
      if (inside(toRow, toCol) && staysHome && !board[eyeRow][eyeCol]) {
        pushIfAvailable(moves, board, toRow, toCol, color);
      }
    }
  }

  if (type === "advisor") {
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      const toRow = row + dr;
      const toCol = col + dc;
      if (insidePalace(toRow, toCol, color)) pushIfAvailable(moves, board, toRow, toCol, color);
    }
  }

  if (type === "general") {
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const toRow = row + dr;
      const toCol = col + dc;
      if (insidePalace(toRow, toCol, color)) pushIfAvailable(moves, board, toRow, toCol, color);
    }
    const direction = color === RED ? -1 : 1;
    for (let r = row + direction; inside(r, col); r += direction) {
      const target = board[r][col];
      if (!target) continue;
      if (target.type === "general" && target.color !== color) moves.push({ toRow: r, toCol: col });
      break;
    }
  }

  if (type === "pawn") {
    const forward = color === RED ? -1 : 1;
    pushIfAvailable(moves, board, row + forward, col, color);
    if (crossedRiver(row, color)) {
      pushIfAvailable(moves, board, row, col - 1, color);
      pushIfAvailable(moves, board, row, col + 1, color);
    }
  }

  return moves.map((move) => ({ ...move, fromRow: row, fromCol: col }));
}

function findGeneral(board, color) {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const entry = board[row][col];
      if (entry?.type === "general" && entry.color === color) return { row, col };
    }
  }
  return null;
}

function isSquareAttacked(board, row, col, byColor) {
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const entry = board[r][c];
      if (!entry || entry.color !== byColor) continue;
      if (generatePseudoMoves(board, r, c).some((move) => move.toRow === row && move.toCol === col)) return true;
    }
  }
  return false;
}

function isInCheck(board, color) {
  const general = findGeneral(board, color);
  if (!general) return true;
  return isSquareAttacked(board, general.row, general.col, OPPOSITE[color]);
}

function applyMove(board, move) {
  const next = cloneBoard(board);
  const moving = next[move.fromRow]?.[move.fromCol];
  const captured = next[move.toRow]?.[move.toCol] || null;
  if (!moving) throw new Error("No piece on source square");
  next[move.toRow][move.toCol] = moving;
  next[move.fromRow][move.fromCol] = null;
  return { board: next, captured };
}

function legalMovesForPiece(board, row, col) {
  const entry = board[row]?.[col];
  if (!entry) return [];
  return generatePseudoMoves(board, row, col).filter((move) => !isInCheck(applyMove(board, move).board, entry.color));
}

function generateLegalMoves(board, color) {
  const moves = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (board[row][col]?.color === color) moves.push(...legalMovesForPiece(board, row, col));
    }
  }
  return moves;
}

function validateMove(board, color, candidate) {
  if (!candidate || !inside(candidate.fromRow, candidate.fromCol) || !inside(candidate.toRow, candidate.toCol)) {
    return { ok: false, reason: "invalid-coordinates" };
  }
  const moving = board[candidate.fromRow][candidate.fromCol];
  if (!moving || moving.color !== color) return { ok: false, reason: "not-your-piece" };
  const legal = legalMovesForPiece(board, candidate.fromRow, candidate.fromCol).find((move) =>
    move.toRow === candidate.toRow && move.toCol === candidate.toCol
  );
  if (!legal) return { ok: false, reason: "illegal-move" };
  return { ok: true, move: legal };
}

function gameStatus(board, sideToMove) {
  const redGeneral = findGeneral(board, RED);
  const blackGeneral = findGeneral(board, BLACK);
  if (!redGeneral) return { over: true, winner: BLACK, reason: "general-captured" };
  if (!blackGeneral) return { over: true, winner: RED, reason: "general-captured" };
  const legal = generateLegalMoves(board, sideToMove);
  if (legal.length) return { over: false, inCheck: isInCheck(board, sideToMove) };
  return { over: true, winner: OPPOSITE[sideToMove], reason: isInCheck(board, sideToMove) ? "checkmate" : "no-legal-moves" };
}

export {
  ROWS,
  COLS,
  RED,
  BLACK,
  OPPOSITE,
  LABELS,
  createInitialBoard,
  cloneBoard,
  applyMove,
  legalMovesForPiece,
  generateLegalMoves,
  validateMove,
  gameStatus,
  isInCheck,
};
