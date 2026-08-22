const STORE_KEY = "qili-ability-v1";
const PROGRESS_KEY = "qili-learn-progress-v1";
const MIN_SAMPLES = 4;
const RECENT = 16;
const MAX_STORE = 400;

const ABILITY_SKILLS = [
  {
    id: "check",
    title: "将军识别",
    summary: "看见将军、正确应将。",
    types: ["check", "in-check", "missed-check", "failed-check-response", "mate", "forced-mate", "missed-mate"],
    harm: ["in-check", "missed-check", "failed-check-response", "missed-mate"],
    good: ["check", "mate", "forced-mate"],
    lessonId: "check-detection",
  },
  {
    id: "capture",
    title: "吃子判断",
    summary: "该吃的吃到，不该吃的不送。",
    types: ["capture", "unsafe-capture"],
    harm: ["unsafe-capture"],
    good: ["capture"],
    lessonId: "safe-capture",
  },
  {
    id: "protection",
    title: "保护意识",
    summary: "强子受攻时先看躲、保、换。",
    types: ["hanging-mover", "lost-protection", "unprotected-piece"],
    harm: ["hanging-mover", "lost-protection", "unprotected-piece"],
    good: [],
    lessonId: "hanging-piece",
  },
  {
    id: "exchange",
    title: "交换判断",
    summary: "吃完会不会被反吃，这笔交换划不划算。",
    types: ["material-loss", "route-material-loss", "missed-recapture", "bad-exchange"],
    harm: ["material-loss", "route-material-loss", "missed-recapture", "bad-exchange"],
    good: [],
    lessonId: "recapture-risk",
  },
  {
    id: "tactics",
    title: "战术配合",
    summary: "捉双、牵制、蹩马腿、炮架变化。",
    types: ["fork", "pin", "skewer", "horse-leg-opened", "horse-leg-blocked", "cannon-screen-change", "discovered-attack", "defender-removed"],
    harm: [],
    good: ["fork", "pin", "skewer", "horse-leg-opened", "cannon-screen-change", "discovered-attack"],
    lessonId: "discovered-attack",
  },
  {
    id: "opening",
    title: "开局出子",
    summary: "前十几手把车马炮走出来，别无谓重复走子。",
    types: ["development-loss", "basic-opening"],
    harm: ["development-loss"],
    good: [],
    lessonId: "development-tempo",
    opening: true,
  },
];

function typeSet(facts) {
  return new Set((facts || []).map((item) => item?.type).filter(Boolean));
}

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (raw?.version === 1 && Array.isArray(raw.samples)) {
      return { version: 1, samples: raw.samples, games: raw.games || {} };
    }
  } catch {
    /* ignore */
  }
  return { version: 1, samples: [], games: {} };
}

function saveStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify({
    version: 1,
    samples: store.samples.slice(-MAX_STORE),
    games: store.games || {},
  }));
}

function cloneBoard(source) {
  return source.map((row) => row.map((entry) => (entry ? { ...entry } : null)));
}

function initialBoard() {
  const board = Array.from({ length: 10 }, () => Array(9).fill(null));
  const back = ["rook", "horse", "elephant", "advisor", "general", "advisor", "elephant", "horse", "rook"];
  const labels = {
    red: { rook: "车", horse: "马", elephant: "相", advisor: "仕", general: "帅", cannon: "炮", pawn: "兵" },
    black: { rook: "车", horse: "马", elephant: "象", advisor: "士", general: "将", cannon: "炮", pawn: "卒" },
  };
  back.forEach((type, col) => {
    board[0][col] = { type, color: "black", label: labels.black[type] };
    board[9][col] = { type, color: "red", label: labels.red[type] };
  });
  board[2][1] = { type: "cannon", color: "black", label: "炮" };
  board[2][7] = { type: "cannon", color: "black", label: "炮" };
  board[7][1] = { type: "cannon", color: "red", label: "炮" };
  board[7][7] = { type: "cannon", color: "red", label: "炮" };
  [0, 2, 4, 6, 8].forEach((col) => {
    board[3][col] = { type: "pawn", color: "black", label: "卒" };
    board[6][col] = { type: "pawn", color: "red", label: "兵" };
  });
  return board;
}

function applySimple(board, move) {
  const next = cloneBoard(board);
  const moving = next[move.fromRow]?.[move.fromCol];
  if (!moving) return next;
  next[move.toRow][move.toCol] = moving;
  next[move.fromRow][move.fromCol] = null;
  return next;
}

function tacticalAdapters() {
  const rules = window.QiliTutorialRules;
  return {
    cloneBoard,
    applyMove: (board, move) => (rules?.applyMove ? rules.applyMove(board, move) : { board: applySimple(board, move) }),
    isInCheck: (board, color) => Boolean(rules?.isInCheck?.(board, color)),
    opposite: { red: "black", black: "red" },
    pieceValues: { general: 10000, rook: 900, cannon: 450, horse: 400, elephant: 220, advisor: 220, pawn: 100 },
  };
}

function classify(analysis) {
  const gap = Number(analysis.gap || 0);
  const ply = Number(analysis.ply || 0);
  const chosen = typeSet(analysis.chosenFacts);
  const reply = typeSet(analysis.replyFacts);
  const best = typeSet(analysis.bestFacts);
  const all = new Set([...chosen, ...reply, ...best]);
  const out = [];

  for (const skill of ABILITY_SKILLS) {
    const hitTypes = skill.types.filter((type) => all.has(type));
    const openingTrial = skill.opening && ply > 0 && ply <= 16;
    if (!hitTypes.length && !openingTrial) continue;

    const harmed = skill.harm.some((type) => chosen.has(type) || reply.has(type));
    const missed = skill.good.some((type) => best.has(type) && !chosen.has(type)) && gap >= 80;
    const didGood = skill.good.some((type) => chosen.has(type)) && gap < 50;

    let ok = null;
    if (harmed && gap >= 50) ok = false;
    else if (missed) ok = false;
    else if (didGood) ok = true;
    else if (openingTrial) ok = gap < 50;
    else if (gap < 30) ok = true;
    else if (gap >= 100) ok = false;
    if (ok == null) continue;

    out.push({
      t: Date.now(),
      skill: skill.id,
      ok,
      gap,
      type: hitTypes[0] || (openingTrial ? "opening-ply" : ""),
      source: analysis.source || "play",
      notation: analysis.moveNotation || "",
      gameId: analysis.gameId || null,
      ply,
    });
  }

  return out;
}

function ingest(analysis) {
  if (!analysis || analysis.pending || analysis.error) return;
  const next = classify(analysis);
  if (!next.length) return;
  const store = loadStore();
  if (analysis.gameId && Number.isFinite(analysis.ply) && analysis.ply > 0) {
    store.samples = store.samples.filter((item) => !(item.gameId === analysis.gameId && item.ply === analysis.ply));
  }
  store.samples.push(...next);
  saveStore(store);
  render();
}

function ingestGame(game, analysis) {
  const assessments = analysis?.assessments || [];
  const moves = Array.isArray(game?.moves) ? game.moves : [];
  if (!assessments.length || !moves.length) return 0;
  const gameId = String(game.id || game.startedAt || "");
  if (!gameId) return 0;
  const fingerprint = assessments.map((item) => `${item.ply}:${Math.round(Number(item.loss) || 0)}`).join(",");
  const store = loadStore();
  if (store.games?.[gameId] === fingerprint) {
    render();
    return 0;
  }

  const tactical = window.XiangqiTacticalAnalyzer;
  const engine = window.XiangqiEngineClient;
  const adapters = tacticalAdapters();
  const byPly = new Map(assessments.map((item) => [Number(item.ply), item]));
  let board = initialBoard();
  const batch = [];

  for (let index = 0; index < moves.length; index += 1) {
    const ply = index + 1;
    const move = moves[index]?.move;
    const assessment = byPly.get(ply);
    if (assessment && move) {
      const bestMove = assessment.bestMove && engine?.uciToMove
        ? engine.uciToMove(assessment.bestMove, board)
        : null;
      const chosen = tactical?.analyzeMove ? tactical.analyzeMove(board, move, adapters) : { facts: [] };
      const best = bestMove && tactical?.analyzeMove ? tactical.analyzeMove(board, bestMove, adapters) : { facts: [] };
      batch.push(...classify({
        ply,
        gap: Number(assessment.loss) || 0,
        source: "review",
        gameId,
        moveNotation: moves[index]?.notation || "",
        chosenFacts: chosen.facts || [],
        bestFacts: best.facts || [],
        replyFacts: [],
      }));
    }
    if (move) board = applySimple(board, move);
  }

  store.samples = store.samples.filter((item) => item.gameId !== gameId).concat(batch);
  store.games = { ...(store.games || {}), [gameId]: fingerprint };
  saveStore(store);
  render();
  return batch.length;
}

function learnedLesson(lessonId) {
  try {
    const progress = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null");
    return Boolean(progress?.completed?.[lessonId]);
  } catch {
    return false;
  }
}

function skillSnapshot(skill) {
  const samples = loadStore().samples.filter((item) => item.skill === skill.id).slice(-RECENT);
  const hits = samples.filter((item) => item.ok).length;
  const n = samples.length;
  const ready = n >= MIN_SAMPLES;
  const rate = n ? hits / n : 0;
  let label = "样本不足";
  let tone = "empty";
  if (ready) {
    if (rate >= 0.75) { label = "较稳"; tone = "good"; }
    else if (rate >= 0.5) { label = "一般"; tone = "ok"; }
    else { label = "偏弱"; tone = "weak"; }
  }
  const lastMiss = [...samples].reverse().find((item) => !item.ok);
  return {
    ...skill,
    n,
    hits,
    ready,
    rate,
    percent: ready ? Math.round(rate * 100) : null,
    label,
    tone,
    learned: learnedLesson(skill.lessonId),
    hint: lastMiss?.notation ? `最近 ${lastMiss.notation} 出过问题` : skill.summary,
  };
}

function snapshot() {
  const skills = ABILITY_SKILLS.map(skillSnapshot);
  const scored = skills.filter((item) => item.ready);
  const weakest = [...scored].sort((a, b) => a.rate - b.rate)[0] || null;
  const strongest = [...scored].sort((a, b) => b.rate - a.rate)[0] || null;
  return {
    skills,
    total: loadStore().samples.length,
    weakest,
    strongest,
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function openSkillLesson(lessonId) {
  window.XiangqiPlatform?.switchView?.("learn");
  window.QiliLearn?.openLesson?.(lessonId);
}

function profileHtml(state) {
  if (!state.total) {
    return `
      <div>
        <span class="eyebrow">能力画像</span>
        <h2>不是一个总分，而是六项能力</h2>
      </div>
      <div class="ability-empty">${ABILITY_SKILLS.map((skill) => `<span>${escapeHtml(skill.title)}</span>`).join("")}</div>
      <p>下过棋、出现过将军/吃子/悬子以后才会打分。不编百分比。</p>`;
  }

  const rows = state.skills.map((skill) => `
    <button type="button" class="ability-row ${skill.tone}" data-ability-lesson="${skill.lessonId}">
      <div class="ability-row-copy">
        <strong>${escapeHtml(skill.title)}</strong>
        <small>${skill.ready ? `${skill.n} 次局面 · ${escapeHtml(skill.hint)}` : `还差 ${MIN_SAMPLES - skill.n} 次局面`}${skill.learned ? " · 课程已学" : ""}</small>
      </div>
      <div class="ability-meter" aria-hidden="true"><i style="width:${skill.ready ? skill.percent : 0}%"></i></div>
      <em>${skill.ready ? `${skill.percent}` : "—"}</em>
    </button>
  `).join("");

  return `
    <div>
      <span class="eyebrow">能力画像</span>
      <h2>不是一个总分，而是六项能力</h2>
    </div>
    <div class="ability-list">${rows}</div>
    <p>来自你走过的棋，不是虚构数据。点一项可以去学习中心补对应课。</p>`;
}

function homeHtml(state) {
  if (!state.total || !state.weakest) {
    return `
      <div class="home-section-heading">
        <div><span class="eyebrow">GROWTH · 成长反馈</span><h2>我的成长</h2></div>
        <p>${state.total ? `已有 ${state.total} 个局面样本` : "来自真实对局与复盘"}</p>
      </div>
      <div class="home-growth-empty">
        <strong>${state.total ? "每项能力还需要更多样本" : "还没有足够的实战样本"}</strong>
        <p>完成对局并复盘后，才会展示将军、吃子、保护、交换、战术与开局能力。</p>
      </div>`;
  }
  const weak = state.weakest;
  const visible = state.skills.filter((skill) => skill.ready).sort((left, right) => left.rate - right.rate).slice(0, 3);
  const cards = visible.map((skill) => `
    <div class="home-ability-item ${skill.tone}">
      <span>${escapeHtml(skill.title)}</span>
      <strong>${skill.percent}</strong>
      <small>${escapeHtml(skill.label)} · 最近 ${skill.n} 次相关局面</small>
    </div>`).join("");
  return `
    <div class="home-section-heading">
      <div><span class="eyebrow">GROWTH · 成长反馈</span><h2>我的成长</h2></div>
      <p>根据最近实战局面，不是估算值</p>
    </div>
    <div class="home-ability-grid">${cards}</div>
    <div class="home-coach-note">
      <b>AI</b>
      <div><strong>主要问题是${escapeHtml(weak.title)}</strong><small>${escapeHtml(weak.hint)}</small></div>
      <button type="button" data-ability-lesson="${escapeHtml(weak.lessonId)}">去专项提升 →</button>
    </div>`;
}

function bindProfile(root) {
  root.querySelectorAll("[data-ability-lesson]").forEach((button) => {
    button.addEventListener("click", () => openSkillLesson(button.dataset.abilityLesson));
  });
}

function render() {
  const state = snapshot();
  const profile = document.querySelector("#profileAbilityCard");
  if (profile) {
    profile.innerHTML = profileHtml(state);
    bindProfile(profile);
  }
  const home = document.querySelector("#homeAbilityCard");
  if (home) {
    home.innerHTML = homeHtml(state);
    bindProfile(home);
  }
}

const originalIngest = window.QiliLearn?.ingestAnalysis;
if (window.QiliLearn) {
  window.QiliLearn.ingestAnalysis = (analysis) => {
    originalIngest?.(analysis);
    ingest(analysis);
  };
}

window.QiliAbility = {
  skills: ABILITY_SKILLS,
  ingest,
  ingestGame,
  snapshot,
  render,
};

window.addEventListener("qili-game-finished", render);
new MutationObserver(() => {
  const profile = document.querySelector("#profileView");
  if (profile && !profile.classList.contains("hidden")) render();
}).observe(document.querySelector("#profileView") || document.body, { attributes: true, attributeFilter: ["class"] });

render();
