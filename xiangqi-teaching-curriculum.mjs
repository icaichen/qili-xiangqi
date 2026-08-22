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

const ADULT_LEARN_STAGES = [
  {
    id: "foundation",
    order: 1,
    legacyLevel: 16,
    title: "基础规则与合法走子",
    summary: "棋盘、九宫、河界、七种棋子走法、吃子和将帅照面。",
    previewLessons: ["棋盘、九宫与河界", "七种棋子的合法走法", "吃子与将帅照面", "完成合法短对局"],
    goals: XIANGQI_BEGINNER_CURRICULUM[16].goals,
  },
  {
    id: "capture-intent",
    order: 2,
    legacyLevel: 15,
    title: "吃子、将军与一步意图",
    summary: "子力价值、将军、一步杀、连续吃子和直接意图。",
    previewLessons: ["子力价值", "将军与一步杀", "连续吃子", "一步棋的直接意图"],
    goals: XIANGQI_BEGINNER_CURRICULUM[15].goals,
  },
  {
    id: "safety-exchange",
    order: 3,
    legacyLevel: 14,
    title: "应将、保护与交换",
    summary: "正确应将，识别攻击和保护，判断躲、保、换与交换得失。",
    previewLessons: ["正确应将", "躲、保、换", "保护强子", "判断交换"],
    goals: XIANGQI_BEGINNER_CURRICULUM[14].goals,
  },
  {
    id: "coordination-calculation",
    order: 4,
    legacyLevel: 13,
    title: "配合、计算与基础布局",
    summary: "两子配合、2–3 步计算、基础杀法与顺炮、列炮入门。",
    previewLessons: ["两子配合", "两步杀", "2–3 步计算", "顺炮与列炮"],
    goals: XIANGQI_BEGINNER_CURRICULUM[13].goals,
  },
];

const KIDS_CHAPTERS = [
  {
    id: "kids-foundation",
    order: 1,
    title: "第一次走进象棋世界",
    adultStageIds: ["foundation"],
    lessonStart: 0,
    lessonCount: 14,
    conceptIds: [
      "piece-family", "starting-lineup",
      "board-palace", "general-move", "rook-move", "horse-move", "horse-leg", "cannon-screen",
      "pawn-river", "capture", "check", "respond-check", "facing-generals", "checkmate",
    ],
  },
  {
    id: "kids-safety",
    order: 2,
    title: "学会吃子和保护自己",
    adultStageIds: ["capture-intent", "safety-exchange"],
    lessonStart: 14,
    lessonCount: 6,
    conceptIds: ["attack", "protection", "safe-capture", "recapture-risk", "exchange", "capture-safety"],
  },
  {
    id: "kids-checkmate",
    order: 3,
    title: "听见将军，找到最后一击",
    adultStageIds: ["board-awareness", "checkmate"],
    lessonStart: 20,
    lessonCount: 6,
    conceptIds: ["check-detection", "respond-check", "respond-check", "respond-check", "check-vs-mate", "mate-in-one"],
  },
];

const KIDS_PIECE_COLORS = Object.freeze({ RED: "red", BLACK: "black" });
// This ordered data is the single playable-course source for Web Kids and
// @qili/curriculum. The persisted progress schema stores a completed prefix,
// so reordering or inserting lessons requires an explicit progress migration.
const KIDS_PRACTICE_FRAME = [
  [9, 4, "general", KIDS_PIECE_COLORS.RED],
  [0, 3, "general", KIDS_PIECE_COLORS.BLACK],
];
const KIDS_STARTING_BOARD_PIECES = [
  [0, 0, "rook", KIDS_PIECE_COLORS.BLACK], [0, 1, "horse", KIDS_PIECE_COLORS.BLACK], [0, 2, "elephant", KIDS_PIECE_COLORS.BLACK], [0, 3, "advisor", KIDS_PIECE_COLORS.BLACK],
  [0, 4, "general", KIDS_PIECE_COLORS.BLACK], [0, 5, "advisor", KIDS_PIECE_COLORS.BLACK], [0, 6, "elephant", KIDS_PIECE_COLORS.BLACK], [0, 7, "horse", KIDS_PIECE_COLORS.BLACK], [0, 8, "rook", KIDS_PIECE_COLORS.BLACK],
  [2, 1, "cannon", KIDS_PIECE_COLORS.BLACK], [2, 7, "cannon", KIDS_PIECE_COLORS.BLACK],
  [3, 0, "pawn", KIDS_PIECE_COLORS.BLACK], [3, 2, "pawn", KIDS_PIECE_COLORS.BLACK], [3, 4, "pawn", KIDS_PIECE_COLORS.BLACK], [3, 6, "pawn", KIDS_PIECE_COLORS.BLACK], [3, 8, "pawn", KIDS_PIECE_COLORS.BLACK],
  [9, 0, "rook", KIDS_PIECE_COLORS.RED], [9, 1, "horse", KIDS_PIECE_COLORS.RED], [9, 2, "elephant", KIDS_PIECE_COLORS.RED], [9, 3, "advisor", KIDS_PIECE_COLORS.RED],
  [9, 4, "general", KIDS_PIECE_COLORS.RED], [9, 5, "advisor", KIDS_PIECE_COLORS.RED], [9, 6, "elephant", KIDS_PIECE_COLORS.RED], [9, 7, "horse", KIDS_PIECE_COLORS.RED], [9, 8, "rook", KIDS_PIECE_COLORS.RED],
  [7, 1, "cannon", KIDS_PIECE_COLORS.RED], [7, 7, "cannon", KIDS_PIECE_COLORS.RED],
  [6, 0, "pawn", KIDS_PIECE_COLORS.RED], [6, 2, "pawn", KIDS_PIECE_COLORS.RED], [6, 4, "pawn", KIDS_PIECE_COLORS.RED], [6, 6, "pawn", KIDS_PIECE_COLORS.RED], [6, 8, "pawn", KIDS_PIECE_COLORS.RED],
];

const KIDS_PLAYABLE_LESSON_DEFINITIONS = [
  {
    icon: "棋",
    title: "跟着棋仔认识棋子",
    subtitle: "在真正的棋盘上见面",
    prompt: "棋仔会一次指给你看一种棋子。找到正在发光的棋子，点一点它。",
    tip: "先看箭头和发光圈，再点棋子。红黑双方有些棋子的名字会不一样。",
    mode: "piece-tour",
    piecesToMeet: [
      { type: "general", at: [9, 4], twinAt: [0, 4], label: "帅", blackLabel: "将", name: "全队的队长", job: "红方叫帅，黑方叫将。它们住在各自的九宫里，是最重要的棋子。", prompt: "先看棋盘最下面的正中央：箭头指着红帅。点一下它。", hint: "找最下面一排正中央、正在发光的“帅”。" },
      { type: "rook", at: [9, 0], twinAt: [0, 0], label: "车", blackLabel: "车", name: "直线小火车", job: "车在两边的角落，喜欢沿横线和直线一路前进。", prompt: "现在看左下角：会走直线的红车正在发光。", hint: "找棋盘左下角、正在上下跳动的“车”。" },
      { type: "horse", at: [9, 1], twinAt: [0, 1], label: "马", blackLabel: "马", name: "跳跳小马", job: "马紧挨着车，会走一个“日”字，也会被棋子绊住马腿。", prompt: "车旁边就是马。点一下左下方正在发光的红马。", hint: "从左下角的车往右看一格。" },
      { type: "elephant", at: [9, 2], twinAt: [0, 2], label: "相", blackLabel: "象", name: "守家大象", job: "红方叫相，黑方叫象。它走“田”字，留在自己这一边守家。", prompt: "马的旁边是红相。看看上方对应的黑棋写着“象”。", hint: "找左下方“马”右边的“相”。" },
      { type: "advisor", at: [9, 3], twinAt: [0, 3], label: "仕", blackLabel: "士", name: "贴身小卫士", job: "红方叫仕，黑方叫士。它们在九宫里斜走一步，贴身保护队长。", prompt: "帅旁边的红仕正在发光。它的黑方朋友叫士。", hint: "找红帅左边、正在发光的“仕”。" },
      { type: "cannon", at: [7, 1], twinAt: [2, 1], label: "炮", blackLabel: "炮", name: "隔山小炮手", job: "炮站在底线前面。吃子时要隔着刚好一个炮架。", prompt: "离开底线往前看两排，找到左边正在发光的红炮。", hint: "炮不在最下面一排，在左侧靠前的位置。" },
      { type: "pawn", at: [6, 0], twinAt: [3, 0], label: "兵", blackLabel: "卒", name: "勇敢小兵", job: "红方叫兵，黑方叫卒。它们站在最前面，勇敢地一步一步向前。", prompt: "最后看最靠近河界的一排：点一下最左边发光的红兵。", hint: "找红方最靠近河界、最左边的“兵”。" },
    ],
    success: "七种棋子都在真实棋盘上见过啦！下一关不显示箭头，轮到你自己找。",
    pieces: [...KIDS_STARTING_BOARD_PIECES],
  },
  {
    icon: "找",
    title: "轮到你自己找",
    subtitle: "没有箭头的认棋挑战",
    prompt: "这次箭头藏起来了。根据棋仔的问题，在完整棋盘上找到七位朋友。",
    tip: "底线从外到内是车、马、相、仕、帅；炮站在前面，小兵站得更靠前。",
    mode: "identify-sequence",
    sequence: [
      { at: [9, 4], name: "帅", prompt: "先找到住在底线正中央的红帅。", hint: "帅在最下面一排的正中央。" },
      { at: [9, 0], name: "车", prompt: "找到站在最外侧、走直线的红车。", hint: "车站在底线最左边和最右边。" },
      { at: [9, 1], name: "马", prompt: "找到紧挨着车、会跳“日”的红马。", hint: "从最左边的车往里数一格。" },
      { at: [9, 2], name: "相", prompt: "找到会走“田”字的红相。", hint: "相在马和仕之间。" },
      { at: [9, 3], name: "仕", prompt: "找到站在帅旁边的小卫士红仕。", hint: "仕紧挨着中央的帅。" },
      { at: [7, 1], name: "炮", prompt: "找到站在底线前面两排的红炮。", hint: "炮没有站在最底下一排。" },
      { at: [6, 0], name: "兵", prompt: "最后找到站在最前面、准备过河的红兵。", hint: "兵是红方最靠近河界的一排棋子。" },
    ],
    success: "全部找到了！你已经认识棋子朋友和他们开局时的座位。",
    pieces: [...KIDS_STARTING_BOARD_PIECES],
  },
  {
    icon: "宫",
    title: "找到帅的小城堡",
    subtitle: "认识九宫",
    prompt: "帅住在自己的小城堡里。你能在棋盘上点到红方九宫吗？",
    tip: "红方九宫就在棋盘最下面中央的 3 × 3 交叉点区域。",
    mode: "zone",
    zone: { minRow: 7, maxRow: 9, minCol: 3, maxCol: 5 },
    success: "找到了！帅不能跑出这座小城堡。",
    pieces: [[9, 4, "general", KIDS_PIECE_COLORS.RED]],
  },
  {
    icon: "帅",
    title: "帅怎么走？",
    subtitle: "九宫里走一步",
    prompt: "帅每次只能走一格。把红帅向左走一步，但别跑出九宫。",
    tip: "帅只能待在九宫里，每次只能横着或竖着走一格，不能斜着走。",
    mode: "move",
    legal: true,
    pieces: [[9, 4, "general", KIDS_PIECE_COLORS.RED], [0, 3, "general", KIDS_PIECE_COLORS.BLACK], [5, 3, "pawn", KIDS_PIECE_COLORS.RED]],
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
    pieces: [[8, 4, "rook", KIDS_PIECE_COLORS.RED], ...KIDS_PRACTICE_FRAME],
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
    pieces: [[7, 4, "horse", KIDS_PIECE_COLORS.RED], ...KIDS_PRACTICE_FRAME],
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
    pieces: [[7, 4, "horse", KIDS_PIECE_COLORS.RED], [6, 4, "pawn", KIDS_PIECE_COLORS.RED], ...KIDS_PRACTICE_FRAME],
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
    pieces: [[7, 4, "cannon", KIDS_PIECE_COLORS.RED], [5, 4, "pawn", KIDS_PIECE_COLORS.RED], [2, 4, "rook", KIDS_PIECE_COLORS.BLACK], ...KIDS_PRACTICE_FRAME],
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
    pieces: [[4, 4, "pawn", KIDS_PIECE_COLORS.RED], ...KIDS_PRACTICE_FRAME],
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
    pieces: [[7, 2, "rook", KIDS_PIECE_COLORS.RED], [3, 2, "pawn", KIDS_PIECE_COLORS.BLACK], ...KIDS_PRACTICE_FRAME],
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
    pieces: [[5, 0, "rook", KIDS_PIECE_COLORS.RED], [9, 4, "general", KIDS_PIECE_COLORS.RED], [6, 4, "pawn", KIDS_PIECE_COLORS.RED], [0, 4, "general", KIDS_PIECE_COLORS.BLACK]],
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
    pieces: [[9, 4, "general", KIDS_PIECE_COLORS.RED], [5, 4, "rook", KIDS_PIECE_COLORS.BLACK], [0, 3, "general", KIDS_PIECE_COLORS.BLACK], [5, 3, "pawn", KIDS_PIECE_COLORS.RED]],
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
    pieces: [[0, 4, "general", KIDS_PIECE_COLORS.BLACK], [9, 4, "general", KIDS_PIECE_COLORS.RED], [5, 4, "rook", KIDS_PIECE_COLORS.RED]],
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
    pieces: [[9, 4, "general", KIDS_PIECE_COLORS.RED], [3, 3, "horse", KIDS_PIECE_COLORS.RED], [2, 0, "rook", KIDS_PIECE_COLORS.RED], [0, 4, "general", KIDS_PIECE_COLORS.BLACK], [0, 3, "rook", KIDS_PIECE_COLORS.BLACK], [0, 5, "cannon", KIDS_PIECE_COLORS.BLACK], [1, 0, "rook", KIDS_PIECE_COLORS.BLACK], [2, 4, "pawn", KIDS_PIECE_COLORS.BLACK]],
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
    pieces: [[6, 4, "rook", KIDS_PIECE_COLORS.RED], [2, 4, "rook", KIDS_PIECE_COLORS.BLACK], ...KIDS_PRACTICE_FRAME],
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
    pieces: [[6, 4, "rook", KIDS_PIECE_COLORS.RED], [8, 3, "horse", KIDS_PIECE_COLORS.RED], [2, 4, "rook", KIDS_PIECE_COLORS.BLACK], ...KIDS_PRACTICE_FRAME],
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
    pieces: [[6, 2, "rook", KIDS_PIECE_COLORS.RED], [3, 2, "cannon", KIDS_PIECE_COLORS.BLACK], ...KIDS_PRACTICE_FRAME],
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
    pieces: [[7, 4, "rook", KIDS_PIECE_COLORS.RED], [4, 4, "cannon", KIDS_PIECE_COLORS.BLACK], [4, 0, "rook", KIDS_PIECE_COLORS.BLACK], ...KIDS_PRACTICE_FRAME],
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
    pieces: [[6, 2, "rook", KIDS_PIECE_COLORS.RED], [3, 2, "horse", KIDS_PIECE_COLORS.BLACK], [3, 0, "rook", KIDS_PIECE_COLORS.BLACK], ...KIDS_PRACTICE_FRAME],
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
    pieces: [[7, 4, "rook", KIDS_PIECE_COLORS.RED], [4, 4, "pawn", KIDS_PIECE_COLORS.BLACK], [4, 0, "rook", KIDS_PIECE_COLORS.BLACK], [7, 7, "pawn", KIDS_PIECE_COLORS.BLACK], ...KIDS_PRACTICE_FRAME],
    identify: [7, 7],
    failure: "先看两个黑兵身后有没有保护者。被黑车保护的那个不是安全目标。",
    success: "判断正确！先看保护，再决定要不要吃，你已经开始像真正的棋手一样思考了。",
    finale: true,
  },
  {
    icon: "将",
    title: "是谁在喊将军？",
    subtitle: "看见将军",
    prompt: "红帅正在被攻击。点出喊“将军”的那枚黑棋。",
    tip: "先看帅所在的横线和直线。哪枚黑棋现在可以直接走到帅的位置？",
    mode: "identify",
    pieces: [[9, 4, "general", KIDS_PIECE_COLORS.RED], [5, 4, "pawn", KIDS_PIECE_COLORS.RED], [9, 0, "rook", KIDS_PIECE_COLORS.BLACK], [0, 3, "general", KIDS_PIECE_COLORS.BLACK]],
    identify: [9, 0],
    failure: "再沿着红帅所在的横线看一遍。中间没有棋子挡住谁？",
    success: "看见了！黑车沿横线盯住红帅，这就是将军。",
  },
  {
    icon: "逃",
    title: "先让帅躲开",
    subtitle: "应将方法一：逃",
    prompt: "黑车正在将军。把红帅向左走一步，躲到安全位置。",
    tip: "被将军时，先别做别的事。帅可以走到一个没有被攻击的九宫位置。",
    mode: "move",
    legal: true,
    pieces: [[9, 4, "general", KIDS_PIECE_COLORS.RED], [5, 3, "pawn", KIDS_PIECE_COLORS.RED], [5, 4, "rook", KIDS_PIECE_COLORS.BLACK], [0, 3, "general", KIDS_PIECE_COLORS.BLACK]],
    expected: [9, 4, 9, 3],
    success: "安全了！“逃”是应对将军的一种办法。",
  },
  {
    icon: "挡",
    title: "派车来挡住",
    subtitle: "应将方法二：挡",
    prompt: "这次帅不用动。把红车走到帅的正前方，挡住黑车的直线。",
    tip: "直线将军时，可以把一枚棋放进攻击线路，让对方看不到帅。",
    mode: "move",
    legal: true,
    pieces: [[9, 4, "general", KIDS_PIECE_COLORS.RED], [8, 0, "rook", KIDS_PIECE_COLORS.RED], [5, 4, "rook", KIDS_PIECE_COLORS.BLACK], [0, 3, "general", KIDS_PIECE_COLORS.BLACK]],
    expected: [8, 0, 8, 4],
    success: "挡住了！红车站进攻击线路，红帅安全了。",
  },
  {
    icon: "吃",
    title: "把威胁拿掉",
    subtitle: "应将方法三：吃",
    prompt: "黑车离红帅太近了。用红帅直接吃掉它。",
    tip: "如果将军的棋没有保护，而且吃完后帅很安全，就可以把威胁直接拿掉。",
    mode: "move",
    legal: true,
    pieces: [[9, 4, "general", KIDS_PIECE_COLORS.RED], [8, 4, "rook", KIDS_PIECE_COLORS.BLACK], [0, 3, "general", KIDS_PIECE_COLORS.BLACK]],
    expected: [9, 4, 8, 4],
    success: "威胁消失了！“吃掉将军的棋”也是一种应将办法。",
  },
  {
    icon: "路",
    title: "他还有路可以逃",
    subtitle: "将军不等于将死",
    prompt: "黑将被红车将军了，但棋局还没结束。点出黑将唯一的安全出口。",
    tip: "将军以后，要检查所有逃、挡、吃。只要还有一种合法回应，就不是将死。",
    mode: "identify",
    pieces: [[9, 4, "general", KIDS_PIECE_COLORS.RED], [5, 4, "pawn", KIDS_PIECE_COLORS.RED], [2, 4, "rook", KIDS_PIECE_COLORS.RED], [0, 4, "general", KIDS_PIECE_COLORS.BLACK], [0, 5, "rook", KIDS_PIECE_COLORS.BLACK]],
    identify: [0, 3],
    failure: "黑将不能走进红车控制的直线，也不能走到自己棋子占着的位置。再找一个空着的安全点。",
    success: "找到了！黑将还能逃到左边，所以这是将军，还不是将死。",
  },
  {
    icon: "胜",
    title: "关住所有出口",
    subtitle: "完成一步将死",
    prompt: "把左边的红车送到星星位置。它会将军，另一辆红车会守住黑将的出口。",
    tip: "将死要同时做到两件事：将军，而且不给对方留下任何合法回应。",
    mode: "move",
    legal: true,
    verifyMate: true,
    pieces: [[9, 4, "general", KIDS_PIECE_COLORS.RED], [5, 4, "pawn", KIDS_PIECE_COLORS.RED], [2, 0, "rook", KIDS_PIECE_COLORS.RED], [1, 8, "rook", KIDS_PIECE_COLORS.RED], [0, 4, "general", KIDS_PIECE_COLORS.BLACK]],
    expected: [2, 0, 0, 0],
    success: "将死！一辆车将军，另一辆车守住出口，黑将没有任何合法回应。",
    finale: true,
  },
];

const kidsPlayableLessonLayout = KIDS_CHAPTERS.flatMap((chapter) =>
  chapter.conceptIds.map((conceptId, chapterLessonIndex) => ({ chapter, conceptId, chapterLessonIndex }))
);

const kidsChapterLayoutValid = KIDS_CHAPTERS.every((chapter, index) => {
  const expectedStart = KIDS_CHAPTERS.slice(0, index).reduce((total, entry) => total + entry.lessonCount, 0);
  return chapter.lessonStart === expectedStart && chapter.lessonCount === chapter.conceptIds.length;
});

if (!kidsChapterLayoutValid || kidsPlayableLessonLayout.length !== KIDS_PLAYABLE_LESSON_DEFINITIONS.length) {
  throw new Error("Qili Kids curriculum metadata and playable lessons are out of sync");
}

function freezeKidsLessonValue(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeKidsLessonValue);
  return Object.freeze(value);
}

const KIDS_PLAYABLE_LESSONS = Object.freeze(KIDS_PLAYABLE_LESSON_DEFINITIONS.map((definition, lessonIndex) => {
  const { chapter, conceptId, chapterLessonIndex } = kidsPlayableLessonLayout[lessonIndex];
  return freezeKidsLessonValue({
    ...definition,
    id: `${chapter.id}-${String(chapterLessonIndex + 1).padStart(2, "0")}`,
    lessonIndex,
    chapterId: chapter.id,
    chapterOrder: chapter.order,
    chapterLessonIndex,
    conceptId,
  });
}));

function courseLesson(id, adultTitle, kidsTitle, objective, prerequisites = [], mastery = "5 个新局面至少 4/5。", reviewEvidence = []) {
  return { id, adultTitle, kidsTitle, objective, prerequisites, mastery, reviewEvidence };
}

const QILI_CURRICULUM_STAGE_1_5 = [
  {
    id: "game-model",
    order: 1,
    title: "游戏模型与棋盘",
    kidsTitle: "走进象棋世界",
    summary: "先理解怎样赢、轮到谁、棋子站在哪里，以及九宫和河界为什么重要。",
    exitCriteria: "6 个混合问题至少 5/6；怎样赢与棋子站交叉点不能错。",
    lessons: [
      courseLesson("game-goal", "一盘象棋到底怎样算赢？", "怎么才能赢？", "理解双方轮流走棋、将死获胜，以及无合法着可走也会失败。", [], "5 个“仍可走 / 已结束”局面至少 4/5。", ["mate", "forced-mate", "game-end-confusion"]),
      courseLesson("board-intersections", "棋子走的是交叉点，不是格子", "棋子站在哪里？", "认识 9 路、10 横与 90 个交叉点，并建立红黑方向感。", [], "按提示点 5 个不同位置，5/5。"),
      courseLesson("palace-river", "九宫与楚河汉界为什么重要", "帅的城堡和中间的大河", "认识双方九宫与河界，作为后续将帅、仕相和兵卒规则的地图基础。", ["board-intersections"], "指出双方九宫与河界，4/4。"),
      courseLesson("turn-and-capture", "轮流走、占位与吃子", "轮到谁？怎么把对方棋拿掉？", "理解一次走一枚、不能落到己方棋上、吃子后占据对方原位置。", ["board-intersections"], "3 个判断 + 2 次实际吃子，5/5。", ["capture"]),
      courseLesson("initial-setup", "初始局面怎么摆", "把大家送回自己的位置", "认识完整初始布局，不要求第一次死背。", ["board-intersections"], "补回 4 枚缺失棋子，4/4。"),
      courseLesson("notation-basics", "记谱怎么读", "棋盘上的地址", "理解棋子、路、进退平，能在棋盘上找到红方二路。", ["board-intersections"], "指出红方二路，1/1。"),
    ],
  },
  {
    id: "legal-moves",
    order: 2,
    title: "七种棋子与完整合法性",
    kidsTitle: "七个棋子朋友",
    summary: "从“知道棋子怎么走”升级到“能判断这一步在当前局面到底是否合法”。",
    exitCriteria: "12 个混合局面至少 10/12；任何走完仍让自己的帅被将的题目不能错。",
    lessons: [
      courseLesson("rook-move", "车的直线、路径与阻挡", "让车沿直线冲出去", "掌握车沿横纵线走任意距离、不能越子、可吃终点敌子。", ["turn-and-capture"], "5 个变化局面至少 4/5。", ["open-rook-line"]),
      courseLesson("general-move", "将帅：九宫内一步", "帅只能在城堡里一步一步走", "掌握将帅只能在九宫内横或竖走一步。", ["palace-river"], "5 个落点判断至少 4/5。"),
      courseLesson("advisor-move", "仕/士：九宫内斜一步", "仕走斜线守城堡", "掌握仕士只能在九宫内斜走一步。", ["palace-river"], "5 个落点判断至少 4/5。"),
      courseLesson("elephant-move", "相/象：田字、象眼、不过河", "大象走田，但会被堵住眼睛", "掌握相象走田、象眼阻挡与不过河。", ["palace-river"], "6 个混合局面至少 5/6。", ["elephant-eye-blocked"]),
      courseLesson("horse-move", "马走日", "小马跳一个日", "识别没有阻挡时马的日字落点。", ["turn-and-capture"], "5 个正常落点至少 4/5。"),
      courseLesson("horse-leg", "蹩马腿", "是谁绊住了马？", "理解正交相邻的马腿会封锁对应方向的两个日字落点。", ["horse-move"], "6 个有无马腿局面至少 5/6。", ["horse-leg-blocked", "horse-leg-opened"]),
      courseLesson("cannon-move", "炮：不吃像车，吃子隔一个炮架", "炮要借一座桥", "区分炮普通移动与吃子规则，吃子时中间必须恰好一个炮架。", ["rook-move", "turn-and-capture"], "6 个 0/1/2+ 炮架局面至少 5/6。", ["cannon-screen-change"]),
      courseLesson("pawn-move", "兵/卒：过河前后", "小兵过河后学会横走", "掌握兵卒前进方向、过河前后横走变化与永不后退。", ["palace-river"], "6 个红黑兵卒局面至少 5/6。"),
      courseLesson("facing-generals", "将帅照面", "别让将和帅直接看见彼此", "识别同一路且中间无棋子时的将帅照面非法状态。", ["general-move"], "5 个线路变化至少 4/5。", ["facing-generals-illegal"]),
      courseLesson("self-check-legality", "“棋子会走”不代表“这手合法”", "不能把自己的帅送进危险", "理解被将必须解除、不能走完仍被将、不能主动走进被攻击状态。", ["general-move", "facing-generals"], "6 个局面至少 5/6，且自陷将军题不能错。", ["check", "in-check", "illegal-self-check"]),
      courseLesson("mixed-legality", "合法着法综合判断", "哪一步真的能走？", "综合判断车马炮相帅兵等棋子的完整合法着。", ["rook-move", "advisor-move", "elephant-move", "horse-leg", "cannon-move", "pawn-move", "self-check-legality"], "10 个全新位置至少 8/10，且 self-check 题不得错。"),
    ],
  },
  {
    id: "board-awareness",
    order: 3,
    title: "看见攻击、吃子与将军",
    kidsTitle: "危险雷达",
    summary: "从会移动棋子进入真正看懂棋盘：谁在攻击、谁能被吃、谁在将军、对手下一步想做什么。",
    exitCriteria: "5 个全新局面中指出最紧急棋盘事件，至少 4/5。",
    lessons: [
      courseLesson("attack-map", "谁在攻击谁", "危险雷达：谁盯着我？", "识别当前棋盘上的直接攻击关系，并理解“能攻击”不等于“应该马上吃”。", ["mixed-legality"], "5 个变化局面至少 4/5。", ["missed-attack"]),
      courseLesson("capture-available", "当前有哪些直接吃子", "现在谁能被吃？", "扫描当前所有合法直接吃子机会。", ["attack-map", "turn-and-capture"], "5 个局面至少 4/5。", ["capture"]),
      courseLesson("check-detection", "识别将军", "谁在喊“将军”？", "判断将或帅当前是否正受到合法攻击。", ["attack-map", "self-check-legality"], "5 个将军/非将军局面至少 4/5。", ["check", "in-check", "missed-check"]),
      courseLesson("opponent-intent", "对方上一手在直接威胁什么", "他下一步想干什么？", "只解释对方下一步最直接、可验证的意图，不编造抽象战略故事。", ["attack-map", "capture-available"], "5 个上一手变化局面至少 4/5。", ["simple-intent"]),
      courseLesson("forcing-scan", "每一步先扫：将军 → 吃子 → 直接威胁", "先看最急的事", "建立 forcing events 的观察顺序，同时理解看到强制手不等于必须下强制手。", ["check-detection", "capture-available", "opponent-intent"], "5 个混合局面至少 4/5。"),
      courseLesson("one-ply-blunder-check", "走之前做一次“一步漏算检查”", "我走完会不会马上掉棋？", "落子前检查自己是否被将、移动棋是否会被白吃、是否漏掉对方直接吃子。", ["forcing-scan"], "5 个新局面至少 4/5。", ["hanging-mover", "material-loss"]),
    ],
  },
  {
    id: "safety-exchange",
    order: 4,
    title: "保护、反吃与交换",
    kidsTitle: "别把棋送掉",
    summary: "消灭“看到能吃就吃”的习惯，先看保护、反吃和交换后的最终结果。",
    exitCriteria: "5 个未知局面至少 4/5，必须包含安全吃子、反吃、交换与受攻防守。",
    lessons: [
      courseLesson("piece-value-context", "子力价值是参考，不是死分数", "哪些棋通常更宝贵？", "建立车、马炮、仕相、兵卒的相对子力概念，同时避免把分数当绝对真理。", ["capture-available"], "5 个交换比较至少 4/5。"),
      courseLesson("protection", "谁在保护这枚棋", "谁是它的后援？", "判断一枚棋被吃后，己方是否有合法着能立即吃回。", ["attack-map"], "5 个保护关系至少 4/5。", ["lost-protection", "unprotected-piece"]),
      courseLesson("hanging-piece", "悬子：受攻且没有可靠回应", "哪枚棋没人保护？", "识别受攻且缺乏有效保护或战术回应的棋子。", ["attack-map", "protection"], "5 个局面至少 4/5。", ["hanging-mover", "lost-protection", "unprotected-piece"]),
      courseLesson("recapture-risk", "吃完以后谁能反吃", "等等，它后面有朋友！", "吃子前检查目标位置是否被对方保护，以及对方能否立即反吃。", ["protection", "capture-available"], "5 个新局面至少 4/5。", ["material-loss", "route-material-loss", "missed-recapture"]),
      courseLesson("safe-capture", "白吃 vs 假白吃", "哪一个真的可以放心吃？", "比较可吃目标，区分无人保护的安全吃子与吃完会被反吃的假便宜。", ["recapture-risk"], "5 个新局面至少 4/5。", ["capture", "unsafe-capture"]),
      courseLesson("defense-options", "受攻后：躲、保、挡、吃、换", "救这枚棋有几种办法？", "面对受攻强子时枚举合法的躲、保、挡、吃、换方案。", ["hanging-piece", "safe-capture"], "5 个防守局面至少 4/5。", ["major-piece-danger"]),
      courseLesson("exchange", "交换是什么", "我吃你，你再吃我", "把连续吃子看成完整 sequence，而不是只看第一次 capture。", ["recapture-risk", "piece-value-context"], "5 个交换序列至少 4/5。"),
      courseLesson("exchange-value", "这次交换值不值", "换完以后谁更开心？", "比较交换后的净子力、强子安全与后续直接威胁。", ["exchange", "piece-value-context"], "5 个交换判断至少 4/5。", ["material-loss", "route-material-loss", "bad-exchange"]),
    ],
  },
  {
    id: "checkmate",
    order: 5,
    title: "应将、将死与基础杀法",
    kidsTitle: "将军任务",
    summary: "理解将军是强制状态，正确应将，并逐步找到一步杀、基础配合和简单两步杀。",
    exitCriteria: "应将题 3/3；将军/将死判断 2/2；杀法题至少 2/3。",
    lessons: [
      courseLesson("respond-check", "被将军时只能先解除将军", "先救帅！", "识别并执行合法应将：逃、挡、吃掉将军子、改变炮架等。", ["check-detection", "self-check-legality"], "3 个不同应将机制必须 3/3。", ["check", "in-check", "failed-check-response"]),
      courseLesson("check-vs-mate", "将军不等于将死", "他还能逃吗？", "判断被将一方是否仍存在任何合法应将。", ["respond-check"], "5 个将军/将死局面至少 4/5。", ["mate", "missed-mate"]),
      courseLesson("stalemate-loss", "没有合法着也会输", "没被将军但一步也走不了，会怎样？", "理解象棋中无合法着可走的一方也失败。", ["self-check-legality"], "4 个结束/未结束局面 4/4。"),
      courseLesson("mate-in-one", "一步杀", "找到最后一击", "枚举对方所有合法回应后找到一步将死。", ["check-vs-mate"], "5 个新局面至少 4/5。", ["mate", "forced-mate", "missed-mate"]),
      courseLesson("rook-mate-geometry", "车的封锁线与将帅配合", "用直线关住黑将", "理解车控制横纵逃点形成杀网。", ["mate-in-one", "rook-move"], "5 个车杀几何局面至少 4/5。"),
      courseLesson("cannon-mate-geometry", "炮架、封锁与杀王", "炮的最后一座桥", "理解炮架与其他棋子共同封锁逃点的将死结构。", ["mate-in-one", "cannon-move"], "5 个炮杀局面至少 4/5。"),
      courseLesson("horse-mate-geometry", "马控制逃点", "小马把门堵住", "理解马控制将帅逃点的独特几何。", ["mate-in-one", "horse-leg"], "5 个马杀局面至少 4/5。"),
      courseLesson("double-check", "双将为何特别强制", "两个方向一起将军", "识别双重将军并理解其回应空间极小。", ["respond-check", "attack-map"], "4 个双将/非双将局面至少 3/4。"),
      courseLesson("mate-in-two", "两步杀：先看对方所有合法应将", "先逼他走，再找到最后一击", "计算第一手将军后对方所有合法回应，再找到第二手将死。", ["mate-in-one", "respond-check"], "4 个简单两步杀至少 3/4。", ["forced-mate"]),
    ],
  },
];

const QILI_CURRICULUM_STAGE_6_10 = [
  {
    id: "tactics",
    order: 6,
    title: "基础战术",
    kidsTitle: "战术侦探",
    summary: "先看懂棋盘关系，再学习术语；重点是强制顺序与两个目标之间的关系。",
    exitCriteria: "5 个不显示战术名称的新局面，至少 4/5。",
    lessons: [
      courseLesson("fork", "捉双 / fork", "一枚棋同时盯两个目标", "用一手棋同时攻击两个对手难以兼顾的目标。", ["attack-map", "one-ply-blunder-check"], "5 个变化局面至少 4/5。", ["fork"]),
      courseLesson("pin", "牵制 / pin", "它想走，但后面更重要", "识别一枚棋因移动会暴露更重要目标而受限制。", ["attack-map", "self-check-legality"], "5 个变化局面至少 4/5。", ["pin"]),
      courseLesson("skewer", "串击 / skewer", "先赶走前面的，再吃后面的", "用直线攻击逼走前方高价值目标，再获取后方目标。", ["attack-map", "rook-move"], "5 个变化局面至少 4/5。", ["skewer"]),
      courseLesson("discovered-attack", "闪击 / discovered attack", "我一让开，后面的攻击出现了", "移动遮挡子后，让后方棋子的攻击线路突然打开。", ["attack-map", "rook-move"], "5 个变化局面至少 4/5。", ["discovered-attack"]),
      courseLesson("remove-defender", "消除保护者", "先拿掉它的保镖", "先处理关键保护者，再攻击原本被保护的目标。", ["protection", "safe-capture"], "5 个变化局面至少 4/5。", ["lost-protection", "defender-removed"]),
      courseLesson("trap-piece", "困子", "它还有地方逃吗？", "限制对方棋子的合法逃跑空间，并判断是否能真正赢子。", ["attack-map", "mixed-legality"], "5 个局面至少 4/5。", ["trapped-piece"]),
      courseLesson("horse-leg-tactic", "开马腿 / 封马腿战术", "打开或堵住小马的路", "利用马腿开闭改变攻击关系。", ["horse-leg", "attack-map"], "5 个变化局面至少 4/5。", ["horse-leg-opened", "horse-leg-blocked"]),
      courseLesson("cannon-screen-tactic", "炮架变化", "换一座炮桥，攻击就变了", "通过增加、移除或移动炮架改变炮的攻击与将军线路。", ["cannon-move", "attack-map"], "5 个变化局面至少 4/5。", ["cannon-screen-change"]),
      courseLesson("open-rook-line", "打开车线", "给车清出一条直路", "移动己方阻挡子，为车打开直接攻击线路。", ["rook-move", "attack-map"], "5 个变化局面至少 4/5。", ["open-rook-line"]),
      courseLesson("tactical-combination", "两个战术连续发生", "第一招只是开始", "把两个简单战术按强制顺序连接起来，而不是只看到第一层。", ["fork", "pin", "skewer", "forcing-scan"], "5 个两段组合至少 4/5。"),
    ],
  },
  {
    id: "calculation",
    order: 7,
    title: "计算与候选着",
    kidsTitle: "想两步",
    summary: "从识别模式升级到比较未来：先列候选，再找对手最强回应。",
    exitCriteria: "4 个局面中至少 3/4 正确指出对手最佳直接回应，不能只猜引擎第一手。",
    lessons: [
      courseLesson("candidate-moves", "先列候选着，不要第一眼就走", "先找 2–3 个办法", "从将军、吃子、直接威胁、防守与改善棋子中列出少量候选着。", ["forcing-scan", "defense-options"], "5 个局面至少列出合理候选 4/5。"),
      courseLesson("best-reply", "找对方最强回应", "如果你是对手，你会怎么反击？", "每个候选着都先寻找对手最强的直接回应。", ["candidate-moves", "opponent-intent"], "5 个局面至少 4/5。"),
      courseLesson("two-ply", "我走 → 他走", "想两步", "计算自己一手与对方最强回应的一层变化。", ["best-reply"], "5 个两层变化至少 4/5。"),
      courseLesson("three-ply", "我走 → 他最强回应 → 我再走", "再往前多看一步", "在两层基础上再计算己方下一手，形成最基础三层计算。", ["two-ply"], "4 个三层变化至少 3/4。"),
      courseLesson("compare-lines", "两条候选路线怎么比较", "A 路和 B 路，哪条更安全？", "比较候选路线的将军状态、最终子力、强子安全与强制后续。", ["three-ply", "exchange-value"], "5 个路线比较至少 4/5。", ["route-material-loss"]),
      courseLesson("quiet-threat", "不是所有好棋都将军或吃子", "安静的一步，也可能准备大事", "识别没有立即吃将、但制造下一步直接威胁的安静着。", ["opponent-intent", "candidate-moves"], "5 个局面至少 4/5。"),
      courseLesson("blunder-checklist", "落子前最后 5 秒检查", "按下走棋前，再看一眼", "固定执行：被将？对方将军/吃子？移动棋会被吃？对方最强回应？帅安全吗？", ["one-ply-blunder-check", "best-reply"], "5 个混合局面至少 4/5。", ["hanging-mover", "material-loss"]),
    ],
  },
  {
    id: "endgame",
    order: 8,
    title: "基础残局与优势转化",
    kidsTitle: "最后的战斗",
    summary: "知道优势怎样转成胜利、劣势怎样保留抵抗资源，而不是只会赢子不会收官。",
    exitCriteria: "3 个实用残局至少 2/3，且不能出现重大送子。",
    lessons: [
      courseLesson("theoretical-result", "理论胜 / 理论和 / 实战机会", "这个残局本来能赢吗？", "区分理论结果与实战难度，避免把引擎分数直接等同于必胜。", ["game-goal", "blunder-checklist"], "4 个基础结果判断至少 3/4。"),
      courseLesson("soldier-endgame", "兵的阶段价值、过河与逼近", "小兵越往前越危险", "理解兵卒推进、过河与接近底线后价值和威胁的变化。", ["pawn-move", "theoretical-result"], "5 个基础兵残局至少 4/5。"),
      courseLesson("rook-endgame-basics", "车残局：活动性、将帅位置、切断", "让车把对方将活动空间变小", "理解车在残局中的活动性、切断与将帅配合。", ["rook-move", "theoretical-result"], "5 个基础车残局至少 4/5。"),
      courseLesson("minor-piece-endgame", "马/炮残局的基本差异", "棋子少了以后，马和炮需要什么帮助？", "建立马炮残局在空间、炮架与将帅配合上的基本差异。", ["horse-leg", "cannon-move", "theoretical-result"], "4 个基础比较至少 3/4。"),
      courseLesson("simplify-when-ahead", "优势时什么时候交换", "领先时，把危险棋换掉", "在明确领先时判断交换是否降低对手反击机会并保留可兑现优势。", ["exchange-value", "theoretical-result"], "5 个简化判断至少 4/5。", ["bad-exchange", "endgame-conversion"]),
      courseLesson("defend-worse-position", "劣势时怎样增加守和机会", "落后时别急着把棋都换光", "劣势时避免无意义简化，保留活动性、威胁与对手犯错空间。", ["simplify-when-ahead"], "5 个防守选择至少 4/5。"),
    ],
  },
  {
    id: "opening",
    order: 9,
    title: "开局原则与常见体系",
    kidsTitle: "大军出发",
    summary: "先学出子、协调、将帅安全等原则，再认识顺炮、列炮等结构，不靠死背棋谱。",
    exitCriteria: "5 个未知开局片段至少 4/5 选出原则上更健康的着法并说明原因。",
    lessons: [
      courseLesson("develop-rooks", "尽早让车获得活动空间", "把大车开出来", "理解开局中逐步打开车线与提高车活动性的价值。", ["rook-move", "open-rook-line"], "5 个开局选择至少 4/5。"),
      courseLesson("free-horses", "避免双马长期受堵", "别把两匹马都锁在家里", "识别影响马出动的兵炮结构并避免无意义自堵。", ["horse-leg", "candidate-moves"], "5 个开局选择至少 4/5。"),
      courseLesson("cannon-coordination", "炮需要炮架与其他棋协调", "炮不能自己冲太远", "理解炮的活动依赖线路、炮架与其他棋子的协作。", ["cannon-move", "cannon-screen-tactic"], "5 个开局选择至少 4/5。"),
      courseLesson("general-safety", "开局不要无必要暴露将帅", "先把城堡守好", "保持将帅安全，不为了无关小利主动打开危险线路。", ["self-check-legality", "attack-map"], "5 个安全判断至少 4/5。"),
      courseLesson("development-tempo", "别无理由重复走同一子", "让更多棋一起参加战斗", "理解开局每一手的出子效率与重复走子的机会成本。", ["candidate-moves"], "5 个开局选择至少 4/5。"),
      courseLesson("central-cannon-screen-horse", "中炮 vs 屏风马：认识结构与目的", "一种常见开局长什么样", "认识中炮与屏风马的基本结构、直接目标与常见子力部署。", ["develop-rooks", "free-horses", "cannon-coordination"], "4 个结构识别至少 3/4。"),
      courseLesson("same-opposite-cannon", "顺炮 / 列炮：只认识核心结构与风险", "两个炮怎么对着打", "认识顺炮、列炮的基本结构和最直接战术风险，不要求背谱。", ["central-cannon-screen-horse"], "4 个结构判断至少 3/4。"),
      courseLesson("alternative-openings", "兵类、飞相等非中炮开局的基本思想", "不一定第一步都要架中炮", "理解非中炮开局也可以健康发展，避免把单一开局当唯一正确。", ["development-tempo", "general-safety"], "4 个开局比较至少 3/4。"),
      courseLesson("opening-review", "看 5–8 回合，指出原则性错误", "哪一步让棋子越来越难动？", "用出子、协调、将帅安全与直接战术检查短开局片段。", ["develop-rooks", "free-horses", "cannon-coordination", "general-safety", "development-tempo"], "5 个未知片段至少 4/5。", ["basic-opening", "development-loss"]),
    ],
  },
  {
    id: "full-game",
    order: 10,
    title: "完整对局能力与复盘闭环",
    kidsTitle: "真正下一盘",
    summary: "把前九个阶段整合成每手决策流程，并让真实对局错误自动回到对应训练。",
    exitCriteria: "完成一盘真实棋，正确标出至少 2 个关键节点，并能说明候选着与对手直接回应。",
    lessons: [
      courseLesson("decision-loop", "完整每手决策流程", "先看危险 → 找办法 → 想对手 → 再走", "每手依次检查对方变化、将军、直接威胁、受攻强子、候选着与对手最强回应。", ["blunder-checklist", "compare-lines"], "在 5 个完整决策局面中至少 4/5 完成全部检查。"),
      courseLesson("transition-plan", "从开局到中局、从中局到残局", "棋子越来越少以后，要换一种想法", "理解局面阶段变化时目标会从出子协调转向战术、再转向兑现优势。", ["opening-review", "theoretical-result"], "4 个阶段识别至少 3/4。"),
      courseLesson("time-management", "关键节点投入时间", "难题多想一会，简单走法别发呆", "根据局面复杂度和强制性分配思考时间，不死记具体秒数。", ["decision-loop"], "5 个局面正确判断快想/慢想至少 4/5。"),
      courseLesson("self-review", "复盘自己的棋，不先看引擎答案", "先自己找哪一步开始出问题", "先标不确定节点、自己列候选，再看引擎证据，只抽 1–3 个真正可训练错误。", ["decision-loop"], "完成一盘棋的结构化自评并正确标出至少 2 个关键节点。"),
      courseLesson("personalized-retraining", "把重复错误变成针对训练", "哪里总出错，就回去练哪里", "根据 concept confidence 与 prerequisite 自动选择最浅的真实缺口进行短训练。", ["self-review"], "真实对局错误能正确路由到 concept，并在后续复测中恢复。"),
    ],
  },
];

const QILI_CURRICULUM_STAGES = [...QILI_CURRICULUM_STAGE_1_5, ...QILI_CURRICULUM_STAGE_6_10];

const SKILL_CATEGORIES = [
  {
    id: "foundations",
    title: "基础",
    summary: "棋盘、走法与记谱。先把规则走对，再谈好坏。",
    stageIds: ["game-model", "legal-moves"],
  },
  {
    id: "tactics",
    title: "战术",
    summary: "看见攻击、保护、交换，以及将杀与基本战术。",
    stageIds: ["board-awareness", "safety-exchange", "checkmate", "tactics"],
  },
  {
    id: "strategy",
    title: "棋理",
    summary: "候选着、对手回应，以及每手该检查什么。",
    stageIds: ["calculation", "full-game"],
  },
  {
    id: "opening",
    title: "开局",
    summary: "出子、协调与将帅安全，不靠死背棋谱。",
    stageIds: ["opening"],
  },
  {
    id: "endgame",
    title: "残局",
    summary: "把优势变成胜势，劣势时保留抵抗。",
    stageIds: ["endgame"],
  },
];

const MASTERY_MODEL = {
  introduced: { label: "已接触", description: "看过示例并完成第一次引导题。" },
  practicing: { label: "练习中", description: "至少在 3 个有变化的局面中独立做对。" },
  mastered: { label: "已掌握", description: "后续 mixed / delayed test 至少 4/5，包含未见过 transfer position。" },
  fragile: { label: "掌握不稳", description: "曾经掌握，但真实对局再次出现同类基础错误。" },
  relearn: { label: "重新巩固", description: "只回到最浅缺口做短训练，不从头重学整个 Stage。" },
};

const REVIEW_CONCEPT_MAP = {
  check: "respond-check",
  "in-check": "respond-check",
  mate: "mate-in-one",
  "forced-mate": "mate-in-two",
  "hanging-mover": "hanging-piece",
  "lost-protection": "protection",
  capture: "safe-capture",
  "material-loss": "recapture-risk",
  "route-material-loss": "compare-lines",
  fork: "fork",
  pin: "pin",
  skewer: "skewer",
  "horse-leg-blocked": "horse-leg",
  "horse-leg-opened": "horse-leg-tactic",
  "elephant-eye-blocked": "elephant-move",
  "cannon-screen-change": "cannon-screen-tactic",
  "open-rook-line": "open-rook-line",
  "simple-intent": "opponent-intent",
  "basic-opening": "opening-review",
  "illegal-self-check": "self-check-legality",
  "facing-generals-illegal": "facing-generals",
  "missed-check": "check-detection",
  "missed-mate": "mate-in-one",
  "failed-check-response": "respond-check",
  "unprotected-piece": "hanging-piece",
  "unsafe-capture": "safe-capture",
  "missed-recapture": "recapture-risk",
  "bad-exchange": "exchange-value",
  "trapped-piece": "trap-piece",
  "discovered-attack": "discovered-attack",
  "defender-removed": "remove-defender",
  "development-loss": "opening-review",
  "endgame-conversion": "simplify-when-ahead",
  "engine-preference-only": null,
};

const QILI_CONCEPT_INDEX = new Map(
  QILI_CURRICULUM_STAGES.flatMap((stage) =>
    stage.lessons.map((lesson) => [lesson.id, { ...lesson, stageId: stage.id, stageOrder: stage.order, stageTitle: stage.title }])
  )
);

function getCurriculumConcept(conceptId) {
  return QILI_CONCEPT_INDEX.get(conceptId) || null;
}

function getReviewTrainingRoute(evidenceType) {
  if (evidenceType === "engine-preference-only") return { noTraining: true, concept: null };
  const conceptId = REVIEW_CONCEPT_MAP[evidenceType] || null;
  const concept = conceptId ? getCurriculumConcept(conceptId) : null;
  return {
    noTraining: false,
    conceptId,
    concept,
    prerequisites: concept?.prerequisites || [],
  };
}

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

export { MASTERY_MODEL, QILI_CONCEPT_INDEX, QILI_CURRICULUM_STAGES, SKILL_CATEGORIES, REVIEW_CONCEPT_MAP, getCurriculumConcept, getReviewTrainingRoute };
export { ADULT_LEARN_STAGES, KIDS_CHAPTERS, KIDS_PIECE_COLORS, KIDS_PLAYABLE_LESSONS, XIANGQI_BEGINNER_CURRICULUM, PRIORITY, selectTeachingFocus, curriculumPrompt };
