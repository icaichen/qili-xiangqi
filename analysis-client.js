const ROWS = 10;
const COLS = 9;
const API = window.__QILI_ENGINE_API__ || (["localhost", "127.0.0.1"].includes(window.location.hostname) ? "http://127.0.0.1:8787" : window.location.origin);
const PIECE_LABELS = {
  red: { rook: "车", horse: "马", elephant: "相", advisor: "仕", general: "帅", cannon: "炮", pawn: "兵" },
  black: { rook: "车", horse: "马", elephant: "象", advisor: "士", general: "将", cannon: "炮", pawn: "卒" },
};
const TRAY = [
  { color: "red", types: ["general", "advisor", "elephant", "rook", "horse", "cannon", "pawn"] },
  { color: "black", types: ["general", "advisor", "elephant", "rook", "horse", "cannon", "pawn"] },
];
const RED_NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

const root = document.querySelector("#analysisView");
if (root) {
  const engine = window.XiangqiEngineClient;
  const rules = () => window.QiliTutorialRules;

  let board = createInitialBoard();
  let sideToMove = "red";
  let flipped = false;
  let editing = false;
  let tray = null;
  let selected = null;
  let legalTargets = [];
  let suspects = new Set();
  let hintMove = null;
  let screenshotUrl = "";
  let screenshotNote = "";
  let analysis = null;
  let analyzing = false;
  let recognizing = false;
  let selectedLine = 0;
  let requestId = 0;
  let nodes = [{ board: createInitialBoard(), sideToMove: "red", notation: "", color: null }];
  let cursor = 0;
  let coachAnalysis = null;
  let coachRequestId = 0;
  let replay = null;
  let explanationOpen = false;
  let advancedOpen = false;

  function piece(type, color) {
    return { type, color, label: PIECE_LABELS[color][type] };
  }

  function createEmptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function createInitialBoard() {
    const next = createEmptyBoard();
    const back = ["rook", "horse", "elephant", "advisor", "general", "advisor", "elephant", "horse", "rook"];
    back.forEach((type, col) => {
      next[0][col] = piece(type, "black");
      next[9][col] = piece(type, "red");
    });
    next[2][1] = piece("cannon", "black");
    next[2][7] = piece("cannon", "black");
    next[7][1] = piece("cannon", "red");
    next[7][7] = piece("cannon", "red");
    [0, 2, 4, 6, 8].forEach((col) => {
      next[3][col] = piece("pawn", "black");
      next[6][col] = piece("pawn", "red");
    });
    return next;
  }

  function cloneBoard(source) {
    return source.map((row) => row.map((entry) => (entry ? { ...entry } : null)));
  }

  function displayRow(row) { return flipped ? 9 - row : row; }
  function displayCol(col) { return flipped ? 8 - col : col; }

  function fileName(col, color) {
    return color === "red" ? RED_NUMERALS[8 - col] : String(col + 1);
  }

  function distanceName(distance, color) {
    return color === "red" ? RED_NUMERALS[distance - 1] : String(distance);
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
      const movingForward = moving.color === "red" ? move.toRow < move.fromRow : move.toRow > move.fromRow;
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
      const movingForward = moving.color === "red" ? move.toRow < move.fromRow : move.toRow > move.fromRow;
      action = movingForward ? "进" : "退";
      destination = distanceName(Math.abs(move.toRow - move.fromRow), moving.color);
    }
    return `${moving.label}${fromFile}${action}${destination}`;
  }

  function formatScore(cp) {
    if (!Number.isFinite(cp)) return "—";
    if (Math.abs(cp) >= 90000) return cp > 0 ? "将杀" : "被将杀";
    const value = cp / 100;
    return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
  }

  function evalLabel(cp) {
    if (!Number.isFinite(cp)) return "等待引擎";
    if (cp > 180) return "红方明显占优";
    if (cp > 60) return "红方稍好";
    if (cp < -180) return "黑方明显占优";
    if (cp < -60) return "黑方稍好";
    return "均势";
  }

  function redShare(cp) {
    if (!Number.isFinite(cp)) return 50;
    if (Math.abs(cp) >= 90000) return cp > 0 ? 96 : 4;
    return Math.max(6, Math.min(94, 50 + 50 * Math.tanh(cp / 450)));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function countGenerals(source) {
    const counts = { red: 0, black: 0 };
    source.flat().forEach((entry) => {
      if (entry?.type === "general") counts[entry.color] += 1;
    });
    return counts;
  }

  function legalMoves(source, color) {
    return rules()?.generateLegalMoves?.(source, color) || [];
  }

  function legalMovesAt(source, row, col) {
    return rules()?.legalMovesForPiece?.(source, row, col) || [];
  }

  function applyLegalMove(source, move) {
    return rules()?.applyMove?.(source, move).board || source;
  }

  function boardFromPieces(pieces) {
    const next = createEmptyBoard();
    (pieces || []).forEach((entry) => {
      if (!PIECE_LABELS[entry.color]?.[entry.type]) return;
      next[entry.row][entry.col] = piece(entry.type, entry.color);
    });
    return next;
  }

  function pointStyle(row, col) {
    return `left:${(displayCol(col) / 8) * 100}%;top:${(displayRow(row) / 9) * 100}%`;
  }

  function formatPv(sourceBoard, side, uciMoves, limit = 6) {
    let working = cloneBoard(sourceBoard);
    let color = side;
    const out = [];
    for (const uci of (uciMoves || []).slice(0, limit)) {
      const move = engine?.uciToMove?.(uci, working);
      if (!move) break;
      out.push(formatMove(move, working));
      working = applyLegalMove(working, move);
      color = color === "red" ? "black" : "red";
    }
    return out;
  }

  function restoreNode(index) {
    const node = nodes[index];
    if (!node) return;
    cursor = index;
    board = cloneBoard(node.board);
    sideToMove = node.sideToMove;
    selected = null;
    legalTargets = [];
  }

  function pushMove(move, notation) {
    nodes = nodes.slice(0, cursor + 1);
    const nextBoard = applyLegalMove(board, move);
    const nextSide = sideToMove === "red" ? "black" : "red";
    nodes.push({
      board: cloneBoard(nextBoard),
      sideToMove: nextSide,
      notation,
      color: sideToMove,
      move: { ...move },
    });
    cursor = nodes.length - 1;
    board = cloneBoard(nextBoard);
    sideToMove = nextSide;
    selected = null;
    legalTargets = [];
    hintMove = { fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol };
  }

  function renderArrow(move) {
    if (!move) return "";
    const from = { x: displayCol(move.fromCol) * 100, y: displayRow(move.fromRow) * 100 };
    const to = { x: displayCol(move.toCol) * 100, y: displayRow(move.toRow) * 100 };
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const x1 = from.x + ux * 42;
    const y1 = from.y + uy * 42;
    const x2 = to.x - ux * 28;
    const y2 = to.y - uy * 28;
    return `<svg class="replay-arrows analysis-arrow" viewBox="0 0 800 900" preserveAspectRatio="none" aria-hidden="true">
      <defs><marker id="analysis-arrow-head" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#ed482f"></path></marker></defs>
      <line class="replay-arrow-line" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" marker-end="url(#analysis-arrow-head)"></line>
    </svg>`;
  }

  function render() {
    explanationOpen = Boolean(root.querySelector(".coach-explanation")?.open);
    advancedOpen = Boolean(root.querySelector(".coach-engine")?.open);
    const generals = countGenerals(board);
    const canExplore = generals.red === 1 && generals.black === 1;
    const best = analysis?.lines?.[0];
    const scoreCp = analysis?.lines?.[0]?.numericScore;
    const redPct = redShare(scoreCp);
    const topPct = flipped ? redPct : 100 - redPct;
    const redAhead = (scoreCp || 0) >= 0;
    const displayBoard = replay ? previewReplayBoard() : board;
    const replayStep = replay && replay.index > 0 ? replay.route.steps[replay.index - 1] : null;
    const arrowMove = replay ? replayStep?.move : hintMove;
    const trayHtml = TRAY.map((group) => group.types.map((type) => {
      const active = tray?.type === type && tray?.color === group.color ? " active" : "";
      return `<button type="button" class="analysis-tray-btn ${group.color}${active}" data-tray-type="${type}" data-tray-color="${group.color}">${PIECE_LABELS[group.color][type]}</button>`;
    }).join("")).join("");

    const points = [];
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const entry = displayBoard[row][col];
        const legal = !replay && legalTargets.some((item) => item.toRow === row && item.toCol === col);
        const classes = [
          "board-point",
          !replay && selected?.row === row && selected?.col === col ? "selected" : "",
          legal ? (entry ? "capture" : "legal") : "",
          arrowMove?.fromRow === row && arrowMove?.fromCol === col ? "last-from replay-from" : "",
          arrowMove?.toRow === row && arrowMove?.toCol === col ? "last-to replay-to" : "",
          !replay && suspects.has(`${row},${col}`) ? "selected" : "",
          !replay && !editing && !tray && entry?.color === sideToMove ? "selectable" : "",
        ].filter(Boolean).join(" ");
        points.push(`<button type="button" class="${classes}" data-row="${row}" data-col="${col}" style="${pointStyle(row, col)}">${entry ? `<span class="piece ${entry.color}-piece">${entry.label}</span>` : ""}</button>`);
      }
    }

    const lines = analysis?.lines || [];
    const tools = window.QiliReviewCoach;
    const engineLocked = Boolean(analysis?.locked || (window.QiliPremium && !window.QiliPremium.can("engine")));
    const coachLocked = Boolean(window.QiliPremium && !window.QiliPremium.can("coach"));
    let coachHtml;
    if (engineLocked || coachLocked) {
      coachHtml = window.QiliPremium?.lockedCardHtml?.(engineLocked ? "engine" : "coach") || `<article class="coach-empty"><h3>引擎评估是 Pro</h3><p>可以继续摆棋、走子。评估条和讲解需要开通棋理 Pro。</p></article>`;
    } else if (analysis?.error && !coachAnalysis) {
      coachHtml = `<article class="coach-empty"><h3>还不能分析</h3><p>${escapeHtml(analysis.error)}</p></article>`;
    } else if (coachAnalysis?.pending) {
      coachHtml = `<article class="coach-card move-summary-card">
          <span class="beginner-judgment">正在讲解</span>
          <h3>${escapeHtml(coachAnalysis.moveNotation || "这一手")}</h3>
          <p>正在比较你的走法与更好的选择…</p>
        </article>
        <details class="coach-explanation" open>
          <summary>为什么？</summary>
          <div class="explanation-body"><p>正在把这一步翻译成棋理…</p></div>
        </details>`;
    } else if (coachAnalysis?.error) {
      coachHtml = `<article class="coach-empty"><h3>暂时无法讲解</h3><p>${escapeHtml(coachAnalysis.error)}</p></article>`;
    } else if (coachAnalysis && tools?.panelHtml) {
      coachHtml = tools.panelHtml(coachAnalysis);
    } else {
      coachHtml = tools?.emptyHtml?.() || `<article class="coach-empty">
          <h3>${analyzing ? "正在计算" : canExplore ? "等待你的下一步" : "摆好双方将帅"}</h3>
          <p>${analyzing ? "Pikafish 正在算这一手。" : canExplore ? "在棋盘上走子，评估和首选会跟着变。" : "棋盘上必须各有一枚帅/将。"}</p>
          <ul>
            <li>为什么</li>
            <li>更好的选择</li>
            <li>棋理建议</li>
          </ul>
        </article>`;
    }
    if (!editing && !replay && lines.length && !engineLocked) {
      coachHtml += `<div class="candidate-list">
        ${lines.map((line, index) => `
          <button type="button" class="candidate-row${index === selectedLine ? " active" : ""}" data-candidate="${index}">
            <span class="candidate-rank">${index + 1}</span>
            <strong>${escapeHtml(line.notation)}${(line.pvText || []).slice(1).length ? `<small>${escapeHtml(line.pvText.slice(1).join(" "))}</small>` : ""}</strong>
            <span class="candidate-score">${escapeHtml(line.score)}</span>
          </button>
        `).join("")}
      </div>
      <button type="button" class="button button-primary route-preview-trigger" data-play-best>走首选</button>`;
    }

    const moveCount = Math.max(0, nodes.length - 1);
    const moveRows = [];
    for (let index = 1; index < nodes.length; index += 2) {
      const red = nodes[index];
      const black = nodes[index + 1];
      moveRows.push(`<div class="move-row">
        <span class="move-number">${Math.ceil(index / 2)}.</span>
        <button type="button" class="red-move${cursor === index ? " active" : ""}" data-goto="${index}">${escapeHtml(red?.notation || "")}</button>
        ${black
          ? `<button type="button" class="black-move${cursor === index + 1 ? " active" : ""}" data-goto="${index + 1}">${escapeHtml(black.notation || "")}</button>`
          : `<span class="black-move"></span>`}
      </div>`);
    }
    const lastLabel = nodes[cursor]?.notation
      ? `${nodes[cursor].color === "red" ? "红" : "黑"} ${nodes[cursor].notation}`
      : (editing ? "点棋盘放子，或从左侧选子" : "请选择一个棋子开始");

    root.innerHTML = `
      <aside class="panel left-panel">
        <section>
          <div class="section-heading">
            <div>
              <span class="eyebrow">局面研究</span>
              <h2>分析</h2>
            </div>
            <span class="status-badge">${editing ? "摆盘" : sideToMove === "red" ? "红方走棋" : "黑方走棋"}</span>
          </div>
          ${editing ? `<div class="analysis-tray">${trayHtml}
            <button type="button" class="analysis-tool${tray === "erase" ? " active" : ""}" data-tray-erase>橡皮</button>
          </div>` : `<div class="analysis-toggle-row">
            <div>
              <strong>轮到谁走</strong>
              <span>引擎按这一方计算</span>
            </div>
          </div>
          <div class="analysis-turn-switch">
            <button type="button" class="${sideToMove === "red" ? "active" : ""}" data-side="red">红走</button>
            <button type="button" class="${sideToMove === "black" ? "active" : ""}" data-side="black">黑走</button>
          </div>`}
          <label class="analysis-dropzone${recognizing ? " dragover" : ""}" data-dropzone>
            ${screenshotUrl ? `<img class="analysis-preview" alt="棋盘截图" src="${screenshotUrl}">` : "<strong>粘贴截图填盘</strong>"}
            <input id="analysisScreenshotInput" type="file" accept="image/png,image/jpeg,image/webp" hidden>
          </label>
          ${screenshotNote ? `<p class="analysis-warning">${escapeHtml(screenshotNote)}</p>` : ""}
        </section>

        <section class="history-section">
          <div class="section-heading compact">
            <div>
              <span class="eyebrow">本局记录</span>
              <h2>本局棋谱</h2>
            </div>
            <span class="muted-count">${moveCount} 手</span>
          </div>
          <div class="move-history${moveRows.length ? "" : " empty-state"}">
            ${moveRows.length ? moveRows.join("") : "还没有试走。直接在棋盘上走，或点引擎首选。"}
          </div>
        </section>

        <div class="left-actions">
          ${editing ? `
            <button type="button" class="button button-primary action-wide" data-toggle-edit>完成摆盘</button>
            <button type="button" class="button button-secondary" data-setup-start>标准开局</button>
            <button type="button" class="button button-ghost" data-setup-empty>空棋盘</button>
            <button type="button" class="button button-ghost" data-flip-view>翻转</button>
          ` : `
            <button type="button" class="button button-primary" data-takeback ${cursor === 0 ? "disabled" : ""}>悔棋</button>
            <button type="button" class="button button-ghost" data-step="-1" ${cursor === 0 ? "disabled" : ""}>上一步</button>
            <button type="button" class="button button-ghost" data-step="1" ${cursor >= nodes.length - 1 ? "disabled" : ""}>下一步</button>
            <button type="button" class="button button-ghost" data-goto="0">重来</button>
            <button type="button" class="button button-ghost" data-flip-view>翻转</button>
            <button type="button" class="button button-ghost" data-toggle-edit>摆盘</button>
          `}
        </div>
      </aside>

      <section class="board-column">
        <div class="board-toolbar">
          <div>
            <span class="turn-dot ${sideToMove}"></span>
            <strong>${sideToMove === "red" ? "轮到红方" : "轮到黑方"}</strong>
          </div>
          <div class="evaluation-pill">
            <span>${engineLocked ? "局势" : analyzing ? "计算中" : evalLabel(scoreCp)}</span>
            <strong>${engineLocked ? "Pro" : analyzing ? "…" : escapeHtml(formatScore(scoreCp))}</strong>
          </div>
        </div>

        <div class="board-area">
          <div class="analysis-board-cluster">
            ${engineLocked ? "" : `<div class="analysis-eval-bar ${redAhead ? "red-ahead" : "black-ahead"}" aria-label="评估条">
              <i style="height:${topPct}%"></i>
              <span>${analyzing ? "…" : escapeHtml(formatScore(scoreCp))}</span>
            </div>`}
            <div class="xiangqi-board" aria-label="分析棋盘">
              <svg class="board-lines" viewBox="0 0 800 900" preserveAspectRatio="none" aria-hidden="true">
                <g class="grid-lines">
                  <line x1="0" y1="0" x2="800" y2="0" /><line x1="0" y1="100" x2="800" y2="100" /><line x1="0" y1="200" x2="800" y2="200" />
                  <line x1="0" y1="300" x2="800" y2="300" /><line x1="0" y1="400" x2="800" y2="400" /><line x1="0" y1="500" x2="800" y2="500" />
                  <line x1="0" y1="600" x2="800" y2="600" /><line x1="0" y1="700" x2="800" y2="700" /><line x1="0" y1="800" x2="800" y2="800" />
                  <line x1="0" y1="900" x2="800" y2="900" /><line x1="0" y1="0" x2="0" y2="900" /><line x1="800" y1="0" x2="800" y2="900" />
                  <line x1="100" y1="0" x2="100" y2="400" /><line x1="100" y1="500" x2="100" y2="900" />
                  <line x1="200" y1="0" x2="200" y2="400" /><line x1="200" y1="500" x2="200" y2="900" />
                  <line x1="300" y1="0" x2="300" y2="400" /><line x1="300" y1="500" x2="300" y2="900" />
                  <line x1="400" y1="0" x2="400" y2="400" /><line x1="400" y1="500" x2="400" y2="900" />
                  <line x1="500" y1="0" x2="500" y2="400" /><line x1="500" y1="500" x2="500" y2="900" />
                  <line x1="600" y1="0" x2="600" y2="400" /><line x1="600" y1="500" x2="600" y2="900" />
                  <line x1="700" y1="0" x2="700" y2="400" /><line x1="700" y1="500" x2="700" y2="900" />
                  <line x1="300" y1="0" x2="500" y2="200" /><line x1="500" y1="0" x2="300" y2="200" />
                  <line x1="300" y1="700" x2="500" y2="900" /><line x1="500" y1="700" x2="300" y2="900" />
                </g>
                <text x="175" y="470" class="river-label">楚 河</text>
                <text x="625" y="470" class="river-label">汉 界</text>
              </svg>
              ${editing || !arrowMove ? "" : renderArrow(arrowMove)}
              <div class="board-points">${points.join("")}</div>
            </div>
          </div>
        </div>

        <div class="board-footer">
          <div class="board-footer-play${replay ? " hidden" : ""}">
            <span>${escapeHtml(lastLabel)}</span>
          </div>
          <div class="board-replay-bar${replay ? "" : " hidden"}">
            <div class="board-replay-copy">
              <span class="eyebrow">变化演示</span>
              <strong>${escapeHtml(replay?.title || "你的路线")}</strong>
              <span>${escapeHtml(replayStep?.notation || "起始局面")}</span>
            </div>
            <div class="board-replay-tabs">
              <button id="analysisReplayYour" class="button button-ghost${replay?.key === "your" ? " active" : ""}" type="button">你的路线</button>
              <button id="analysisReplayBest" class="button button-ghost${replay?.key === "best" ? " active" : ""}${coachAnalysis?.sameRoute ? " hidden" : ""}" type="button">最佳路线</button>
            </div>
            <div class="board-replay-controls">
              <button id="analysisReplayPrev" class="button button-ghost" type="button" ${replay && replay.index === 0 ? "disabled" : ""}>上一步</button>
              <output>${replay ? `${replay.index} / ${replay.route.steps.length}` : "0 / 0"}</output>
              <button id="analysisReplayNext" class="button button-primary" type="button" ${replay && replay.index >= replay.route.steps.length ? "disabled" : ""}>下一步</button>
              <button id="analysisReplayClose" class="button button-ghost" type="button">退出</button>
            </div>
          </div>
        </div>
      </section>

      <aside class="panel coach-panel">
        <div class="coach-header">
          <div class="coach-avatar">AI</div>
          <div>
            <span class="eyebrow">每一步的解释</span>
            <h2>AI Coach</h2>
          </div>
        </div>
        <div class="coach-content">${coachHtml}</div>
        <div class="engine-placeholder">
          <div>
            <span class="engine-dot"></span>
            <strong>分析状态</strong>
          </div>
          <span>${analyzing ? "Pikafish 正在计算…" : analysis?.error ? "等待局面" : "Pikafish · 深度 12"}</span>
        </div>
      </aside>
    `;
    root.classList.toggle("replay-active", Boolean(replay));
    bind();
    const explanation = root.querySelector(".coach-explanation");
    const advanced = root.querySelector(".coach-engine");
    if (explanation) explanation.open = explanationOpen || coachAnalysis?.pending || coachAnalysis?.aiCoach?.state === "loading";
    if (advanced) advanced.open = advancedOpen;
  }

  function bind() {
    root.querySelectorAll("[data-tray-type]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = { type: button.dataset.trayType, color: button.dataset.trayColor };
        tray = tray?.type === next.type && tray?.color === next.color ? null : next;
        selected = null;
        legalTargets = [];
        render();
      });
    });
    root.querySelector("[data-tray-erase]")?.addEventListener("click", () => {
      tray = tray === "erase" ? null : "erase";
      selected = null;
      legalTargets = [];
      render();
    });
    root.querySelector("[data-setup-start]")?.addEventListener("click", () => resetToBoard(createInitialBoard(), "red"));
    root.querySelector("[data-setup-empty]")?.addEventListener("click", () => resetToBoard(createEmptyBoard(), "red"));
    root.querySelector("[data-flip-view]")?.addEventListener("click", () => { flipped = !flipped; render(); });
    root.querySelector("[data-toggle-edit]")?.addEventListener("click", () => {
      editing = !editing;
      tray = null;
      selected = null;
      legalTargets = [];
      if (!editing) {
        nodes = [{ board: cloneBoard(board), sideToMove, notation: "", color: null }];
        cursor = 0;
        coachRequestId += 1;
        coachAnalysis = null;
        replay = null;
        void runAnalysis();
        return;
      }
      render();
    });
    root.querySelector("[data-takeback]")?.addEventListener("click", takeback);
    root.querySelector("[data-play-best]")?.addEventListener("click", () => playLine(selectedLine));
    root.querySelectorAll("[data-side]").forEach((button) => {
      button.addEventListener("click", () => {
        sideToMove = button.dataset.side;
        nodes = [{ board: cloneBoard(board), sideToMove, notation: "", color: null }];
        cursor = 0;
        render();
      });
    });
    root.querySelectorAll("[data-candidate]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.candidate);
        const line = analysis?.lines?.[index];
        if (!line) return;
        if (selectedLine === index && line.move) {
          playLine(index);
          return;
        }
        selectedLine = index;
        hintMove = line.move || null;
        render();
      });
    });
    root.querySelectorAll("[data-goto]").forEach((button) => {
      button.addEventListener("click", () => {
        restoreNode(Number(button.dataset.goto));
        afterExploreChange();
      });
    });
    root.querySelectorAll("[data-step]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = cursor + Number(button.dataset.step);
        if (next < 0 || next >= nodes.length) return;
        restoreNode(next);
        afterExploreChange();
      });
    });
    root.querySelectorAll("[data-route]").forEach((button) => {
      button.addEventListener("click", () => openReplay(button.dataset.route));
    });
    root.querySelector("#analysisReplayPrev")?.addEventListener("click", () => stepReplay(-1));
    root.querySelector("#analysisReplayNext")?.addEventListener("click", () => stepReplay(1));
    root.querySelector("#analysisReplayClose")?.addEventListener("click", closeReplay);
    root.querySelector("#analysisReplayYour")?.addEventListener("click", () => openReplay("your"));
    root.querySelector("#analysisReplayBest")?.addEventListener("click", () => openReplay("best"));

    const dropzone = root.querySelector("[data-dropzone]");
    const input = root.querySelector("#analysisScreenshotInput");
    dropzone?.addEventListener("click", () => input?.click());
    input?.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) void ingestImage(file);
      input.value = "";
    });
    dropzone?.addEventListener("dragover", (event) => { event.preventDefault(); dropzone.classList.add("dragover"); });
    dropzone?.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone?.addEventListener("drop", (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragover");
      const file = event.dataTransfer?.files?.[0];
      if (file) void ingestImage(file);
    });
    root.querySelectorAll("[data-row]").forEach((button) => {
      button.addEventListener("click", () => onSquare(Number(button.dataset.row), Number(button.dataset.col)));
    });
  }

  function resetToBoard(next, side = "red") {
    board = next;
    sideToMove = side;
    nodes = [{ board: cloneBoard(board), sideToMove, notation: "", color: null }];
    cursor = 0;
    selected = null;
    legalTargets = [];
    hintMove = null;
    analysis = null;
    coachRequestId += 1;
    coachAnalysis = null;
    replay = null;
    suspects = new Set();
    editing = false;
    render();
    void runAnalysis();
  }

  function takeback() {
    if (cursor <= 0) return;
    if (cursor === nodes.length - 1) nodes.pop();
    restoreNode(nodes.length - 1);
    afterExploreChange();
  }

  function playLine(index) {
    const line = analysis?.lines?.[index];
    if (!line?.move || editing) return;
    const notation = line.notation || formatMove(line.move, board);
    pushMove(line.move, notation);
    selectedLine = 0;
    afterExploreChange();
  }

  function afterExploreChange() {
    replay = null;
    void runAnalysis();
    if (!editing && cursor > 0 && nodes[cursor]?.move) {
      void runCoach(nodes[cursor - 1].board, nodes[cursor].move);
    } else {
      coachRequestId += 1;
      coachAnalysis = null;
    }
  }

  function previewReplayBoard() {
    if (!replay) return board;
    let working = cloneBoard(replay.sourceBoard);
    for (let index = 0; index < replay.index; index += 1) {
      const step = replay.route.steps[index];
      if (!step?.move) break;
      working = applyLegalMove(working, step.move);
    }
    return working;
  }

  function openReplay(routeKey) {
    const route = coachAnalysis?.routes?.[routeKey];
    if (!route?.steps?.length || !coachAnalysis?.sourceBoard) return;
    replay = {
      key: routeKey,
      route,
      index: 1,
      title: routeKey === "best" ? "最佳路线" : "你的路线",
      sourceBoard: cloneBoard(coachAnalysis.sourceBoard),
    };
    render();
  }

  function closeReplay() {
    if (!replay) return;
    replay = null;
    render();
  }

  function stepReplay(delta) {
    if (!replay) return;
    replay.index = Math.max(0, Math.min(replay.route.steps.length, replay.index + delta));
    render();
  }

  async function runCoach(sourceBoard, move) {
    if (window.QiliPremium && !window.QiliPremium.can("coach")) {
      coachAnalysis = null;
      render();
      return;
    }
    const tools = window.QiliReviewCoach;
    const requestId = ++coachRequestId;
    coachAnalysis = { pending: true, moveNotation: formatMove(move, sourceBoard) };
    render();
    if (!tools?.analyzeMove) {
      coachAnalysis = { error: "AI Coach 尚未加载。" };
      render();
      return;
    }
    try {
      const built = await tools.analyzeMove(sourceBoard, move, { depth: 12, routeLimit: 8 });
      if (requestId !== coachRequestId) return;
      built.aiCoach = { state: "loading" };
      built.ply = cursor;
      built.source = "analysis";
      coachAnalysis = built;
      window.QiliLearn?.ingestAnalysis?.(built);
      render();
      try {
        const ai = await tools.explain(built, "play");
        if (requestId !== coachRequestId) return;
        built.aiCoach = { state: "ready", ...ai };
      } catch (error) {
        if (requestId !== coachRequestId) return;
        built.aiCoach = error?.reason
          ? { state: "unavailable", reason: error.reason }
          : { state: "error", message: error instanceof Error ? error.message : "AI教练请求失败" };
      }
      render();
    } catch (error) {
      if (requestId !== coachRequestId) return;
      if (error?.status === 402 || error?.code === "pro-required") {
        coachAnalysis = null;
        window.QiliPremium?.open?.("coach");
      } else {
        coachAnalysis = { error: error instanceof Error ? error.message : "讲解失败" };
      }
      render();
    }
  }

  function onSquare(row, col) {
    if (replay) return;
    if (editing || tray) {
      if (tray === "erase") {
        board[row][col] = null;
        suspects.delete(`${row},${col}`);
        render();
        return;
      }
      if (tray) {
        board[row][col] = piece(tray.type, tray.color);
        suspects.delete(`${row},${col}`);
        render();
        return;
      }
      const entry = board[row][col];
      if (selected && (selected.row !== row || selected.col !== col)) {
        board[row][col] = board[selected.row][selected.col];
        board[selected.row][selected.col] = null;
        selected = null;
        render();
        return;
      }
      selected = entry ? { row, col } : null;
      render();
      return;
    }

    const entry = board[row][col];
    if (selected) {
      const move = legalTargets.find((item) => item.toRow === row && item.toCol === col);
      if (move) {
        pushMove(move, formatMove(move, board));
        afterExploreChange();
        return;
      }
    }
    if (entry && entry.color === sideToMove) {
      selected = { row, col };
      legalTargets = legalMovesAt(board, row, col);
    } else {
      selected = null;
      legalTargets = [];
    }
    render();
  }

  async function fileToImage(file) {
    const bitmap = await createImageBitmap(file);
    const max = 1280;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.84);
  }

  async function ingestImage(file) {
    if (!file?.type?.startsWith("image/")) {
      screenshotNote = "请上传棋盘截图。";
      editing = true;
      render();
      return;
    }
    recognizing = true;
    editing = true;
    screenshotNote = "正在识别棋盘，请稍候…";
    render();
    try {
      const dataUrl = await fileToImage(file);
      screenshotUrl = dataUrl;
      const response = await fetch(`${API}/api/coach/recognize-board`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "截图识别失败");
      board = boardFromPieces(payload.pieces);
      if (payload.sideToMove === "red" || payload.sideToMove === "black") sideToMove = payload.sideToMove;
      flipped = payload.redAtBottom === false;
      suspects = new Set((payload.pieces || []).filter((item) => Number(item.confidence) < 0.72).map((item) => `${item.row},${item.col}`));
      nodes = [{ board: cloneBoard(board), sideToMove, notation: "", color: null }];
      cursor = 0;
      analysis = null;
      hintMove = null;
      coachRequestId += 1;
      coachAnalysis = null;
      replay = null;
      const warnings = payload.warnings?.length ? payload.warnings.join(" ") : "";
      screenshotNote = `请核对棋盘后再开始研究。识别把握：${payload.confidence || "low"}。${warnings}`;
    } catch (error) {
      screenshotNote = error instanceof Error ? error.message : "截图识别失败，请手动摆盘。";
    } finally {
      recognizing = false;
      render();
    }
  }

  async function runAnalysis() {
    if (window.QiliPremium && !window.QiliPremium.can("engine")) {
      analysis = { locked: true };
      hintMove = null;
      analyzing = false;
      render();
      return;
    }
    const generals = countGenerals(board);
    if (generals.red !== 1 || generals.black !== 1) {
      analysis = { error: "棋盘上必须各有一枚帅和将。" };
      hintMove = null;
      render();
      return;
    }
    if (!engine?.analyze) {
      analysis = { error: "引擎客户端尚未加载。" };
      render();
      return;
    }
    const current = ++requestId;
    analyzing = true;
    selectedLine = 0;
    render();
    try {
      const result = await engine.analyze(board, sideToMove, { depth: 12, multiPv: 3, study: true });
      if (current !== requestId) return;
      const lines = (result.lines || []).filter((line) => line.parsedMove).map((line) => ({
        move: line.parsedMove,
        notation: formatMove(line.parsedMove, board),
        score: formatScore(line.numericScore),
        numericScore: line.numericScore,
        pvText: formatPv(board, sideToMove, line.pv || [line.move]),
      }));
      analysis = { lines };
      hintMove = lines[0]?.move || null;
      selectedLine = 0;
    } catch (error) {
      if (current !== requestId) return;
      if (error?.status === 402 || error?.code === "pro-required") {
        analysis = { locked: true };
        window.QiliPremium?.open?.("engine");
      } else {
        analysis = { error: error instanceof Error ? error.message : "分析失败" };
      }
    } finally {
      if (current === requestId) analyzing = false;
      render();
    }
  }

  document.addEventListener("paste", (event) => {
    if (root.classList.contains("hidden")) return;
    const file = [...(event.clipboardData?.items || [])].find((item) => item.type.startsWith("image/"))?.getAsFile();
    if (file) {
      event.preventDefault();
      void ingestImage(file);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (root.classList.contains("hidden") || editing) return;
    if (replay) {
      if (event.key === "ArrowLeft") stepReplay(-1);
      if (event.key === "ArrowRight") stepReplay(1);
      if (event.key === "Escape") closeReplay();
      return;
    }
    if (event.key === "ArrowLeft" && cursor > 0) {
      restoreNode(cursor - 1);
      afterExploreChange();
    }
    if (event.key === "ArrowRight" && cursor < nodes.length - 1) {
      restoreNode(cursor + 1);
      afterExploreChange();
    }
  });

  render();
  void runAnalysis();
}
