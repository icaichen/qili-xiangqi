import {
  analyzeMove,
  compareMoveAnalyses,
  analyzeRoute,
  statusAt,
} from "./tactical-analyzer.js";

const LEVELS = {
  "800": { label: "估算 800", depth: 4, multiPv: 8, lossMin: 100, lossMax: 360, temperature: 105 },
  "1000": { label: "估算 1000", depth: 5, multiPv: 8, lossMin: 75, lossMax: 260, temperature: 85 },
  "1200": { label: "估算 1200", depth: 7, multiPv: 8, lossMin: 45, lossMax: 170, temperature: 62 },
  "1400": { label: "估算 1400", depth: 8, multiPv: 8, lossMin: 25, lossMax: 105, temperature: 45 },
  "1600": { label: "估算 1600", depth: 10, multiPv: 7, lossMin: 10, lossMax: 65, temperature: 30 },
  "1800": { label: "估算 1800", depth: 12, multiPv: 6, lossMin: 0, lossMax: 32, temperature: 18 },
  "2000": { label: "估算 2000", depth: 14, multiPv: 5, lossMin: 0, lossMax: 14, temperature: 9 },
  max: { label: "无限制", depth: 18, multiPv: 4, lossMin: 0, lossMax: 0, temperature: 1 },
};

function getLevelSettings(level) {
  return LEVELS[level] ?? LEVELS["1400"];
}

function weightedChoice(items, weights) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!total) return items[0];
  let roll = Math.random() * total;
  for (let index = 0; index < items.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return items[index];
  }
  return items.at(-1);
}

function chooseLine(lines, level) {
  const usable = lines.filter((line) => line?.parsedMove && Number.isFinite(line.numericScore));
  if (!usable.length) return null;
  const config = getLevelSettings(level);
  if (level === "max") return usable[0];

  const bestScore = usable[0].numericScore;
  const targetLoss = config.lossMin + Math.random() * (config.lossMax - config.lossMin);
  const candidates = usable.map((line, index) => ({
    line,
    index,
    loss: Math.max(0, bestScore - line.numericScore),
  }));

  const eligible = candidates.filter((candidate) => candidate.loss <= config.lossMax * 1.8 + 20);
  const pool = eligible.length ? eligible : candidates;
  const weights = pool.map((candidate) => {
    const distance = Math.abs(candidate.loss - targetLoss);
    const closeness = Math.exp(-distance / config.temperature);
    const rankPenalty = 1 / (1 + candidate.index * 0.18);
    return Math.max(0.001, closeness * rankPenalty);
  });
  return weightedChoice(pool, weights).line;
}

function formatScore(cp) {
  if (!Number.isFinite(cp)) return "—";
  if (Math.abs(cp) >= 90000) return cp > 0 ? "将杀" : "被将杀";
  const value = cp / 100;
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function routeData(sourceBoard, pv, adapters, limit = 8) {
  let working = adapters.cloneBoard(sourceBoard);
  const steps = [];
  for (const uci of (pv || []).slice(0, limit)) {
    const move = adapters.uciToMove(uci, working);
    if (!move) break;
    const notation = adapters.formatMove(move, working);
    const moveAnalysis = analyzeMove(working, move, adapters);
    const verifiedFacts = moveAnalysis.facts.filter((entry) => [
      "capture",
      "check",
      "hanging-mover",
      "lost-protection",
      "fork",
      "pin",
      "skewer",
      "horse-leg-opened",
      "horse-leg-blocked",
      "elephant-eye-opened",
      "elephant-eye-blocked",
      "open-rook-line",
      "cannon-screen-change",
    ].includes(entry.type));
    steps.push({
      uci,
      move: { ...move },
      notation,
      facts: verifiedFacts,
      events: verifiedFacts.map((entry) => entry.title),
    });
    working = moveAnalysis.afterBoard;
  }
  return {
    sequence: steps.map((step) => step.notation).join(" → "),
    steps,
    finalBoard: working,
  };
}

function routeMaterialText(routeResult) {
  if (!routeResult || (!routeResult.gained && !routeResult.lost)) return null;
  if (routeResult.net > 0) {
    return `在这条主变化中净得约${routeResult.net}点子力（得${routeResult.gained}，失${routeResult.lost}）。`;
  }
  if (routeResult.net < 0) {
    return `在这条主变化中净失约${Math.abs(routeResult.net)}点子力（得${routeResult.gained}，失${routeResult.lost}）。`;
  }
  return `在这条主变化中交换子力价值相当（得${routeResult.gained}，失${routeResult.lost}）。`;
}

function positionSignals(board, color, focusSquare, adapters) {
  const opponent = adapters.opposite[color];
  const legalMoves = adapters.generateLegalMoves(board, color);
  const opponentLegalMoves = adapters.generateLegalMoves(board, opponent);
  let attackedPieces = 0;
  let loosePieces = 0;
  const loosePieceLabels = [];
  let developedActivePieces = 0;
  const homeRow = color === "red" ? 9 : 0;

  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.color !== color || piece.type === "general") continue;
      const status = statusAt(board, row, col, adapters);
      if (status?.attackers.length) attackedPieces += 1;
      if (status?.attackers.length && !status.defenders.length) {
        loosePieces += 1;
        loosePieceLabels.push(piece.label);
      }
      if (["rook", "horse", "cannon"].includes(piece.type) && row !== homeRow) developedActivePieces += 1;
    }
  }

  const capturesAvailable = legalMoves.filter((candidate) => {
    const target = board[candidate.toRow]?.[candidate.toCol];
    return target && target.color === opponent;
  }).length;
  const movedPieceOptions = focusSquare
    ? legalMoves.filter((candidate) => candidate.fromRow === focusSquare.row && candidate.fromCol === focusSquare.col).length
    : null;

  return {
    legalMoves: legalMoves.length,
    opponentLegalMoves: opponentLegalMoves.length,
    capturesAvailable,
    attackedPieces,
    loosePieces,
    loosePieceLabels: loosePieceLabels.slice(0, 5),
    movedPieceOptions,
    developedActivePieces,
    inCheck: adapters.isInCheck(board, color),
  };
}

function buildCoachAnalysis({ sourceBoard, move, beforeAnalysis, afterAnalysis, adapters }) {
  const chosenUci = adapters.moveToUci(move);
  const lines = beforeAnalysis.lines.filter((line) => line.parsedMove);
  const bestLine = lines[0];
  const selectedIndex = lines.findIndex((line) => line.move === chosenUci);
  const selectedLine = selectedIndex >= 0 ? lines[selectedIndex] : null;
  const bestMove = bestLine?.parsedMove ?? move;
  const bestScore = bestLine?.numericScore ?? 0;
  const afterScore = -(afterAnalysis.lines[0]?.numericScore ?? 0);
  const chosenScore = selectedLine?.numericScore ?? afterScore;
  const gap = Math.max(0, bestScore - chosenScore);
  const selectedIsBest = Boolean(bestLine && bestLine.move === chosenUci);
  const moveRank = selectedIndex >= 0 ? selectedIndex + 1 : null;
  const mover = sourceBoard[move.fromRow]?.[move.fromCol];

  const chosenTactics = analyzeMove(sourceBoard, move, adapters);
  const bestTactics = analyzeMove(sourceBoard, bestMove, adapters);
  const chosenSignals = positionSignals(chosenTactics.afterBoard, mover?.color, { row: move.toRow, col: move.toCol }, adapters);
  const bestSignals = positionSignals(bestTactics.afterBoard, mover?.color, { row: bestMove.toRow, col: bestMove.toCol }, adapters);
  const deterministicDifferences = selectedIsBest ? [] : compareMoveAnalyses(chosenTactics, bestTactics);

  const replyLine = afterAnalysis.lines.find((line) => line.parsedMove) ?? afterAnalysis.lines[0];
  const replyMove = replyLine?.parsedMove;
  const replyNotation = replyMove
    ? adapters.formatMove(replyMove, chosenTactics.afterBoard)
    : "未返回";
  const replyTactics = replyMove
    ? analyzeMove(chosenTactics.afterBoard, replyMove, adapters)
    : { facts: [] };

  const chosenPv = selectedLine?.pv?.length
    ? selectedLine.pv
    : [chosenUci, ...(replyLine?.pv || [])];
  const yourRoute = routeData(sourceBoard, chosenPv, adapters, 8);
  const bestRoute = routeData(sourceBoard, bestLine?.pv || [], adapters, 8);
  const sameRoute = selectedIsBest || yourRoute.sequence === bestRoute.sequence;
  const yourRouteResult = analyzeRoute(sourceBoard, yourRoute.steps, mover?.color, adapters);
  const bestRouteResult = analyzeRoute(sourceBoard, bestRoute.steps, mover?.color, adapters);

  let quality;
  let verdict;
  if (selectedIsBest) {
    quality = "good";
    verdict = "你走的是 Pikafish 当前首选。";
  } else if (gap < 30) {
    quality = "good";
    verdict = `这步与首选基本等价，评价差只有 ${formatScore(gap)}。`;
  } else if (gap < 100) {
    quality = "inaccuracy";
    verdict = `这步可下，但比首选约差 ${formatScore(gap)}。`;
  } else {
    quality = "mistake";
    verdict = `这步让局面评价下降约 ${formatScore(gap)}。`;
  }

  const chosenFacts = chosenTactics.facts;
  const bestFacts = selectedIsBest ? [] : bestTactics.facts;
  const replyFacts = replyTactics.facts.filter((entry) => entry.severity === "warning" || [
    "capture", "check", "fork", "pin", "skewer", "lost-protection",
  ].includes(entry.type));

  const routeComparisons = [];
  const yourMaterial = routeMaterialText(yourRouteResult);
  const bestMaterial = routeMaterialText(bestRouteResult);
  if (yourMaterial) routeComparisons.push(`你的路线：${yourMaterial}`);
  if (!sameRoute && bestMaterial) routeComparisons.push(`首选路线：${bestMaterial}`);
  if (!sameRoute && Math.abs(yourRouteResult.net - bestRouteResult.net) >= 100) {
    routeComparisons.push(`按当前主变化，首选路线的子力净结果比你的路线好约${bestRouteResult.net - yourRouteResult.net}点。`);
  }

  const hasVerifiedReason = Boolean(
    chosenFacts.length
    || bestFacts.length
    || replyFacts.length
    || deterministicDifferences.length
    || routeComparisons.length,
  );

  return {
    quality,
    verdict,
    selectedIsBest,
    sameRoute,
    moveRank,
    moveNotation: adapters.formatMove(move, sourceBoard),
    moveRaw: { fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol },
    bestMove: adapters.formatMove(bestMove, sourceBoard),
    bestMoveRaw: { fromRow: bestMove.fromRow, fromCol: bestMove.fromCol, toRow: bestMove.toRow, toCol: bestMove.toCol },
    bestScore,
    chosenScore,
    gap,
    opponentMove: replyNotation,
    hasVerifiedReason,
    chosenFacts,
    bestFacts,
    replyFacts,
    deterministicDifferences,
    routeComparisons,
    signals: { chosen: chosenSignals, best: bestSignals },
    sourceBoard: adapters.cloneBoard(sourceBoard),
    routes: {
      your: yourRoute,
      best: bestRoute,
    },
    rawEngine: {
      opponentMove: replyNotation,
      yourSequence: yourRoute.sequence || "主变化不足",
      bestSequence: bestRoute.sequence || "主变化不足",
    },
    engineDetail: `首选 ${formatScore(bestScore)}；你的走法 ${formatScore(chosenScore)}；差值 ${formatScore(gap)}；搜索深度 ${bestLine?.depth ?? beforeAnalysis.depth ?? "—"}。`,
    candidates: lines.slice(0, 5).map((line, index) => ({
      rank: index + 1,
      notation: adapters.formatMove(line.parsedMove, sourceBoard),
      score: formatScore(line.numericScore),
      loss: formatScore(Math.max(0, bestScore - line.numericScore)),
      selected: line.move === chosenUci,
    })),
  };
}

window.XiangqiCoachTools = {
  LEVELS,
  getLevelSettings,
  chooseLine,
  buildCoachAnalysis,
  formatScore,
};
