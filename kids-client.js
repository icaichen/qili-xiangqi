import { KIDS_CHAPTERS } from "./xiangqi-teaching-curriculum.mjs";

const rules = window.QiliTutorialRules;

if (!rules) {
  console.warn("Qili Kids: tutorial rules unavailable");
} else {
  const { ROWS, COLS, COLORS, createEmptyBoard, piece, generatePseudoMoves, applyMove, legalMovesForPiece, generateLegalMoves, isInCheck } = rules;

  const appShell = document.querySelector(".app-shell");
  const homeView = document.querySelector("#homeView");
  const topbarActions = document.querySelector(".topbar-actions");

  const entryButton = document.createElement("button");
  entryButton.id = "openKidsMode";
  entryButton.className = "button button-ghost kids-mode-entry";
  entryButton.textContent = "儿童模式";
  topbarActions?.prepend(entryButton);

  const kidsView = document.createElement("section");
  kidsView.id = "kidsView";
  kidsView.className = "platform-view kids-view hidden";
  homeView?.insertAdjacentElement("afterend", kidsView);

  const LESSONS = [
    {
      icon: "宫",
      title: "找到帅的小城堡",
      subtitle: "认识九宫",
      prompt: "帅住在自己的小城堡里。你能在棋盘上点到红方九宫吗？",
      tip: "红方九宫就在棋盘最下面中央的 3 × 3 交叉点区域。",
      mode: "zone",
      zone: (row, col) => row >= 7 && row <= 9 && col >= 3 && col <= 5,
      success: "找到了！帅不能跑出这座小城堡。",
      pieces: [[9, 4, "general", COLORS.RED]],
    },
    {
      icon: "帅",
      title: "帅怎么走？",
      subtitle: "九宫里走一步",
      prompt: "帅每次只能走一格。把红帅向左走一步，但别跑出九宫。",
      tip: "帅只能待在九宫里，每次只能横着或竖着走一格，不能斜着走。",
      mode: "move",
      legal: true,
      pieces: [[9, 4, "general", COLORS.RED], [0, 3, "general", COLORS.BLACK], [5, 3, "pawn", COLORS.RED]],
      expected: [9, 4, 9, 3],
      success: "对了！帅一步一步走，而且始终待在九宫里。",
    },
    {
      icon: "车",
      title: "让车冲上去",
      subtitle: "车走直线",
      prompt: "车最喜欢直线冲刺。点红车，再把它送到上面的星星位置。",
      tip: "车可以横着或直着走，只要路上没人挡住。",
      mode: "move",
      pieces: [[8, 4, "rook", COLORS.RED]],
      expected: [8, 4, 3, 4],
      success: "漂亮！车沿直线一路冲到了目标。",
    },
    {
      icon: "马",
      title: "让小马跳一个日",
      subtitle: "马的基本走法",
      prompt: "先看看小马怎么跳。点红马，把它跳到左上方的星星。",
      tip: "马走一个“日”字：先沿一个方向走一格，再斜着拐出去一格。",
      mode: "move",
      pieces: [[7, 4, "horse", COLORS.RED]],
      expected: [7, 4, 5, 3],
      success: "跳到了！先记住马的“日”字路线，下一关再看它什么时候会被挡住。",
    },
    {
      icon: "马",
      title: "谁绊住了小马？",
      subtitle: "认识蹩马腿",
      prompt: "小马想往左上跳，可它被绊住了。点出真正挡住它的棋子。",
      tip: "马虽然会走“日”，但紧挨着它的马腿位置不能被堵住。",
      mode: "identify",
      pieces: [[7, 4, "horse", COLORS.RED], [6, 4, "pawn", COLORS.RED]],
      identify: [6, 4],
      success: "对，就是它！马腿被堵住，对应方向就跳不过去。",
    },
    {
      icon: "炮",
      title: "给炮搭一座桥",
      subtitle: "炮架",
      prompt: "红炮想吃掉黑车。中间刚好有一个棋子当炮架。试试看！",
      tip: "炮平时像车一样走；吃子时，中间必须刚好隔一个棋子。",
      mode: "move",
      pieces: [[7, 4, "cannon", COLORS.RED], [5, 4, "pawn", COLORS.RED], [2, 4, "rook", COLORS.BLACK]],
      expected: [7, 4, 2, 4],
      success: "命中！隔着一个炮架，炮才能跳过去吃子。",
    },
    {
      icon: "兵",
      title: "小兵过河啦",
      subtitle: "兵的变化",
      prompt: "这枚兵已经过河了。让它向左走一步。",
      tip: "兵没过河时只能向前；过河后可以向前、向左、向右，但永远不能后退。",
      mode: "move",
      pieces: [[4, 4, "pawn", COLORS.RED]],
      expected: [4, 4, 4, 3],
      success: "做对了！过河以后，小兵会多出左右两个方向。",
    },
    {
      icon: "吃",
      title: "第一次吃子",
      subtitle: "占领对方位置",
      prompt: "黑卒挡在前面。用红车把它吃掉。",
      tip: "吃子就是走到对方棋子所在的位置，并把那枚棋子拿走。",
      mode: "move",
      pieces: [[7, 2, "rook", COLORS.RED], [3, 2, "pawn", COLORS.BLACK]],
      expected: [7, 2, 3, 2],
      success: "吃到了！你的棋子会占据对方原来的位置。",
    },
    {
      icon: "将",
      title: "大声喊：将军！",
      subtitle: "认识将军",
      prompt: "把红车走到星星位置，让黑将立刻受到攻击。",
      tip: "当你的棋子下一步可以直接吃掉对方的将或帅，这就叫“将军”。",
      mode: "move",
      legal: true,
      verifyCheck: true,
      pieces: [[5, 0, "rook", COLORS.RED], [9, 4, "general", COLORS.RED], [6, 4, "pawn", COLORS.RED], [0, 4, "general", COLORS.BLACK]],
      expected: [5, 0, 5, 4],
      success: "将军！黑将现在必须马上想办法逃开或挡住攻击。",
    },
    {
      icon: "救",
      title: "快救救自己的帅",
      subtitle: "被将军必须应对",
      prompt: "黑车正在攻击红帅。把红帅移到安全的位置。",
      tip: "自己的帅被将军时，不能假装没看到。必须立刻躲开、挡住或吃掉威胁。",
      mode: "move",
      legal: true,
      pieces: [[9, 4, "general", COLORS.RED], [5, 4, "rook", COLORS.BLACK]],
      expected: [9, 4, 9, 3],
      success: "安全了！被将军时，第一件事永远是先救自己的帅。",
    },
    {
      icon: "照",
      title: "别让将帅面对面",
      subtitle: "将帅不能照面",
      prompt: "红帅和黑将站在同一条直线上。点出现在挡在他们中间的棋子。",
      tip: "将和帅不能在同一条直线上直接面对面，中间必须有棋子挡住。",
      mode: "identify",
      pieces: [[0, 4, "general", COLORS.BLACK], [9, 4, "general", COLORS.RED], [5, 4, "rook", COLORS.RED]],
      identify: [5, 4],
      success: "找到了！这枚车一旦离开这条线，就可能让将帅直接照面。",
    },
    {
      icon: "胜",
      title: "我的第一盘象棋",
      subtitle: "两步小对局",
      prompt: "先用红车吃掉黑兵，给黑将一个将军。系统会用一手合法应将回应你。",
      tip: "这次不是单独练走法。先制造将军，再观察对手怎么应对，最后找到将死。",
      mode: "mini-game",
      legal: true,
      pieces: [[9, 4, "general", COLORS.RED], [3, 3, "horse", COLORS.RED], [2, 0, "rook", COLORS.RED], [0, 4, "general", COLORS.BLACK], [0, 3, "rook", COLORS.BLACK], [0, 5, "cannon", COLORS.BLACK], [1, 0, "rook", COLORS.BLACK], [2, 4, "pawn", COLORS.BLACK]],
      expectedMoves: [[2, 0, 2, 4], [2, 4, 1, 4]],
      success: "将死！你完成了第一盘小棋局：将军、看对手回应，再找到最后一击。",
      finale: true,
    },
    {
      icon: "攻",
      title: "谁在攻击我？",
      subtitle: "看见对手的威胁",
      prompt: "红车正被一枚黑棋盯着。点出正在攻击红车的棋子。",
      tip: "走棋前先问一句：对手现在正在攻击我的哪枚棋？",
      mode: "identify",
      pieces: [[6, 4, "rook", COLORS.RED], [2, 4, "rook", COLORS.BLACK]],
      identify: [2, 4],
      failure: "沿着红车所在的直线找一找，哪枚黑棋可以直接走到红车的位置？",
      success: "看见了！黑车沿着直线正盯着你的红车。",
    },
    {
      icon: "护",
      title: "谁在保护我？",
      subtitle: "找到自己的后援",
      prompt: "红车虽然被攻击，但它并不是孤零零的。点出正在保护红车的红棋。",
      tip: "一枚棋子被吃以后，如果你能马上把对方吃回来，它就是被保护的。",
      mode: "identify",
      pieces: [[6, 4, "rook", COLORS.RED], [8, 3, "horse", COLORS.RED], [2, 4, "rook", COLORS.BLACK]],
      identify: [8, 3],
      failure: "想一想：如果黑车吃到红车的位置，哪枚红棋下一步能跳到那里？",
      success: "对！红马守着红车的位置，这就是保护。",
    },
    {
      icon: "赚",
      title: "这枚棋可以白吃",
      subtitle: "吃掉没人保护的棋",
      prompt: "这枚黑炮没有同伴保护。用红车把它吃掉。",
      tip: "能吃到对方棋子，而且对手不能马上把你吃回来，通常就是一次赚子。",
      mode: "move",
      pieces: [[6, 2, "rook", COLORS.RED], [3, 2, "cannon", COLORS.BLACK]],
      expected: [6, 2, 3, 2],
      success: "赚到了！红车吃掉黑炮后，没有黑棋能立刻把它吃回来。",
    },
    {
      icon: "回",
      title: "等等，对方会反吃",
      subtitle: "吃之前先找保护者",
      prompt: "红车看起来能吃黑炮，但先别急。点出吃完以后能马上反吃红车的黑棋。",
      tip: "看到能吃的棋先别马上动手。先看目标后面有没有对方的保护者。",
      mode: "identify",
      pieces: [[7, 4, "rook", COLORS.RED], [4, 4, "cannon", COLORS.BLACK], [4, 0, "rook", COLORS.BLACK]],
      identify: [4, 0],
      failure: "假设红车已经站到黑炮的位置，再看哪枚黑棋能沿直线吃到那里。",
      success: "找到了！黑车保护着黑炮。红车如果贸然吃炮，就会被黑车吃回来。",
    },
    {
      icon: "换",
      title: "体验一次交换",
      subtitle: "我吃你，你再吃我",
      prompt: "用红车吃掉黑马。然后看看黑方会怎么把红车吃回来。",
      tip: "交换不是白吃：你拿掉对方一枚棋，对方也会拿掉你一枚棋。要比较双方交换掉的东西值不值得。",
      mode: "move",
      pieces: [[6, 2, "rook", COLORS.RED], [3, 2, "horse", COLORS.BLACK], [3, 0, "rook", COLORS.BLACK]],
      expected: [6, 2, 3, 2],
      autoReply: [3, 0, 3, 2],
      success: "看到了：红车吃马以后，黑车马上把红车吃回去。这就是一次交换。",
    },
    {
      icon: "算",
      title: "先算再吃",
      subtitle: "选安全的目标",
      prompt: "红车眼前有两个黑兵。一个被保护，一个没人保护。点出可以放心吃的那一个。",
      tip: "真正开始下棋以后，每次想吃子都先问：我吃完以后，对方能不能马上吃回来？",
      mode: "identify",
      pieces: [[7, 4, "rook", COLORS.RED], [4, 4, "pawn", COLORS.BLACK], [4, 0, "rook", COLORS.BLACK], [7, 7, "pawn", COLORS.BLACK]],
      identify: [7, 7],
      failure: "先看两个黑兵身后有没有保护者。被黑车保护的那个不是安全目标。",
      success: "判断正确！先看保护，再决定要不要吃，你已经开始像真正的棋手一样思考了。",
      finale: true,
    },
  ];

  const [CHAPTER1_META, CHAPTER2_META] = KIDS_CHAPTERS;
  const CHAPTER1_COUNT = CHAPTER1_META.lessonCount;
  const CHAPTER2_START = CHAPTER2_META.lessonStart;
  const CHAPTER2_COUNT = CHAPTER2_META.lessonCount;
  const CHAPTER2_END = CHAPTER2_START + CHAPTER2_COUNT;
  const conceptIds = KIDS_CHAPTERS.flatMap((chapter) => chapter.conceptIds);
  LESSONS.forEach((lesson, index) => {
    lesson.conceptId = conceptIds[index] || null;
  });
  const progressKey = "qili-kids-ch1-completed";
  const progressVersionKey = "qili-kids-ch1-version";
  const savedProgress = Number(localStorage.getItem(progressKey) || 0);
  const savedVersion = Number(localStorage.getItem(progressVersionKey) || 1);
  let completed;
  if (savedVersion < 3) {
    if (savedVersion < 2) completed = savedProgress >= 9 ? CHAPTER1_COUNT : 0;
    else completed = Math.max(0, Math.min(CHAPTER1_COUNT, savedProgress));
    localStorage.setItem(progressVersionKey, "3");
    localStorage.setItem(progressKey, String(completed));
  } else {
    completed = Math.max(0, Math.min(LESSONS.length, savedProgress));
  }
  let screen = "map";
  let lessonIndex = Math.min(completed, LESSONS.length - 1);
  let board = createEmptyBoard();
  let selected = null;
  let legalTargets = [];
  let lessonDone = false;
  let feedback = null;
  let moveStep = 0;

  function makeBoard(lesson) {
    const next = createEmptyBoard();
    (lesson.pieces || []).forEach(([row, col, type, color]) => {
      next[row][col] = piece(type, color);
    });
    return next;
  }

  function saveProgress() {
    localStorage.setItem(progressVersionKey, "3");
    localStorage.setItem(progressKey, String(completed));
  }

  function starsText() {
    return `${completed} / ${LESSONS.length}`;
  }

  function chapterFor(index) {
    if (index < CHAPTER2_START) return { number: 1, start: 0, count: CHAPTER1_COUNT };
    return { number: 2, start: CHAPTER2_START, count: CHAPTER2_COUNT };
  }

  function chapterCompletedCount(start, count) {
    return Math.max(0, Math.min(count, completed - start));
  }

  function openKids() {
    document.body.classList.add("kids-mode");
    document.querySelectorAll(".platform-view").forEach((view) => view.classList.add("hidden"));
    kidsView.classList.remove("hidden");
    if (window.location.hash !== "#kids") history.replaceState(null, "", "#kids");
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeKids() {
    document.body.classList.remove("kids-mode");
    kidsView.classList.add("hidden");
    window.XiangqiPlatform?.switchView?.("home");
    history.replaceState(null, "", "#home");
  }

  function startLesson(index) {
    if (index > completed) return;
    screen = "lesson";
    lessonIndex = Math.max(0, Math.min(LESSONS.length - 1, index));
    board = makeBoard(LESSONS[lessonIndex]);
    selected = null;
    legalTargets = [];
    lessonDone = false;
    feedback = null;
    moveStep = 0;
    render();
  }

  function markLessonComplete() {
    lessonDone = true;
    selected = null;
    legalTargets = [];
    if (lessonIndex === completed && completed < LESSONS.length) {
      completed += 1;
      saveProgress();
    }
    feedback = { kind: "success", title: "太棒了！", text: LESSONS[lessonIndex].success };
    render();
  }

  function fail(title, text) {
    feedback = { kind: "error", title, text };
    render();
  }

  function renderShell(inner) {
    kidsView.innerHTML = `
      <div class="kids-shell">
        <header class="kids-topbar">
          <button class="kids-brand" data-kids-home aria-label="回到儿童模式首页">
            <span class="kids-brand-piece">帅</span>
            <span><strong>棋理 Kids</strong><small>快乐学中国象棋</small></span>
          </button>
          <div class="kids-top-stats">
            <span class="kids-star-pill">★ <strong>${starsText()}</strong></span>
            <button class="kids-adult-exit" data-exit-kids>返回普通模式</button>
          </div>
        </header>
        ${inner}
      </div>`;

    kidsView.querySelector("[data-exit-kids]")?.addEventListener("click", closeKids);
    kidsView.querySelector("[data-kids-home]")?.addEventListener("click", () => {
      screen = "map";
      render();
    });
  }

  function renderMap() {
    const chapter1Completed = chapterCompletedCount(0, CHAPTER1_COUNT);
    const chapter2Completed = chapterCompletedCount(CHAPTER2_START, CHAPTER2_COUNT);
    const chapter1Done = chapter1Completed >= CHAPTER1_COUNT;
    const chapter2Done = chapter2Completed >= CHAPTER2_COUNT;
    const nextIndex = Math.min(completed, LESSONS.length - 1);
    function renderNodes(start, count, unlocked) {
      return LESSONS.slice(start, start + count).map((lesson, offset) => {
        const index = start + offset;
        const done = index < completed;
        const current = unlocked && index === completed && completed < start + count;
        const locked = !unlocked || index > completed;
        const stateClass = done ? "done" : current ? "current" : locked ? "locked" : "";
        const badge = done ? "✓" : locked ? "锁" : lesson.icon;
        return `
          <button class="kids-path-node ${stateClass}" data-kids-lesson="${index}" ${locked ? "disabled" : ""}>
            <span class="kids-node-bubble">${badge}</span>
            <span class="kids-node-copy"><strong>${lesson.title}</strong><small>${lesson.subtitle}</small></span>
            ${current ? '<span class="kids-current-tag">从这里开始</span>' : ""}
          </button>`;
      }).join("");
    }

    const chapter1Nodes = renderNodes(0, CHAPTER1_COUNT, true);
    const chapter2Nodes = renderNodes(CHAPTER2_START, CHAPTER2_COUNT, chapter1Done);
    const heroEyebrow = !chapter1Done ? "第一章 · 第一次走进象棋世界" : !chapter2Done ? "第二章 · 学会吃子和保护自己" : "前两章完成";
    const heroTitle = !chapter1Done ? "一起认识棋盘上的新朋友" : !chapter2Done ? "开始像棋手一样看威胁" : "你已经学会先看、再吃、再计算";
    const heroText = !chapter1Done ? "每次只学一个小规则。点棋盘、走一步、马上知道自己为什么做对。" : !chapter2Done ? "这一章不再只问棋子怎么走，而是练习攻击、保护、反吃和交换。" : "你已经完成基础规则和第一轮棋局思考训练。";
    const heroAction = !chapter1Done ? (completed ? "继续第一章" : "开始第一关") : !chapter2Done ? (chapter2Completed ? "继续第二章" : "开始第二章") : "重新挑战第二章";
    const resumeIndex = chapter2Done ? CHAPTER2_START : nextIndex;

    renderShell(`
      <main class="kids-map-page">
        <section class="kids-hero-card">
          <div class="kids-hero-copy">
            <span class="kids-eyebrow">${heroEyebrow}</span>
            <h1>${heroTitle}</h1>
            <p>${heroText}</p>
            <button class="kids-primary-action" data-kids-resume>${heroAction}</button>
          </div>
          <div class="kids-mascot-card" aria-label="棋理儿童陪练角色">
            <div class="kids-mascot-speech">${!chapter1Done ? "我叫棋仔，今天陪你走第一步。" : !chapter2Done ? "第二章开始啦：先看清楚，再决定要不要吃。" : "前两章的星星都点亮啦！"}</div>
            <div class="kids-mascot">
              <span class="kids-mascot-eye left"></span><span class="kids-mascot-eye right"></span><span class="kids-mascot-smile"></span><strong>车</strong>
            </div>
          </div>
        </section>

        <section class="kids-chapter-card">
          <div class="kids-chapter-head">
            <div><span>CHAPTER 1</span><h2>第一次走进象棋世界</h2><p>完成一关，就点亮一颗学习星星。</p></div>
            <div class="kids-chapter-progress"><strong>${chapter1Completed}</strong><span>/ ${CHAPTER1_COUNT} 颗星</span></div>
          </div>
          <div class="kids-progress-track"><i style="width:${(chapter1Completed / CHAPTER1_COUNT) * 100}%"></i></div>
          <div class="kids-path">${chapter1Nodes}</div>
        </section>

        <section class="kids-chapter-card">
          <div class="kids-chapter-head">
            <div><span>CHAPTER 2</span><h2>学会吃子和保护自己</h2><p>看懂攻击、保护、反吃和交换。</p></div>
            <div class="kids-chapter-progress"><strong>${chapter2Completed}</strong><span>/ ${CHAPTER2_COUNT} 颗星</span></div>
          </div>
          <div class="kids-progress-track"><i style="width:${(chapter2Completed / CHAPTER2_COUNT) * 100}%"></i></div>
          <div class="kids-path">${chapter2Nodes}</div>
        </section>
      </main>`);

    kidsView.querySelector("[data-kids-resume]")?.addEventListener("click", () => startLesson(resumeIndex));
    kidsView.querySelectorAll("[data-kids-lesson]").forEach((button) => {
      button.addEventListener("click", () => startLesson(Number(button.dataset.kidsLesson)));
    });
  }

  function positionPercent(row, col) {
    const inset = 6;
    const span = 88;
    return { left: `${inset + (col / (COLS - 1)) * span}%`, top: `${inset + (row / (ROWS - 1)) * span}%` };
  }

  function isLegalTarget(row, col) {
    return legalTargets.some((move) => move.toRow === row && move.toCol === col);
  }

  function renderBoard() {
    const lesson = LESSONS[lessonIndex];
    const points = [];
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const entry = board[row][col];
        const pos = positionPercent(row, col);
        const selectedClass = selected?.row === row && selected?.col === col ? " selected" : "";
        const targetClass = isLegalTarget(row, col) ? (entry ? " capture" : " legal") : "";
        const expected = lesson.mode === "mini-game" ? lesson.expectedMoves?.[moveStep] : lesson.expected;
        const isGoal = Boolean(expected && row === expected[2] && col === expected[3] && !lessonDone);
        const goalClass = isGoal ? " goal" : "";
        const occupiedGoalClass = isGoal && entry ? " occupied-goal" : "";
        points.push(`
          <button class="kids-board-point${selectedClass}${targetClass}${goalClass}${occupiedGoalClass}" data-board-row="${row}" data-board-col="${col}" aria-label="第 ${row + 1} 行，第 ${col + 1} 列${entry ? `，${entry.label}` : ""}" style="left:${pos.left};top:${pos.top}">
            ${entry ? `<span class="kids-piece ${entry.color}">${entry.label}</span>` : ""}
          </button>`);
      }
    }
    return `
      <div class="kids-board" aria-label="儿童互动象棋棋盘">
        <div class="kids-board-grid"></div>
        <div class="kids-palace-guide black" aria-hidden="true"></div>
        <div class="kids-palace-guide red" aria-hidden="true"></div>
        ${lesson.mode === "zone" && !lessonDone ? '<div class="kids-zone-highlight red-palace" aria-hidden="true"></div>' : ""}
        <div class="kids-river"><span>楚 河</span><span>汉 界</span></div>
        ${points.join("")}
      </div>`;
  }

  function renderLesson() {
    const lesson = LESSONS[lessonIndex];
    const chapter = chapterFor(lessonIndex);
    const localIndex = lessonIndex - chapter.start;
    const promptText = lesson.mode === "mini-game" && moveStep === 1 ? "黑车挡住了将军。现在用红车吃掉它，看看能不能结束小棋局。" : lesson.prompt;
    const message = feedback || { kind: "neutral", title: "轮到你啦", text: promptText };
    const coachMood = message.kind === "success" ? "happy" : message.kind === "error" ? "hint" : "neutral";
    const coachLabel = message.kind === "success" ? "棋仔也很开心" : message.kind === "error" ? "棋仔给你一点提示" : "棋仔的小提示";
    const coachNote = message.kind === "success" ? "这一步你已经掌握了。准备好就去下一关。" : message.kind === "error" ? "看看棋盘上的高亮和星星，再试一次。" : "先看棋盘，再看提示；不用一次记住全部规则。";
    renderShell(`
      <main class="kids-lesson-page">
        <button class="kids-back-map" data-back-map>← 回到学习地图</button>
        <div class="kids-lesson-progress-row">
          <span>第 ${chapter.number} 章 · 第 ${localIndex + 1} 关</span>
          <div class="kids-progress-track"><i style="width:${((localIndex + (lessonDone ? 1 : 0)) / chapter.count) * 100}%"></i></div>
          <strong>${localIndex + 1} / ${chapter.count}</strong>
        </div>

        <section class="kids-lesson-layout">
          <div class="kids-lesson-main">
            <div class="kids-lesson-title"><span class="kids-lesson-icon">${lesson.icon}</span><div><small>${lesson.subtitle}</small><h1>${lesson.title}</h1><p>${promptText}</p></div></div>
            ${renderBoard()}
            <div class="kids-feedback ${message.kind}"><span class="kids-feedback-face">${message.kind === "success" ? "★" : message.kind === "error" ? "!" : "?"}</span><div><strong>${message.title}</strong><p>${message.text}</p></div></div>
          </div>

          <aside class="kids-coach-card">
            <div class="kids-mini-mascot ${coachMood}"><strong>车</strong></div>
            <span>${coachLabel}</span>
            <h2>${lesson.tip}</h2>
            <p>${coachNote}</p>
            ${lessonDone ? `<button class="kids-primary-action" data-next-kids>${lesson.finale ? "领取通关星星" : "下一关"}</button>` : ""}
            <button class="kids-secondary-action" data-reset-kids>重新试一次</button>
          </aside>
        </section>
      </main>`);

    kidsView.querySelector("[data-back-map]")?.addEventListener("click", () => { screen = "map"; render(); });
    kidsView.querySelector("[data-reset-kids]")?.addEventListener("click", () => startLesson(lessonIndex));
    kidsView.querySelector("[data-next-kids]")?.addEventListener("click", () => {
      if (lesson.finale) {
        screen = "complete";
        render();
      } else {
        startLesson(lessonIndex + 1);
      }
    });
    kidsView.querySelectorAll("[data-board-row]").forEach((button) => {
      button.addEventListener("click", () => handleBoardClick(Number(button.dataset.boardRow), Number(button.dataset.boardCol)));
    });
  }

  function renderComplete() {
    const secondChapter = lessonIndex >= CHAPTER2_START;
    const starCount = secondChapter ? CHAPTER2_COUNT : CHAPTER1_COUNT;
    const replayIndex = secondChapter ? CHAPTER2_END - 1 : CHAPTER1_COUNT - 1;
    const stars = Array.from({ length: starCount }, () => "<span>★</span>").join("");
    renderShell(`
      <main class="kids-complete-page">
        <section class="kids-complete-card">
          <div class="kids-complete-stars" aria-label="${starCount} 颗学习星星">${stars}</div>
          <span class="kids-eyebrow">${secondChapter ? "第二章完成" : "第一章完成"}</span>
          <h1>${secondChapter ? "第二章通关！" : "第一章通关！"}</h1>
          <p>${secondChapter ? "你已经开始会看攻击、保护、反吃和交换，而不是看到能吃就马上吃。" : "你已经认识棋盘、会走第一批棋子，也完成了第一次将死。"}</p>
          <div class="kids-complete-skills">
            ${secondChapter ? "<span>看见攻击</span><span>找到保护</span><span>识别反吃</span><span>理解交换</span>" : "<span>帅与九宫</span><span>车、马、炮、兵</span><span>将军与应将</span><span>将帅不能照面</span>"}
          </div>
          <div class="kids-complete-actions">
            ${secondChapter ? '<button class="kids-primary-action" data-complete-map>回到学习地图</button>' : '<button class="kids-primary-action" data-complete-next>开始第二章</button><button class="kids-secondary-action" data-complete-map>回到学习地图</button>'}
            <button class="kids-secondary-action" data-complete-replay>再挑战最后一局</button>
          </div>
        </section>
      </main>`);
    kidsView.querySelector("[data-complete-map]")?.addEventListener("click", () => { screen = "map"; render(); });
    kidsView.querySelector("[data-complete-next]")?.addEventListener("click", () => startLesson(CHAPTER2_START));
    kidsView.querySelector("[data-complete-replay]")?.addEventListener("click", () => startLesson(replayIndex));
  }

  function handleBoardClick(row, col) {
    if (lessonDone) return;
    const lesson = LESSONS[lessonIndex];

    if (lesson.mode === "zone") {
      if (lesson.zone?.(row, col)) markLessonComplete();
      else fail("再找找", "帅的小城堡在红方底线中央，不在棋盘边上。" );
      return;
    }

    if (lesson.mode === "identify") {
      if (row === lesson.identify?.[0] && col === lesson.identify?.[1]) markLessonComplete();
      else fail("不是它", lesson.failure || "看看谁紧挨着小马，而且正好挡住了它要跳的方向。" );
      return;
    }

    const expected = lesson.mode === "mini-game" ? lesson.expectedMoves?.[moveStep] : lesson.expected;
    if (!expected) return;

    if (!selected) {
      if (row !== expected[0] || col !== expected[1]) {
        fail("先找到要动的棋子", "题目里已经告诉你今天要帮助哪一枚红棋。" );
        return;
      }
      selected = { row, col };
      legalTargets = lesson.legal ? legalMovesForPiece(board, row, col) : generatePseudoMoves(board, row, col);
      feedback = { kind: "neutral", title: "选中了！", text: "现在把它走到星星目标位置。亮起来的点都是这枚棋子按基础规则能到的位置。" };
      render();
      return;
    }

    if (row === selected.row && col === selected.col) {
      selected = null;
      legalTargets = [];
      feedback = null;
      render();
      return;
    }

    if (row !== expected[2] || col !== expected[3]) {
      if (isLegalTarget(row, col)) fail("这步能走，但不是今天的小任务", "看看闪着星星的目标点，再试一次。" );
      else fail("这里走不到", "这个位置不符合刚才学到的规则。看看棋仔的提示。" );
      return;
    }

    const move = legalTargets.find((candidate) => candidate.toRow === row && candidate.toCol === col);
    if (!move) {
      fail("差一点", "目标虽然对，但当前棋子的走法还不允许到这里。" );
      return;
    }

    board = applyMove(board, move).board;

    if (lesson.autoReply) {
      const [fromRow, fromCol, toRow, toCol] = lesson.autoReply;
      const reply = generatePseudoMoves(board, fromRow, fromCol).find((candidate) => candidate.toRow === toRow && candidate.toCol === toCol);
      if (!reply) {
        fail("交换没有完成", "系统没有找到预期的反吃，请重新试一次。" );
        return;
      }
      board = applyMove(board, reply).board;
      markLessonComplete();
      return;
    }

    if (lesson.verifyCheck && !isInCheck(board, COLORS.BLACK)) {
      fail("还没有形成将军", "这一步虽然能走，但黑将还没有真正受到攻击。" );
      return;
    }

    if (lesson.mode === "mini-game") {
      if (moveStep === 0) {
        if (!isInCheck(board, COLORS.BLACK)) {
          fail("还没有将军", "第一步要先让黑将进入被攻击状态。" );
          return;
        }
        const reply = generateLegalMoves(board, COLORS.BLACK).find((candidate) => candidate.fromRow === 1 && candidate.fromCol === 0 && candidate.toRow === 1 && candidate.toCol === 4);
        if (!reply) {
          fail("小棋局需要重来", "没有找到预期的合法应将。请重新试一次。" );
          return;
        }
        board = applyMove(board, reply).board;
        moveStep = 1;
        selected = null;
        legalTargets = [];
        feedback = { kind: "neutral", title: "对手挡住了！", text: "黑车赶来挡住将军。现在轮到你，再找最后一击。" };
        render();
        return;
      }

      const checkmate = isInCheck(board, COLORS.BLACK) && generateLegalMoves(board, COLORS.BLACK).length === 0;
      if (!checkmate) {
        fail("还没有结束", "黑方还有合法的应对。再看看有没有更强的一步。" );
        return;
      }
    }

    markLessonComplete();
  }

  function render() {
    if (screen === "lesson") renderLesson();
    else if (screen === "complete") renderComplete();
    else renderMap();
  }

  entryButton.addEventListener("click", openKids);

  if (window.location.hash === "#kids") openKids();
}
