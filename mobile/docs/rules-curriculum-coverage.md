# 中国象棋规则与儿童课程覆盖审计

审计对象：`xiangqi-server-rules.mjs`、`xiangqi-teaching-curriculum.mjs`、`kids-client.js`，以及在线对局的 `online-room-core.mjs`。结论只根据当前代码与可运行的静态导入结果，不把课程标题当成已经实现的规则判定。

## 代码基线

- 规则引擎是 10×9 棋盘，初始局面包含双方完整 16 子；运行时初始局面生成 44 个红方合法着法，状态为未结束、未将军。
- `KIDS_CHAPTERS` 的章节布局为 14 + 6 + 6 = 26 个概念位；`kids-client.js` 也定义了 26 个可玩的 LESSONS，并把概念按索引绑定。当前儿童端是“26 个引导题”，不是完整覆盖 77 个成人/通用课程 lesson。
- 儿童端的 move 题会先调用 `legalMovesForPiece`（标记 `legal: true` 时），但普通未标记题调用 `generatePseudoMoves`；因此“亮点能走”不总是等价于“整盘规则下合法”。

## 规则覆盖矩阵

| 规则主题 | 引擎现状 | 儿童课程/交互现状 | 移动端判断 |
|---|---|---|---|
| 棋盘 9 路、10 横、交叉点、九宫、河界 | 已实现：10×9 边界、双方九宫行列、相/象不过河、兵过河判定（`xiangqi-server-rules.mjs:1-5,38-49,100-108`） | 已教九宫与河界，并有 `zone` 点击题（`xiangqi-teaching-curriculum.mjs:84-101`；`kids-client.js:79-99,811-814`）。棋盘交叉点、初始摆法在通用课程定义中有明确 lesson，但儿童 26 题仅通过认棋/布局间接覆盖 | P0：移动棋盘必须把河界、九宫、交叉点和红黑方向做成可视化教学，不只靠文字 |
| 车 | 已实现四方向滑行、路径阻挡、终点吃子（`xiangqi-server-rules.mjs:63-87`） | 有车直线 move 题（`kids-client.js:103-112`），但题面主要验证一条开放线路 | P0：补“被挡不能越子、可吃/不可吃己方子”的动画对照 |
| 马与蹩马腿 | 已实现 8 个日字候选，并检查正交马腿为空（`xiangqi-server-rules.mjs:89-98`） | 有马走日与“找挡马腿”两题（`kids-client.js:113-134`），课程也列出 `horse-move`/`horse-leg`（`xiangqi-teaching-curriculum.mjs:147-153`） | P0：保留箭头指示马腿→目标落点的因果动画 |
| 相/象、象眼、不过河 | 已实现田字、象眼为空、红方不低于第 5 行/黑方不高于第 4 行（`xiangqi-server-rules.mjs:100-110`） | 课程定义覆盖“田字、象眼、不过河”，但当前 26 个 LESSONS 中没有独立 elephant move / elephant-eye 练习；只有第一关认棋（`xiangqi-teaching-curriculum.mjs:150,84-105`） | P0 缺口：移动端必须新增“堵象眼”和“河界不能过”两组棋盘题 |
| 仕/士 | 已实现九宫内斜一步（`xiangqi-server-rules.mjs:113-119`） | 有认棋，但没有独立走法题；通用课程有 `advisor-move`，不在儿童 26 题中（`xiangqi-teaching-curriculum.mjs:149`） | P1：与帅合并成“城堡里的两位守卫”互动题 |
| 将/帅与照面 | 已实现九宫内横竖一步；同一路无棋阻挡时允许伪走到对方将/帅（用于照面/将军几何）（`xiangqi-server-rules.mjs:121-134`） | 有帅走法题与将帅照面识别题（`kids-client.js:90-101,193-203`）；课程明确列出 `facing-generals`（`xiangqi-teaching-curriculum.mjs:148,155`） | P0：用“激光线/挡板”动画解释照面，避免只让孩子点挡子 |
| 炮、炮架 | 已实现无炮架时按车移动；恰好一个屏障后可吃第一个敌子，两个或更多屏障不能吃（`xiangqi-server-rules.mjs:63-85`） | 有一题炮架吃子（`kids-client.js:136-145`），课程定义也覆盖 0/1/2+ 炮架 | P0：补 0/1/2+ 的同一棋盘对比，当前单题不足以验证边界 |
| 兵/卒、过河 | 已实现前进；过河后左右可走；不支持后退（`xiangqi-server-rules.mjs:136-143,47-49`） | 有过河后横走题，提示也写明前后变化与不可后退（`kids-client.js:147-155`） | P0：新增“过河前只能前进”和黑方方向镜像题 |
| 吃子、己方占位 | 引擎所有候选落点拒绝己方棋，滑行子遇己方子停止；`applyMove` 返回被吃子（`xiangqi-server-rules.mjs:51-55,68-81,175-183`） | 有第一次吃子题；认知目标在通用课程中定义（`kids-client.js:157-167`; `xiangqi-teaching-curriculum.mjs:134`） | P1：显示“目标位置被占据→换成对方棋/禁止”的反馈 |
| 将军、应将、将死 | 有攻击检测、将军判断、生成合法着法过滤、自陷将和无合法着结束判定（`xiangqi-server-rules.mjs:148-173,185-221`） | 有将军、移帅应将、两步 mini-game、一步将死；实现中直接用 `isInCheck` 与 `generateLegalMoves` 验证（`kids-client.js:169-214,891-929`） | P0：将军分类（逃、挡、吃将军子）目前主要是文字/预设题，移动端需让孩子在棋盘上逐类尝试 |
| 自陷将/非法着 | 引擎通过模拟着法后再次 `isInCheck` 过滤，能拒绝走后仍被将的着法（`xiangqi-server-rules.mjs:175-189`） | 通用课程明确有 `self-check-legality`，但儿童 26 题没有专门的“这一步为什么非法”棋盘挑战；儿童题的 `legal: true` 仅用于部分题 | P0 缺口：新增“红色危险格/走完回放/不能这样走”的可视化题 |
| 困毙 | `gameStatus` 在无合法着时返回 `no-legal-moves`，但只根据 `isInCheck` 区分 checkmate，否则仍判当前方失败（`xiangqi-server-rules.mjs:214-221`） | 课程有 `stalemate-loss`，通用学习页也有文字说明，但儿童 26 题没有困毙题（`xiangqi-teaching-curriculum.mjs:204`） | P1：补“没被将但没有出口也输”的棋盘题；结果文案要明确不是和棋 |
| 胜负/将被吃 | 引擎在任一将/帅不存在时返回 `general-captured`；否则无合法着的一方输（`xiangqi-server-rules.mjs:214-221`） | 有 mini-game 与一步将死；没有独立区分“将被吃”的规则教育，且真实对局由服务层状态驱动 | P1：移动端统一结果模型与动效，区分将死、困毙、认输、超时 |
| 和棋：协议和棋 | 规则引擎不处理和棋；在线房间只支持玩家主动 offer/accept draw，返回 `draw-agreed`（`online-room-core.mjs:109-120`） | 儿童课程未教协议和棋；儿童模式不应在入门阶段混入复杂和棋条款 | P1：成人 app 先接入现有协议和棋；kids 只在家长/进阶说明中出现 |
| 和棋：长将、长捉、重复局面 | 当前规则引擎没有局面历史/重复计数/长将或长捉裁判；`online-room-core.mjs` 只保存 `moveHistory` 用于记录，没有据此判和（`online-room-core.mjs:38-40,126-134`） | 课程与儿童 26 题均未覆盖；“没有国际象棋那种逼和”只解释困毙，不等于实现中国象棋重复规则 | P0 成人规则缺口：移动端不要声称完整竞赛规则；需后端单一裁判模块后再共享给两 app |

## 三类结论

### v1 已覆盖（代码可验证）

七类棋子的基础走法均在引擎中有分支；车路径、马腿、象眼/不过河、炮架、兵过河、九宫限制、将帅照面、自陷将过滤、将军/将死以及困毙式“无合法着失败”均有实现。儿童可玩内容已覆盖认棋、九宫、帅/车/马/炮/兵基础操作、吃子、将军、一次应将、照面识别、短 mini-game 与车将死。

### 只在引擎/通用课程覆盖，儿童课程没有完整教

仕/士独立走法、象/相的象眼和不过河、车的多种阻挡边界、炮的 0/1/2+ 炮架边界、自陷将的系统化练习、困毙、完整应将分类、正式记谱，以及成人课程中的战术/残局/开局内容。`KIDS_CHAPTERS` 的 26 个概念名看起来比实际 LESSONS 更完整；`kids-client.js` 的可玩题仍是预设局面，不能据此宣称每个概念已充分掌握。

### 完全缺口

长将、长捉、重复局面与竞赛和棋判定不在当前规则引擎、在线房间裁判或儿童课件中；也没有统一的跨端规则包/状态历史裁判接口。协议和棋存在，但不是自动规则判和。移动端若直接复制现有规则文件，会把这个缺口复制到两款 app。

## 移动端建议优先级

1. **P0 先做单一规则核心**：抽取可在 Web、iOS、Android 共用的纯函数包；补齐局面 key、历史重复、长将/长捉裁判接口，并让服务端做最终裁判。移动端只展示裁判结果。
2. **P0 把儿童第一章改成棋盘教学流**：开局摆盘 → 棋子发光/箭头 → 点击棋子 → 显示所有合法落点 → 动画走一步 → 立即用反例解释非法点。优先补象眼、不过河、炮架边界、自陷将和困毙。
3. **P0 统一 legal move API**：儿童所有 move 题都使用合法着法，而不是 `generatePseudoMoves`；需要展示“规则上能走但会送将”的反例时，单独返回 `pseudoMoves` 与 `illegalReason`。
4. **P1 完整化进阶课程**：仕/士、吃子保护、应将三类方法、将死/困毙对照、记谱和成人 app 的战术训练；同一题库用主题配置区分 QiliChess 与 QiliChessKids。
5. **P1 做规则回归矩阵**：每个棋子至少包含开放、被挡、吃子、己方占位、将军/自陷将五类测试；再加入初始局面、将帅照面、炮架 0/1/2+、重复局面与超时/协议和棋端到端测试。

## 取证命令

```sh
node --input-type=module -e 'import { KIDS_CHAPTERS } from "./xiangqi-teaching-curriculum.mjs"; console.log(KIDS_CHAPTERS.map(({id,lessonStart,lessonCount,conceptIds}) => ({id,lessonStart,lessonCount,concepts:conceptIds.length})))'
node --input-type=module -e 'import { createInitialBoard, generateLegalMoves, gameStatus } from "./xiangqi-server-rules.mjs"; const b=createInitialBoard(); console.log(b.length,b[0].length,generateLegalMoves(b,"red").length,gameStatus(b,"red"))'
git diff --check
```

