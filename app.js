import { QILI_CURRICULUM_STAGES } from "./xiangqi-teaching-curriculum.mjs";

const ROWS = 10;
const COLS = 9;
const COLORS = { RED: "red", BLACK: "black" };
const OPPOSITE = { red: "black", black: "red" };
const COMPUTER_GAME_HISTORY_KEY = "qili-computer-games-v1";

const PIECE_LABELS = {
  red: { rook: "车", horse: "马", elephant: "相", advisor: "仕", general: "帅", cannon: "炮", pawn: "兵" },
  black: { rook: "车", horse: "马", elephant: "象", advisor: "士", general: "将", cannon: "炮", pawn: "卒" },
};

const PIECE_VALUES = {
  general: 10000,
  rook: 900,
  cannon: 450,
  horse: 420,
  elephant: 220,
  advisor: 220,
  pawn: 100,
};

const RED_NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

const boardElement = document.querySelector("#boardPoints");
const moveHistoryElement = document.querySelector("#moveHistory");
const moveCountElement = document.querySelector("#moveCount");
const statusBadgeElement = document.querySelector("#gameStatusBadge");
const turnTextElement = document.querySelector("#turnText");
const turnIndicatorElement = document.querySelector("#turnIndicator");
const evaluationDisplayElement = document.querySelector("#evaluationDisplay");
const lastMoveLabelElement = document.querySelector("#lastMoveLabel");
const coachContentElement = document.querySelector("#coachContent");
const analysisToggleElement = document.querySelector("#analysisToggle");
const moveHintsToggleElement = document.querySelector("#moveHintsToggle");
const notationBreakdownElement = document.querySelector("#notationBreakdown");
const routePreviewModalElement = document.querySelector("#routePreviewModal");
const routePreviewBoardElement = document.querySelector("#routePreviewBoard");
const routePreviewTitleElement = document.querySelector("#routePreviewTitle");
const routePreviewStepElement = document.querySelector("#routePreviewStep");
const routePreviewEventElement = document.querySelector("#routePreviewEvent");
const routePreviewCounterElement = document.querySelector("#routePreviewCounter");
const routePreviewPrevElement = document.querySelector("#routePreviewPrev");
const routePreviewNextElement = document.querySelector("#routePreviewNext");
const routePreviewCloseElement = document.querySelector("#routePreviewClose");
const notationModalElement = document.querySelector("#notationModal");
const openNotationButtonElement = document.querySelector("#openNotationButton");
const closeNotationButtonElement = document.querySelector("#closeNotationButton");
const moveHintsElement = document.querySelector("#moveHints");
const moveHintLegendElement = document.querySelector("#moveHintLegend");
const levelSelectElement = document.querySelector("#levelSelect");
const undoStepButtonElement = document.querySelector("#undoStepButton");
const undoButtonElement = document.querySelector("#undoButton");
const resumeButtonElement = document.querySelector("#resumeButton");
const newGameButtonElement = document.querySelector("#newGameButton");
const flipButtonElement = document.querySelector("#flipButton");
const leftNewGameButtonElement = document.querySelector("#leftNewGameButton");
const playViewElement = document.querySelector("#playView");
const replayArrowsElement = document.querySelector("#replayArrows");
const boardFooterPlayElement = document.querySelector("#boardFooterPlay");
const boardReplayBarElement = document.querySelector("#boardReplayBar");
const boardReplayTitleElement = document.querySelector("#boardReplayTitle");
const boardReplayStepElement = document.querySelector("#boardReplayStep");
const boardReplayCounterElement = document.querySelector("#boardReplayCounter");
const boardReplayPrevElement = document.querySelector("#boardReplayPrev");
const boardReplayNextElement = document.querySelector("#boardReplayNext");
const boardReplayCloseElement = document.querySelector("#boardReplayClose");
const boardReplayYourElement = document.querySelector("#boardReplayYour");
const boardReplayBestElement = document.querySelector("#boardReplayBest");
const gameResultOverlayElement = document.querySelector("#gameResultOverlay");
const gameResultMarkElement = document.querySelector("#gameResultMark");
const gameResultTitleElement = document.querySelector("#gameResultTitle");
const gameResultReasonElement = document.querySelector("#gameResultReason");
const gameResultOpponentElement = document.querySelector("#gameResultOpponent");
const gameResultMovesElement = document.querySelector("#gameResultMoves");
const reviewFinishedGameButtonElement = document.querySelector("#reviewFinishedGameButton");
const rematchButtonElement = document.querySelector("#rematchButton");
const dismissGameResultButtonElement = document.querySelector("#dismissGameResultButton");
const workspaceElement = document.querySelector(".workspace");
const reviewDropzoneElement = document.querySelector("#reviewDropzone");
const platformViews = {
  home: document.querySelector("#homeView"), play: document.querySelector("#playView"),
  train: document.querySelector("#trainView"), learn: document.querySelector("#learnView"),
  review: document.querySelector("#reviewDropzone"), analysis: document.querySelector("#analysisView"),
  profile: document.querySelector("#profileView"),
  online: document.querySelector("#onlineView"),
};
const quickPlayButtonElement = document.querySelector("#quickPlayButton");
const learnNotationButtonElement = document.querySelector("#learnNotationButton");
const curriculumDetailElement = document.querySelector("#curriculumDetail");
const engineStateElement = document.querySelector("#engineState");
const engineClient = window.XiangqiEngineClient;
const coachTools = window.XiangqiCoachTools;

let board = createInitialBoard();
let currentTurn = COLORS.RED;
let selected = null;
let legalTargets = [];
let history = [];
let snapshots = [cloneBoard(board)];
let flipped = false;
let locked = false;
let gameOver = false;
let coachAnalysis = null;
let engineConnected = false;
let engineError = null;
let engineEvaluationCp = null;
let pausedAfterUndo = false;
let moveSuggestions = [];
let suggestionRequestId = 0;
let routePreviewState = { route: null, index: 0, title: "", sourceBoard: null };
let boardReplay = null;
let boardReplayTimer = null;
let aiCoachConfigured = false;
let aiCoachServerAvailable = false;
let aiCoachModel = "";
let aiCoachRequestId = 0;
let computerGameId = createComputerGameId();
let computerGameStartedAt = Date.now();

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function piece(type, color) {
  return { type, color, label: PIECE_LABELS[color][type] };
}

function createInitialBoard() {
  const next = createEmptyBoard();
  const backRank = ["rook", "horse", "elephant", "advisor", "general", "advisor", "elephant", "horse", "rook"];

  backRank.forEach((type, col) => {
    next[0][col] = piece(type, COLORS.BLACK);
    next[9][col] = piece(type, COLORS.RED);
  });

  next[2][1] = piece("cannon", COLORS.BLACK);
  next[2][7] = piece("cannon", COLORS.BLACK);
  next[7][1] = piece("cannon", COLORS.RED);
  next[7][7] = piece("cannon", COLORS.RED);

  [0, 2, 4, 6, 8].forEach((col) => {
    next[3][col] = piece("pawn", COLORS.BLACK);
    next[6][col] = piece("pawn", COLORS.RED);
  });

  return next;
}

function cloneBoard(source) {
  return source.map((row) => row.map((entry) => (entry ? { ...entry } : null)));
}

function inside(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function insidePalace(row, col, color) {
  const rowAllowed = color === COLORS.RED ? row >= 7 && row <= 9 : row >= 0 && row <= 2;
  return rowAllowed && col >= 3 && col <= 5;
}

function crossedRiver(row, color) {
  return color === COLORS.RED ? row <= 4 : row >= 5;
}

function pushIfAvailable(moves, sourceBoard, row, col, color, captureOnly = false) {
  if (!inside(row, col)) return;
  const target = sourceBoard[row][col];
  if (!target && !captureOnly) moves.push({ toRow: row, toCol: col });
  if (target && target.color !== color) moves.push({ toRow: row, toCol: col });
}

function generatePseudoMoves(sourceBoard, row, col) {
  const currentPiece = sourceBoard[row][col];
  if (!currentPiece) return [];

  const moves = [];
  const { color, type } = currentPiece;

  if (type === "rook" || type === "cannon") {
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    directions.forEach(([dr, dc]) => {
      let r = row + dr;
      let c = col + dc;
      let screenFound = false;

      while (inside(r, c)) {
        const target = sourceBoard[r][c];

        if (type === "rook") {
          if (!target) {
            moves.push({ toRow: r, toCol: c });
          } else {
            if (target.color !== color) moves.push({ toRow: r, toCol: c });
            break;
          }
        } else if (!screenFound) {
          if (!target) {
            moves.push({ toRow: r, toCol: c });
          } else {
            screenFound = true;
          }
        } else if (target) {
          if (target.color !== color) moves.push({ toRow: r, toCol: c });
          break;
        }

        r += dr;
        c += dc;
      }
    });
  }

  if (type === "horse") {
    const patterns = [
      { dr: -2, dc: -1, lr: -1, lc: 0 }, { dr: -2, dc: 1, lr: -1, lc: 0 },
      { dr: 2, dc: -1, lr: 1, lc: 0 }, { dr: 2, dc: 1, lr: 1, lc: 0 },
      { dr: -1, dc: -2, lr: 0, lc: -1 }, { dr: 1, dc: -2, lr: 0, lc: -1 },
      { dr: -1, dc: 2, lr: 0, lc: 1 }, { dr: 1, dc: 2, lr: 0, lc: 1 },
    ];

    patterns.forEach(({ dr, dc, lr, lc }) => {
      if (!inside(row + lr, col + lc) || sourceBoard[row + lr][col + lc]) return;
      pushIfAvailable(moves, sourceBoard, row + dr, col + dc, color);
    });
  }

  if (type === "elephant") {
    [[-2, -2], [-2, 2], [2, -2], [2, 2]].forEach(([dr, dc]) => {
      const destinationRow = row + dr;
      const destinationCol = col + dc;
      const eyeRow = row + dr / 2;
      const eyeCol = col + dc / 2;
      const staysHome = color === COLORS.RED ? destinationRow >= 5 : destinationRow <= 4;
      if (inside(destinationRow, destinationCol) && staysHome && !sourceBoard[eyeRow][eyeCol]) {
        pushIfAvailable(moves, sourceBoard, destinationRow, destinationCol, color);
      }
    });
  }

  if (type === "advisor") {
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([dr, dc]) => {
      const destinationRow = row + dr;
      const destinationCol = col + dc;
      if (insidePalace(destinationRow, destinationCol, color)) {
        pushIfAvailable(moves, sourceBoard, destinationRow, destinationCol, color);
      }
    });
  }

  if (type === "general") {
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
      const destinationRow = row + dr;
      const destinationCol = col + dc;
      if (insidePalace(destinationRow, destinationCol, color)) {
        pushIfAvailable(moves, sourceBoard, destinationRow, destinationCol, color);
      }
    });

    const direction = color === COLORS.RED ? -1 : 1;
    let scanRow = row + direction;
    while (inside(scanRow, col)) {
      const target = sourceBoard[scanRow][col];
      if (target) {
        if (target.type === "general" && target.color !== color) {
          moves.push({ toRow: scanRow, toCol: col });
        }
        break;
      }
      scanRow += direction;
    }
  }

  if (type === "pawn") {
    const forward = color === COLORS.RED ? -1 : 1;
    pushIfAvailable(moves, sourceBoard, row + forward, col, color);
    if (crossedRiver(row, color)) {
      pushIfAvailable(moves, sourceBoard, row, col - 1, color);
      pushIfAvailable(moves, sourceBoard, row, col + 1, color);
    }
  }

  return moves.map((move) => ({ ...move, fromRow: row, fromCol: col, piece: currentPiece }));
}

function applyMove(sourceBoard, move) {
  const next = cloneBoard(sourceBoard);
  const movingPiece = next[move.fromRow][move.fromCol];
  const captured = next[move.toRow][move.toCol];
  next[move.toRow][move.toCol] = movingPiece;
  next[move.fromRow][move.fromCol] = null;
  return { board: next, captured };
}

function findGeneral(sourceBoard, color) {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const entry = sourceBoard[row][col];
      if (entry?.type === "general" && entry.color === color) return { row, col };
    }
  }
  return null;
}

function isSquareAttacked(sourceBoard, row, col, byColor) {
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const entry = sourceBoard[r][c];
      if (!entry || entry.color !== byColor) continue;
      const attacks = generatePseudoMoves(sourceBoard, r, c);
      if (attacks.some((move) => move.toRow === row && move.toCol === col)) return true;
    }
  }
  return false;
}

function isInCheck(sourceBoard, color) {
  const general = findGeneral(sourceBoard, color);
  if (!general) return true;
  return isSquareAttacked(sourceBoard, general.row, general.col, OPPOSITE[color]);
}

function legalMovesForPiece(sourceBoard, row, col) {
  const entry = sourceBoard[row][col];
  if (!entry) return [];
  return generatePseudoMoves(sourceBoard, row, col).filter((move) => {
    const result = applyMove(sourceBoard, move);
    return !isInCheck(result.board, entry.color);
  });
}

function generateLegalMoves(sourceBoard, color) {
  const moves = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (sourceBoard[row][col]?.color === color) {
        moves.push(...legalMovesForPiece(sourceBoard, row, col));
      }
    }
  }
  return moves;
}

function materialEvaluation(sourceBoard) {
  let score = 0;
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const entry = sourceBoard[row][col];
      if (!entry) continue;
      const direction = entry.color === COLORS.BLACK ? 1 : -1;
      const value = PIECE_VALUES[entry.type];
      let positional = 0;

      if (entry.type === "pawn") {
        positional += crossedRiver(row, entry.color) ? 24 : 0;
        positional += (4 - Math.abs(4 - col)) * 2;
      }
      if (entry.type === "horse" || entry.type === "cannon") {
        positional += (4 - Math.abs(4 - col)) * 3;
      }
      if (entry.type === "rook") {
        positional += (4 - Math.abs(4 - col));
      }

      score += direction * (value + positional);
    }
  }
  return score;
}

function moveHeuristic(sourceBoard, move, color) {
  const target = sourceBoard[move.toRow][move.toCol];
  const moving = sourceBoard[move.fromRow][move.fromCol];
  const result = applyMove(sourceBoard, move);
  let score = color === COLORS.BLACK ? materialEvaluation(result.board) : -materialEvaluation(result.board);

  if (target) score += PIECE_VALUES[target.type] * 0.65;
  if (isInCheck(result.board, OPPOSITE[color])) score += 110;

  const centerGain = Math.abs(move.fromCol - 4) - Math.abs(move.toCol - 4);
  score += centerGain * 5;

  const homeRow = color === COLORS.RED ? 9 : 0;
  if (["horse", "cannon", "rook"].includes(moving.type) && move.fromRow === homeRow) score += 18;

  if (isSquareAttacked(result.board, move.toRow, move.toCol, OPPOSITE[color])) {
    score -= PIECE_VALUES[moving.type] * 0.18;
  }

  return score;
}

function rankMoves(sourceBoard, color, limit = 5) {
  return generateLegalMoves(sourceBoard, color)
    .map((move) => ({ ...move, score: moveHeuristic(sourceBoard, move, color) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function minimax(sourceBoard, depth, alpha, beta, maximizingBlack) {
  if (depth === 0 || !findGeneral(sourceBoard, COLORS.RED) || !findGeneral(sourceBoard, COLORS.BLACK)) {
    return materialEvaluation(sourceBoard);
  }

  const color = maximizingBlack ? COLORS.BLACK : COLORS.RED;
  const moves = generateLegalMoves(sourceBoard, color);
  if (!moves.length) return maximizingBlack ? -99999 : 99999;

  if (maximizingBlack) {
    let best = -Infinity;
    for (const move of moves) {
      const result = applyMove(sourceBoard, move);
      best = Math.max(best, minimax(result.board, depth - 1, alpha, beta, false));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    const result = applyMove(sourceBoard, move);
    best = Math.min(best, minimax(result.board, depth - 1, alpha, beta, true));
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function engineSettings() {
  return coachTools.getLevelSettings(levelSelectElement.value);
}

function formatEngineScore(cp) {
  if (!Number.isFinite(cp)) return "—";
  if (Math.abs(cp) >= 90000) return cp > 0 ? "将杀" : "被将杀";
  const value = cp / 100;
  return (value > 0 ? "+" : "") + value.toFixed(2);
}

function pvToNotation(sourceBoard, pv, limit = 4) {
  let working = cloneBoard(sourceBoard);
  const labels = [];
  for (const uci of (pv || []).slice(0, limit)) {
    const move = engineClient.uciToMove(uci, working);
    if (!move) break;
    labels.push(formatMove(move, working));
    working = applyMove(working, move).board;
  }
  return labels.join("，");
}

async function initializeEngine() {
  try {
    engineStateElement.textContent = "正在连接 Pikafish…";
    const health = await engineClient.health();
    if (!health.configured) throw new Error("Pikafish 尚未配置");
    engineConnected = true;
    engineError = null;
    aiCoachServerAvailable = Number(health.apiVersion || 0) >= 2;
    aiCoachConfigured = Boolean(health.coach?.configured);
    aiCoachModel = health.coach?.model || "";
    engineStateElement.textContent = health.ready ? "Pikafish 已连接" : "Pikafish 已就绪";
    window.setTimeout(refreshMoveSuggestions, 0);
    return true;
  } catch (error) {
    engineConnected = false;
    engineError = error instanceof Error ? error.message : "引擎连接失败";
    engineStateElement.textContent = "连接失败：" + engineError;
    return false;
  }
}

function hintCoordinates(row, col) {
  return {
    x: (flipped ? 8 - col : col) * 100,
    y: (flipped ? 9 - row : row) * 100,
  };
}

function clearMoveSuggestions() {
  suggestionRequestId += 1;
  moveSuggestions = [];
  renderMoveHints();
}

function renderMoveHints() {
  if (!moveHintsElement || !moveHintLegendElement) return;
  const visible = Boolean(
    !boardReplay &&
    moveHintsToggleElement?.checked &&
    currentTurn === COLORS.RED &&
    !locked &&
    !gameOver &&
    moveSuggestions.length
  );

  moveHintLegendElement.classList.toggle("hidden", !visible);
  if (!visible) {
    moveHintsElement.innerHTML = "";
    return;
  }

  const colors = ["#237a52", "#3577b8", "#7d817f"];
  const widths = [12, 9, 7];
  const opacities = [0.9, 0.78, 0.66];
  const definitions = colors.map((color, index) =>
    '<marker id="hint-arrow-' + index + '" markerWidth="11" markerHeight="11" refX="8" refY="5.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L10,5.5 L0,11 Z" fill="' + color + '"></path></marker>'
  ).join("");

  const arrows = moveSuggestions.slice(0, 3).map((item, index) => {
    const from = hintCoordinates(item.move.fromRow, item.move.fromCol);
    const to = hintCoordinates(item.move.toRow, item.move.toCol);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const startPadding = 37;
    const endPadding = 42;
    const x1 = from.x + (dx / length) * startPadding;
    const y1 = from.y + (dy / length) * startPadding;
    const x2 = to.x - (dx / length) * endPadding;
    const y2 = to.y - (dy / length) * endPadding;
    const badgeX = x1 + (x2 - x1) * 0.68;
    const badgeY = y1 + (y2 - y1) * 0.68;
    return '<g class="move-hint">' +
      '<line class="move-hint-line" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + colors[index] + '" stroke-width="' + widths[index] + '" opacity="' + opacities[index] + '" marker-end="url(#hint-arrow-' + index + ')"></line>' +
      '<g class="move-hint-rank" transform="translate(' + badgeX + ' ' + badgeY + ')"><circle r="18" fill="' + colors[index] + '"></circle><text y="1">' + (index + 1) + '</text></g>' +
    '</g>';
  }).join("");

  moveHintsElement.innerHTML = '<defs>' + definitions + '</defs>' + arrows;
}

async function refreshMoveSuggestions() {
  const requestId = ++suggestionRequestId;
  moveSuggestions = [];
  renderMoveHints();

  if (!moveHintsToggleElement?.checked || !engineConnected || locked || gameOver || currentTurn !== COLORS.RED || pausedAfterUndo) return;

  try {
    engineStateElement.textContent = "Pikafish 正在生成棋盘候选…";
    const settings = engineSettings();
    const analysis = await engineClient.analyze(board, COLORS.RED, {
      depth: Math.max(8, Math.min(13, settings.depth)),
      multiPv: 3,
    });
    if (requestId !== suggestionRequestId || locked || currentTurn !== COLORS.RED || gameOver) return;
    moveSuggestions = analysis.lines
      .filter((line) => line.parsedMove)
      .slice(0, 3)
      .map((line) => ({ move: line.parsedMove, score: line.numericScore }));
    engineEvaluationCp = analysis.lines[0]?.numericScore ?? engineEvaluationCp;
    renderEvaluation();
    renderMoveHints();
    engineStateElement.textContent = "Pikafish 已连接 · 候选箭头已更新";
  } catch (error) {
    if (requestId !== suggestionRequestId) return;
    moveSuggestions = [];
    renderMoveHints();
    engineStateElement.textContent = "候选箭头暂时不可用";
  }
}

function computerMoveTimeBudget(level) {
  return {
    "800": 400,
    "1000": 500,
    "1200": 650,
    "1400": 800,
    "1600": 1000,
    "1800": 1200,
    "2000": 1500,
    max: 2200,
  }[level] || 800;
}

async function chooseComputerMove() {
  const level = levelSelectElement.value;
  const settings = engineSettings();
  try {
    const analysis = await engineClient.analyze(board, COLORS.BLACK, {
      depth: Math.min(settings.depth, level === "max" ? 14 : 10),
      multiPv: Math.min(settings.multiPv, level === "max" ? 3 : 4),
      maxTimeMs: computerMoveTimeBudget(level),
    });
    const selectedLine = coachTools.chooseLine(analysis.lines, level);
    if (selectedLine?.parsedMove) return { move: selectedLine.parsedMove, analysis, selectedLine };
    const bestMove = engineClient.uciToMove(analysis.bestMove, board);
    if (bestMove) {
      return { move: bestMove, analysis, selectedLine: null, bestMoveOnly: true };
    }
  } catch (error) {
    console.warn("[computer-engine]", error);
  }

  const fallbackMove = rankMoves(board, COLORS.BLACK, 5)[0] || null;
  if (!fallbackMove) return null;
  return {
    move: fallbackMove,
    analysis: { lines: [] },
    selectedLine: null,
    fallback: true,
  };
}
function sameMove(a, b) {
  return a.fromRow === b.fromRow && a.fromCol === b.fromCol && a.toRow === b.toRow && a.toCol === b.toCol;
}

function fileName(col, color) {
  return color === COLORS.RED ? RED_NUMERALS[8 - col] : String(col + 1);
}

function distanceName(distance, color) {
  return color === COLORS.RED ? RED_NUMERALS[distance - 1] : String(distance);
}

function formatMove(move, sourceBoard) {
  const moving = sourceBoard[move.fromRow][move.fromCol] ?? move.piece;
  if (!moving) return "未知着法";

  const fromFile = fileName(move.fromCol, moving.color);
  const toFile = fileName(move.toCol, moving.color);
  const vertical = move.fromCol === move.toCol;
  let action;
  let destination;

  if (!vertical) {
    const movingForward = moving.color === COLORS.RED ? move.toRow < move.fromRow : move.toRow > move.fromRow;
    if (["horse", "elephant", "advisor"].includes(moving.type)) {
      action = movingForward ? "进" : "退";
      destination = toFile;
    } else if (move.fromRow === move.toRow) {
      action = "平";
      destination = toFile;
    } else {
      action = movingForward ? "进" : "退";
      destination = distanceName(Math.abs(move.toRow - move.fromRow), moving.color);
    }
  } else {
    const movingForward = moving.color === COLORS.RED ? move.toRow < move.fromRow : move.toRow > move.fromRow;
    action = movingForward ? "进" : "退";
    destination = distanceName(Math.abs(move.toRow - move.fromRow), moving.color);
  }

  return `${moving.label}${fromFile}${action}${destination}`;
}

function describeMove(sourceBoard, move) {
  const moving = sourceBoard[move.fromRow][move.fromCol];
  const captured = sourceBoard[move.toRow][move.toCol];
  const result = applyMove(sourceBoard, move);
  const facts = [];

  if (captured) facts.push(`直接取得了对方的${captured.label}`);
  if (isInCheck(result.board, OPPOSITE[moving.color])) facts.push("形成将军，迫使对手立即应对");

  const homeRow = moving.color === COLORS.RED ? 9 : 0;
  if (["horse", "cannon", "rook"].includes(moving.type) && move.fromRow === homeRow) {
    facts.push(`让${moving.label}离开初始位置，改善了子力活动`);
  }

  const wasCentral = Math.abs(move.fromCol - 4);
  const nowCentral = Math.abs(move.toCol - 4);
  if (nowCentral < wasCentral) facts.push("向中路靠拢，增加了对关键线路的控制");

  if (isSquareAttacked(result.board, move.toRow, move.toCol, OPPOSITE[moving.color])) {
    facts.push(`但落点上的${moving.label}会受到对方攻击，需要继续计算交换是否划算`);
  }

  if (!facts.length) facts.push("这是一手改善棋形的安静着，需要结合对方下一步威胁判断价值");
  return facts;
}

function principleForMove(sourceBoard, move) {
  const moving = sourceBoard[move.fromRow][move.fromCol];
  const target = sourceBoard[move.toRow][move.toCol];
  const result = applyMove(sourceBoard, move);

  if (isInCheck(result.board, OPPOSITE[moving.color])) {
    return "出现将军、吃子等强制手段时，优先计算对手所有被迫应对，再判断进攻是否持续。";
  }
  if (target) {
    return "吃子之前不要只计算眼前收益，还要检查吃完以后，这个棋子是否会被反吃或被更强的先手攻击。";
  }
  if (["horse", "cannon", "rook"].includes(moving.type)) {
    return "开局阶段应让更多棋子参与，而不是连续移动同一个棋子；出子速度决定谁先获得主动。";
  }
  return "每步先问三个问题：对手威胁什么、我有没有强制手段、这一步是否让最差的棋子变得更有用。";
}

function buildCoachAnalysis(sourceBoard, move, beforeAnalysis, afterAnalysis, options = {}) {
  return coachTools.buildCoachAnalysis({
    sourceBoard,
    move,
    beforeAnalysis,
    afterAnalysis,
    adapters: {
      cloneBoard,
      applyMove,
      isInCheck,
      isSquareAttacked,
      formatMove,
      uciToMove: engineClient.uciToMove,
      moveToUci: engineClient.moveToUci,
      pieceValues: PIECE_VALUES,
      opposite: OPPOSITE,
      generateLegalMoves,
    },
    routeLimit: options.routeLimit || 8,
  });
}

function createComputerGameId() {
  return window.crypto?.randomUUID?.() || `computer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function computerOpponentInfo(levelValue = levelSelectElement?.value) {
  const level = String(levelValue || "1400");
  const info = window.QiliIdentity?.getComputerLevels?.()?.[level] || null;
  const rating = Number(info?.rating ?? (level === "max" ? 2200 : level));
  const calibration = info?.calibrated ? "" : " · 校准中";
  const strength = level === "max" ? " · 最高强度" : "";
  return { level, info, label: `Pikafish · Qili ${rating}${strength}${calibration}` };
}

function saveComputerGameToHistory(result) {
  if (!history.length) return;
  const opponentInfo = computerOpponentInfo();
  const { level, info } = opponentInfo;
  const record = {
    id: computerGameId,
    source: "computer",
    createdAt: computerGameStartedAt,
    startedAt: computerGameStartedAt,
    finishedAt: Date.now(),
    timeControl: {
      mode: "computer",
      level,
      label: opponentInfo.label,
      qiliRating: info?.rating ?? (level === "max" ? 2200 : Number(level)),
      ratingDeviation: info?.deviation ?? null,
      calibrated: Boolean(info?.calibrated),
    },
    color: "red",
    opponent: opponentInfo.label,
    result,
    moves: history.map((entry, index) => ({
      ply: index + 1,
      color: entry.color,
      move: { ...entry.move },
      notation: entry.notation,
      captured: entry.captured?.label || null,
    })),
  };
  try {
    const stored = JSON.parse(localStorage.getItem(COMPUTER_GAME_HISTORY_KEY) || "[]");
    const previous = Array.isArray(stored) ? stored : [];
    const next = [record, ...previous.filter((item) => item?.id !== record.id)]
      .sort((a, b) => Number(new Date(b.finishedAt)) - Number(new Date(a.finishedAt)))
      .slice(0, 30);
    localStorage.setItem(COMPUTER_GAME_HISTORY_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("qili-game-finished", { detail: { source: "computer", game: record } }));
  } catch (error) {
    console.warn("[computer-review-save]", error);
  }
}

function hideGameResult() {
  gameResultOverlayElement?.classList.add("hidden");
}

function gameResultReasonText(result, didWin) {
  if (result?.reason === "checkmate") return didWin ? "将死对手" : "被将死";
  if (result?.reason === "general-captured") return didWin ? "吃掉黑将" : "红帅被吃";
  if (result?.reason === "no-legal-moves") return didWin ? "对手无合法着可走" : "无合法着可走";
  return result?.winner ? "本局结束" : "和棋";
}

function showGameResult(result) {
  if (!gameResultOverlayElement) return;
  const didWin = result?.winner === COLORS.RED;
  const isDraw = !result?.winner;
  const opponent = computerOpponentInfo().label;
  gameResultOverlayElement.classList.remove("hidden", "win", "loss", "draw");
  gameResultOverlayElement.classList.add(isDraw ? "draw" : didWin ? "win" : "loss");
  if (gameResultMarkElement) gameResultMarkElement.textContent = isDraw ? "和" : didWin ? "胜" : "负";
  if (gameResultTitleElement) gameResultTitleElement.textContent = isDraw ? "本局和棋" : didWin ? "本局获胜" : "本局落败";
  if (gameResultReasonElement) gameResultReasonElement.textContent = gameResultReasonText(result, didWin);
  if (gameResultOpponentElement) gameResultOpponentElement.textContent = opponent;
  if (gameResultMovesElement) gameResultMovesElement.textContent = history.length + " 手";
}

function performMove(move, color) {
  const sourceBoard = cloneBoard(board);
  const result = applyMove(board, move);
  const notation = formatMove(move, sourceBoard);

  board = result.board;
  history.push({
    color,
    notation,
    move: { ...move },
    captured: result.captured,
  });
  snapshots.push(cloneBoard(board));
  lastMoveLabelElement.textContent = `${color === COLORS.RED ? "你" : "电脑"}：${notation}`;

  return { sourceBoard, result, notation };
}

async function analyzeHumanMoveInBackground(sourceBoard, afterHumanBoard, move) {
  if (!analysisToggleElement?.checked || !engineConnected || gameOver) return;
  try {
    const settings = engineSettings();
    const coachDepth = Math.max(8, Math.min(14, settings.depth));
    const before = await engineClient.analyze(sourceBoard, COLORS.RED, { depth: coachDepth, multiPv: 4, maxTimeMs: 500 });
    const after = await engineClient.analyze(afterHumanBoard, COLORS.BLACK, { depth: coachDepth, multiPv: 2, maxTimeMs: 350 });
    coachAnalysis = buildCoachAnalysis(sourceBoard, move, before, after);
    requestAiCoachExplanation(coachAnalysis);
    renderCoach();
  } catch (error) {
    console.warn("[coach-background-analysis]", error);
    if (!gameOver && engineConnected) {
      engineStateElement.textContent = "Pikafish 已连接 · 本手讲解稍后再试";
    }
  }
}

async function performHumanMove(move) {
  if (locked || gameOver || pausedAfterUndo) return;
  closeBoardReplay();
  clearMoveSuggestions();
  locked = true;
  selected = null;
  legalTargets = [];
  if (!engineConnected && !(await initializeEngine())) { locked = false; render(); return; }
  const sourceBoard = cloneBoard(board);
  performMove(move, COLORS.RED);
  const afterHumanBoard = cloneBoard(board);
  currentTurn = COLORS.BLACK;
  engineStateElement.textContent = "Pikafish 正在选择应对…";
  render();
  if (finishIfNeeded()) return;
  try {
    await performComputerMove();
  } catch (error) {
    engineConnected = false;
    engineError = error instanceof Error ? error.message : "Pikafish 分析失败";
    engineStateElement.textContent = "引擎错误：" + engineError;
    locked = false;
    render();
    return;
  }
  void analyzeHumanMoveInBackground(sourceBoard, afterHumanBoard, move);
}

async function performComputerMove() {
  if (gameOver) return;
  engineStateElement.textContent = "Pikafish 正在选择应对…";
  const choice = await chooseComputerMove();
  if (!choice) { locked = false; finishIfNeeded(); return; }
  if (choice.analysis?.lines?.length) {
    engineEvaluationCp = -(choice.analysis.lines[0]?.numericScore ?? 0);
  }
  performMove(choice.move, COLORS.BLACK);
  currentTurn = COLORS.RED;
  locked = false;
  engineStateElement.textContent = choice.fallback
    ? "Pikafish 响应较慢 · 本手已用本地应对"
    : "Pikafish 已连接";
  render();
  if (!finishIfNeeded()) refreshMoveSuggestions();
}

function finishIfNeeded() {
  const redGeneral = findGeneral(board, COLORS.RED);
  const blackGeneral = findGeneral(board, COLORS.BLACK);
  const legal = generateLegalMoves(board, currentTurn);

  if (!redGeneral || !blackGeneral || legal.length === 0) {
    gameOver = true;
    locked = true;
    const winner = !redGeneral || (currentTurn === COLORS.RED && legal.length === 0) ? "黑方" : "红方";
    const winnerColor = winner === "红方" ? COLORS.RED : COLORS.BLACK;
    const reason = !redGeneral || !blackGeneral
      ? "general-captured"
      : isInCheck(board, currentTurn) ? "checkmate" : "no-legal-moves";
    statusBadgeElement.textContent = `${winner}获胜`;
    turnTextElement.textContent = "本局结束";
    lastMoveLabelElement.textContent = `${winner}获胜 · 可以重新开始或悔棋`;
    const result = { winner: winnerColor, reason };
    saveComputerGameToHistory(result);
    showGameResult(result);
    renderBoard();
    return true;
  }
  return false;
}

function handlePointClick(row, col) {
  if (boardReplay || locked || gameOver || currentTurn !== COLORS.RED) return;
  const targetPiece = board[row][col];

  if (selected) {
    const legalMove = legalTargets.find((move) => move.toRow === row && move.toCol === col);
    if (legalMove) {
      performHumanMove(legalMove);
      return;
    }

    if (targetPiece?.color === COLORS.RED) {
      selected = { row, col };
      legalTargets = legalMovesForPiece(board, row, col);
    } else {
      selected = null;
      legalTargets = [];
    }
    renderBoard();
    return;
  }

  if (targetPiece?.color === COLORS.RED) {
    selected = { row, col };
    legalTargets = legalMovesForPiece(board, row, col);
    renderBoard();
  }
}

function renderBoard() {
  boardElement.innerHTML = "";
  const replayActive = Boolean(boardReplay);
  const displayBoard = replayActive
    ? previewBoardAt(boardReplay.route, boardReplay.index, boardReplay.sourceBoard)
    : board;
  const highlightMove = replayActive
    ? (boardReplay.index > 0 ? boardReplay.route.steps[boardReplay.index - 1]?.move : null)
    : history.at(-1)?.move;

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const point = document.createElement("button");
      const visualCol = flipped ? 8 - col : col;
      const visualRow = flipped ? 9 - row : row;
      point.className = "board-point";
      point.style.left = `${(visualCol / 8) * 100}%`;
      point.style.top = `${(visualRow / 9) * 100}%`;
      point.setAttribute("aria-label", `第 ${row + 1} 行，第 ${col + 1} 列`);
      point.addEventListener("click", () => handlePointClick(row, col));

      const isSelected = !replayActive && selected?.row === row && selected?.col === col;
      const legalMove = replayActive ? null : legalTargets.find((move) => move.toRow === row && move.toCol === col);
      const entry = displayBoard[row][col];

      if (isSelected) point.classList.add("selected");
      if (legalMove) point.classList.add(entry ? "capture" : "legal");
      if (!replayActive && entry?.color === COLORS.RED && currentTurn === COLORS.RED && !locked) point.classList.add("selectable");

      if (highlightMove?.fromRow === row && highlightMove?.fromCol === col) {
        point.classList.add("last-from");
        if (replayActive) point.classList.add("replay-from");
      }
      if (highlightMove?.toRow === row && highlightMove?.toCol === col) {
        point.classList.add("last-to");
        if (replayActive) point.classList.add("replay-to");
      }

      if (entry) {
        const pieceElement = document.createElement("span");
        pieceElement.className = `piece ${entry.color}-piece`;
        pieceElement.textContent = entry.label;
        point.appendChild(pieceElement);
      }

      boardElement.appendChild(point);
    }
  }

  renderReplayArrows();
}

function renderHistory() {
  moveCountElement.textContent = `${history.length} 手`;
  undoStepButtonElement.disabled = history.length === 0 || locked;
  undoButtonElement.disabled = history.length === 0 || locked;
  resumeButtonElement.classList.toggle("hidden", !pausedAfterUndo);

  if (!history.length) {
    moveHistoryElement.className = "move-history empty-state";
    moveHistoryElement.textContent = "开始走棋后，这里会记录完整棋谱。";
    return;
  }

  moveHistoryElement.className = "move-history";
  const rows = [];
  for (let index = 0; index < history.length; index += 2) {
    const redMove = history[index];
    const blackMove = history[index + 1];
    rows.push(`
      <div class="move-row">
        <span class="move-number">${Math.floor(index / 2) + 1}.</span>
        <span class="red-move">${redMove?.notation ?? ""}</span>
        <span class="black-move">${blackMove?.notation ?? ""}</span>
      </div>
    `);
  }
  moveHistoryElement.innerHTML = rows.join("");
  moveHistoryElement.scrollTop = moveHistoryElement.scrollHeight;
}

function renderStatus() {
  if (gameOver) return;

  if (locked) {
    statusBadgeElement.textContent = "电脑思考中";
    statusBadgeElement.style.color = "#34423a";
    statusBadgeElement.style.background = "#e8ece9";
    turnTextElement.textContent = "电脑正在思考";
    turnIndicatorElement.className = "turn-dot black";
    return;
  }

  const redTurn = currentTurn === COLORS.RED;
  statusBadgeElement.textContent = redTurn ? "红方走棋" : "黑方走棋";
  statusBadgeElement.style.color = redTurn ? "#a64335" : "#34423a";
  statusBadgeElement.style.background = redTurn ? "#f7e9e5" : "#e8ece9";
  turnTextElement.textContent = redTurn ? "轮到红方" : "轮到黑方";
  turnIndicatorElement.className = `turn-dot ${redTurn ? "red" : "black"}`;
}

function renderEvaluation() {
  if (engineEvaluationCp == null) { evaluationDisplayElement.innerHTML = "<span>引擎</span><strong>等待分析</strong>"; return; }
  const score = engineEvaluationCp;
  const label = score > 180 ? "红方明显占优" : score > 60 ? "红方稍优" : score < -180 ? "黑方明显占优" : score < -60 ? "黑方稍优" : "均势";
  evaluationDisplayElement.innerHTML = "<span>" + formatEngineScore(score) + "</span><strong>" + label + "</strong>";
}

function candidateRowsHtml(candidates) {
  return candidates.map((candidate) =>
    '<div class="candidate-row"><span class="candidate-rank">' + candidate.rank + '</span><strong>' + candidate.notation + (candidate.selected ? ' · 你的选择' : '') + '</strong><span class="candidate-score">' + candidate.score + '</span></div>'
  ).join('');
}

function verifiedFactsHtml(facts, emptyText = "没有命中可验证规则。") {
  if (!facts?.length) return '<div class="verified-empty">' + emptyText + '</div>';
  return '<div class="verified-fact-list">' + facts.map((entry) =>
    '<article class="verified-fact ' + entry.severity + '">' +
      '<div class="verified-fact-heading"><strong>' + entry.title + '</strong><span>' + entry.confidence + '</span></div>' +
      '<p>' + entry.detail + '</p>' +
    '</article>'
  ).join('') + '</div>';
}

function comparisonFactsHtml(items) {
  if (!items?.length) return '';
  return '<div class="verified-differences">' + items.map((item) => '<p>' + item + '</p>').join('') + '</div>';
}

function routeComparisonHtml(items) {
  if (!items?.length) return '';
  return '<div class="route-material-summary"><strong>当前主变化中的子力结果</strong>' + items.map((item) => '<p>' + item + '</p>').join('') + '</div>';
}

function compactBoardForAi(sourceBoard) {
  return sourceBoard.map((row) => row.map((entry) => entry ? entry.color + ":" + entry.type + ":" + entry.label : null));
}

function buildAiCoachCase(analysis, mode = "play") {
  const evidenceCatalog = [
    { id: "board-position", type: "board-position", text: "完整棋盘位置已提供；row 0 是黑方底线，row 9 是红方底线。" },
    { id: "engine-choice", type: "engine-choice", text: "你的走法：" + analysis.moveNotation + "；Pikafish首选：" + analysis.bestMove + "。" },
    { id: "engine-gap", type: "engine-gap", text: "评价差：" + formatEngineScore(analysis.gap) + "；你的候选排名：" + (analysis.moveRank || "前五之外") + "。" },
  ];

  const addFacts = (prefix, facts) => {
    (facts || []).forEach((fact, index) => evidenceCatalog.push({
      id: prefix + "-" + (index + 1),
      type: fact.type,
      text: fact.title + "：" + fact.detail,
    }));
  };
  addFacts("chosen-fact", analysis.chosenFacts);
  addFacts("best-fact", analysis.bestFacts);
  addFacts("reply-fact", analysis.replyFacts);
  (analysis.deterministicDifferences || []).forEach((text, index) => evidenceCatalog.push({ id: "difference-" + (index + 1), type: "comparison", text }));
  (analysis.routeComparisons || []).forEach((text, index) => evidenceCatalog.push({ id: "route-result-" + (index + 1), type: text.includes("净失") ? "route-material-loss" : "route-material", text }));
  evidenceCatalog.push({ id: "signals-chosen", type: "position-signals", text: "你的走法后局面指标：" + JSON.stringify(analysis.signals?.chosen || {}) });
  evidenceCatalog.push({ id: "signals-best", type: "position-signals", text: "首选着后局面指标：" + JSON.stringify(analysis.signals?.best || {}) });

  const routeLimit = mode === "review" ? 10 : 8;
  const routeForAi = (route, prefix) => (route?.steps || []).slice(0, routeLimit).map((step, index) => {
    const id = prefix + "-" + (index + 1);
    const text = step.notation + (step.facts?.length ? "；确定事实：" + step.facts.map((fact) => fact.title + "（" + fact.detail + "）").join("；") : "");
    evidenceCatalog.push({ id, text });
    return { id, notation: step.notation, facts: step.facts?.map((fact) => ({ type: fact.type, title: fact.title, detail: fact.detail })) || [] };
  });

  return {
    mode,
    move: {
      notation: analysis.moveNotation,
      bestMove: analysis.bestMove,
      selectedIsBest: analysis.selectedIsBest,
      rank: analysis.moveRank,
      gap: analysis.gap,
      raw: analysis.moveRaw,
      bestRaw: analysis.bestMoveRaw,
    },
    engine: {
      chosenScore: analysis.chosenScore,
      bestScore: analysis.bestScore,
      opponentMove: analysis.opponentMove,
    },
    board: compactBoardForAi(analysis.sourceBoard),
    signals: analysis.signals || {},
    routes: {
      your: routeForAi(analysis.routes?.your, "your-route"),
      best: routeForAi(analysis.routes?.best, "best-route"),
    },
    evidenceCatalog,
  };
}

async function analyzeReviewPosition(sourceBoard, move, options = {}) {
  if (!engineConnected && !(await initializeEngine())) {
    throw new Error(engineError || "Pikafish 连接失败");
  }
  const mover = sourceBoard?.[move?.fromRow]?.[move?.fromCol];
  if (!mover) throw new Error("无法读取这一步的起始棋盘");
  const depth = Math.max(8, Math.min(16, Number(options.depth) || 12));
  const routeLimit = Math.max(6, Math.min(12, Number(options.routeLimit) || 10));
  const before = await engineClient.analyze(sourceBoard, mover.color, { depth, multiPv: 8 });
  const afterBoard = applyMove(sourceBoard, move).board;
  const after = await engineClient.analyze(afterBoard, OPPOSITE[mover.color], { depth, multiPv: 3 });
  const analysis = buildCoachAnalysis(sourceBoard, move, before, after, { routeLimit });
  let ai = null;
  let aiError = null;
  if (aiCoachServerAvailable && aiCoachConfigured) {
    try {
      ai = await engineClient.explainCoach(buildAiCoachCase(analysis, "review"));
    } catch (error) {
      aiError = error instanceof Error ? error.message : "AI 复盘解释失败";
    }
  }
  return {
    analysis,
    ai,
    aiError,
    aiAvailable: Boolean(aiCoachServerAvailable && aiCoachConfigured),
  };
}

function requestAiCoachExplanation(analysis) {
  const requestId = ++aiCoachRequestId;
  if (!aiCoachServerAvailable) {
    analysis.aiCoach = { state: "unavailable", reason: "restart" };
    renderCoach();
    return;
  }
  if (!aiCoachConfigured) {
    analysis.aiCoach = { state: "unavailable", reason: "key" };
    renderCoach();
    return;
  }

  analysis.aiCoach = { state: "loading" };
  renderCoach();
  engineClient.explainCoach(buildAiCoachCase(analysis)).then((result) => {
    if (requestId !== aiCoachRequestId || coachAnalysis !== analysis) return;
    analysis.aiCoach = { state: "ready", ...result };
    renderCoach();
  }).catch((error) => {
    if (requestId !== aiCoachRequestId || coachAnalysis !== analysis) return;
    analysis.aiCoach = { state: "error", message: error instanceof Error ? error.message : "AI教练请求失败" };
    renderCoach();
  });
}

function moveSummaryMeta(analysis) {
  if (analysis.selectedIsBest) {
    return { tone: "good", badge: "这步很好", kicker: "", reason: "这一步就是当前首选，不用纠正。" };
  }
  if (analysis.gap < 30) {
    return { tone: "good", badge: "这步没错", kicker: "", reason: "和 " + analysis.bestMove + " 几乎一样好。重点是看两种选择差在哪里。" };
  }
  if (analysis.gap < 100) {
    return { tone: "warning", badge: "可以更好", kicker: "你错过了", reason: "首选是 " + analysis.bestMove + "。先看最重要的区别。" };
  }
  return { tone: "danger", badge: "需要注意", kicker: "你错过了", reason: analysis.bestMove + " 明显更好。先看这步给了对手什么机会。" };
}

function moveSummaryCardHtml(analysis) {
  const meta = moveSummaryMeta(analysis);
  const ai = analysis.aiCoach;
  const reason = ai?.state === "ready" && ai.headline ? ai.headline : meta.reason;
  return '<article class="coach-card move-summary-card ' + meta.tone + '">' +
    '<span class="beginner-judgment ' + meta.tone + '">' + meta.badge + '</span>' +
    '<h3>' + analysis.moveNotation + '</h3>' +
    (meta.kicker ? '<span class="summary-kicker">' + meta.kicker + '</span>' : '') +
    '<p>' + reason + '</p>' +
    variationViewerHtml(analysis) +
  '</article>';
}

function explanationFallbackHtml(analysis) {
  const parts = [];
  if (analysis.selectedIsBest) {
    parts.push('<p>' + analysis.moveNotation + ' 就是当前首选。下面只看它最值得记住的一点。</p>');
  } else {
    parts.push('<p>你走了 ' + analysis.moveNotation + '，但 ' + analysis.bestMove + ' 更值得考虑。</p>');
  }
  const fact = analysis.chosenFacts?.[0];
  if (fact?.detail) parts.push('<p>' + fact.detail + '</p>');
  else if (analysis.deterministicDifferences?.[0]) parts.push('<p>' + analysis.deterministicDifferences[0] + '</p>');
  return parts.join("");
}

function explanationCardHtml(analysis) {
  const ai = analysis.aiCoach;
  let body;
  if (!ai || ai.state === "loading") {
    body = '<p>正在把这一步翻译成棋理…</p>';
  } else if (ai.state === "unavailable") {
    const message = ai.reason === "restart"
      ? "AI 解释服务正在更新，请稍后重试。"
      : "AI 解释暂时不可用。先看棋盘变化，再对比更好的选择。";
    body = '<div class="ai-unavailable"><p>' + message + '</p></div>' + explanationFallbackHtml(analysis);
  } else if (ai.state === "error") {
    body = '<div class="ai-unavailable"><p>' + ai.message + '</p></div>' + explanationFallbackHtml(analysis);
  } else {
    const confidenceLabel = ai.confidence === "high" ? "高" : ai.confidence === "medium" ? "中" : "低";
    const lessonFocus = ai.teaching?.focus?.concept || "看清这一手的直接作用";
    const lessonLevel = ai.teaching?.stage?.level ? ai.teaching.stage.level + "级重点" : "基础重点";
    body =
      '<div class="teacher-focus"><span>' + lessonLevel + '</span><strong>' + lessonFocus + '</strong></div>' +
      (ai.question ? '<div class="teacher-question"><span>先看棋盘</span><strong>' + ai.question + '</strong></div>' : '') +
      '<div class="teacher-section"><strong>原因</strong><p>' + ai.coreReason + '</p></div>' +
      (ai.comparison ? '<div class="teacher-section"><strong>和更好的选择差在哪里</strong><p>' + ai.comparison + '</p></div>' : '') +
      (ai.remember ? '<div class="teacher-memory"><span>下次记住</span><strong>' + ai.remember + '</strong></div>' : '') +
      '<div class="teacher-confidence">解释置信度：' + confidenceLabel + (ai.status === "uncertain" ? " · 标记为不确定" : "") + '</div>';
  }

  return '<details class="coach-explanation">' +
    '<summary>为什么？</summary>' +
    '<div class="explanation-body">' + body + '</div>' +
  '</details>';
}

function variationViewerHtml(analysis) {
  if (!analysis?.routes?.your && !analysis?.routes?.best) return "";
  return '<button class="button button-primary route-preview-trigger" data-route="your" type="button">查看变化</button>';
}

function engineSearchDepth(analysis) {
  const match = String(analysis.engineDetail || "").match(/搜索深度\s+(\S+)/);
  return match ? match[1].replace(/。$/, "") : "—";
}

function engineDetailsHtml(analysis) {
  const rankText = analysis.moveRank ? "第 " + analysis.moveRank + " 候选" : "未进入前五候选";
  const evidence = analysis.hasVerifiedReason
    ? '<div class="verified-evidence-content">' +
        verifiedFactsHtml(analysis.chosenFacts, "你的走法没有命中直接战术规则。") +
        comparisonFactsHtml(analysis.deterministicDifferences) +
        (analysis.bestFacts.length ? '<div class="evidence-subsection"><strong>首选着的可验证作用</strong>' + verifiedFactsHtml(analysis.bestFacts) + '</div>' : '') +
        (analysis.replyFacts.length ? '<div class="evidence-subsection"><strong>对手回应中的明确威胁：' + analysis.opponentMove + '</strong>' + verifiedFactsHtml(analysis.replyFacts) + '</div>' : '') +
        routeComparisonHtml(analysis.routeComparisons) +
      '</div>'
    : "";

  return '<details class="coach-engine engine-details">' +
    '<summary>高级分析</summary>' +
    '<div class="engine-body raw-engine-content">' +
      '<p>Pikafish</p>' +
      '<div class="engine-fact-grid">' +
        '<div><span>Evaluation</span><strong>' + formatEngineScore(analysis.chosenScore) + '</strong></div>' +
        '<div><span>Best</span><strong>' + formatEngineScore(analysis.bestScore) + '</strong></div>' +
        '<div><span>Depth</span><strong>' + engineSearchDepth(analysis) + '</strong></div>' +
        '<div><span>Gap</span><strong>' + formatEngineScore(analysis.gap) + '</strong></div>' +
      '</div>' +
      '<p><strong>候选排名：</strong>' + rankText + '</p>' +
      '<p><strong>对手首选回应：</strong>' + analysis.rawEngine.opponentMove + '</p>' +
      '<p><strong>PV：</strong>' + analysis.rawEngine.yourSequence + '</p>' +
      (analysis.sameRoute ? "" : '<p><strong>最佳 PV：</strong>' + analysis.rawEngine.bestSequence + '</p>') +
      '<div class="candidate-list">' + candidateRowsHtml(analysis.candidates) + '</div>' +
      evidence +
      '<p class="engine-detail-line">' + analysis.engineDetail + '</p>' +
    '</div>' +
  '</details>';
}

function analysisOffCardHtml() {
  return '<article class="coach-empty"><h3>独立思考模式</h3><p>打开「棋理分析」后，每一步都会得到简短解释。</p></article>';
}

function emptyCoachHtml() {
  return '<article class="coach-empty"><h3>等待你的下一步</h3><p>每一步都会获得：</p><ul><li>为什么</li><li>更好的选择</li><li>棋理建议</li></ul></article>';
}

function setCoachHtml(html) {
  const explanationOpen = Boolean(coachContentElement.querySelector(".coach-explanation")?.open);
  const advancedOpen = Boolean(coachContentElement.querySelector(".coach-engine")?.open);
  if (coachContentElement.dataset.html === html) return;
  coachContentElement.dataset.html = html;
  coachContentElement.innerHTML = html;
  const explanation = coachContentElement.querySelector(".coach-explanation");
  const advanced = coachContentElement.querySelector(".coach-engine");
  if (explanation) explanation.open = explanationOpen;
  if (advanced) advanced.open = advancedOpen;
}

function renderCoach() {
  if (!analysisToggleElement.checked) {
    closeBoardReplay();
    setCoachHtml(analysisOffCardHtml());
    return;
  }

  if (!coachAnalysis) {
    setCoachHtml(emptyCoachHtml());
    return;
  }

  setCoachHtml(
    moveSummaryCardHtml(coachAnalysis) +
    explanationCardHtml(coachAnalysis) +
    engineDetailsHtml(coachAnalysis)
  );
}

function render() {
  renderBoard();
  renderHistory();
  renderStatus();
  renderEvaluation();
  renderCoach();
  renderMoveHints();
}

function resetGame() {
  board = createInitialBoard();
  currentTurn = COLORS.RED;
  selected = null;
  legalTargets = [];
  history = [];
  snapshots = [cloneBoard(board)];
  locked = false;
  gameOver = false;
  coachAnalysis = null;
  engineEvaluationCp = null;
  pausedAfterUndo = false;
  computerGameId = createComputerGameId();
  computerGameStartedAt = Date.now();
  hideGameResult();
  closeBoardReplay();
  clearMoveSuggestions();
  lastMoveLabelElement.textContent = "请选择一个棋子开始";
  render();
  if (engineConnected) refreshMoveSuggestions();
}

function restoreAfterUndo(removeCount, forceRedTurn) {
  history.splice(-removeCount, removeCount);
  snapshots.splice(-removeCount, removeCount);
  board = cloneBoard(snapshots.at(-1));
  currentTurn = forceRedTurn ? COLORS.RED : (history.length % 2 === 0 ? COLORS.RED : COLORS.BLACK);
  selected = null;
  legalTargets = [];
  locked = false;
  gameOver = false;
  coachAnalysis = null;
  engineEvaluationCp = null;
  hideGameResult();
  closeBoardReplay();
  lastMoveLabelElement.textContent = history.length ? "已回到 " + history.at(-1).notation + " 之后" : "请选择一个棋子开始";
}

function undoOneStep() {
  if (!history.length || locked) return;
  const removed = history.at(-1);
  restoreAfterUndo(1, false);
  currentTurn = removed.color;
  pausedAfterUndo = removed.color === COLORS.BLACK;
  if (pausedAfterUndo) lastMoveLabelElement.textContent = "已退回电脑走棋前。可继续让电脑重新选择。";
  render();
  if (!pausedAfterUndo && currentTurn === COLORS.RED) refreshMoveSuggestions();
}

function undoTurn() {
  if (!history.length || locked) return;
  const removeCount = history.at(-1)?.color === COLORS.BLACK && history.length >= 2 ? 2 : 1;
  restoreAfterUndo(removeCount, true);
  pausedAfterUndo = false;
  render();
  if (currentTurn === COLORS.RED) refreshMoveSuggestions();
}

async function resumeAfterUndo() {
  if (!pausedAfterUndo || locked) return;
  pausedAfterUndo = false;
  if (currentTurn === COLORS.BLACK) {
    locked = true;
    render();
    await performComputerMove();
  } else {
    render();
  }
}

function previewBoardAt(route, index, sourceBoard) {
  const base = sourceBoard || routePreviewState.sourceBoard || boardReplay?.sourceBoard || coachAnalysis?.sourceBoard;
  if (!base || !route) return createEmptyBoard();
  let previewBoard = cloneBoard(base);
  for (let stepIndex = 0; stepIndex < index; stepIndex += 1) {
    const step = route.steps[stepIndex];
    if (!step?.move) break;
    previewBoard = applyMove(previewBoard, step.move).board;
  }
  return previewBoard;
}

function stopBoardReplayTimer() {
  if (boardReplayTimer) {
    clearInterval(boardReplayTimer);
    boardReplayTimer = null;
  }
}

function renderReplayArrows() {
  if (!replayArrowsElement) return;
  if (!boardReplay || boardReplay.index === 0) {
    replayArrowsElement.innerHTML = "";
    return;
  }
  const step = boardReplay.route.steps[boardReplay.index - 1];
  if (!step?.move) {
    replayArrowsElement.innerHTML = "";
    return;
  }
  const from = hintCoordinates(step.move.fromRow, step.move.fromCol);
  const to = hintCoordinates(step.move.toRow, step.move.toCol);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const x1 = from.x + (dx / length) * 37;
  const y1 = from.y + (dy / length) * 37;
  const x2 = to.x - (dx / length) * 42;
  const y2 = to.y - (dy / length) * 42;
  replayArrowsElement.innerHTML =
    '<defs><marker id="replay-arrow-head" markerWidth="11" markerHeight="11" refX="8" refY="5.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L10,5.5 L0,11 Z" fill="#ed482f"></path></marker></defs>' +
    '<line class="replay-arrow-line" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"></line>';
}

function updateBoardReplayChrome() {
  if (!boardReplay || !boardReplayBarElement) return;
  const route = boardReplay.route;
  const activeStep = boardReplay.index > 0 ? route.steps[boardReplay.index - 1] : null;
  playViewElement?.classList.add("replay-active");
  boardFooterPlayElement?.classList.add("hidden");
  boardReplayBarElement.classList.remove("hidden");
  boardReplayTitleElement.textContent = boardReplay.title;
  boardReplayStepElement.textContent = activeStep
    ? (activeStep.notation + (activeStep.events?.length ? " · " + activeStep.events.join("、") : ""))
    : "起始局面";
  boardReplayCounterElement.textContent = boardReplay.index + " / " + route.steps.length;
  boardReplayPrevElement.disabled = boardReplay.index === 0;
  boardReplayNextElement.disabled = boardReplay.index >= route.steps.length;
  boardReplayYourElement?.classList.toggle("active", boardReplay.key === "your");
  boardReplayBestElement?.classList.toggle("active", boardReplay.key === "best");
  boardReplayBestElement?.classList.toggle("hidden", Boolean(coachAnalysis?.sameRoute));
}

function renderBoardReplay() {
  if (!boardReplay) return;
  updateBoardReplayChrome();
  renderBoard();
  renderMoveHints();
}

function openBoardReplay(routeKey) {
  if (!coachAnalysis?.routes?.[routeKey]) return;
  stopBoardReplayTimer();
  const route = coachAnalysis.routes[routeKey];
  boardReplay = {
    key: routeKey,
    route,
    index: route.steps.length ? 1 : 0,
    title: routeKey === "best" ? "最佳路线" : "你的路线",
    sourceBoard: cloneBoard(coachAnalysis.sourceBoard),
  };
  renderBoardReplay();
}

function closeBoardReplay() {
  if (!boardReplay) return;
  stopBoardReplayTimer();
  boardReplay = null;
  playViewElement?.classList.remove("replay-active");
  boardReplayBarElement?.classList.add("hidden");
  boardFooterPlayElement?.classList.remove("hidden");
  if (replayArrowsElement) replayArrowsElement.innerHTML = "";
  renderBoard();
  renderMoveHints();
}

function stepBoardReplay(delta) {
  if (!boardReplay) return;
  stopBoardReplayTimer();
  boardReplay.index = Math.max(0, Math.min(boardReplay.route.steps.length, boardReplay.index + delta));
  renderBoardReplay();
}

function renderRoutePreview() {
  const route = routePreviewState.route;
  if (!route || !routePreviewBoardElement) return;
  const previewBoard = previewBoardAt(route, routePreviewState.index);
  const activeStep = routePreviewState.index > 0 ? route.steps[routePreviewState.index - 1] : null;
  routePreviewBoardElement.innerHTML = "";
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = document.createElement("div");
      cell.className = "route-preview-cell";
      if (activeStep && activeStep.move.toRow === row && activeStep.move.toCol === col) cell.classList.add("active-to");
      if (activeStep && activeStep.move.fromRow === row && activeStep.move.fromCol === col) cell.classList.add("active-from");
      const entry = previewBoard[row][col];
      if (entry) {
        const pieceElement = document.createElement("span");
        pieceElement.className = "route-preview-piece " + entry.color;
        pieceElement.textContent = entry.label;
        cell.appendChild(pieceElement);
      }
      routePreviewBoardElement.appendChild(cell);
    }
  }
  routePreviewTitleElement.textContent = routePreviewState.title;
  routePreviewCounterElement.textContent = routePreviewState.index + " / " + route.steps.length;
  routePreviewPrevElement.disabled = routePreviewState.index === 0;
  routePreviewNextElement.disabled = routePreviewState.index >= route.steps.length;
  routePreviewStepElement.textContent = activeStep ? activeStep.notation : "起始局面";
  routePreviewEventElement.textContent = activeStep
    ? (activeStep.events.length ? activeStep.events.join("、") : "这一手没有立即吃子或将军。")
    : "使用前后按钮逐步查看棋盘上的真实变化。";
}

function openRoutePreview(routeKey) {
  if (!coachAnalysis?.routes?.[routeKey]) return;
  const playVisible = playViewElement && !playViewElement.classList.contains("hidden");
  if (playVisible) {
    openBoardReplay(routeKey);
    return;
  }
  routePreviewState = {
    route: coachAnalysis.routes[routeKey],
    index: 0,
    title: routeKey === "best" ? "Pikafish 首选路线" : "你的走法路线",
    sourceBoard: cloneBoard(coachAnalysis.sourceBoard),
  };
  routePreviewModalElement.classList.remove("hidden");
  document.body.classList.add("modal-open");
  renderRoutePreview();
}

function openExternalRoutePreview(route, sourceBoard, title = "复盘路线") {
  if (!route?.steps?.length || !sourceBoard) return;
  routePreviewState = {
    route,
    index: 0,
    title,
    sourceBoard: cloneBoard(sourceBoard),
  };
  routePreviewModalElement.classList.remove("hidden");
  document.body.classList.add("modal-open");
  renderRoutePreview();
}

function closeRoutePreview() {
  routePreviewModalElement?.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

window.QiliReviewCoach = {
  analyzePosition: analyzeReviewPosition,
  openRoutePreview: openExternalRoutePreview,
};

coachContentElement?.addEventListener("click", (event) => {
  const button = event.target.closest(".route-preview-trigger");
  if (button) openRoutePreview(button.dataset.route);
});
boardReplayPrevElement?.addEventListener("click", () => stepBoardReplay(-1));
boardReplayNextElement?.addEventListener("click", () => stepBoardReplay(1));
boardReplayCloseElement?.addEventListener("click", closeBoardReplay);
boardReplayYourElement?.addEventListener("click", () => openBoardReplay("your"));
boardReplayBestElement?.addEventListener("click", () => openBoardReplay("best"));
routePreviewPrevElement?.addEventListener("click", () => {
  routePreviewState.index = Math.max(0, routePreviewState.index - 1);
  renderRoutePreview();
});
routePreviewNextElement?.addEventListener("click", () => {
  routePreviewState.index = Math.min(routePreviewState.route.steps.length, routePreviewState.index + 1);
  renderRoutePreview();
});
routePreviewCloseElement?.addEventListener("click", closeRoutePreview);
routePreviewModalElement?.addEventListener("click", (event) => {
  if (event.target === routePreviewModalElement) closeRoutePreview();
});

newGameButtonElement?.addEventListener("click", resetGame);
leftNewGameButtonElement?.addEventListener("click", resetGame);
undoStepButtonElement?.addEventListener("click", undoOneStep);
undoButtonElement?.addEventListener("click", undoTurn);
resumeButtonElement?.addEventListener("click", resumeAfterUndo);
flipButtonElement?.addEventListener("click", () => {
  flipped = !flipped;
  renderBoard();
  renderMoveHints();
});
reviewFinishedGameButtonElement?.addEventListener("click", () => {
  hideGameResult();
  switchPlatformView("review");
  void window.QiliIdentity?.loadReviewGames?.();
});
rematchButtonElement?.addEventListener("click", resetGame);
dismissGameResultButtonElement?.addEventListener("click", hideGameResult);
analysisToggleElement?.addEventListener("change", renderCoach);
function renderNotationLesson(notation = "车二进四", pieceType = "rook", color = "red") {
  if (!notationBreakdownElement) return;
  const chars = [...notation];
  const pieceName = chars[0] || "";
  const file = chars[1] || "";
  const action = chars[2] || "";
  const destination = chars[3] || "";
  const fileText = (color === "red" ? "红方第" : "黑方第") + file + "路；从走棋一方右侧数";
  const actionText = action === "进" ? "向对方方向移动" : action === "退" ? "向自己方向移动" : "横向移动";
  const usesDestinationFile = action === "平" || ["horse", "elephant", "advisor"].includes(pieceType);
  const destinationText = usesDestinationFile
    ? "落到第" + destination + "路"
    : "前进或后退" + destination + "个交叉点";
  const items = [
    [pieceName, "移动的棋子"],
    [file, fileText],
    [action, actionText],
    [destination, destinationText],
  ];
  notationBreakdownElement.innerHTML = items.map(([token, text]) =>
    '<div class="notation-token"><b>' + token + '</b><span>' + text + '</span></div>'
  ).join('');
}

function openNotationLesson() {
  notationModalElement?.classList.remove("hidden");
  document.body.classList.add("modal-open");
  renderNotationLesson();
  closeNotationButtonElement?.focus();
}

function closeNotationLesson() {
  notationModalElement?.classList.add("hidden");
  document.body.classList.remove("modal-open");
  openNotationButtonElement?.focus();
}

openNotationButtonElement?.addEventListener("click", openNotationLesson);
closeNotationButtonElement?.addEventListener("click", closeNotationLesson);
notationModalElement?.querySelector("[data-close-notation]")?.addEventListener("click", closeNotationLesson);
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (boardReplay) {
    closeBoardReplay();
    return;
  }
  if (!notationModalElement?.classList.contains("hidden")) closeNotationLesson();
  if (!routePreviewModalElement?.classList.contains("hidden")) closeRoutePreview();
});

document.querySelectorAll(".notation-example").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".notation-example").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderNotationLesson(button.dataset.notation, button.dataset.piece, button.dataset.color);
  });
});

moveHintsToggleElement?.addEventListener("change", () => {
  if (moveHintsToggleElement.checked) refreshMoveSuggestions();
  else clearMoveSuggestions();
});
levelSelectElement?.addEventListener("change", () => {
  if (currentTurn === COLORS.RED && !locked) refreshMoveSuggestions();
});

function switchPlatformView(viewName) {
  const target = platformViews[viewName] ? viewName : "home";
  const navTarget = target === "online" ? "play" : target;
  Object.entries(platformViews).forEach(([name, element]) => element?.classList.toggle("hidden", name !== target));
  document.querySelectorAll(".platform-nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === navTarget));
  document.querySelector(".play-only-action")?.classList.toggle("hidden", target !== "play");
  quickPlayButtonElement?.classList.toggle("hidden", target === "play" || target === "online");
  document.body.classList.toggle("play-mode", target === "play");
  if (target !== "play") closeBoardReplay();
}

window.XiangqiPlatform = { switchView: switchPlatformView };

document.querySelectorAll(".platform-nav-item").forEach((item) => item.addEventListener("click", () => switchPlatformView(item.dataset.view)));
document.querySelectorAll(".platform-jump").forEach((item) => item.addEventListener("click", () => switchPlatformView(item.dataset.targetView)));
quickPlayButtonElement?.addEventListener("click", () => switchPlatformView("play"));
learnNotationButtonElement?.addEventListener("click", openNotationLesson);

const curriculumGridElement = document.querySelector("#learnView .curriculum-grid");

if (curriculumGridElement) {
  curriculumGridElement.innerHTML = QILI_CURRICULUM_STAGES.map((stage) => {
    const stageNumber = String(stage.order).padStart(2, "0");
    return `<button type="button" class="curriculum-card platform-surface curriculum-start" data-stage-id="${stage.id}" data-stage-card="${stage.id}" aria-label="查看阶段 ${stage.order}：${stage.title}">
      <b>${stageNumber}</b>
      <h2>${stage.title}</h2>
      <p>${stage.summary}</p>
      <span class="curriculum-card-action">查看课程 →</span>
    </button>`;
  }).join("");
}

document.querySelectorAll(".curriculum-start").forEach((button) => {
  const stage = QILI_CURRICULUM_STAGES.find((entry) => entry.id === button.dataset.stageId);
  if (!stage) return;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    switchPlatformView("learn");
    document.querySelectorAll("[data-stage-card]").forEach((card) => card.classList.toggle("active", card.dataset.stageCard === stage.id));
    const lessonRows = stage.lessons.map((lesson, lessonIndex) => `<article class="curriculum-lesson-row">
      <span>${String(lessonIndex + 1).padStart(2, "0")}</span>
      <div><strong>${lesson.adultTitle}</strong><p>${lesson.objective}</p></div>
    </article>`).join("");
    curriculumDetailElement.innerHTML = `<div class="curriculum-detail-head">
      <div><span class="eyebrow">阶段 ${String(stage.order).padStart(2, "0")} · ${stage.lessons.length} 课</span><h2>${stage.title}</h2><p>${stage.summary}</p></div>
    </div>
    <div class="curriculum-lesson-list">${lessonRows}</div>`;
    curriculumDetailElement.classList.remove("hidden");
    curriculumDetailElement.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

window.QiliTutorialRules = {
  ROWS,
  COLS,
  COLORS,
  createEmptyBoard,
  piece,
  generatePseudoMoves,
  applyMove,
  legalMovesForPiece,
  generateLegalMoves,
  isInCheck,
};

const initialPlatformView = window.location.hash.replace("#", "");
switchPlatformView(platformViews[initialPlatformView] ? initialPlatformView : "home");

render();
renderNotationLesson();
initializeEngine();
