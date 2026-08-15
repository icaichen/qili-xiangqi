const rules = window.QiliTutorialRules;

if (rules) {
  const { ROWS, COLS, COLORS, createEmptyBoard, piece, generatePseudoMoves, applyMove } = rules;

  const workspace = document.querySelector("#lessonWorkspace");
  const rail = document.querySelector("#lessonStepRail");
  const progressText = document.querySelector("#lessonProgressText");
  const progressFill = document.querySelector("#lessonProgressFill");
  const kicker = document.querySelector("#lessonKicker");
  const title = document.querySelector("#lessonTitle");
  const instruction = document.querySelector("#lessonInstruction");
  const hintTitle = document.querySelector("#lessonHintTitle");
  const hint = document.querySelector("#lessonHint");
  const chips = document.querySelector("#lessonRuleChips");
  const boardElement = document.querySelector("#lessonBoard");
  const feedback = document.querySelector("#lessonFeedback");
  const previousButton = document.querySelector("#lessonPrev");
  const nextButton = document.querySelector("#lessonNext");
  const resetButton = document.querySelector("#lessonReset");
  const level16Button = document.querySelector('.curriculum-start[data-level="16"]');
  const curriculumDetail = document.querySelector("#curriculumDetail");
  const learnView = document.querySelector("#learnView");
  if (workspace && learnView && workspace.parentElement !== learnView) learnView.appendChild(workspace);

  const STEPS = [
    {
      title: "认识棋盘",
      instruction: "先点出红方九宫，再点出棋盘中央的河界。",
      hintTitle: "棋子落在交叉点",
      hint: "棋盘有 9 路、10 横线。九宫限制帅与仕；楚河汉界会改变兵的走法，也限制相不能过河。",
      chips: ["9 路 × 10 横线", "九宫", "楚河 · 汉界"],
      mode: "landmarks",
      pieces: [],
    },
    {
      title: "车走直线",
      instruction: "点击红车，再把它沿纵线走到上方目标位置。",
      hintTitle: "车：横直都能走，不能越子",
      hint: "车沿横线或纵线走任意距离，只要中间没有棋子挡住。",
      chips: ["横走", "直走", "不能越子"],
      mode: "moves",
      pieces: [[8, 4, "rook", COLORS.RED]],
      expectedMoves: [[8, 4, 3, 4]],
    },
    {
      title: "马为什么会被蹩住",
      instruction: "这匹马想向左上跳。点出真正挡住它的那枚棋子。",
      hintTitle: "马走日，但先看马腿",
      hint: "马不是无条件跳跃。与马相邻的正交位置如果被占住，对应方向的两个日字落点都会失效。",
      chips: ["马走日", "先看马腿", "会被堵"],
      mode: "identify",
      pieces: [[7, 4, "horse", COLORS.RED], [6, 4, "pawn", COLORS.RED]],
      identify: [6, 4],
    },
    {
      title: "相与仕的边界",
      instruction: "先把相走到左上，再把仕走到九宫中央。",
      hintTitle: "相不过河，仕不出九宫",
      hint: "相走田，还要检查象眼；仕只能在九宫内斜走一格。",
      chips: ["相走田", "相不过河", "仕守九宫"],
      mode: "moves",
      pieces: [[9, 2, "elephant", COLORS.RED], [9, 3, "advisor", COLORS.RED]],
      expectedMoves: [[9, 2, 7, 0], [9, 3, 8, 4]],
    },
    {
      title: "炮要隔一个子吃",
      instruction: "用红炮吃掉上方黑车。中间必须正好隔一个炮架。",
      hintTitle: "炮移动像车，吃子时必须翻山",
      hint: "炮不吃子时沿直线走；吃子时，炮与目标之间必须恰好有一个棋子。",
      chips: ["直线移动", "隔一子吃", "炮架"],
      mode: "moves",
      pieces: [[7, 4, "cannon", COLORS.RED], [5, 4, "pawn", COLORS.RED], [2, 4, "rook", COLORS.BLACK]],
      expectedMoves: [[7, 4, 2, 4]],
    },
    {
      title: "兵过河以后",
      instruction: "这枚兵已经过河。让它向左横走一步。",
      hintTitle: "兵未过河只向前，过河后可以左右",
      hint: "兵永远不能后退。过河前只能前进一步；过河后才增加左右移动。",
      chips: ["只能向前", "过河可左右", "不能后退"],
      mode: "moves",
      pieces: [[4, 4, "pawn", COLORS.RED]],
      expectedMoves: [[4, 4, 4, 3]],
    },
    {
      title: "将帅不能照面",
      instruction: "点出当前挡在将与帅之间、不能随便移走的红车。",
      hintTitle: "将和帅不能在同一路直接相望",
      hint: "如果双方主帅在同一纵线上，中间必须有棋子隔开。移走最后一个遮挡子会形成非法局面。",
      chips: ["帅守九宫", "将守九宫", "不能照面"],
      mode: "identify",
      pieces: [[9, 4, "general", COLORS.RED], [5, 4, "rook", COLORS.RED], [0, 4, "general", COLORS.BLACK]],
      identify: [5, 4],
    },
    {
      title: "小测验",
      instruction: "连续完成两手：先让车直进，再让马走一个没有被蹩住的日字。",
      hintTitle: "先检查限制，再决定落点",
      hint: "车看路径；马看马腿。真正会下棋，不只是记住形状，而是先检查这一步是否被规则限制。",
      chips: ["车看路径", "马看马腿", "合法落点"],
      mode: "moves",
      pieces: [[8, 0, "rook", COLORS.RED], [8, 4, "horse", COLORS.RED]],
      expectedMoves: [[8, 0, 4, 0], [8, 4, 6, 3]],
      quiz: true,
    },
  ];

  let state = {
    active: false,
    stepIndex: 0,
    board: createEmptyBoard(),
    selected: null,
    legal: [],
    moveIndex: 0,
    landmarkHits: new Set(),
    complete: false,
    message: null,
  };

  function currentStep() {
    return STEPS[state.stepIndex];
  }

  function makeBoard(step) {
    const next = createEmptyBoard();
    (step.pieces || []).forEach(([row, col, type, color]) => {
      next[row][col] = piece(type, color);
    });
    return next;
  }

  function setMessage(kind, heading, text) {
    state.message = { kind, heading, text };
  }

  function markComplete(text = "做对了。你已经掌握这一点。") {
    state.complete = true;
    state.selected = null;
    state.legal = [];
    setMessage("success", "正确", text);
    if (state.stepIndex === STEPS.length - 1) {
      localStorage.setItem("qili-level16-complete", "1");
      if (level16Button) level16Button.textContent = "重新练习";
    }
  }

  function resetStep() {
    state.board = makeBoard(currentStep());
    state.selected = null;
    state.legal = [];
    state.moveIndex = 0;
    state.landmarkHits = new Set();
    state.complete = false;
    state.message = null;
    render();
  }

  function loadStep(index) {
    state.stepIndex = Math.max(0, Math.min(STEPS.length - 1, index));
    resetStep();
  }

  function isLegalTarget(row, col) {
    return state.legal.some((move) => move.toRow === row && move.toCol === col);
  }

  function renderRail() {
    rail.innerHTML = STEPS.map((step, index) => {
      const active = index === state.stepIndex ? " active" : "";
      const done = index < state.stepIndex || (index === state.stepIndex && state.complete) ? " done" : "";
      return `<button class="lesson-step-item${active}${done}" data-step="${index}"><span>${index + 1}</span><strong>${step.title}</strong></button>`;
    }).join("");

    rail.querySelectorAll("[data-step]").forEach((button) => {
      button.addEventListener("click", () => loadStep(Number(button.dataset.step)));
    });
  }

  function renderBoard() {
    const step = currentStep();
    boardElement.innerHTML = "";

    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const point = document.createElement("button");
        point.className = "lesson-board-point";
        point.style.left = `${(col / (COLS - 1)) * 100}%`;
        point.style.top = `${(row / (ROWS - 1)) * 100}%`;
        point.setAttribute("aria-label", `教学棋盘第 ${row + 1} 行，第 ${col + 1} 列`);

        if (state.selected?.row === row && state.selected?.col === col) point.classList.add("selected");
        if (isLegalTarget(row, col)) point.classList.add(state.board[row][col] ? "capture" : "legal");
        if (step.mode === "landmarks" && state.landmarkHits.has("palace") && row === 8 && col === 4) point.classList.add("lesson-found");
        if (step.mode === "landmarks" && state.landmarkHits.has("river") && row === 4 && col === 4) point.classList.add("lesson-found");
        if (step.mode === "identify" && state.complete && step.identify?.[0] === row && step.identify?.[1] === col) point.classList.add("lesson-found");

        const entry = state.board[row][col];
        if (entry) {
          const token = document.createElement("span");
          token.className = `lesson-piece ${entry.color}`;
          token.textContent = entry.label;
          point.appendChild(token);
        }

        point.addEventListener("click", () => handleBoardClick(row, col));
        boardElement.appendChild(point);
      }
    }
  }

  function render() {
    if (!state.active) return;
    const step = currentStep();

    kicker.textContent = `第 ${state.stepIndex + 1} 课 · ${step.quiz ? "测验" : "基础"}`;
    title.textContent = step.title;
    instruction.textContent = step.instruction;
    hintTitle.textContent = step.hintTitle;
    hint.textContent = step.hint;
    chips.innerHTML = step.chips.map((chip) => `<span>${chip}</span>`).join("");
    progressText.textContent = `${state.stepIndex + 1} / ${STEPS.length}`;
    progressFill.style.width = `${((state.stepIndex + (state.complete ? 1 : 0)) / STEPS.length) * 100}%`;

    previousButton.disabled = state.stepIndex === 0;
    nextButton.disabled = !state.complete;
    nextButton.textContent = state.stepIndex === STEPS.length - 1 ? "完成课程" : "下一节";

    const message = state.message || { kind: "neutral", heading: "轮到你", text: step.instruction };
    feedback.className = `lesson-feedback ${message.kind}`;
    feedback.innerHTML = `<strong>${message.heading}</strong><span>${message.text}</span>`;

    renderRail();
    renderBoard();
  }

  function handleLandmarks(row, col) {
    let matched = false;

    if (!state.landmarkHits.has("palace") && row >= 7 && row <= 9 && col >= 3 && col <= 5) {
      state.landmarkHits.add("palace");
      setMessage("success", "找到九宫", "很好。红方帅和仕主要在这九个交叉点活动。现在再找河界。");
      matched = true;
    }

    if (!state.landmarkHits.has("river") && (row === 4 || row === 5)) {
      state.landmarkHits.add("river");
      setMessage("success", "找到河界", "正确。楚河汉界位于棋盘中央，它会改变兵的走法。");
      matched = true;
    }

    if (!matched) setMessage("error", "再看一眼", "先找红方九宫，以及棋盘中央的楚河汉界。");
    if (state.landmarkHits.size === 2) markComplete("九宫和河界都找到了。以后看任何局面，先知道这些边界在哪里。");
    render();
  }

  function handleIdentify(row, col) {
    const target = currentStep().identify;
    if (row === target?.[0] && col === target?.[1]) {
      markComplete("找对了。这个位置就是本题真正造成限制的关键。");
    } else {
      setMessage("error", "不是这里", "不要只看目标落点，找真正造成规则限制的那枚棋子。");
    }
    render();
  }

  function handleMove(row, col) {
    const step = currentStep();
    const expected = step.expectedMoves?.[state.moveIndex];
    if (!expected) return;

    if (!state.selected) {
      if (row !== expected[0] || col !== expected[1]) {
        setMessage("error", "先选对棋子", "按照题目提示，先点击需要走动的那枚红棋。");
        render();
        return;
      }
      state.selected = { row, col };
      state.legal = generatePseudoMoves(state.board, row, col);
      setMessage("neutral", "已经选中", "现在选择正确落点。高亮位置是这枚棋子当前规则允许的落点。");
      render();
      return;
    }

    if (row === state.selected.row && col === state.selected.col) {
      state.selected = null;
      state.legal = [];
      render();
      return;
    }

    if (row !== expected[2] || col !== expected[3]) {
      if (isLegalTarget(row, col)) {
        setMessage("error", "这步合法，但不是本题目标", "本题要你练习指定规则。根据提示再找一次目标位置。");
      } else {
        setMessage("error", "这一步不合法", "这个落点违反了刚学的走子规则。看看右侧提示，再试一次。");
      }
      render();
      return;
    }

    const move = state.legal.find((candidate) => candidate.toRow === row && candidate.toCol === col);
    if (!move) {
      setMessage("error", "当前不能这样走", "目标看起来接近，但当前棋盘条件不允许这一步。");
      render();
      return;
    }

    state.board = applyMove(state.board, move).board;
    state.moveIndex += 1;
    state.selected = null;
    state.legal = [];

    if (state.moveIndex >= step.expectedMoves.length) {
      markComplete(step.quiz ? "两手都正确。16级规则与走子课程完成。" : "走对了。这个规则你已经亲手验证过。" );
    } else {
      setMessage("success", "第一步正确", "继续完成这一节的下一手。");
    }
    render();
  }

  function handleBoardClick(row, col) {
    if (!state.active || state.complete) return;
    const step = currentStep();
    if (step.mode === "landmarks") return handleLandmarks(row, col);
    if (step.mode === "identify") return handleIdentify(row, col);
    return handleMove(row, col);
  }

  function startTutorial() {
    state.active = true;
    curriculumDetail?.classList.add("hidden");
    workspace?.classList.remove("hidden");
    loadStep(0);
    workspace?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  level16Button?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    startTutorial();
  }, true);

  previousButton?.addEventListener("click", () => loadStep(state.stepIndex - 1));
  nextButton?.addEventListener("click", () => {
    if (!state.complete) return;
    if (state.stepIndex < STEPS.length - 1) {
      loadStep(state.stepIndex + 1);
      return;
    }
    setMessage("success", "16级完成", "你已经掌握棋盘边界和七种棋子的基础走法。下一步可以进入15级：吃子、将军与一步意图。");
    render();
  });
  resetButton?.addEventListener("click", resetStep);

  if (level16Button) {
    level16Button.textContent = localStorage.getItem("qili-level16-complete") === "1" ? "重新练习" : "开始互动课";
  }
}
