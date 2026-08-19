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
  let phase = "setup";
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
  let history = [];
  let requestId = 0;

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

  function displayRow(row) {
    return flipped ? 9 - row : row;
  }

  function displayCol(col) {
    return flipped ? 8 - col : col;
  }

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
    const api = rules();
    if (!api?.generateLegalMoves) return [];
    return api.generateLegalMoves(source, color);
  }

  function legalMovesAt(source, row, col) {
    const api = rules();
    if (!api?.legalMovesForPiece) return [];
    return api.legalMovesForPiece(source, row, col);
  }

  function applyLegalMove(source, move) {
    const api = rules();
    if (!api?.applyMove) return source;
    return api.applyMove(source, move).board;
  }

  function inCheck(source, color) {
    return Boolean(rules()?.isInCheck?.(source, color));
  }

  function urgentFacts(source, color) {
    const facts = [];
    const ownLegal = legalMoves(source, color);
    const opponent = color === "red" ? "black" : "red";
    const opponentLegal = legalMoves(source, opponent);
    if (inCheck(source, color)) facts.push(color === "red" ? "红帅正在被将军" : "黑将正在被将军");
    if (!ownLegal.length) facts.push(inCheck(source, color) ? "没有合法应将，这是将死" : "没有合法着可走，按规则负");
    const hanging = [];
    opponentLegal.forEach((move) => {
      const target = source[move.toRow]?.[move.toCol];
      if (!target || target.color !== color || target.type === "general") return;
      const after = applyLegalMove(source, move);
      const recapture = legalMoves(after, color).some((reply) => reply.toRow === move.toRow && reply.toCol === move.toCol);
      if (!recapture) hanging.push(target.label);
    });
    if (hanging.length) facts.push(`有子可能被白吃：${[...new Set(hanging)].join("、")}`);
    const captures = ownLegal.filter((move) => source[move.toRow][move.toCol]).length;
    if (captures && !facts.some((text) => text.includes("将军") || text.includes("将死"))) {
      facts.push(`当前有 ${captures} 个直接吃子机会`);
    }
    if (!facts.length) facts.push("暂时没有一眼能看出的强制手，先比较候选着");
    return facts;
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

  function render() {
    const generals = countGenerals(board);
    const canAnalyze = generals.red === 1 && generals.black === 1 && !analyzing;
    const trayHtml = TRAY.map((group) => `
      <div class="analysis-tray-row">
        ${group.types.map((type) => {
          const active = tray?.type === type && tray?.color === group.color ? " active" : "";
          return `<button type="button" class="analysis-tray-btn ${group.color}${active}" data-tray-type="${type}" data-tray-color="${group.color}">${PIECE_LABELS[group.color][type]}</button>`;
        }).join("")}
      </div>
    `).join("");

    const points = [];
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const entry = board[row][col];
        const isSelected = selected?.row === row && selected?.col === col;
        const legal = legalTargets.some((item) => item.toRow === row && item.toCol === col);
        const capture = legal && entry;
        const classes = [
          "analysis-board-point",
          isSelected ? "selected" : "",
          legal ? "legal" : "",
          capture ? "capture" : "",
          hintMove && hintMove.fromRow === row && hintMove.fromCol === col ? "hint-from" : "",
          hintMove && hintMove.toRow === row && hintMove.toCol === col ? "hint-to" : "",
          suspects.has(`${row},${col}`) ? "suspect" : "",
        ].filter(Boolean).join(" ");
        points.push(`<button type="button" class="${classes}" data-row="${row}" data-col="${col}" style="${pointStyle(row, col)}" aria-label="${row + 1}行${col + 1}列${entry ? "，" + entry.label : ""}">${entry ? `<span class="analysis-piece ${entry.color}">${entry.label}</span>` : ""}</button>`);
      }
    }

    const resultHtml = analysis ? renderResult() : `
      <div class="analysis-empty">摆好棋盘、确认轮到谁，再开始分析。截图只用来填盘，分析前请看一眼棋子对不对。</div>
    `;

    root.innerHTML = `
      <div class="platform-page-header">
        <div>
          <span class="eyebrow">ANALYSIS · 棋盘分析</span>
          <h1>把一个局面放上来研究</h1>
          <p>截图或手动摆盘都可以。先核对棋盘，再让 Pikafish 看这一手。</p>
        </div>
        <span>${phase === "result" ? "可以试走" : "先摆盘"}</span>
      </div>
      <div class="analysis-workbench">
        <section class="platform-surface analysis-board-shell">
          <div class="analysis-tray">
            ${trayHtml}
            <div class="analysis-tray-row">
              <button type="button" class="analysis-tool${tray === "erase" ? " active" : ""}" data-tray-erase>橡皮</button>
              <button type="button" class="analysis-tool" data-setup-start>标准开局</button>
              <button type="button" class="analysis-tool" data-setup-empty>空棋盘</button>
              <button type="button" class="analysis-tool" data-flip-view>翻转视角</button>
            </div>
          </div>
          <div class="analysis-xiangqi-board" aria-label="分析棋盘">
            <svg class="analysis-board-lines" viewBox="0 0 800 900" preserveAspectRatio="none" aria-hidden="true">
              <g>
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
              <text x="175" y="470">楚 河</text>
              <text x="625" y="470">汉 界</text>
            </svg>
            <div class="analysis-board-points">${points.join("")}</div>
          </div>
          <div class="analysis-board-toolbar">
            <button type="button" class="button button-ghost" data-edit-board>${phase === "result" ? "继续改局面" : "摆盘中"}</button>
            ${history.length ? '<button type="button" class="button button-ghost" data-undo-try>撤消试走</button>' : ""}
          </div>
        </section>
        <aside class="platform-surface analysis-side">
          <div class="analysis-side-block">
            <span class="eyebrow">放上局面</span>
            <h2>截图填盘</h2>
            <label class="analysis-dropzone${recognizing ? " dragover" : ""}" data-dropzone>
              ${screenshotUrl ? `<img class="analysis-preview" alt="上传的棋盘截图" src="${screenshotUrl}">` : "<strong>拖进来、点选，或直接粘贴截图</strong>"}
              <span>识别后请核对虚线标出的可疑子。分析不会在核对前自动开始。</span>
              <input id="analysisScreenshotInput" type="file" accept="image/png,image/jpeg,image/webp" hidden>
            </label>
            ${screenshotNote ? `<p class="analysis-warning">${escapeHtml(screenshotNote)}</p>` : ""}
          </div>
          <div class="analysis-side-block">
            <span class="eyebrow">核对</span>
            <h2>轮到谁走</h2>
            <div class="analysis-turn-switch">
              <button type="button" class="${sideToMove === "red" ? "active" : ""}" data-side="red">红方</button>
              <button type="button" class="${sideToMove === "black" ? "active" : ""}" data-side="black">黑方</button>
            </div>
            <p class="analysis-note">${generals.red === 1 && generals.black === 1 ? "双方将帅都在。" : "棋盘上必须各有一枚帅/将，才能开始分析。"}</p>
            <button type="button" class="button button-primary" data-start-analysis ${canAnalyze ? "" : "disabled"}>${analyzing ? "Pikafish 计算中…" : "开始分析"}</button>
          </div>
          <div class="analysis-side-block">
            <span class="eyebrow">这一手</span>
            <h2>分析结果</h2>
            ${resultHtml}
          </div>
        </aside>
      </div>
    `;

    bind();
  }

  function renderResult() {
    if (analysis.error) {
      return `<div class="analysis-empty">${escapeHtml(analysis.error)}</div>`;
    }
    const facts = (analysis.facts || []).map((fact) => `<div class="analysis-urgent"><strong>${escapeHtml(fact)}</strong></div>`).join("");
    const lines = (analysis.lines || []).slice(0, 3).map((line, index) => {
      const active = hintMove && line.move?.fromRow === hintMove.fromRow && line.move?.toRow === hintMove.toRow && line.move?.fromCol === hintMove.fromCol && line.move?.toCol === hintMove.toCol;
      return `<button type="button" class="analysis-candidate${active ? " active" : ""}" data-candidate="${index}">
        <strong>${index === 0 ? "Pikafish 首选" : `候选 ${index + 1}`} · ${line.notation}</strong>
        <span class="analysis-score">${line.score}</span>
        <span>点一下看起点和落点。要看变化，直接在棋盘上试走。</span>
      </button>`;
    }).join("");
    const tries = history.map((item, index) => `<div class="analysis-try-row"><strong>${index + 1}. ${item.notation}</strong><span>${item.color === "red" ? "红" : "黑"}</span></div>`).join("");
    return `${facts}${lines || '<div class="analysis-empty">引擎没有返回候选着。</div>'}${tries ? `<div class="analysis-try-list">${tries}</div>` : ""}`;
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
    root.querySelector("[data-setup-start]")?.addEventListener("click", () => {
      board = createInitialBoard();
      resetAnalysis("已恢复标准开局。");
    });
    root.querySelector("[data-setup-empty]")?.addEventListener("click", () => {
      board = createEmptyBoard();
      resetAnalysis("棋盘已清空。");
    });
    root.querySelector("[data-flip-view]")?.addEventListener("click", () => {
      flipped = !flipped;
      render();
    });
    root.querySelector("[data-edit-board]")?.addEventListener("click", () => {
      phase = "setup";
      selected = null;
      legalTargets = [];
      hintMove = null;
      render();
    });
    root.querySelector("[data-undo-try]")?.addEventListener("click", () => {
      const previous = history.pop();
      if (!previous) return;
      board = previous.board;
      sideToMove = previous.color;
      hintMove = null;
      void runAnalysis();
    });
    root.querySelectorAll("[data-side]").forEach((button) => {
      button.addEventListener("click", () => {
        sideToMove = button.dataset.side;
        if (phase === "result") void runAnalysis();
        else render();
      });
    });
    root.querySelector("[data-start-analysis]")?.addEventListener("click", () => {
      phase = "result";
      history = [];
      void runAnalysis();
    });
    root.querySelectorAll("[data-candidate]").forEach((button) => {
      button.addEventListener("click", () => {
        const line = analysis?.lines?.[Number(button.dataset.candidate)];
        hintMove = line?.move || null;
        render();
      });
    });

    const dropzone = root.querySelector("[data-dropzone]");
    const input = root.querySelector("#analysisScreenshotInput");
    dropzone?.addEventListener("click", () => input?.click());
    input?.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) void ingestImage(file);
      input.value = "";
    });
    dropzone?.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropzone.classList.add("dragover");
    });
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

  function resetAnalysis(note = "") {
    phase = "setup";
    selected = null;
    legalTargets = [];
    hintMove = null;
    suspects = new Set();
    analysis = null;
    history = [];
    if (note) screenshotNote = note;
    render();
  }

  function onSquare(row, col) {
    if (phase === "result" && !tray) {
      onTrySquare(row, col);
      return;
    }

    if (tray === "erase") {
      board[row][col] = null;
      suspects.delete(`${row},${col}`);
      analysis = null;
      render();
      return;
    }

    if (tray) {
      board[row][col] = piece(tray.type, tray.color);
      suspects.delete(`${row},${col}`);
      analysis = null;
      render();
      return;
    }

    const entry = board[row][col];
    if (selected && (selected.row !== row || selected.col !== col)) {
      board[row][col] = board[selected.row][selected.col];
      board[selected.row][selected.col] = null;
      selected = null;
      analysis = null;
      render();
      return;
    }
    selected = entry ? { row, col } : null;
    render();
  }

  function onTrySquare(row, col) {
    const entry = board[row][col];
    if (selected) {
      const move = legalTargets.find((item) => item.toRow === row && item.toCol === col);
      if (move) {
        const notation = formatMove(move, board);
        history.push({ board: cloneBoard(board), color: sideToMove, notation });
        board = applyLegalMove(board, move);
        sideToMove = sideToMove === "red" ? "black" : "red";
        selected = null;
        legalTargets = [];
        hintMove = { fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol };
        void runAnalysis();
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
      render();
      return;
    }
    recognizing = true;
    screenshotNote = "正在识别棋盘，请稍候…";
    render();
    try {
      const dataUrl = await fileToImage(file);
      if (screenshotUrl) URL.revokeObjectURL(screenshotUrl);
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
      phase = "setup";
      analysis = null;
      history = [];
      hintMove = null;
      const warnings = payload.warnings?.length ? payload.warnings.join(" ") : "";
      screenshotNote = `请核对棋盘后再分析。识别把握：${payload.confidence || "low"}。${warnings}`;
    } catch (error) {
      screenshotNote = error instanceof Error ? error.message : "截图识别失败，请手动摆盘。";
    } finally {
      recognizing = false;
      render();
    }
  }

  async function runAnalysis() {
    const generals = countGenerals(board);
    if (generals.red !== 1 || generals.black !== 1) {
      analysis = { error: "棋盘上必须各有一枚帅和将。" };
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
    render();
    try {
      const result = await engine.analyze(board, sideToMove, { depth: 12, multiPv: 3 });
      if (current !== requestId) return;
      const lines = (result.lines || []).filter((line) => line.parsedMove).map((line) => ({
        move: line.parsedMove,
        notation: formatMove(line.parsedMove, board),
        score: formatScore(line.numericScore),
      }));
      analysis = {
        facts: urgentFacts(board, sideToMove),
        lines,
      };
      hintMove = lines[0]?.move || null;
      phase = "result";
    } catch (error) {
      if (current !== requestId) return;
      analysis = { error: error instanceof Error ? error.message : "分析失败" };
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

  render();
}
