const ROWS = 10;
const COLS = 9;
const ORTHOGONAL_DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function inside(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function squareKey(row, col) {
  return `${row}:${col}`;
}

function sameSquare(a, b) {
  return Boolean(a && b && a.row === b.row && a.col === b.col);
}

function between(value, endA, endB) {
  return value > Math.min(endA, endB) && value < Math.max(endA, endB);
}

function isBetweenSquare(row, col, fromRow, fromCol, toRow, toCol) {
  if (fromRow === toRow && row === fromRow) return between(col, fromCol, toCol);
  if (fromCol === toCol && col === fromCol) return between(row, fromRow, toRow);
  return false;
}

function piecesBetween(board, fromRow, fromCol, toRow, toCol) {
  if (fromRow !== toRow && fromCol !== toCol) return [];
  const dr = Math.sign(toRow - fromRow);
  const dc = Math.sign(toCol - fromCol);
  const pieces = [];
  let row = fromRow + dr;
  let col = fromCol + dc;
  while (row !== toRow || col !== toCol) {
    if (board[row][col]) pieces.push({ row, col, piece: board[row][col] });
    row += dr;
    col += dc;
  }
  return pieces;
}

function horseLeg(fromRow, fromCol, toRow, toCol) {
  const dr = toRow - fromRow;
  const dc = toCol - fromCol;
  if (Math.abs(dr) === 2 && Math.abs(dc) === 1) {
    return { row: fromRow + Math.sign(dr), col: fromCol };
  }
  if (Math.abs(dr) === 1 && Math.abs(dc) === 2) {
    return { row: fromRow, col: fromCol + Math.sign(dc) };
  }
  return null;
}

function elephantEye(fromRow, fromCol, toRow, toCol) {
  const dr = toRow - fromRow;
  const dc = toCol - fromCol;
  if (Math.abs(dr) !== 2 || Math.abs(dc) !== 2) return null;
  return { row: fromRow + dr / 2, col: fromCol + dc / 2 };
}

function attacksSquare(board, fromRow, fromCol, toRow, toCol) {
  const attacker = board[fromRow]?.[fromCol];
  if (!attacker || (fromRow === toRow && fromCol === toCol) || !inside(toRow, toCol)) return false;
  const dr = toRow - fromRow;
  const dc = toCol - fromCol;

  if (attacker.type === "rook") {
    return (dr === 0 || dc === 0) && piecesBetween(board, fromRow, fromCol, toRow, toCol).length === 0;
  }

  if (attacker.type === "cannon") {
    if (dr !== 0 && dc !== 0) return false;
    if (!board[toRow][toCol]) return false;
    return piecesBetween(board, fromRow, fromCol, toRow, toCol).length === 1;
  }

  if (attacker.type === "horse") {
    const leg = horseLeg(fromRow, fromCol, toRow, toCol);
    return Boolean(leg && !board[leg.row][leg.col]);
  }

  if (attacker.type === "elephant") {
    const eye = elephantEye(fromRow, fromCol, toRow, toCol);
    if (!eye || board[eye.row][eye.col]) return false;
    return attacker.color === "red" ? toRow >= 5 : toRow <= 4;
  }

  if (attacker.type === "advisor") {
    const inPalace = attacker.color === "red"
      ? toRow >= 7 && toRow <= 9 && toCol >= 3 && toCol <= 5
      : toRow >= 0 && toRow <= 2 && toCol >= 3 && toCol <= 5;
    return inPalace && Math.abs(dr) === 1 && Math.abs(dc) === 1;
  }

  if (attacker.type === "general") {
    if (Math.abs(dr) + Math.abs(dc) === 1) {
      const inPalace = attacker.color === "red"
        ? toRow >= 7 && toRow <= 9 && toCol >= 3 && toCol <= 5
        : toRow >= 0 && toRow <= 2 && toCol >= 3 && toCol <= 5;
      return inPalace;
    }
    const target = board[toRow][toCol];
    return dc === 0 && target?.type === "general" && target.color !== attacker.color
      && piecesBetween(board, fromRow, fromCol, toRow, toCol).length === 0;
  }

  if (attacker.type === "pawn") {
    const forward = attacker.color === "red" ? -1 : 1;
    if (dr === forward && dc === 0) return true;
    const crossedRiver = attacker.color === "red" ? fromRow <= 4 : fromRow >= 5;
    return crossedRiver && dr === 0 && Math.abs(dc) === 1;
  }

  return false;
}

function attackersOf(board, row, col, color) {
  const attackers = [];
  for (let fromRow = 0; fromRow < ROWS; fromRow += 1) {
    for (let fromCol = 0; fromCol < COLS; fromCol += 1) {
      const piece = board[fromRow][fromCol];
      if (!piece || piece.color !== color) continue;
      if (attacksSquare(board, fromRow, fromCol, row, col)) {
        attackers.push({ row: fromRow, col: fromCol, piece });
      }
    }
  }
  return attackers;
}

function statusAt(board, row, col, adapters) {
  const piece = board[row]?.[col];
  if (!piece) return null;
  const opponent = adapters.opposite[piece.color];
  return {
    piece,
    row,
    col,
    attackers: attackersOf(board, row, col, opponent),
    defenders: attackersOf(board, row, col, piece.color),
    value: adapters.pieceValues[piece.type] ?? 0,
  };
}

function enemyTargetsAttackedBy(board, row, col, adapters) {
  const attacker = board[row]?.[col];
  if (!attacker) return [];
  const targets = [];
  for (let targetRow = 0; targetRow < ROWS; targetRow += 1) {
    for (let targetCol = 0; targetCol < COLS; targetCol += 1) {
      const target = board[targetRow][targetCol];
      if (!target || target.color === attacker.color) continue;
      if (attacksSquare(board, row, col, targetRow, targetCol)) {
        targets.push({
          row: targetRow,
          col: targetCol,
          piece: target,
          value: adapters.pieceValues[target.type] ?? 0,
        });
      }
    }
  }
  return targets.sort((a, b) => b.value - a.value);
}

function lineOccupants(board, row, col, dr, dc) {
  const occupants = [];
  let currentRow = row + dr;
  let currentCol = col + dc;
  while (inside(currentRow, currentCol)) {
    if (board[currentRow][currentCol]) {
      occupants.push({ row: currentRow, col: currentCol, piece: board[currentRow][currentCol] });
    }
    currentRow += dr;
    currentCol += dc;
  }
  return occupants;
}

function linePatterns(board, color, adapters) {
  const patterns = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const attacker = board[row][col];
      if (!attacker || attacker.color !== color || attacker.type !== "rook") continue;
      for (const [dr, dc] of ORTHOGONAL_DIRECTIONS) {
        const occupants = lineOccupants(board, row, col, dr, dc);
        const first = occupants[0];
        const second = occupants[1];
        if (!first || !second || first.piece.color === color || second.piece.color === color) continue;
        const firstValue = adapters.pieceValues[first.piece.type] ?? 0;
        const secondValue = adapters.pieceValues[second.piece.type] ?? 0;
        if (second.piece.type === "general" || secondValue > firstValue) {
          patterns.push({
            type: "pin",
            attacker: { row, col, piece: attacker },
            front: first,
            back: second,
            signature: `pin:${row}:${col}:${first.row}:${first.col}:${second.row}:${second.col}`,
          });
        } else if (first.piece.type === "general" || firstValue > secondValue) {
          patterns.push({
            type: "skewer",
            attacker: { row, col, piece: attacker },
            front: first,
            back: second,
            signature: `skewer:${row}:${col}:${first.row}:${first.col}:${second.row}:${second.col}`,
          });
        }
      }
    }
  }
  return patterns;
}

function relationMap(board, attackerColor, adapters) {
  const relations = new Map();
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const attacker = board[row][col];
      if (!attacker || attacker.color !== attackerColor) continue;
      const targets = enemyTargetsAttackedBy(board, row, col, adapters);
      for (const target of targets) {
        const key = `${row}:${col}>${target.row}:${target.col}`;
        relations.set(key, { attacker: { row, col, piece: attacker }, target });
      }
    }
  }
  return relations;
}

function fact(type, title, detail, severity, squares = []) {
  return { type, title, detail, severity, confidence: "确定", squares };
}

function dedupeFacts(facts) {
  const seen = new Set();
  return facts.filter((entry) => {
    const key = `${entry.type}:${entry.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function analyzeMove(sourceBoard, move, adapters) {
  const moving = sourceBoard[move.fromRow]?.[move.fromCol];
  if (!moving) {
    return { facts: [], afterBoard: adapters.cloneBoard(sourceBoard), moving: null, captured: null };
  }

  const opponent = adapters.opposite[moving.color];
  const captured = sourceBoard[move.toRow]?.[move.toCol] ?? null;
  const afterBoard = adapters.applyMove(sourceBoard, move).board;
  const facts = [];

  if (captured) {
    facts.push(fact(
      "capture",
      "吃子",
      `${moving.label}吃掉${captured.label}，取得约${adapters.pieceValues[captured.type] ?? 0}点子力。`,
      "positive",
      [{ row: move.fromRow, col: move.fromCol }, { row: move.toRow, col: move.toCol }],
    ));
  }

  if (adapters.isInCheck(afterBoard, opponent)) {
    facts.push(fact(
      "check",
      "将军",
      `${moving.label}走到目标格后形成将军，对手必须立即应将。`,
      "positive",
      [{ row: move.toRow, col: move.toCol }],
    ));
  }

  const movedStatus = statusAt(afterBoard, move.toRow, move.toCol, adapters);
  if (movedStatus && movedStatus.attackers.length > 0 && movedStatus.defenders.length === 0 && moving.type !== "general") {
    facts.push(fact(
      "hanging-mover",
      "落点无保护",
      `${moving.label}落点受到${movedStatus.attackers.length}个敌方棋子攻击，但没有己方棋子保护。`,
      "warning",
      [{ row: move.toRow, col: move.toCol }, ...movedStatus.attackers.map((entry) => ({ row: entry.row, col: entry.col }))],
    ));
  }

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const afterPiece = afterBoard[row][col];
      const beforePiece = sourceBoard[row][col];
      if (!afterPiece || afterPiece.color !== moving.color || afterPiece.type === "general") continue;
      if (row === move.toRow && col === move.toCol) continue;
      if (!beforePiece || beforePiece.color !== afterPiece.color || beforePiece.type !== afterPiece.type) continue;
      const beforeStatus = statusAt(sourceBoard, row, col, adapters);
      const afterStatus = statusAt(afterBoard, row, col, adapters);
      const becameLoose = afterStatus.attackers.length > 0 && afterStatus.defenders.length === 0
        && (beforeStatus.attackers.length === 0 || beforeStatus.defenders.length > 0);
      if (!becameLoose) continue;
      const moverWasDefender = attacksSquare(sourceBoard, move.fromRow, move.fromCol, row, col);
      const cause = moverWasDefender ? "这步移走了它的保护者" : "这步打开了对方的攻击线路";
      facts.push(fact(
        "lost-protection",
        "失去保护",
        `${afterPiece.label}由${beforeStatus.defenders.length}个保护变为0，并受到${afterStatus.attackers.length}次攻击；${cause}。`,
        "warning",
        [{ row, col }, { row: move.fromRow, col: move.fromCol }, ...afterStatus.attackers.map((entry) => ({ row: entry.row, col: entry.col }))],
      ));
    }
  }

  const beforeTargets = enemyTargetsAttackedBy(sourceBoard, move.fromRow, move.fromCol, adapters);
  const afterTargets = enemyTargetsAttackedBy(afterBoard, move.toRow, move.toCol, adapters);
  const beforeTargetSquares = new Set(beforeTargets.map((entry) => squareKey(entry.row, entry.col)));
  const meaningfulAfterTargets = afterTargets.filter((entry) => entry.piece.type === "general" || entry.value >= 200);
  const newMeaningfulTargets = meaningfulAfterTargets.filter((entry) => !beforeTargetSquares.has(squareKey(entry.row, entry.col)));
  if (meaningfulAfterTargets.length >= 2 && newMeaningfulTargets.length > 0) {
    facts.push(fact(
      "fork",
      "捉双",
      `${moving.label}同时攻击${meaningfulAfterTargets.slice(0, 3).map((entry) => entry.piece.label).join("、")}。`,
      "positive",
      [{ row: move.toRow, col: move.toCol }, ...meaningfulAfterTargets.map((entry) => ({ row: entry.row, col: entry.col }))],
    ));
  }

  const beforePatterns = new Set(linePatterns(sourceBoard, moving.color, adapters).map((entry) => entry.signature));
  for (const pattern of linePatterns(afterBoard, moving.color, adapters)) {
    if (beforePatterns.has(pattern.signature)) continue;
    if (pattern.type === "pin") {
      facts.push(fact(
        "pin",
        "牵制",
        `${pattern.attacker.piece.label}沿直线牵制${pattern.front.piece.label}；它后方是${pattern.back.piece.label}。`,
        "positive",
        [pattern.attacker, pattern.front, pattern.back].map((entry) => ({ row: entry.row, col: entry.col })),
      ));
    } else {
      facts.push(fact(
        "skewer",
        "串打",
        `${pattern.attacker.piece.label}先攻击前方的${pattern.front.piece.label}，其后方还有${pattern.back.piece.label}。`,
        "positive",
        [pattern.attacker, pattern.front, pattern.back].map((entry) => ({ row: entry.row, col: entry.col })),
      ));
    }
  }

  const beforeRelations = relationMap(sourceBoard, moving.color, adapters);
  const afterRelations = relationMap(afterBoard, moving.color, adapters);
  for (const [key, relation] of afterRelations) {
    if (beforeRelations.has(key)) continue;
    if (relation.attacker.row === move.toRow && relation.attacker.col === move.toCol) continue;
    if (relation.target.value < 200 && relation.target.piece.type !== "general") continue;
    const attacker = relation.attacker;
    if (attacker.piece.type === "horse") {
      const leg = horseLeg(attacker.row, attacker.col, relation.target.row, relation.target.col);
      if (leg && leg.row === move.fromRow && leg.col === move.fromCol) {
        facts.push(fact(
          "horse-leg-opened",
          "腾开马腿",
          `${moving.label}离开马腿后，${attacker.piece.label}开始攻击${relation.target.piece.label}。`,
          "positive",
          [{ row: move.fromRow, col: move.fromCol }, { row: attacker.row, col: attacker.col }, { row: relation.target.row, col: relation.target.col }],
        ));
      }
    } else if (attacker.piece.type === "elephant") {
      const eye = elephantEye(attacker.row, attacker.col, relation.target.row, relation.target.col);
      if (eye && eye.row === move.fromRow && eye.col === move.fromCol) {
        facts.push(fact(
          "elephant-eye-opened",
          "腾开象眼",
          `${moving.label}离开象眼后，${attacker.piece.label}开始攻击${relation.target.piece.label}。`,
          "positive",
          [{ row: move.fromRow, col: move.fromCol }, { row: attacker.row, col: attacker.col }, { row: relation.target.row, col: relation.target.col }],
        ));
      }
    } else if (["rook", "cannon"].includes(attacker.piece.type)
      && isBetweenSquare(move.fromRow, move.fromCol, attacker.row, attacker.col, relation.target.row, relation.target.col)) {
      facts.push(fact(
        attacker.piece.type === "rook" ? "open-rook-line" : "cannon-screen-change",
        attacker.piece.type === "rook" ? "腾开车路" : "改变炮架",
        `${moving.label}离开线路后，${attacker.piece.label}开始攻击${relation.target.piece.label}。`,
        "positive",
        [{ row: move.fromRow, col: move.fromCol }, { row: attacker.row, col: attacker.col }, { row: relation.target.row, col: relation.target.col }],
      ));
    }
  }

  const beforeOpponentRelations = relationMap(sourceBoard, opponent, adapters);
  const afterOpponentRelations = relationMap(afterBoard, opponent, adapters);
  for (const [key, relation] of beforeOpponentRelations) {
    if (afterOpponentRelations.has(key)) continue;
    if (relation.attacker.piece.type === "horse") {
      const leg = horseLeg(relation.attacker.row, relation.attacker.col, relation.target.row, relation.target.col);
      if (leg && leg.row === move.toRow && leg.col === move.toCol && relation.target.piece.color === moving.color) {
        facts.push(fact(
          "horse-leg-blocked",
          "卡住马腿",
          `${moving.label}占住马腿，解除${relation.attacker.piece.label}对${relation.target.piece.label}的攻击。`,
          "positive",
          [{ row: move.toRow, col: move.toCol }, { row: relation.attacker.row, col: relation.attacker.col }, { row: relation.target.row, col: relation.target.col }],
        ));
      }
    }
    if (relation.attacker.piece.type === "elephant") {
      const eye = elephantEye(relation.attacker.row, relation.attacker.col, relation.target.row, relation.target.col);
      if (eye && eye.row === move.toRow && eye.col === move.toCol && relation.target.piece.color === moving.color) {
        facts.push(fact(
          "elephant-eye-blocked",
          "塞住象眼",
          `${moving.label}占住象眼，解除${relation.attacker.piece.label}对${relation.target.piece.label}的攻击。`,
          "positive",
          [{ row: move.toRow, col: move.toCol }, { row: relation.attacker.row, col: relation.attacker.col }, { row: relation.target.row, col: relation.target.col }],
        ));
      }
    }
  }

  return {
    moving,
    captured,
    afterBoard,
    facts: dedupeFacts(facts),
    movedStatus,
  };
}

function compareMoveAnalyses(chosen, best) {
  if (!chosen || !best) return [];
  const differences = [];
  const chosenWarningTypes = new Set(chosen.facts.filter((entry) => entry.severity === "warning").map((entry) => entry.type));
  const bestWarningTypes = new Set(best.facts.filter((entry) => entry.severity === "warning").map((entry) => entry.type));
  const chosenPositiveTypes = new Set(chosen.facts.filter((entry) => entry.severity === "positive").map((entry) => entry.type));
  const bestPositiveTypes = new Set(best.facts.filter((entry) => entry.severity === "positive").map((entry) => entry.type));

  for (const type of chosenWarningTypes) {
    if (!bestWarningTypes.has(type)) {
      const matching = chosen.facts.find((entry) => entry.type === type);
      differences.push(`你的走法出现“${matching.title}”，首选着没有。`);
    }
  }
  for (const type of bestPositiveTypes) {
    if (!chosenPositiveTypes.has(type)) {
      const matching = best.facts.find((entry) => entry.type === type);
      differences.push(`首选着形成“${matching.title}”，你的走法没有。`);
    }
  }
  return differences;
}

function analyzeRoute(sourceBoard, steps, perspectiveColor, adapters) {
  let working = adapters.cloneBoard(sourceBoard);
  let gained = 0;
  let lost = 0;
  const events = [];

  for (let index = 0; index < steps.length; index += 1) {
    const move = steps[index].move;
    const moving = working[move.fromRow]?.[move.fromCol];
    if (!moving) break;
    const analysis = analyzeMove(working, move, adapters);
    if (analysis.captured) {
      const value = adapters.pieceValues[analysis.captured.type] ?? 0;
      if (moving.color === perspectiveColor) gained += value;
      else lost += value;
    }
    for (const entry of analysis.facts.filter((item) => ["capture", "check", "fork", "pin", "skewer", "lost-protection"].includes(item.type))) {
      events.push({ step: index + 1, notation: steps[index].notation, fact: entry });
    }
    working = analysis.afterBoard;
  }

  return { gained, lost, net: gained - lost, events, finalBoard: working };
}

const api = {
  attacksSquare,
  attackersOf,
  statusAt,
  analyzeMove,
  compareMoveAnalyses,
  analyzeRoute,
};

if (typeof window !== "undefined") window.XiangqiTacticalAnalyzer = api;

export { attacksSquare, attackersOf, statusAt, analyzeMove, compareMoveAnalyses, analyzeRoute };
