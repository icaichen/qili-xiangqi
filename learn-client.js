import {
  QILI_CURRICULUM_STAGES,
  SKILL_CATEGORIES,
  getCurriculumConcept,
  getReviewTrainingRoute,
} from "./xiangqi-teaching-curriculum.mjs";

const PROGRESS_KEY = "qili-learn-progress-v1";
const SIGNALS_KEY = "qili-learn-signals-v1";
const COLORS = { RED: "red", BLACK: "black" };

const INTERACTIVE = {
  "palace-river": {
    title: "九宫与楚河汉界",
    explain: "棋子站在交叉点上。帅和仕主要在九宫里活动；楚河汉界在棋盘中央，兵过河以后才能横走。",
    chips: ["交叉点", "九宫", "河界"],
    instruction: "先点出红方九宫，再点出河界。",
    hint: "红方九宫在棋盘下方中央 3×3；河界是中间那一带。",
    mode: "landmarks",
    pieces: [],
    success: "以后看任何局面，先知道九宫和河界在哪里。",
  },
  "rook-move": {
    title: "车走直线",
    explain: "车沿横线或纵线走任意距离，中间不能有棋挡住。吃子时落到对方棋所在的交叉点。",
    chips: ["横走", "直走", "不能越子"],
    instruction: "点红车，再把它沿纵线走到上方目标。",
    hint: "路上没有棋，就可以一直往前。",
    mode: "moves",
    pieces: [[8, 4, "rook", "red"]],
    expectedMoves: [[8, 4, 3, 4]],
    success: "车看的是整条直线，不是一格一格跳。",
  },
  "horse-leg": {
    title: "蹩马腿",
    explain: "马走日。紧挨着马的正交位置如果被占住，那个方向就跳不过去。",
    chips: ["马走日", "先看马腿"],
    instruction: "这匹马想向左上跳。点出真正挡住它的棋子。",
    hint: "不要看目标落点，看马旁边是谁堵住了腿。",
    mode: "identify",
    pieces: [[7, 4, "horse", "red"], [6, 4, "pawn", "red"]],
    identify: [6, 4],
    success: "马腿被堵住，对应方向的两个日字落点都会失效。",
  },
  "cannon-move": {
    title: "炮要隔一个子吃",
    explain: "炮不吃子时像车一样走直线。吃子时，中间必须恰好隔一个炮架。",
    chips: ["直线移动", "隔一子吃"],
    instruction: "用红炮吃掉上方黑车。中间必须正好隔一个炮架。",
    hint: "炮架太多或太少都不能吃。",
    mode: "moves",
    pieces: [[7, 4, "cannon", "red"], [5, 4, "pawn", "red"], [2, 4, "rook", "black"]],
    expectedMoves: [[7, 4, 2, 4]],
    success: "记住：走法像车，吃子必须翻山。",
  },
  "pawn-move": {
    title: "兵过河以后",
    explain: "兵永远不能后退。过河前只能向前；过河后可以左右平走。",
    chips: ["不能后退", "过河可左右"],
    instruction: "这枚兵已经过河。让它向左横走一步。",
    hint: "过河后的兵可以平，但不能退。",
    mode: "moves",
    pieces: [[4, 4, "pawn", "red"]],
    expectedMoves: [[4, 4, 4, 3]],
    success: "过河是兵的能力分界，不是随便横着走。",
  },
  "facing-generals": {
    title: "将帅不能照面",
    explain: "将和帅如果在同一路直接相望、中间没有棋，这步不合法。",
    chips: ["不能照面", "中间要有遮挡"],
    instruction: "点出当前挡在将与帅之间、不能随便移走的红车。",
    hint: "同一纵线上，最后一枚遮挡子最关键。",
    mode: "identify",
    pieces: [[9, 4, "general", "red"], [5, 4, "rook", "red"], [0, 4, "general", "black"]],
    identify: [5, 4],
    success: "移走最后的遮挡，将帅就会照面。",
  },
  "piece-value-context": {
    title: "子力价值",
    explain: "中国象棋有一套入门分值，用来判断交换：车 9，炮 4.5，马 4，仕/相 2，兵 1；兵过河后大约 2。这不是国际象棋的马=3。马和炮接近，开局炮往往略强，残局马往往更灵活。分值是参考，不是死命令。",
    chips: ["车 9", "炮 4.5", "马 4", "仕/相 2", "兵 1"],
    values: [
      ["车", "9"],
      ["炮", "4.5"],
      ["马", "4"],
      ["仕 / 相", "2"],
      ["兵", "1 · 过河约 2"],
    ],
    instruction: "红马约 4 分，红炮约 4.5 分。点出分值更高的那枚棋。",
    hint: "马不是 3 分。中国象棋里炮通常略高于马。",
    mode: "identify",
    pieces: [[7, 2, "horse", "red"], [7, 6, "cannon", "red"]],
    identify: [7, 6],
    success: "记住：车 9、炮 4.5、马 4。用马换炮通常稍亏，除非局面另有补偿。",
  },
  protection: {
    title: "谁在保护这枚棋",
    explain: "一枚棋被吃后，如果己方能立即合法吃回，它就有保护。没有保护又被攻击，就是悬子。",
    chips: ["保护", "悬子"],
    instruction: "黑炮隔着炮架盯着红马。点出这枚没有可靠保护的红马。",
    hint: "看被吃之后，红方能不能立刻吃回。",
    mode: "identify",
    pieces: [[9, 4, "general", "red"], [7, 4, "horse", "red"], [5, 4, "pawn", "black"], [2, 4, "cannon", "black"], [0, 3, "general", "black"]],
    identify: [7, 4],
    success: "受攻且吃不回来，就要处理：躲、保、换或挡。",
  },
  "safe-capture": {
    title: "白吃还是假白吃",
    explain: "能吃不等于该吃。先看目标有没有保护，再看吃完会不会被反吃。",
    chips: ["安全吃子", "反吃"],
    instruction: "用红车吃掉一个真正没人保护的黑卒。",
    hint: "另一枚黑马背后有保护，那不是白吃。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [9, 0, "rook", "red"], [6, 0, "pawn", "black"], [6, 4, "horse", "black"], [7, 4, "pawn", "black"], [0, 4, "general", "black"]],
    expectedMoves: [[9, 0, 6, 0]],
    success: "先找没有保护的目标，再动手。",
  },
  fork: {
    title: "捉双",
    explain: "一手棋同时攻击两个对手难以兼顾的目标，就是捉双。",
    chips: ["一子两用", "强制"],
    instruction: "跳红马，让它同时瞄住黑将和黑车。",
    hint: "马走日。找那个能同时打到将和车的落点。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [4, 2, "horse", "red"], [0, 4, "general", "black"], [4, 4, "rook", "black"]],
    expectedMoves: [[4, 2, 2, 3]],
    success: "捉双的力量来自对方无法同时救两个目标。",
  },
  "notation-basics": {
    title: "记谱怎么读",
    explain: "一手棋通常是：棋子 + 哪一路 + 进/退/平 + 距离或目标路。红方用汉字一路到九路，从自己右侧数。",
    chips: ["进", "退", "平", "路"],
    instruction: "红方「二路」从自己右手边数第二条纵线。点出二路上的任意交叉点。",
    hint: "红方右侧第一路是一，第二路是二。",
    mode: "file",
    fileCol: 7,
    pieces: [[9, 7, "rook", "red"]],
    success: "以后看到「车二进四」，就能在棋盘上找到那条路。",
  },
  "elephant-move": {
    title: "相走田、不过河",
    explain: "相走田字，还要看象眼有没有被堵。相不能过河，所以它是防守子，不是进攻主力。",
    chips: ["相走田", "象眼", "不过河"],
    instruction: "把红相走到左上方的田字位。路上的象眼是空的。",
    hint: "从 9 路相到左上，象眼在相邻的斜向交叉点。",
    mode: "moves",
    pieces: [[9, 2, "elephant", "red"]],
    expectedMoves: [[9, 2, 7, 0]],
    success: "相保住己方阵地。不要指望它过河去吃子。",
  },
  "check-detection": {
    title: "识别将军",
    explain: "现代入门强调：每步先问有没有将军。将军是强制状态，比吃子更急。能攻击不等于已经将军，要看将/帅现在是否被合法攻击。",
    chips: ["先看将军", "强制"],
    instruction: "红车正对着黑将，中间没有遮挡。点出正在将军的那枚棋。",
    hint: "看哪一枚棋正在攻击黑将所在的交叉点。",
    mode: "identify",
    pieces: [[9, 3, "general", "red"], [5, 4, "rook", "red"], [0, 4, "general", "black"]],
    identify: [5, 4],
    success: "车在同一路直射将，就是将军。下一步必须先处理它。",
  },
  "forcing-scan": {
    title: "先看最急的事",
    explain: "实战扫描顺序是：将军 → 吃子 → 直接威胁。看到能吃的卒，也不该盖过正在发生的将军。看到强制手，不等于必须走强制手，但必须先看见。",
    chips: ["将军", "吃子", "威胁"],
    instruction: "盘上既有将军，也有一个没保护的黑卒。先点出正在将军的棋子。",
    hint: "卒可以稍后再吃。先找正在攻击将的那枚棋。",
    mode: "identify",
    pieces: [[9, 3, "general", "red"], [6, 4, "rook", "red"], [3, 0, "pawn", "black"], [0, 4, "general", "black"]],
    identify: [6, 4],
    success: "先看见将军，再谈吃子。这是当代入门最重要的观察顺序。",
  },
  "respond-check": {
    title: "先救帅",
    explain: "被将军时，只能先解除：逃将、挡住来路、吃掉将军子，或拆掉炮架。不能先去吃别处的便宜。",
    chips: ["逃", "挡", "吃将子"],
    instruction: "黑车在底线将军。把红帅向上走一步，离开这条被控的横线。",
    hint: "帅在九宫里只能走一步。离开被车控制的那条横线。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [9, 0, "rook", "black"], [0, 3, "general", "black"]],
    expectedMoves: [[9, 4, 8, 4]],
    success: "离开被将的线，这手应将就成立了。",
  },
  "check-vs-mate": {
    title: "将军不等于将死",
    explain: "将军只说明将正在被攻击。将死要看对方是否已经没有任何合法应将。没将死之前，不要提前喊赢了。",
    chips: ["将军", "将死", "还能逃"],
    instruction: "黑将被红车将军，但它还能逃。点出黑将可以逃去的交叉点。",
    hint: "将还能往九宫里走一步。不要逃在车正在控制的那条直线上。",
    mode: "identify",
    pieces: [[9, 3, "general", "red"], [5, 4, "rook", "red"], [0, 4, "general", "black"]],
    identify: [1, 3],
    success: "将还能逃，就只是将军。下一课才练真正的一步杀。",
  },
  "recapture-risk": {
    title: "吃完谁能反吃",
    explain: "吃子前要问：目标有没有保护？保护者吃回来之后，我是赚是亏？车 9 分被炮 4.5 反吃，就是大亏。",
    chips: ["保护", "反吃", "车 9 / 炮 4.5"],
    instruction: "红车能吃这匹黑马，但点出吃完以后会反吃红车的那枚黑炮。",
    hint: "炮隔着一个炮架，就能打到马现在站的位置。",
    mode: "identify",
    pieces: [[9, 3, "general", "red"], [9, 4, "rook", "red"], [6, 4, "horse", "black"], [4, 4, "pawn", "black"], [2, 4, "cannon", "black"], [0, 3, "general", "black"]],
    identify: [2, 4],
    success: "马有炮作保护。用车去换马，等于 9 换 4，不能走。",
  },
  "exchange-value": {
    title: "这次交换值不值",
    explain: "用入门分值算净结果：车 9、炮 4.5、马 4、仕相 2、兵 1。用马吃炮赚 0.5；用马吃仕只赚 2，明显不如吃炮。先算完再动手。",
    chips: ["炮 4.5", "卒 1", "净得分"],
    values: [
      ["车", "9"],
      ["炮", "4.5"],
      ["马", "4"],
      ["仕 / 相", "2"],
      ["兵", "1"],
    ],
    instruction: "红马可以吃黑炮（4.5）或黑卒（1）。走马，吃掉分值更高的那枚。",
    hint: "炮 4.5 比卒 1 值钱得多。选吃炮。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [6, 4, "horse", "red"], [5, 2, "cannon", "black"], [7, 2, "pawn", "black"], [0, 4, "general", "black"]],
    expectedMoves: [[6, 4, 5, 2]],
    success: "马 4 换炮 4.5 是小赚；换卒只赚 1 分。先算分，再动手。",
  },
  pin: {
    title: "牵制",
    explain: "一枚棋想走，但一走就会露出后面的将或其他重子。它被牵住了。先认关系，再谈术语。",
    chips: ["不能走", "露将"],
    instruction: "红车、黑马、黑将在同一路。点出这枚被牵住的黑马。",
    hint: "马一离开，车就会直接打到将。",
    mode: "identify",
    pieces: [[9, 3, "general", "red"], [7, 4, "rook", "red"], [3, 4, "horse", "black"], [0, 4, "general", "black"]],
    identify: [3, 4],
    success: "马被自己的将拖住了。这种棋暂时不能轻易走开。",
  },
  "mate-in-one": {
    title: "一步杀",
    explain: "将死是对方已经被将，并且没有任何逃、挡、吃的合法应将。入门只练能一眼看清的杀，不背复杂杀法名称。",
    chips: ["封锁逃点", "将死"],
    instruction: "另一枚红车已经管住将的前方。把这枚车走到黑将的底线，做成将死。",
    hint: "走到将所在的那条横线，并且不要给将留下可逃的交叉点。",
    mode: "moves",
    pieces: [[9, 3, "general", "red"], [5, 0, "rook", "red"], [1, 8, "rook", "red"], [0, 4, "general", "black"]],
    expectedMoves: [[5, 0, 0, 0]],
    success: "底线被车控制，前方又被另一枚车封住，将没有合法落点。",
  },
  "one-ply-blunder-check": {
    title: "走之前再看一眼",
    explain: "落子前固定问：我会被将吗？走的这枚棋会不会被白吃？对方有没有直接吃子？帅还安全吗？这比记住开局名称更重要。",
    chips: ["被将？", "白吃？", "对方吃子？"],
    instruction: "如果红马还站在这里，黑车就能白吃它。点出那枚会吃掉红马的黑车。",
    hint: "看和红马同一横线的远程棋。",
    mode: "identify",
    pieces: [[9, 4, "general", "red"], [6, 4, "horse", "red"], [6, 0, "rook", "black"], [0, 3, "general", "black"]],
    identify: [6, 0],
    success: "马没有保护，又和车同一线。这种棋走出来前就要看见。",
  },
  "develop-rooks": {
    title: "车贵神速",
    explain: "开局不要先去捡兵。当代棋理是尽快出动强子，尤其是车。车开到河口，整条直线才真正参战。",
    chips: ["出车", "不要贪兵", "一子不频移"],
    instruction: "把底线红车开到河口。",
    hint: "沿自己所在的直线向前走到河界附近。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [9, 0, "rook", "red"], [0, 3, "general", "black"]],
    expectedMoves: [[9, 0, 5, 0]],
    success: "车出来了。开局把车关在家里，就是浪费 9 分的子力。",
  },
  "open-rook-line": {
    title: "给车让路",
    explain: "车再强，前面被自己的兵堵住也没用。打开车线，是出车的一部分，不是摆好看。",
    chips: ["车线", "挺兵"],
    instruction: "这枚兵挡住了底线车。把它向前挺一步，让车亮出来。",
    hint: "兵未过河只能向前。挺开以后，车的直线就通了。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [9, 0, "rook", "red"], [6, 0, "pawn", "red"], [0, 3, "general", "black"]],
    expectedMoves: [[6, 0, 5, 0]],
    success: "兵一让，车就有路。开局经常是先给车腾线，再出车。",
  },
  "blunder-checklist": {
    title: "落子前最后看一眼",
    explain: "计算课的核心不是想很远，而是每次落子前问：被将了吗？这枚棋会被白吃吗？对方能直接吃子吗？帅还安全吗？",
    chips: ["被将", "白吃", "帅安全"],
    instruction: "这枚红炮没有保护，又对着黑车。点出这枚现在不能随便丢掉的红炮。",
    hint: "同一路上，车可以直接吃到没有保护的炮。",
    mode: "identify",
    pieces: [[9, 3, "general", "red"], [7, 4, "cannon", "red"], [2, 4, "rook", "black"], [0, 3, "general", "black"]],
    identify: [7, 4],
    success: "炮 4.5 分，被车白吃就是大亏。先看见悬子，再决定走哪步。",
  },
  "soldier-endgame": {
    title: "过河兵更有价值",
    explain: "残局里分值会变。未过河兵大约 1 分；过河后大约 2 分，还能当炮架、卡将门。逼近九宫的兵，有时比仕相更麻烦。",
    chips: ["兵 1", "过河约 2", "越近越值钱"],
    values: [
      ["未过河兵", "1"],
      ["过河兵", "约 2"],
      ["仕 / 相", "2"],
    ],
    instruction: "一枚兵还在己方，一枚已经过河。点出更有价值的那枚过河兵。",
    hint: "过了楚河汉界的兵，可以横走，也更接近对方将。",
    mode: "identify",
    pieces: [[9, 4, "general", "red"], [6, 2, "pawn", "red"], [4, 6, "pawn", "red"], [0, 4, "general", "black"]],
    identify: [4, 6],
    success: "过河兵约 2 分。残局不要随手把过河兵兑掉。",
  },
  "game-goal": {
    title: "怎样才算赢",
    explain: "中国象棋的目标是将死对方的将/帅，或让对方无合法着可走（困毙也算输）。没有国际象棋那种逼和。赢的是将，不是吃光棋子。",
    chips: ["将死", "困毙也输", "将是目标"],
    instruction: "这个黑将已经被两枚车封死。点出这枚决定胜负的将。",
    hint: "找黑方的将，不是找车。",
    mode: "identify",
    pieces: [[9, 3, "general", "red"], [0, 0, "rook", "red"], [1, 8, "rook", "red"], [0, 4, "general", "black"]],
    identify: [0, 4],
    success: "一切子力都是为了将死对方的将。先记住这个目标。",
  },
  "board-intersections": {
    title: "棋子站交叉点",
    explain: "中国象棋下在交叉点上，不是方格里。棋盘 9 路 10 条横线，一共 90 个点。红黑从各自右侧数路。",
    chips: ["交叉点", "9 路", "10 横"],
    instruction: "点出楚河汉界上的一个交叉点。",
    hint: "河界在棋盘正中央那一带，大约第 5、第 6 条横线。",
    mode: "identify",
    pieces: [],
    identifyAny: [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5], [4, 6], [4, 7], [4, 8], [5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5], [5, 6], [5, 7], [5, 8]],
    success: "以后看棋，都按交叉点来想，不要按格子来想。",
  },
  "turn-and-capture": {
    title: "轮流走与吃子",
    explain: "一次只能走自己的一枚棋。吃子就是走到对方棋所在的交叉点，把它拿掉。不能吃自己的棋。",
    chips: ["轮流", "走到即吃"],
    instruction: "用红车走到黑卒所在的交叉点，把它吃掉。",
    hint: "车走直线。黑卒就在同一条纵线上。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [9, 0, "rook", "red"], [6, 0, "pawn", "black"], [0, 3, "general", "black"]],
    expectedMoves: [[9, 0, 6, 0]],
    success: "吃子后，你的棋占据那个交叉点。",
  },
  "initial-setup": {
    title: "帅的初始位置",
    explain: "开局时帅在己方底线正中，也就是九宫最下面的中点。先记住将帅的家，再记其他棋。",
    chips: ["帅在中", "九宫底"],
    instruction: "点出红帅现在的位置。这也是开局时帅该在的家。",
    hint: "红方底线中央，九宫最下。",
    mode: "identify",
    pieces: [[9, 4, "general", "red"], [9, 0, "rook", "red"], [9, 8, "rook", "red"], [0, 4, "general", "black"]],
    identify: [9, 4],
    success: "帅的家在底线中路。开局不要无故把帅走出来。",
  },
  "general-move": {
    title: "帅在九宫里走一步",
    explain: "帅只能在九宫内横或竖走一格，不能斜走，不能出九宫。",
    chips: ["九宫", "一步", "不斜走"],
    instruction: "把红帅向上走一步。",
    hint: "只能走一格，而且必须仍在九宫里。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [0, 3, "general", "black"]],
    expectedMoves: [[9, 4, 8, 4]],
    success: "帅五进一。先习惯九宫这个笼子。",
  },
  "advisor-move": {
    title: "仕走斜线守九宫",
    explain: "仕只能在九宫内斜走一格。它是纯防守子，分值约 2 分，用来护帅。",
    chips: ["斜一步", "不出九宫", "仕 2 分"],
    instruction: "把红仕斜进到九宫中央。",
    hint: "从底线角落的仕，斜着走一格到中心。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [9, 3, "advisor", "red"], [0, 3, "general", "black"]],
    expectedMoves: [[9, 3, 8, 4]],
    success: "仕四进五。这是最常见的补仕。",
  },
  "horse-move": {
    title: "马走日",
    explain: "马走日字：先一格再斜一格。没有蹩腿时，这就是马的基本步法。下一课再专门练蹩马腿。",
    chips: ["日字", "先看落点"],
    instruction: "把红马跳到左前方的日字位。",
    hint: "日字是两格直加一格横，或两格横加一格直。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [7, 4, "horse", "red"], [0, 3, "general", "black"]],
    expectedMoves: [[7, 4, 5, 3]],
    success: "这是没有蹩腿时的马步。下一步要记得先看马腿。",
  },
  "self-check-legality": {
    title: "不能把帅送给人",
    explain: "棋子会走，不等于这步合法。走完之后自己的帅不能处于被将状态。挡在帅前面的棋，常常暂时不能走开。",
    chips: ["自陷将军", "不合法"],
    instruction: "这枚红车正挡着对方车对帅的攻击。点出这枚现在不能随便离开的车。",
    hint: "车一让开，对方车就会直接打到帅。",
    mode: "identify",
    pieces: [[9, 4, "general", "red"], [5, 4, "rook", "red"], [0, 4, "rook", "black"], [0, 3, "general", "black"]],
    identify: [5, 4],
    success: "挡住来将的棋，先当它被钉住。这叫不能送将。",
  },
  "mixed-legality": {
    title: "合法着综合",
    explain: "把规则合在一起：马要看腿，炮要看架，帅要看九宫，还不能送将。会走不等于能走。",
    chips: ["马腿", "合法落点"],
    instruction: "前方马腿是空的。把红马跳到右前方的日字。",
    hint: "不要跳到被堵住的方向。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [8, 4, "horse", "red"], [0, 3, "general", "black"]],
    expectedMoves: [[8, 4, 6, 5]],
    success: "这步马既符合日字，也没有蹩腿，也不会送将。",
  },
  "attack-map": {
    title: "谁在攻击谁",
    explain: "先看见关系：哪枚棋正在打哪枚棋。能攻击不等于应该马上吃。",
    chips: ["攻击关系", "先看见"],
    instruction: "红车和黑马在同一条直线上。点出正在攻击黑马的红车。",
    hint: "车走直线，中间没有遮挡就能打到。",
    mode: "identify",
    pieces: [[9, 3, "general", "red"], [9, 4, "rook", "red"], [4, 4, "horse", "black"], [0, 3, "general", "black"]],
    identify: [9, 4],
    success: "先建立攻击图，再决定吃不吃。",
  },
  "capture-available": {
    title: "现在谁能被吃",
    explain: "每步扫描当前所有直接能吃的目标。有吃不代表该吃，但必须先看见。",
    chips: ["直接吃子"],
    instruction: "用红车吃掉同一条直线上没有保护的黑卒。",
    hint: "车沿直线走到卒的交叉点。",
    mode: "moves",
    pieces: [[9, 3, "general", "red"], [9, 8, "rook", "red"], [4, 8, "pawn", "black"], [0, 3, "general", "black"]],
    expectedMoves: [[9, 8, 4, 8]],
    success: "这是当前盘面上最直接的吃子。",
  },
  "opponent-intent": {
    title: "对方在威胁什么",
    explain: "不要编故事。只看对方下一步最直接的手段：将军、吃子、捉子。",
    chips: ["直接威胁"],
    instruction: "黑车盯着红马。点出正在被捉的红马。",
    hint: "同一横线上，车可以直接吃到马。",
    mode: "identify",
    pieces: [[9, 4, "general", "red"], [6, 4, "horse", "red"], [6, 0, "rook", "black"], [0, 3, "general", "black"]],
    identify: [6, 4],
    success: "对方这手的意图就是捉马。先看见，再处理。",
  },
  "hanging-piece": {
    title: "悬子",
    explain: "受攻、又没有可靠保护或战术回应的棋，就是悬子。悬子要优先处理。",
    chips: ["受攻", "无保护"],
    instruction: "黑炮隔炮架打着红马，红马没有保护。点出这枚悬子。",
    hint: "看被炮隔子打到、且吃不回来的那枚马。",
    mode: "identify",
    pieces: [[9, 4, "general", "red"], [7, 4, "horse", "red"], [5, 4, "pawn", "black"], [2, 4, "cannon", "black"], [0, 3, "general", "black"]],
    identify: [7, 4],
    success: "马 4 分悬在那里。下一手要躲、保、挡或反打。",
  },
  "defense-options": {
    title: "受攻后先躲开",
    explain: "强子受攻时，常见回应是躲、保、挡、吃、换。入门先练最稳的：把马走到不受攻击的日字。",
    chips: ["躲", "保", "挡"],
    instruction: "红马被炮打着。把它跳到安全的日字位，离开这条炮线。",
    hint: "离开这条纵线，炮就打不到了。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [7, 4, "horse", "red"], [5, 4, "pawn", "black"], [2, 4, "cannon", "black"], [0, 3, "general", "black"]],
    expectedMoves: [[7, 4, 5, 5]],
    success: "马离开炮线。躲是五种防守里最直接的一种。",
  },
  exchange: {
    title: "交换是一来一回",
    explain: "交换不是只看第一口。兵换兵是 1 换 1；要问换完之后局面有没有变坏。",
    chips: ["对等交换", "兵 1"],
    instruction: "用红兵吃掉对面的黑卒，完成一次兵换兵。",
    hint: "兵只能向前吃斜前方。这枚卒就在它前面。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [6, 4, "pawn", "red"], [5, 4, "pawn", "black"], [0, 3, "general", "black"]],
    expectedMoves: [[6, 4, 5, 4]],
    success: "这是最简单的交换。下一课用 9 / 4.5 / 4 去算值不值。",
  },
  "stalemate-loss": {
    title: "无棋可走也是输",
    explain: "中国象棋没有国际象棋的逼和。将没有被将、但一步都走不了，叫困毙，算输。",
    chips: ["困毙", "不是和棋"],
    instruction: "黑将没有被将军，但所有落点都被管住。点出已经困毙的将。",
    hint: "找黑将。它无路可走。",
    mode: "identify",
    pieces: [[9, 3, "general", "red"], [1, 0, "rook", "red"], [2, 2, "horse", "red"], [2, 6, "horse", "red"], [0, 4, "general", "black"]],
    identify: [0, 4],
    success: "困毙在中国象棋里是输，不是和。残局算逃点时要记住。",
  },
  "rook-mate-geometry": {
    title: "车卡肋道",
    explain: "车杀最常见的几何是封住将的横线或肋道（将旁边的直线）。先占线，再收网。",
    chips: ["肋道", "封线"],
    instruction: "把红车沿直线开到黑将旁边的肋道上。",
    hint: "将在中路。旁边一路就是肋道。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [8, 3, "rook", "red"], [0, 4, "general", "black"]],
    expectedMoves: [[8, 3, 1, 3]],
    success: "车在肋道上，将的一侧活动被切断了。",
  },
  "cannon-mate-geometry": {
    title: "炮架杀将",
    explain: "炮要隔子打将。杀法里炮架和封锁逃点一样重要。开局炮强，就是因为炮架多。",
    chips: ["炮架", "隔子将"],
    instruction: "把红炮平到中路，隔着兵向黑将将军。",
    hint: "炮和将之间已经有一个兵当炮架。炮要走到同一条直线。",
    mode: "moves",
    pieces: [[9, 3, "general", "red"], [5, 0, "cannon", "red"], [2, 4, "pawn", "red"], [0, 4, "general", "black"]],
    expectedMoves: [[5, 0, 5, 4]],
    success: "中路有炮架，炮就能隔子将军。",
  },
  "horse-mate-geometry": {
    title: "马控制逃点",
    explain: "马的杀法靠日字卡住将的门口，比如钓鱼马。先学会跳到能将军的位置。",
    chips: ["钓鱼马", "卡门"],
    instruction: "把红马跳到能将军的日字位。",
    hint: "目标是打到黑将，同时靠近九宫门口。",
    mode: "moves",
    pieces: [[9, 3, "general", "red"], [4, 4, "horse", "red"], [0, 4, "general", "black"]],
    expectedMoves: [[4, 4, 2, 5]],
    success: "马在这个位置打将，并盯着部分逃点。",
  },
  "double-check": {
    title: "双将",
    explain: "两枚棋同时将军时，对方很难同时挡两个方向，通常只能逃将。闪击经常造成双将。",
    chips: ["两个方向", "只能逃"],
    instruction: "把挡住车的红马跳开，让车和马同时将军。",
    hint: "马跳离这条纵线，车就露出来；马自己落地也要打到将。",
    mode: "moves",
    pieces: [[9, 3, "general", "red"], [7, 4, "rook", "red"], [4, 4, "horse", "red"], [0, 4, "general", "black"]],
    expectedMoves: [[4, 4, 2, 3]],
    success: "车和马同时将，这就是双将。",
  },
  "mate-in-two": {
    title: "两步杀的第一手",
    explain: "两步杀要先看对方所有应将。入门先走那步只留一种应将的将军。",
    chips: ["先将", "限制逃点"],
    instruction: "把车开到将的肋道将军。这是两步杀里该先走的那手。",
    hint: "走到将旁边那条直线上。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [8, 3, "rook", "red"], [0, 4, "general", "black"]],
    expectedMoves: [[8, 3, 1, 3]],
    success: "先把将的路逼窄。真正的第二步杀，要等对方应将后再走。",
  },
  skewer: {
    title: "串击",
    explain: "直线上前面是将或重子，后面还藏着一个目标。先打前面的，它一逃，后面就能吃。",
    chips: ["先打前面", "再吃后面"],
    instruction: "把红车走到黑将所在的底线。将一让，后面的车就露出来。",
    hint: "将和黑车已经在同一横线。红车要加入这条线。",
    mode: "moves",
    pieces: [[9, 3, "general", "red"], [5, 8, "rook", "red"], [0, 4, "general", "black"], [0, 0, "rook", "black"]],
    expectedMoves: [[5, 8, 0, 8]],
    success: "将在前、车在后，这就是串。",
  },
  "discovered-attack": {
    title: "闪击",
    explain: "自己的棋挡住了后面车或炮的线。一让开，攻击突然出现。常常顺便自己也将军，变成双将。",
    chips: ["让开", "后面发力"],
    instruction: "把挡住红车的马跳开，让车直接将军。",
    hint: "马现在站在车和将之间的纵线上。",
    mode: "moves",
    pieces: [[9, 3, "general", "red"], [7, 4, "rook", "red"], [5, 4, "horse", "red"], [0, 4, "general", "black"]],
    expectedMoves: [[5, 4, 3, 5]],
    success: "马一让，车的将军就出现了。",
  },
  "remove-defender": {
    title: "先拿掉保镖",
    explain: "有的棋看起来有保护，保护者本身却能被先吃掉。先消除保护者，目标就变成悬子。",
    chips: ["先吃保护者"],
    instruction: "黑车正在保护黑马。用红炮隔子吃掉这枚护卫车。",
    hint: "炮和黑车之间已经有一个炮架。",
    mode: "moves",
    pieces: [[9, 3, "general", "red"], [9, 0, "cannon", "red"], [6, 0, "pawn", "red"], [4, 0, "rook", "black"], [4, 4, "horse", "black"], [0, 3, "general", "black"]],
    expectedMoves: [[9, 0, 4, 0]],
    success: "护卫一没，马就悬了。",
  },
  "trap-piece": {
    title: "困马",
    explain: "困子是先断逃跑空间。马最怕腿被堵死。四条马腿都被占住，这马就几乎废了。",
    chips: ["堵腿", "无路"],
    instruction: "这匹黑马的四条腿都被堵住。点出这枚被困住的马。",
    hint: "看哪匹马四周正交位置都被占满。",
    mode: "identify",
    pieces: [[9, 3, "general", "red"], [1, 2, "pawn", "red"], [2, 1, "pawn", "red"], [2, 3, "pawn", "red"], [3, 2, "pawn", "red"], [2, 2, "horse", "black"], [0, 4, "general", "black"]],
    identify: [2, 2],
    success: "马腿全堵，这马暂时没有日字可跳。",
  },
  "horse-leg-tactic": {
    title: "打开马腿",
    explain: "自己的兵蹩住马，是开局常见的事。挺开马腿，马才能参战。",
    chips: ["挺兵", "马腿"],
    instruction: "自己的兵蹩着马。把兵向前挺一步，打开马腿。",
    hint: "兵未过河只能向前。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [7, 4, "horse", "red"], [6, 4, "pawn", "red"], [0, 3, "general", "black"]],
    expectedMoves: [[6, 4, 5, 4]],
    success: "兵一进，马就能向前跳了。",
  },
  "cannon-screen-tactic": {
    title: "给炮搭架",
    explain: "炮的攻击随炮架变化。把棋走到炮和目标之间，攻击线就出现了。",
    chips: ["炮架", "变招"],
    instruction: "把过河兵平到炮和黑车之间，给炮搭一座架。",
    hint: "过河兵可以左右平。走到炮和车同一条纵线。",
    mode: "moves",
    pieces: [[9, 3, "general", "red"], [7, 4, "cannon", "red"], [4, 5, "pawn", "red"], [2, 4, "rook", "black"], [0, 3, "general", "black"]],
    expectedMoves: [[4, 5, 4, 4]],
    success: "炮架一立，炮就能隔子打车。",
  },
  "tactical-combination": {
    title: "两步连在一起",
    explain: "第一招往往只是打开条件。先挺兵开马腿，再跳马，这才是连续战术。",
    chips: ["先开腿", "再跳马"],
    instruction: "先挺开蹩马的兵，再把马跳到右前方。",
    hint: "两手都是红方走。先兵后马。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [7, 4, "horse", "red"], [6, 4, "pawn", "red"], [0, 3, "general", "black"]],
    expectedMoves: [[6, 4, 5, 4], [7, 4, 5, 5]],
    success: "先创造条件，再出击。战术经常是两步，不是一步。",
  },
  "candidate-moves": {
    title: "先找候选，不要第一眼就走",
    explain: "每步先列出 2–3 个候选：将军、吃子、防守、出子。不要看一眼就走。",
    chips: ["先列", "再选"],
    instruction: "盘上有将军也有一个能吃的卒。点出最该进入候选的将军棋子。",
    hint: "强制手段优先进入候选名单。",
    mode: "identify",
    pieces: [[9, 3, "general", "red"], [6, 4, "rook", "red"], [3, 0, "pawn", "black"], [0, 4, "general", "black"]],
    identify: [6, 4],
    success: "将军必须进候选。吃卒可以稍后。",
  },
  "best-reply": {
    title: "对方最强回应",
    explain: "每个候选都要问：对方会怎么打回来？入门先练看见反吃。",
    chips: ["反吃", "最强回应"],
    instruction: "如果你用车吃马，对方会反吃。点出会反吃的那枚黑炮。",
    hint: "炮隔着炮架能打到马现在的位置。",
    mode: "identify",
    pieces: [[9, 3, "general", "red"], [9, 4, "rook", "red"], [6, 4, "horse", "black"], [4, 4, "pawn", "black"], [2, 4, "cannon", "black"], [0, 3, "general", "black"]],
    identify: [2, 4],
    success: "对方最强回应就是炮吃车。这步候选可以划掉。",
  },
  "two-ply": {
    title: "我想一步，他也想一步",
    explain: "两层计算：我走，他最强回应。吃马会被车吃回来，所以改吃没保护的卒。",
    chips: ["我走", "他走"],
    instruction: "想两步之后，用红车去吃没有保护的黑卒，而不是被保护的马。",
    hint: "马后面有保护。卒没有。",
    mode: "moves",
    pieces: [[9, 3, "general", "red"], [9, 0, "rook", "red"], [6, 0, "pawn", "black"], [6, 4, "horse", "black"], [7, 4, "pawn", "black"], [0, 3, "general", "black"]],
    expectedMoves: [[9, 0, 6, 0]],
    success: "两步一算：吃马亏车，吃卒才干净。",
  },
  "three-ply": {
    title: "再往前看一手",
    explain: "三层是：我走 → 他最强回应 → 我再走。入门先走那步能保持主动的将军。",
    chips: ["三层", "保持主动"],
    instruction: "把红车走到能将军的位置，这是三步计算的第一手。",
    hint: "车走到与将同一条直线、中间没有遮挡。",
    mode: "moves",
    pieces: [[9, 3, "general", "red"], [8, 0, "rook", "red"], [0, 4, "general", "black"]],
    expectedMoves: [[8, 0, 8, 4]],
    success: "先将，再看他逃哪，再决定第二手。",
  },
  "compare-lines": {
    title: "两条线比净分",
    explain: "比较两条吃子路线时，用 车9 炮4.5 马4 兵1。吃炮比吃卒多赚 3.5 分。",
    chips: ["炮 4.5", "卒 1"],
    values: [
      ["炮", "4.5"],
      ["卒", "1"],
    ],
    instruction: "红马可以吃炮或吃卒。走马，吃分值更高的炮。",
    hint: "4.5 比 1 大。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [6, 4, "horse", "red"], [5, 2, "cannon", "black"], [7, 2, "pawn", "black"], [0, 4, "general", "black"]],
    expectedMoves: [[6, 4, 5, 2]],
    success: "两条线一比，吃炮明显更好。",
  },
  "quiet-threat": {
    title: "安静的一步",
    explain: "好棋不一定立刻将军或吃子。跳到下一步就能捉双的位置，也是计算里的安静威胁。",
    chips: ["不吃不将", "下一步有威胁"],
    instruction: "把马跳到下一步就能形成威胁的位置。这步本身不吃子、不将军。",
    hint: "日字跳到棋盘中部，靠近对方。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [6, 2, "horse", "red"], [0, 4, "general", "black"]],
    expectedMoves: [[6, 2, 4, 3]],
    success: "这步很安静，但马已经进入能制造捉双的地带。",
  },
  "theoretical-result": {
    title: "多一个车就是理论优势",
    explain: "残局先数子。多一个车（9分）通常是理论胜势，不等于马上能杀，但交换时要保留这个优势。",
    chips: ["车 9", "多子"],
    instruction: "红方多一枚车。点出这个决定理论优势的车。",
    hint: "盘上红方有车，黑方没有车。",
    mode: "identify",
    pieces: [[9, 3, "general", "red"], [5, 0, "rook", "red"], [6, 4, "horse", "red"], [4, 4, "horse", "black"], [0, 3, "general", "black"]],
    identify: [5, 0],
    success: "多车是巨大优势。领先时避免无意义对兑。",
  },
  "rook-endgame-basics": {
    title: "车残局先限制将",
    explain: "车残局的核心是限制将的活动：占横线、卡肋、切断。先把将关小，再推进。",
    chips: ["限制将", "占线"],
    instruction: "把车开到黑将附近的横线，切断它向下活动。",
    hint: "走到将前面那条横线。",
    mode: "moves",
    pieces: [[9, 3, "general", "red"], [9, 8, "rook", "red"], [0, 4, "general", "black"]],
    expectedMoves: [[9, 8, 1, 8]],
    success: "车占住将门前的横线，将的空间被压缩了。",
  },
  "minor-piece-endgame": {
    title: "残局马比炮灵活",
    explain: "棋子少了，炮架也少了，炮的远程优势下降。马在开阔残局里往往更灵活。这和开局正好相反。",
    chips: ["残局马", "炮要架"],
    instruction: "这个残局里几乎没有炮架。点出更有用的红马。",
    hint: "炮缺少炮架时，马更能跳着找将。",
    mode: "identify",
    pieces: [[9, 4, "general", "red"], [6, 4, "horse", "red"], [7, 1, "cannon", "red"], [0, 4, "general", "black"]],
    identify: [6, 4],
    success: "开局偏爱炮，残局常常更靠马。分值会随阶段变化。",
  },
  "simplify-when-ahead": {
    title: "领先就简化",
    explain: "多子时，对等交换通常有利，因为优势被放大，对方反击子减少。用马换马，把多余的车留下来。",
    chips: ["多子兑子", "留车"],
    instruction: "红方已经多一个车。用红马换掉黑马，简化局面。",
    hint: "马跳日字，吃掉那匹黑马。",
    mode: "moves",
    pieces: [[9, 3, "general", "red"], [5, 0, "rook", "red"], [6, 4, "horse", "red"], [5, 2, "horse", "black"], [0, 3, "general", "black"]],
    expectedMoves: [[6, 4, 5, 2]],
    success: "4 换 4，但你还多一个 9 分的车。领先时这种兑换常常正确。",
  },
  "defend-worse-position": {
    title: "落后不要再兑",
    explain: "少子时避免无意义简化。先保住还能制造威胁的棋，让对方还有出错空间。",
    chips: ["不随便兑", "保子"],
    instruction: "红方没有车了。点出这枚必须先保住的红马，不要再拿去兑。",
    hint: "马是你剩下的主要进攻子。",
    mode: "identify",
    pieces: [[9, 4, "general", "red"], [6, 4, "horse", "red"], [5, 0, "rook", "black"], [0, 3, "general", "black"]],
    identify: [6, 4],
    success: "落后时马是反击资本。先保住，再谈兑子。",
  },
  "free-horses": {
    title: "把马跳出来",
    explain: "开局双马不要长期挤在底线。马二进三 / 马八进七是最常见的出子。",
    chips: ["出马", "马路"],
    instruction: "把右底的红马跳到前线的日字位。",
    hint: "这是开局最常见的一步出马。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [9, 1, "horse", "red"], [0, 3, "general", "black"]],
    expectedMoves: [[9, 1, 7, 2]],
    success: "马出来了。开局要让马有路，不要自己堵死。",
  },
  "cannon-coordination": {
    title: "中炮",
    explain: "炮要有炮架，也要和其他子配合。炮二平五架中炮，是最常见的开局结构，不是唯一正确，但是入门该认识的。",
    chips: ["中炮", "炮架"],
    instruction: "把红炮平到中路，架起中炮。",
    hint: "沿着炮所在的横线，走到中路。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [7, 1, "cannon", "red"], [0, 4, "general", "black"]],
    expectedMoves: [[7, 1, 7, 4]],
    success: "中炮对准将门。下一步才是出车出马配合。",
  },
  "general-safety": {
    title: "先补仕",
    explain: "开局不要无故把帅暴露在中路开放线上。补仕是最基本的将帅安全。",
    chips: ["补仕", "帅安全"],
    instruction: "把红仕斜进到中路，护住帅。",
    hint: "仕四进五：从底线斜进一格。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [9, 3, "advisor", "red"], [0, 3, "general", "black"]],
    expectedMoves: [[9, 3, 8, 4]],
    success: "仕补上了。开局先求稳，再求攻。",
  },
  "development-tempo": {
    title: "一子不频移",
    explain: "开局最亏的是同一枚棋连走很多步，而车马还在家里。效率比小便宜重要。",
    chips: ["出子效率", "不要连走"],
    instruction: "这枚炮已经冲得很深，车马却还在原位。点出这枚开局不该频移的炮。",
    hint: "找离开自己阵地太远的那枚炮。",
    mode: "identify",
    pieces: [[9, 4, "general", "red"], [9, 0, "rook", "red"], [9, 1, "horse", "red"], [2, 4, "cannon", "red"], [0, 3, "general", "black"]],
    identify: [2, 4],
    success: "炮走太远、车马没动，就是开局效率差。",
  },
  "central-cannon-screen-horse": {
    title: "中炮对屏风马",
    explain: "中炮攻中路；屏风马用两匹马护住中兵，是当代最主流的对局结构。先认形状，不背变化。",
    chips: ["中炮", "屏风马"],
    instruction: "黑方两匹马像屏风一样护着中路。点出其中一匹屏风马。",
    hint: "马在第二、八路过河前的位置。",
    mode: "identify",
    pieces: [[9, 4, "general", "red"], [7, 4, "cannon", "red"], [2, 2, "horse", "black"], [2, 6, "horse", "black"], [3, 4, "pawn", "black"], [0, 4, "general", "black"]],
    identifyAny: [[2, 2], [2, 6]],
    success: "这就是屏风马的骨架。记住形状即可。",
  },
  "same-opposite-cannon": {
    title: "顺炮",
    explain: "双方都架中炮，叫顺炮，对攻更快。列炮是炮在另一侧。入门只认结构，不背谱。",
    chips: ["顺炮", "对攻"],
    instruction: "红黑都把炮放在中路。点出黑方的中炮。",
    hint: "中路那枚黑炮。",
    mode: "identify",
    pieces: [[9, 4, "general", "red"], [7, 4, "cannon", "red"], [2, 4, "cannon", "black"], [0, 4, "general", "black"]],
    identify: [2, 4],
    success: "双方中炮相对，就是顺炮结构。",
  },
  "alternative-openings": {
    title: "飞相局",
    explain: "不一定第一步中炮。飞相局先补中相，求稳健协调。当代入门也要认识非中炮开局。",
    chips: ["飞相", "不一定中炮"],
    instruction: "把红相飞到中路，形成飞相局。",
    hint: "相走田。中路的田字位在前方。",
    mode: "moves",
    pieces: [[9, 4, "general", "red"], [9, 2, "elephant", "red"], [0, 3, "general", "black"]],
    expectedMoves: [[9, 2, 7, 4]],
    success: "相三进五。开局可以先求结构，再求对攻。",
  },
  "opening-review": {
    title: "找出开局原则错误",
    explain: "看短开局时只问：车出来了吗？马路通吗？帅安全吗？有没有无谓贪兵？",
    chips: ["出车", "原则错误"],
    instruction: "已经走了几步，这枚车还在角落。点出这个违反出车原则的棋子。",
    hint: "找还在底线角落的车。",
    mode: "identify",
    pieces: [[9, 4, "general", "red"], [9, 0, "rook", "red"], [7, 4, "cannon", "red"], [7, 2, "horse", "red"], [0, 3, "general", "black"]],
    identify: [9, 0],
    success: "炮马都动了，车还在家，这就是开局原则问题。",
  },
  "decision-loop": {
    title: "每手决策顺序",
    explain: "完整循环：对方在将我吗？我能将对方吗？有无直接吃子？强子安全吗？再选出子或改善。",
    chips: ["将", "吃", "安全", "出子"],
    instruction: "按决策循环，先处理强制。点出正在将军的棋子。",
    hint: "不要先看出子，先看将军。",
    mode: "identify",
    pieces: [[9, 3, "general", "red"], [5, 4, "rook", "red"], [3, 0, "pawn", "black"], [0, 4, "general", "black"]],
    identify: [5, 4],
    success: "决策循环永远从强制手段开始。",
  },
  "transition-plan": {
    title: "阶段变了，目标也变",
    explain: "开局重出子，中局重战术，残局重兑现。大子兑光以后，过河兵会变成主角。",
    chips: ["开局", "中局", "残局"],
    instruction: "大子已经很少。点出残局里最该关注的过河兵。",
    hint: "已经过河、靠近对方的那枚兵。",
    mode: "identify",
    pieces: [[9, 4, "general", "red"], [4, 4, "pawn", "red"], [6, 2, "pawn", "red"], [0, 4, "general", "black"]],
    identify: [4, 4],
    success: "进入残局，过河兵的地位会上升。",
  },
  "time-management": {
    title: "关键点多想",
    explain: "不是每步都要想很久。将军、交换、将死附近才是该加时间的关键节点。",
    chips: ["关键点", "强制"],
    instruction: "这是将军，必须算清。点出这个关键强制点上的棋子。",
    hint: "正在将军的那枚。",
    mode: "identify",
    pieces: [[9, 3, "general", "red"], [6, 4, "rook", "red"], [0, 4, "general", "black"]],
    identify: [6, 4],
    success: "遇到将军，停下多算。平常出子可以快。",
  },
  "self-review": {
    title: "先找自己的错",
    explain: "复盘不要先翻引擎最佳着。先找被白吃、被将、交换亏的棋。",
    chips: ["先自己找", "白吃"],
    instruction: "这枚车没有保护，会被对方直接吃掉。点出这枚该在复盘里标出来的车。",
    hint: "同一条直线上有对方的车盯着它。",
    mode: "identify",
    pieces: [[9, 4, "general", "red"], [7, 4, "rook", "red"], [2, 4, "rook", "black"], [0, 3, "general", "black"]],
    identify: [7, 4],
    success: "复盘先标这种明显漏着。不要从引擎第一着开始背。",
  },
  "personalized-retraining": {
    title: "漏洞回到对应课",
    explain: "棋理的学习闭环：对局暴露保护问题，就回来练保护，而不是再刷一本开局。",
    chips: ["对局", "漏洞", "回练"],
    instruction: "这是保护课会出现的典型漏洞。点出那枚没人保护的马。",
    hint: "被炮隔打、且没有保护的马。",
    mode: "identify",
    pieces: [[9, 4, "general", "red"], [7, 4, "horse", "red"], [5, 4, "pawn", "black"], [2, 4, "cannon", "black"], [0, 3, "general", "black"]],
    identify: [7, 4],
    success: "看见这类马，就回到保护课。学习中心会按你的对局这样推荐。",
  },
};

const root = document.querySelector("#learnView");
if (root) {
  const rules = () => window.QiliTutorialRules;
  let view = "home";
  let skillId = null;
  let lessonId = null;
  let engine = {
    board: [],
    selected: null,
    legal: [],
    moveIndex: 0,
    landmarkHits: new Set(),
    complete: false,
    message: null,
  };

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "null") || { completed: {}, lastLessonId: null };
    } catch {
      return { completed: {}, lastLessonId: null };
    }
  }

  function saveProgress(next) {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  }

  function markLessonComplete(id) {
    const progress = loadProgress();
    progress.completed[id] = Date.now();
    progress.lastLessonId = id;
    saveProgress(progress);
  }

  function isComplete(id) {
    return Boolean(loadProgress().completed[id]);
  }

  function lessonsForSkill(skill) {
    const stages = QILI_CURRICULUM_STAGES.filter((stage) => skill.stageIds.includes(stage.id));
    return stages.flatMap((stage) => stage.lessons.map((lesson) => ({ ...lesson, stageId: stage.id, stageTitle: stage.title })));
  }

  function playableLessons(skill) {
    return lessonsForSkill(skill).filter((lesson) => INTERACTIVE[lesson.id]);
  }

  function skillProgress(skill) {
    const playable = playableLessons(skill);
    const done = playable.filter((lesson) => isComplete(lesson.id)).length;
    return { done, total: playable.length };
  }

  function loadSignals() {
    try {
      return JSON.parse(localStorage.getItem(SIGNALS_KEY) || "null");
    } catch {
      return null;
    }
  }

  function recommend() {
    const progress = loadProgress();
    const signals = loadSignals();
    const playableIds = QILI_CURRICULUM_STAGES.flatMap((stage) => stage.lessons.map((lesson) => lesson.id)).filter((id) => INTERACTIVE[id]);

    if (signals?.types?.length) {
      for (const type of signals.types) {
        const route = getReviewTrainingRoute(type);
        if (route?.noTraining || !route?.conceptId) continue;
        const chain = [route.conceptId, ...(route.prerequisites || [])];
        const target = chain.find((id) => INTERACTIVE[id] && !isComplete(id));
        if (target) {
          const concept = getCurriculumConcept(target);
          return {
            lessonId: target,
            title: INTERACTIVE[target].title,
            reason: signals.moveNotation
              ? `推荐因为最近 ${signals.moveNotation} 暴露了「${concept?.adultTitle || INTERACTIVE[target].title}」相关问题。`
              : `推荐因为最近对局里出现了「${concept?.adultTitle || INTERACTIVE[target].title}」的漏洞。`,
          };
        }
      }
    }

    const unfinished = playableIds.find((id) => !isComplete(id));
    if (!unfinished) {
      return {
        lessonId: playableIds[0],
        title: INTERACTIVE[playableIds[0]].title,
        reason: "可练习的课都完成了。再下一盘，让真实对局决定下一课。",
      };
    }

    if (progress.lastLessonId && INTERACTIVE[progress.lastLessonId]) {
      const ids = playableIds;
      const index = ids.indexOf(progress.lastLessonId);
      const nextId = ids.slice(index + 1).find((id) => !isComplete(id)) || ids.find((id) => !isComplete(id));
      if (nextId) {
        return {
          lessonId: nextId,
          title: INTERACTIVE[nextId].title,
          reason: isComplete(progress.lastLessonId) ? "接着上一课继续。" : "从上次停下的地方继续。",
        };
      }
    }

    const first = playableIds.find((id) => !isComplete(id)) || playableIds[0];
    return {
      lessonId: first,
      title: INTERACTIVE[first].title,
      reason: "从棋盘和走法开始，先建立不会走错的基础。",
    };
  }

  function skillForLesson(lessonId) {
    return SKILL_CATEGORIES.find((skill) => lessonsForSkill(skill).some((lesson) => lesson.id === lessonId)) || SKILL_CATEGORIES[0];
  }

  function ensureGenerals(board, spec) {
    const hasRed = board.flat().some((entry) => entry?.type === "general" && entry.color === "red");
    const hasBlack = board.flat().some((entry) => entry?.type === "general" && entry.color === "black");
    if (spec.mode === "moves") {
      if (!hasRed) board[9][4] = rules().piece("general", COLORS.RED);
      if (!hasBlack) board[0][3] = rules().piece("general", COLORS.BLACK);
    }
    return board;
  }

  function makeBoard(spec) {
    const { createEmptyBoard, piece } = rules();
    const board = createEmptyBoard();
    (spec.pieces || []).forEach(([row, col, type, color]) => {
      board[row][col] = piece(type, color);
    });
    return ensureGenerals(board, spec);
  }

  function resetEngine(spec) {
    engine = {
      board: makeBoard(spec),
      selected: null,
      legal: [],
      moveIndex: 0,
      landmarkHits: new Set(),
      complete: false,
      message: { kind: "neutral", heading: "轮到你", text: spec.instruction },
    };
  }

  function setMessage(kind, heading, text) {
    engine.message = { kind, heading, text };
  }

  function completeLesson(spec) {
    engine.complete = true;
    engine.selected = null;
    engine.legal = [];
    markLessonComplete(lessonId);
    setMessage("success", "正确", spec.success);
  }

  function handleLandmarks(row, col, spec) {
    if (!engine.landmarkHits.has("palace") && row >= 7 && row <= 9 && col >= 3 && col <= 5) {
      engine.landmarkHits.add("palace");
      setMessage("success", "找到九宫", "很好。现在再找河界。");
    } else if (!engine.landmarkHits.has("river") && (row === 4 || row === 5)) {
      engine.landmarkHits.add("river");
      setMessage("success", "找到河界", "楚河汉界在棋盘中央。");
    } else {
      setMessage("error", "再看一眼", spec.hint);
    }
    if (engine.landmarkHits.size === 2) completeLesson(spec);
  }

  function isIdentifyTarget(row, col, spec) {
    if (spec.identifyAny) return spec.identifyAny.some(([r, c]) => r === row && c === col);
    return spec.identify?.[0] === row && spec.identify?.[1] === col;
  }

  function handleIdentify(row, col, spec) {
    if (isIdentifyTarget(row, col, spec)) completeLesson(spec);
    else setMessage("error", "不是这里", spec.hint);
  }

  function handleFile(row, col, spec) {
    if (col === spec.fileCol) completeLesson(spec);
    else setMessage("error", "路数不对", spec.hint);
  }

  function handleMove(row, col, spec) {
    const { legalMovesForPiece, applyMove } = rules();
    const expected = spec.expectedMoves?.[engine.moveIndex];
    if (!expected) return;
    if (!engine.selected) {
      if (row !== expected[0] || col !== expected[1]) {
        setMessage("error", "先选对棋子", spec.hint);
        return;
      }
      engine.selected = { row, col };
      engine.legal = legalMovesForPiece(engine.board, row, col);
      setMessage("neutral", "已选中", "现在走到题目要求的落点。");
      return;
    }
    if (row === engine.selected.row && col === engine.selected.col) {
      engine.selected = null;
      engine.legal = [];
      return;
    }
    if (row !== expected[2] || col !== expected[3]) {
      setMessage("error", "落点不是本题目标", spec.hint);
      return;
    }
    const move = engine.legal.find((item) => item.toRow === row && item.toCol === col);
    if (!move) {
      setMessage("error", "这一步不合法", spec.hint);
      return;
    }
    engine.board = applyMove(engine.board, move).board;
    engine.moveIndex += 1;
    engine.selected = null;
    engine.legal = [];
    if (engine.moveIndex >= spec.expectedMoves.length) completeLesson(spec);
    else setMessage("success", "第一步正确", "继续下一手。");
  }

  function handleBoardClick(row, col) {
    if (engine.complete) return;
    const spec = INTERACTIVE[lessonId];
    if (!spec) return;
    if (spec.mode === "landmarks") handleLandmarks(row, col, spec);
    else if (spec.mode === "identify") handleIdentify(row, col, spec);
    else if (spec.mode === "file") handleFile(row, col, spec);
    else handleMove(row, col, spec);
    renderLessonBoard();
    renderLessonChrome();
  }

  function renderLessonBoard() {
    const boardEl = document.querySelector("#learnBoardPoints");
    if (!boardEl || !engine.board?.length) return;
    const spec = INTERACTIVE[lessonId];
    boardEl.innerHTML = "";
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        const point = document.createElement("button");
        point.className = "board-point";
        point.style.left = `${(col / 8) * 100}%`;
        point.style.top = `${(row / 9) * 100}%`;
        if (engine.selected?.row === row && engine.selected?.col === col) point.classList.add("selected");
        const legal = engine.legal.some((move) => move.toRow === row && move.toCol === col);
        const entry = engine.board[row][col];
        if (legal) point.classList.add(entry ? "capture" : "legal");
        if (spec?.mode === "landmarks" && engine.landmarkHits.has("palace") && row === 8 && col === 4) point.classList.add("last-to");
        if (spec?.mode === "file" && spec.fileCol === col) point.classList.add("selectable");
        if (entry) {
          const pieceEl = document.createElement("span");
          pieceEl.className = `piece ${entry.color}-piece`;
          pieceEl.textContent = entry.label;
          point.appendChild(pieceEl);
        }
        point.addEventListener("click", () => handleBoardClick(row, col));
        boardEl.appendChild(point);
      }
    }
  }

  function renderLessonChrome() {
    const spec = INTERACTIVE[lessonId];
    const feedback = document.querySelector("#learnFeedback");
    const next = document.querySelector("#learnLessonNext");
    if (!spec || !feedback) return;
    const message = engine.message || { kind: "neutral", heading: "轮到你", text: spec.instruction };
    feedback.className = `learn-feedback ${message.kind}`;
    feedback.innerHTML = `<strong>${message.heading}</strong><span>${message.text}</span>`;
    if (next) {
      next.disabled = !engine.complete;
      next.textContent = "完成并继续";
    }
  }

  function openHome() {
    view = "home";
    skillId = null;
    lessonId = null;
    render();
  }

  function openSkill(id) {
    view = "skill";
    skillId = id;
    lessonId = null;
    render();
  }

  function openLesson(id) {
    if (!INTERACTIVE[id] || !rules()) return;
    view = "lesson";
    lessonId = id;
    skillId = skillForLesson(id).id;
    resetEngine(INTERACTIVE[id]);
    render();
  }

  function homeHtml() {
    const rec = recommend();
    const recSkill = skillForLesson(rec.lessonId);
    const cards = SKILL_CATEGORIES.map((skill) => {
      const { done, total } = skillProgress(skill);
      const pct = total ? Math.round((done / total) * 100) : 0;
      return `<button class="learn-skill-card" data-open-skill="${skill.id}">
        <b>${String(SKILL_CATEGORIES.indexOf(skill) + 1).padStart(2, "0")}</b>
        <h2>${skill.title}</h2>
        <p>${skill.summary}</p>
        <div class="learn-skill-progress"><span>${total ? `可练习 ${done} / ${total}` : "先完成基础与战术"}<span>${pct}%</span></span><div class="learn-skill-track"><i style="width:${pct}%"></i></div></div>
      </button>`;
    }).join("");
    return `
      <div class="learn-hero">
        <div>
          <span class="eyebrow">LEARNING CENTER</span>
          <h1>学习中心</h1>
          <p>按技能学，不按一本大纲从头翻。有对局记录时，会优先补你刚暴露的漏洞。</p>
        </div>
      </div>
      <section class="learn-continue">
        <div>
          <span class="eyebrow">继续学习</span>
          <h2>${rec.title}</h2>
          <p>下一课属于「${recSkill.title}」。</p>
          <span class="learn-reason">${rec.reason}</span>
        </div>
        <button class="button button-primary" data-open-lesson="${rec.lessonId}">开始这课</button>
      </section>
      <div class="learn-skill-grid">${cards}</div>
      <div class="learn-kids-entry">
        <div>
          <strong>儿童课程</strong>
          <p>儿童版里的互动学习地图：一次一个规则，边走边懂。</p>
        </div>
        <button class="button button-ghost" id="learnOpenKids" type="button">打开儿童课程</button>
      </div>`;
  }

  function skillHtml() {
    const skill = SKILL_CATEGORIES.find((item) => item.id === skillId);
    if (!skill) return "";
    const playable = playableLessons(skill);
    const rows = playable.length
      ? playable.map((lesson, index) => {
        const done = isComplete(lesson.id);
        return `<button class="learn-lesson-row" data-open-lesson="${lesson.id}">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <div><strong>${INTERACTIVE[lesson.id].title}</strong><small>${lesson.objective}</small></div>
          <em class="${done ? "done" : ""}">${done ? "已完成" : "练习"}</em>
        </button>`;
      }).join("")
      : `<div class="learn-empty-skill"><strong>这一类暂时没有练习</strong><p>${skill.summary}</p></div>`;
    return `
      <button class="button button-ghost learn-back" data-learn-home type="button">返回学习中心</button>
      <div class="learn-hero"><div><span class="eyebrow">技能</span><h1>${skill.title}</h1><p>${skill.summary}</p></div></div>
      <div class="learn-lesson-list">${rows}</div>`;
  }

  function lessonHtml() {
    const spec = INTERACTIVE[lessonId];
    if (!spec) return "";
    const chips = spec.chips.map((chip) => `<span>${chip}</span>`).join("");
    const valueTable = spec.values
      ? `<table class="learn-value-table">${spec.values.map(([name, score]) => `<tr><th>${name}</th><td>${score}</td></tr>`).join("")}</table>`
      : "";
    return `
      <button class="button button-ghost learn-back" data-back-skill type="button">返回${skillForLesson(lessonId).title}</button>
      <div class="learn-lesson-shell">
        <aside class="learn-teach">
          <span class="eyebrow">讲解</span>
          <h2>${spec.title}</h2>
          <p>${spec.explain}</p>
          ${valueTable}
          <div class="learn-chips">${chips}</div>
          <p>${spec.instruction}</p>
          <div id="learnFeedback" class="learn-feedback"></div>
          <div class="learn-lesson-actions">
            <button class="button button-ghost" id="learnLessonReset" type="button">重来</button>
            <button class="button button-primary" id="learnLessonNext" type="button" disabled>完成并继续</button>
          </div>
        </aside>
        <div class="learn-board-wrap">
          <div class="xiangqi-board" aria-label="学习棋盘">
            <svg class="board-lines" viewBox="0 0 800 900" preserveAspectRatio="none" aria-hidden="true">
              <g class="grid-lines">
                <line x1="0" y1="0" x2="800" y2="0" /><line x1="0" y1="100" x2="800" y2="100" /><line x1="0" y1="200" x2="800" y2="200" />
                <line x1="0" y1="300" x2="800" y2="300" /><line x1="0" y1="400" x2="800" y2="400" /><line x1="0" y1="500" x2="800" y2="500" />
                <line x1="0" y1="600" x2="800" y2="600" /><line x1="0" y1="700" x2="800" y2="700" /><line x1="0" y1="800" x2="800" y2="800" />
                <line x1="0" y1="900" x2="800" y2="900" /><line x1="0" y1="0" x2="0" y2="900" />
                <line x1="100" y1="0" x2="100" y2="400" /><line x1="100" y1="500" x2="100" y2="900" />
                <line x1="200" y1="0" x2="200" y2="400" /><line x1="200" y1="500" x2="200" y2="900" />
                <line x1="300" y1="0" x2="300" y2="400" /><line x1="300" y1="500" x2="300" y2="900" />
                <line x1="400" y1="0" x2="400" y2="400" /><line x1="400" y1="500" x2="400" y2="900" />
                <line x1="500" y1="0" x2="500" y2="400" /><line x1="500" y1="500" x2="500" y2="900" />
                <line x1="600" y1="0" x2="600" y2="400" /><line x1="600" y1="500" x2="600" y2="900" />
                <line x1="700" y1="0" x2="700" y2="400" /><line x1="700" y1="500" x2="700" y2="900" />
                <line x1="800" y1="0" x2="800" y2="900" />
                <line x1="300" y1="0" x2="500" y2="200" /><line x1="500" y1="0" x2="300" y2="200" />
                <line x1="300" y1="700" x2="500" y2="900" /><line x1="500" y1="700" x2="300" y2="900" />
              </g>
              <text x="175" y="470" class="river-label">楚 河</text>
              <text x="625" y="470" class="river-label">汉 界</text>
            </svg>
            <div id="learnBoardPoints" class="board-points"></div>
          </div>
        </div>
      </div>`;
  }

  function bind() {
    root.querySelector("[data-learn-home]")?.addEventListener("click", openHome);
    root.querySelector("[data-back-skill]")?.addEventListener("click", () => openSkill(skillId));
    root.querySelectorAll("[data-open-skill]").forEach((button) => {
      button.addEventListener("click", () => openSkill(button.dataset.openSkill));
    });
    root.querySelectorAll("[data-open-lesson]").forEach((button) => {
      button.addEventListener("click", () => openLesson(button.dataset.openLesson));
    });
    root.querySelector("#learnOpenKids")?.addEventListener("click", () => {
      window.QiliKids?.openCourses?.();
    });
    root.querySelector("#learnLessonReset")?.addEventListener("click", () => {
      if (INTERACTIVE[lessonId]) {
        resetEngine(INTERACTIVE[lessonId]);
        renderLessonBoard();
        renderLessonChrome();
      }
    });
    root.querySelector("#learnLessonNext")?.addEventListener("click", () => {
      const rec = recommend();
      if (rec.lessonId && rec.lessonId !== lessonId) openLesson(rec.lessonId);
      else openSkill(skillId);
    });
  }

  function render() {
    if (view === "skill") root.innerHTML = skillHtml();
    else if (view === "lesson") root.innerHTML = lessonHtml();
    else root.innerHTML = homeHtml();
    bind();
    if (view === "lesson") {
      renderLessonBoard();
      renderLessonChrome();
    }
  }

  function ingestAnalysis(analysis) {
    if (!analysis) return;
    const types = [
      ...(analysis.chosenFacts || []).map((item) => item.type),
      ...(analysis.replyFacts || []).map((item) => item.type),
      ...(analysis.bestFacts || []).map((item) => item.type),
    ].filter(Boolean);
    if (!types.length && analysis.gap >= 100) types.push("material-loss");
    if (!types.length) return;
    localStorage.setItem(SIGNALS_KEY, JSON.stringify({
      at: Date.now(),
      types: [...new Set(types)].slice(0, 8),
      moveNotation: analysis.moveNotation || "",
      gap: analysis.gap,
    }));
  }

  window.QiliLearn = {
    ingestAnalysis,
    openLesson,
    openHome,
  };

  const refreshIfVisible = () => {
    if (view === "home" && !root.classList.contains("hidden")) render();
  };
  window.addEventListener("qili-game-finished", refreshIfVisible);
  new MutationObserver(refreshIfVisible).observe(root, { attributes: true, attributeFilter: ["class"] });

  render();
}
