import { KIDS_CHAPTERS, KIDS_PLAYABLE_LESSONS } from "./xiangqi-teaching-curriculum.mjs";

const rules = window.QiliTutorialRules;

if (!rules) {
  console.warn("Qili Kids: tutorial rules unavailable");
} else {
  const { ROWS, COLS, COLORS, createEmptyBoard, piece, generatePseudoMoves, applyMove, legalMovesForPiece, generateLegalMoves, isInCheck } = rules;

  const topbarActions = document.querySelector(".topbar-actions");
  const modePreferenceKey = "qili-kids-mode-enabled";

  const entryButton = document.createElement("button");
  entryButton.id = "openKidsMode";
  entryButton.className = "button button-ghost kids-mode-entry";
  entryButton.type = "button";
  entryButton.textContent = "儿童版";
  entryButton.setAttribute("aria-pressed", "false");
  topbarActions?.prepend(entryButton);

  const kidsView = document.querySelector("#kidsView");
  const INTRO_LESSON_COUNT = 2;
  const LEGACY_CHAPTER1_COUNT = 12;
  const LEGACY_TOTAL_LESSONS = 24;
  const LESSONS = KIDS_PLAYABLE_LESSONS;

  const [CHAPTER1_META, CHAPTER2_META, CHAPTER3_META] = KIDS_CHAPTERS;
  const CHAPTER1_COUNT = CHAPTER1_META.lessonCount;
  const CHAPTER2_START = CHAPTER2_META.lessonStart;
  const CHAPTER2_COUNT = CHAPTER2_META.lessonCount;
  const CHAPTER3_START = CHAPTER3_META.lessonStart;
  const CHAPTER3_COUNT = CHAPTER3_META.lessonCount;
  const CHAPTER3_END = CHAPTER3_START + CHAPTER3_COUNT;
  const progressKey = "qili-kids-ch1-completed";
  const progressVersionKey = "qili-kids-ch1-version";
  const savedProgress = Number(localStorage.getItem(progressKey) || 0);
  const savedVersion = Number(localStorage.getItem(progressVersionKey) || 1);
  let completed;
  if (savedVersion < 5) {
    let legacyCompleted;
    if (savedVersion < 2) legacyCompleted = savedProgress >= 9 ? LEGACY_CHAPTER1_COUNT : 0;
    else if (savedVersion < 3) legacyCompleted = Math.max(0, Math.min(LEGACY_CHAPTER1_COUNT, savedProgress));
    else legacyCompleted = Math.max(0, Math.min(LEGACY_TOTAL_LESSONS, savedProgress));
    completed = legacyCompleted > 0 ? Math.min(LESSONS.length, legacyCompleted + INTRO_LESSON_COUNT) : 0;
    localStorage.setItem(progressVersionKey, "5");
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
    localStorage.setItem(progressVersionKey, "5");
    localStorage.setItem(progressKey, String(completed));
  }

  function starsText() {
    return `${completed} / ${LESSONS.length}`;
  }

  function chapterFor(index) {
    if (index < CHAPTER2_START) return { number: 1, start: 0, count: CHAPTER1_COUNT };
    if (index < CHAPTER3_START) return { number: 2, start: CHAPTER2_START, count: CHAPTER2_COUNT };
    return { number: 3, start: CHAPTER3_START, count: CHAPTER3_COUNT };
  }

  function chapterCompletedCount(start, count) {
    return Math.max(0, Math.min(count, completed - start));
  }

  const kidsCopy = [
    [".platform-nav-item[data-view='home']", "我的首页"],
    [".platform-nav-item[data-view='play']", "去下棋"],
    [".platform-nav-item[data-view='train']", "小挑战"],
    [".platform-nav-item[data-view='learn']", "学习乐园"],
    [".platform-nav-item[data-view='review']", "看懂这盘"],
    [".platform-nav-item[data-view='analysis']", "棋盘研究"],
    [".platform-nav-item[data-view='profile']", "我的成长"],
    ["#quickPlayButton", "开始下一盘"],
    ["#openNotationButton", "记谱小课堂"],
  ];
  const kidsHtmlCopy = [
    [".home-hero .eyebrow", "棋理 KIDS · 下棋 / 学习 / 进步"],
    [".home-hero h1", "每走一步，<br>都能学会一点。"],
    [".home-hero>div:first-child>p", "先下一盘，再把没看懂的地方变成一堂小课。不是背答案，而是慢慢学会自己想。"],
    [".home-action-card:nth-child(1) h2", "来下一盘"],
    [".home-action-card:nth-child(1) p", "可以找棋友，也可以和电脑练习。大胆走，每一盘都算成长。"],
    [".home-action-card:nth-child(2) h2", "今天学一小课"],
    [".home-action-card:nth-child(2) p", "从棋子怎么走，到怎么看攻击和保护。一次学一个规则。"],
    [".home-action-card:nth-child(3) h2", "看看哪里能更好"],
    [".home-action-card:nth-child(3) p", "把刚才的棋重新看一遍，找到最值得学会的那一步。"],
    ["#profileView .platform-page-header h1", "我的成长记录"],
  ];

  function setKidsCopy(enabled) {
    kidsCopy.forEach(([selector, label]) => {
      const element = document.querySelector(selector);
      if (!element) return;
      if (!element.dataset.regularLabel) element.dataset.regularLabel = element.textContent.trim();
      element.textContent = enabled ? label : element.dataset.regularLabel;
    });
    const subtitle = document.querySelector(".brand span");
    if (subtitle) {
      if (!subtitle.dataset.regularLabel) subtitle.dataset.regularLabel = subtitle.textContent.trim();
      subtitle.textContent = enabled ? "KIDS · 边下边学" : subtitle.dataset.regularLabel;
    }
    kidsHtmlCopy.forEach(([selector, html]) => {
      const element = document.querySelector(selector);
      if (!element) return;
      if (!element.dataset.regularHtml) element.dataset.regularHtml = element.innerHTML;
      element.innerHTML = enabled ? html : element.dataset.regularHtml;
    });
  }

  function setKidsMode(enabled, persist = true) {
    document.body.classList.toggle("kids-mode", enabled);
    entryButton.classList.toggle("active", enabled);
    entryButton.setAttribute("aria-pressed", String(enabled));
    entryButton.textContent = enabled ? "切换普通版" : "儿童版";
    setKidsCopy(enabled);
    if (persist) localStorage.setItem(modePreferenceKey, enabled ? "1" : "0");
    window.dispatchEvent(new CustomEvent("qili-kids-mode-change", { detail: { enabled } }));
  }

  function openKids() {
    setKidsMode(true);
    // Paint first and repaint after the shell switches views. This keeps the
    // course usable even when an embedded history adapter throws during URL
    // synchronization or when navigation happens during boot.
    render();
    try {
      window.XiangqiPlatform?.switchView?.("kids");
    } finally {
      render();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeKids() {
    screen = "map";
    window.XiangqiPlatform?.switchView?.("home");
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
            <span class="kids-brand-piece">学</span>
            <span><strong>儿童课程</strong><small>学习中心 · 互动学习地图</small></span>
          </button>
          <div class="kids-top-stats">
            <span class="kids-star-pill">★ <strong>${starsText()}</strong></span>
            <button class="kids-adult-exit" data-exit-kids>返回儿童版首页</button>
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
    const chapter3Completed = chapterCompletedCount(CHAPTER3_START, CHAPTER3_COUNT);
    const chapter1Done = chapter1Completed >= CHAPTER1_COUNT;
    const chapter2Done = chapter2Completed >= CHAPTER2_COUNT;
    const chapter3Done = chapter3Completed >= CHAPTER3_COUNT;
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
    const chapter3Nodes = renderNodes(CHAPTER3_START, CHAPTER3_COUNT, chapter2Done);
    const heroEyebrow = !chapter1Done ? "第一章 · 第一次走进象棋世界" : !chapter2Done ? "第二章 · 学会吃子和保护自己" : !chapter3Done ? "第三章 · 听见将军，找到最后一击" : "前三章完成";
    const heroTitle = !chapter1Done ? "一起认识棋盘上的新朋友" : !chapter2Done ? "开始像棋手一样看威胁" : !chapter3Done ? "学会救帅，也学会赢下一局" : "你已经能看危险、救帅和完成将死";
    const heroText = !chapter1Done ? "每次只学一个小规则。点棋盘、走一步、马上知道自己为什么做对。" : !chapter2Done ? "这一章不再只问棋子怎么走，而是练习攻击、保护、反吃和交换。" : !chapter3Done ? "从看见将军开始，一次练一种应对办法，最后亲手完成一步将死。" : "你已经完成规则、安全和第一轮将杀训练。";
    const heroAction = !chapter1Done ? (completed ? "继续第一章" : "开始第一关") : !chapter2Done ? (chapter2Completed ? "继续第二章" : "开始第二章") : !chapter3Done ? (chapter3Completed ? "继续第三章" : "开始第三章") : "再挑战一步将死";
    const resumeIndex = chapter3Done ? CHAPTER3_END - 1 : nextIndex;

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

        <section class="kids-chapter-card">
          <div class="kids-chapter-head">
            <div><span>CHAPTER 3</span><h2>听见将军，找到最后一击</h2><p>练习逃、挡、吃，再亲手完成一步将死。</p></div>
            <div class="kids-chapter-progress"><strong>${chapter3Completed}</strong><span>/ ${CHAPTER3_COUNT} 颗星</span></div>
          </div>
          <div class="kids-progress-track"><i style="width:${(chapter3Completed / CHAPTER3_COUNT) * 100}%"></i></div>
          <div class="kids-path">${chapter3Nodes}</div>
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
    const tourFriend = lesson.mode === "piece-tour" && !lessonDone ? lesson.piecesToMeet?.[moveStep] : null;
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
        const tourTargetClass = tourFriend && row === tourFriend.at[0] && col === tourFriend.at[1] ? " tour-target" : "";
        const tourTwinClass = tourFriend && row === tourFriend.twinAt[0] && col === tourFriend.twinAt[1] ? " tour-twin" : "";
        points.push(`
          <button class="kids-board-point${selectedClass}${targetClass}${goalClass}${occupiedGoalClass}${tourTargetClass}${tourTwinClass}" data-board-row="${row}" data-board-col="${col}" aria-label="第 ${row + 1} 行，第 ${col + 1} 列${entry ? `，${entry.label}` : ""}${tourTargetClass ? "，当前要认识的棋子" : ""}" style="left:${pos.left};top:${pos.top}">
            ${entry ? `<span class="kids-piece ${entry.color}">${entry.label}</span>` : ""}
          </button>`);
      }
    }
    return `
      <section class="kids-board-stage">
        ${tourFriend ? `<div class="kids-tour-guide" aria-live="polite">
          <span class="kids-tour-count">${moveStep + 1} / ${lesson.piecesToMeet.length}</span>
          <div class="kids-tour-pair"><b>${tourFriend.label}</b><i>认识</i><b>${tourFriend.blackLabel}</b></div>
          <div><strong>${tourFriend.name}</strong><p>${tourFriend.job}</p><small>跟着箭头，点一下正在发光的红方棋子。</small></div>
        </div>` : ""}
        <div class="kids-board" aria-label="儿童互动象棋棋盘">
        <span class="kids-board-name" aria-hidden="true">棋仔练习场</span>
        <div class="kids-board-grid"></div>
        <div class="kids-palace-guide black" aria-hidden="true"></div>
        <div class="kids-palace-guide red" aria-hidden="true"></div>
        ${lesson.mode === "zone" && !lessonDone ? '<div class="kids-zone-highlight red-palace" aria-hidden="true"></div>' : ""}
        <div class="kids-river"><span>楚 河</span><span>汉 界</span></div>
        ${points.join("")}
        </div>
      </section>`;
  }

  function renderLesson() {
    const lesson = LESSONS[lessonIndex];
    const chapter = chapterFor(lessonIndex);
    const localIndex = lessonIndex - chapter.start;
    const guidedPrompt = lesson.mode === "piece-tour" ? lesson.piecesToMeet?.[moveStep]?.prompt : null;
    const sequencePrompt = lesson.mode === "identify-sequence" ? lesson.sequence?.[moveStep]?.prompt : null;
    const promptText = lesson.mode === "mini-game" && moveStep === 1 ? "黑车挡住了将军。现在用红车吃掉它，看看能不能结束小棋局。" : guidedPrompt || sequencePrompt || lesson.prompt;
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
    const chapter = chapterFor(lessonIndex);
    const chapterMeta = KIDS_CHAPTERS[chapter.number - 1];
    const starCount = chapter.count;
    const replayIndex = chapter.start + chapter.count - 1;
    const nextChapter = KIDS_CHAPTERS[chapter.number];
    const completionCopy = chapter.number === 1
      ? "你已经认识七位棋子朋友、知道他们的座位和走法，也完成了第一次将死。"
      : chapter.number === 2
        ? "你已经开始会看攻击、保护、反吃和交换，而不是看到能吃就马上吃。"
        : "你已经会看见将军，用逃、挡、吃来救帅，也能判断将军和将死。";
    const skillTags = chapter.number === 1
      ? "<span>七位棋子朋友</span><span>帅与九宫</span><span>车、马、炮、兵</span><span>将军与应将</span>"
      : chapter.number === 2
        ? "<span>看见攻击</span><span>找到保护</span><span>识别反吃</span><span>理解交换</span>"
        : "<span>看见将军</span><span>逃、挡、吃</span><span>区分将军与将死</span><span>一步将死</span>";
    const stars = Array.from({ length: starCount }, () => "<span>★</span>").join("");
    renderShell(`
      <main class="kids-complete-page">
        <section class="kids-complete-card">
          <div class="kids-complete-stars" aria-label="${starCount} 颗学习星星">${stars}</div>
          <span class="kids-eyebrow">第${["一", "二", "三"][chapter.number - 1]}章完成</span>
          <h1>${chapterMeta.title} · 通关！</h1>
          <p>${completionCopy}</p>
          <div class="kids-complete-skills">${skillTags}</div>
          <div class="kids-complete-actions">
            ${nextChapter ? `<button class="kids-primary-action" data-complete-next>开始第${["二", "三"][chapter.number - 1]}章</button><button class="kids-secondary-action" data-complete-map>回到学习地图</button>` : '<button class="kids-primary-action" data-complete-map>回到学习地图</button>'}
            <button class="kids-secondary-action" data-complete-replay>再挑战最后一局</button>
          </div>
        </section>
      </main>`);
    kidsView.querySelector("[data-complete-map]")?.addEventListener("click", () => { screen = "map"; render(); });
    kidsView.querySelector("[data-complete-next]")?.addEventListener("click", () => startLesson(nextChapter.lessonStart));
    kidsView.querySelector("[data-complete-replay]")?.addEventListener("click", () => startLesson(replayIndex));
  }

  function handleBoardClick(row, col) {
    if (lessonDone) return;
    const lesson = LESSONS[lessonIndex];

    if (lesson.mode === "piece-tour") {
      const friend = lesson.piecesToMeet?.[moveStep];
      if (!friend) return;
      if (row === friend.at[0] && col === friend.at[1]) {
        if (moveStep >= lesson.piecesToMeet.length - 1) {
          moveStep += 1;
          markLessonComplete();
        } else {
          moveStep += 1;
          const next = lesson.piecesToMeet[moveStep];
          feedback = { kind: "neutral", title: `认识${friend.label}啦！`, text: `${friend.job} 下一位是${next.name}，继续跟着箭头找。` };
          render();
        }
      } else if (row === friend.twinAt[0] && col === friend.twinAt[1]) {
        fail(`这是黑方的${friend.blackLabel}`, `它和红方的${friend.label}是一对朋友。现在先点箭头指着的红方${friend.label}。`);
      } else {
        fail("跟着会跳动的箭头", friend.hint);
      }
      return;
    }

    if (lesson.mode === "zone") {
      const { minRow, maxRow, minCol, maxCol } = lesson.zone;
      if (row >= minRow && row <= maxRow && col >= minCol && col <= maxCol) markLessonComplete();
      else fail("再找找", "帅的小城堡在红方底线中央，不在棋盘边上。" );
      return;
    }

    if (lesson.mode === "identify-sequence") {
      const target = lesson.sequence?.[moveStep];
      if (!target) return;
      if (row === target.at[0] && col === target.at[1]) {
        if (moveStep >= lesson.sequence.length - 1) {
          moveStep += 1;
          markLessonComplete();
        } else {
          moveStep += 1;
          const next = lesson.sequence[moveStep];
          feedback = { kind: "neutral", title: `找到${target.name}啦！`, text: `很好。下一位朋友是${next.name}：${next.prompt}` };
          render();
        }
      } else {
        fail("再看看它站在哪里", target.hint);
      }
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

    if (lesson.verifyMate) {
      const checkmate = isInCheck(board, COLORS.BLACK) && generateLegalMoves(board, COLORS.BLACK).length === 0;
      if (!checkmate) {
        fail("还没有将死", "黑方还有合法回应。重新试一次，看看怎样同时将军并守住出口。" );
        return;
      }
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

  entryButton.addEventListener("click", () => {
    const nextEnabled = !document.body.classList.contains("kids-mode");
    if (nextEnabled) {
      openKids();
      return;
    }
    setKidsMode(false);
    if (kidsView && !kidsView.classList.contains("hidden")) {
      screen = "map";
      window.XiangqiPlatform?.switchView?.("learn");
    }
  });
  window.QiliKids = { setMode: setKidsMode, openCourses: openKids, isEnabled: () => document.body.classList.contains("kids-mode") };
  window.dispatchEvent(new CustomEvent("qili-kids-ready"));

  const savedKidsMode = localStorage.getItem(modePreferenceKey) === "1";
  setKidsMode(savedKidsMode || window.location.hash === "#kids", false);
  if (window.location.hash === "#kids" || (savedKidsMode && window.location.hash === "#learn")) openKids();
}
