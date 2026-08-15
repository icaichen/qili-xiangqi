const XIANGQI_BEGINNER_CURRICULUM = {
  16: {
    name: "规则与走子",
    goals: [
      "认识棋盘、九宫、河界和全部棋子",
      "正确走动车马炮兵帅仕相",
      "理解简单吃子与将帅不能照面",
      "区分强子与弱子",
      "在短对局中正确走动多个不同棋子",
    ],
  },
  15: {
    name: "吃子、将军与一步意图",
    goals: [
      "比较子力价值并做正确吃子选择",
      "识别单子一步杀和常见杀法术语",
      "规划单子连续吃子路线",
      "用车马炮兵完成将军",
      "简单说明一手棋的直接意图",
      "开始认识基础记谱",
    ],
  },
  14: {
    name: "应将、保护与交换",
    goals: [
      "正确应对将军并判断是否将死",
      "识别单子抽吃和两步吃",
      "掌握躲避、保护、交换",
      "避免己方强子无谓损失",
      "判断交换是否划算",
    ],
  },
  13: {
    name: "两子配合与基础布局",
    goals: [
      "掌握常见两子配合一步杀",
      "掌握单子两步杀",
      "掌握两子配合的2至3步抽吃",
      "认识顺炮、列炮等基础布局前5至7回合",
      "能够独立或在引导下完成完整对局",
    ],
  },
};

const PRIORITY = [
  "illegal-or-check",
  "major-piece-danger",
  "material-loss",
  "forced-tactic",
  "protection-exchange",
  "simple-intent",
  "basic-opening",
  "engine-preference-only",
];

function evidenceTypes(caseData) {
  return new Set((caseData?.evidenceCatalog || []).map((entry) => entry?.type).filter(Boolean));
}

function engineGap(caseData) {
  const value = Number(caseData?.move?.gap ?? caseData?.engine?.gap ?? caseData?.engine?.evaluationGap ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function hasAny(types, candidates) {
  return candidates.some((type) => types.has(type));
}

function selectTeachingFocus(caseData) {
  const types = evidenceTypes(caseData);
  const gap = engineGap(caseData);

  if (hasAny(types, ["check", "in-check", "mate", "forced-mate"])) {
    return {
      priority: "illegal-or-check",
      level: 14,
      concept: "先处理将军与强制手",
      teacherGoal: "让学生先看将军、应将和是否存在被迫回应，不讨论更抽象的布局优劣。",
    };
  }

  if (hasAny(types, ["hanging-mover", "lost-protection"])) {
    return {
      priority: "major-piece-danger",
      level: 14,
      concept: "保护强子，避免无谓丢子",
      teacherGoal: "指出具体哪枚棋子失去保护、谁在攻击它，并让学生先找躲、保、换三类办法。",
    };
  }

  if (hasAny(types, ["capture", "material-loss", "route-material-loss"])) {
    return {
      priority: "material-loss",
      level: 15,
      concept: "先算子力价值和连续吃子",
      teacherGoal: "比较这次吃子或交换的实际得失，只讲看得见的子力结果。",
    };
  }

  if (hasAny(types, ["fork", "pin", "skewer", "horse-leg-opened", "cannon-screen-change"])) {
    return {
      priority: "forced-tactic",
      level: 13,
      concept: "两子配合与连续威胁",
      teacherGoal: "用棋盘演示威胁对象和强制顺序，让学生看懂为什么对手不能同时解决所有问题。",
    };
  }

  if (hasAny(types, ["horse-leg-blocked", "elephant-eye-blocked", "open-rook-line"])) {
    return {
      priority: "protection-exchange",
      level: 14,
      concept: "保护、解除攻击和打开线路",
      teacherGoal: "只解释具体线路或保护关系的变化，不上升到抽象的长期战略。",
    };
  }

  if (gap <= 30) {
    return {
      priority: "engine-preference-only",
      level: 15,
      concept: "这步没有必要纠正",
      teacherGoal: "明确告诉学生这步可以下。除非存在当前阶段需要掌握的基础错误，否则不要因为引擎微小偏好强行教学。",
    };
  }

  return {
    priority: "simple-intent",
    level: 15,
    concept: "先说清这一步在直接做什么",
    teacherGoal: "如果没有可靠战术证据，只帮助学生理解双方下一步最直接的意图；不能把引擎偏好包装成确定棋理。",
  };
}

function curriculumPrompt(caseData) {
  const focus = selectTeachingFocus(caseData);
  const level = XIANGQI_BEGINNER_CURRICULUM[focus.level];
  return {
    focus,
    stage: {
      level: focus.level,
      name: level.name,
      goals: level.goals,
    },
    priorityOrder: PRIORITY,
    teachingRules: [
      "先判断学生有没有犯当前阶段的基础错误，再考虑引擎最佳着。",
      "如果一手棋基本可下，不要为了展示引擎差异而纠正学生。",
      "一次只教一个概念。",
      "先问学生看到了什么，再给答案；优先让学生自己找将军、吃子、受攻和保护。",
      "能用棋盘演示的内容不要只用文字说明。",
      "13至16级阶段优先具体、可见、可验证的问题，不优先讲抽象长期战略。",
    ],
  };
}

export { XIANGQI_BEGINNER_CURRICULUM, PRIORITY, selectTeachingFocus, curriculumPrompt };
