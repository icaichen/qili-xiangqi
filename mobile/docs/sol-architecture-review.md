# Sol mobile architecture review

> 本文前半部分保留首次审计基线；重构后的最终 merge-gate 结论见文末“最终复审”。

审计日期：2026-08-22

审计角色：资深移动架构 / 产品 reviewer（独立审计）

审计范围：`mobile/` monorepo、两个 Expo App、共享包、Expo Router/config、Web/移动规则与课程来源、Adult/Kids IA。

变更约束：本次只输出评审文档，不修改 `apps/*`、`packages/mobile-ui` 或视觉实现。

## 结论先行

当前仓库是一个**可以解析配置和通过 TypeScript 检查的双 App prototype 骨架**，不是两个可继续直接叠加业务的移动产品。

- “一套代码、两个 App”只成立一半：两个目录拥有不同的 Expo slug、scheme、iOS bundle ID 和 Android package，理论上可生成两个独立安装包；但两个入口都只渲染同一个 `ProductApp`，Expo Router 只有单一 `index`，产品差异仍是一个组件内的 `if (kids)`。
- 规则目前是**一个物理实现、多个入口**：移动包 re-export 根目录 `xiangqi-server-rules.mjs`，Web/服务端仍直接引用根文件。短期没有复制规则，但 `@qili/xiangqi-core` 还不是全仓真正的权威包。
- 课程目前**不是单一真源**：`xiangqi-teaching-curriculum.mjs` 的 `KIDS_CHAPTERS` 只描述 3 章、26 个概念槽位；真正可玩的 26 个 `LESSONS` 仍硬编码在 `kids-client.js`。移动端只读取章节元数据，并没有消费 26 课的题面、局面、验证和 mastery。
- Adult 与 Kids 的 IA 已同时偏离各自规格，而且偏离互相冲突。继续在当前壳上加 Online、Review、Progress、Parent Gate、IAP 或完整课程，会把 prototype 状态固化成难以迁移的产品债务。
- 用户感知到的“UI ugly”主要不是某个颜色或圆角选择，而是**信息架构、交互真实性、棋盘几何、产品分层和视觉语言没有形成一致系统**。视觉负责人可以继续定义 token 和组件语言，但关键结构必须先由架构 owner 定版。

发布判断：**No-Go**。可以用于概念演示和共享包 spike，不应作为 V1 功能开发壳或商店发布基线。

## 关于“谁写了 UI”

当前整个 `mobile/` 在 Git 中显示为未跟踪目录，因此 Git 历史无法可靠归属作者。代码证据只能说明现状，不能据此判断是谁写的。不要把架构问题归因给个人；应把它当作 prototype 未经过产品架构 gate 的结果。

## 现状证据

| 主题 | 当前证据 | 审计判断 |
| --- | --- | --- |
| 双 App 身份 | `apps/qilichess/app.config.ts` 与 `apps/qilichesskids/app.config.ts` 有不同 slug、scheme、bundle/package ID | 独立发布身份骨架成立 |
| App 入口 | 两个 `app/index.tsx` 都只调用 `ProductApp`，仅 `productId` 不同 | 不是两个独立产品 composition root |
| Expo Router | 两端都只有 `_layout.tsx` 和 `index.tsx`；`_layout` 只有无标题 `Stack` | Router 已安装，但没有承担真实导航、deep link 或状态恢复 |
| 共享 UI | Adult/Kids 首页、导航、课程、棋盘和占位页面集中在 `packages/mobile-ui/src/product-app.tsx` | God component / prototype shell，无法承载长期模块边界 |
| 产品配置 | `product-config` 同时保存品牌、bundle/package、feature flags、tab；App config 又重复保存发布身份 | 存在双写漂移；feature flags 当前没有驱动 UI |
| 规则 | `@qili/xiangqi-core` re-export 根规则文件；Web/Server 直接 import 根规则文件 | 一个物理实现，但 package 不是 canonical owner；手写 `.d.ts` 可漂移 |
| Kids 课程 | `KIDS_CHAPTERS` 只有章节/概念布局；完整 `LESSONS` 位于 DOM 客户端 `kids-client.js` | 课程内容、交互局面、验证、进度迁移尚未抽取 |
| Adult 课程 | 移动 `AdultLearn` 硬编码 4 个标题；Web 使用 `QILI_CURRICULUM_STAGES` | 移动展示不是课程数据的真实渲染 |
| 棋盘 | `XiangqiBoard` 自己创建局面、选择棋子并直接 `applyMove` | 它同时拥有 View、局面和交互控制，不是可复用的受控 board UI |
| 校验 | `npm run check` 通过 TypeScript、Expo public config 和两个最小 Node test | 只证明静态骨架可解析，不证明任何产品流程完成 |
| 发布 | 两个 `eas.json` 存在，但没有 EAS `projectId`、正式 icon/splash、runtime/update 策略等 | 尚未形成两个可安全独立发布和 OTA 的应用 |

## P0：继续开发前必须修

### P0.1 先冻结 IA，替换单组件伪导航

必须由架构 owner 明确两套 route map，再允许功能进入 App。`active` 和 `lessonOpen` 这种组件本地状态不能继续充当导航器。

建议的 V1 路由基线：

**QiliChess**

- Tabs：Home / Play / Learn / Review / Profile。
- Puzzles 是 Learn 内的训练入口，不替代 Review。
- Game、Room、Lesson、Review Detail、Analysis、Paywall 使用 tab 外的 Stack 路由或 modal。
- Deep link 最低覆盖 `game/[id]`、`review/[id]`、`lesson/[lessonId]`、`room/[code]`，并能在登录后恢复目的地。

**QiliChess Kids**

- Tabs：首页 / 学棋 / 练习 / 我的。
- V1 不提供独立 Play/多人入口；已完成课程的重复练习属于“练习”。
- Parent Gate 是受保护 route/modal，不是第五个儿童 tab，也不是普通设置按钮。
- 课程播放器使用 `lesson/[lessonId]`，退出、恢复、重练都必须由稳定 lesson ID 驱动。

当前偏差必须明确撤回：

- Adult spec 要求 Review，但实现配置成 Puzzles。
- Kids spec 要求 4 tab，但实现为 Home / Play / Learn / Challenges / Growth。
- Kids manifest 把 `livePlay` 设为 `true`，与 Kids V1 将 multiplayer 放在 later scope 冲突。
- 中英文 tab label 混用，信息层级和年龄语言都未定版。

### P0.2 建立真正的双产品 composition root

两个 App 应共享能力，不应共享一个包含全部产品分支的页面树。

目标原则：

- `apps/qilichess` 组装成人 route tree、成人 feature modules、成人 entitlement。
- `apps/qilichesskids` 组装儿童 route tree、课程/练习/进度、家长门与儿童安全策略。
- 可共享 design system、board renderer、domain controller、API client、storage interface；不要共享整个 `ProductApp`。
- 产品差异通过显式依赖和 route composition 表达，不通过遍布 UI 的 `kids ? ... : ...` 表达。
- App 身份由一份 typed manifest 生成或校验，避免 `product-config` 和两个 `app.config.ts` 双写 scheme/bundle/package。

完成定义：两个 App 删除任意一方的 feature module，不会破坏另一方的 route tree；构建配置测试能证明 name/slug/scheme/bundle/package/project/channel 全部不串包。

### P0.3 把规则包变成全仓 canonical source

当前没有复制规则实现，这是正确起点；但移动包反向引用仓库根文件只是过渡适配器，不是稳定边界。

必须做到：

1. 规则实现移动到 canonical package（保留稳定 import path 和版本策略）。
2. Web、服务端、两个 App 和测试全部 import `@qili/xiangqi-core`，根目录只允许临时兼容 shim。
3. 类型从实现生成或与实现同源，不能长期维护一份手写 `index.d.ts`。
4. 将 `applyMove` 定义为低层、已验证 move 的执行器；对 UI 暴露的 controller 必须先用 side-to-move + `validateMove`。
5. 明确规则范围：基础合法着、将军、将死、困毙当前可用；长将、长捉、重复裁判缺失时不得宣称“完整竞赛规则”。在线最终裁判继续由服务端权威执行。

### P0.4 把完整课程记录和 lesson runtime 抽成单一真源

`KIDS_CHAPTERS` 不是 26 课。仅验证 `lessonCount` 总和等于 26，不能证明 26 课已进入移动端。

canonical curriculum 至少需要：

- 稳定 `lessonId`、`conceptId`、chapter、order、prerequisite、版本和 locale key。
- 题面、初始局面、mode、expected outcome、合法性策略、提示、成功/失败反馈。
- mastery 证据、attempt event、completion rule、resume state 和 progress migration。
- 对重复的 `respond-check` 使用不同 lesson ID，而不是依赖数组索引区分。
- Web 和移动 lesson renderer 消费同一 record；平台只负责渲染与输入适配。

当前 `kids-client.js` 中的函数、DOM、`localStorage` 和数据混在一起。迁移时先提取 schema/data/validator，再分别保留 Web adapter 与 Native adapter，不能复制整个 `LESSONS` 数组到移动端。

Adult 端同样不能继续硬编码四行课程标题；应由 shared curriculum 派生 stage、进度和下一步推荐。

### P0.5 重做棋盘契约，当前棋盘只可视为视觉占位

`XiangqiBoard` 目前不能成为 Play、Lesson、Review 和 Analysis 的共同基础：

- 10×9 被画成 10 行、9 列“格子中心”，而中国象棋棋子应落在 9 路、10 横的交叉点；九宫斜线也未绘制。
- 375pt 宽手机上，当前可见单元触控宽约 36pt，低于 Kids spec 的 44pt 目标。
- 组件内部自己创建初始局面，外部无法提供 lesson position、review position、orientation 或 authoritative game state。
- 没有 side-to-move；用户可选择并移动红黑任意一方棋子。文案写“轮到红方”但逻辑没有约束。
- `applyMove` 在落点点击后直接执行，缺少 controller 级的 turn、game status、result 和 event contract。
- Kids 第 1 课只要任意合法移动就把 `moved` 设为成功，与真实课程 mastery 无关。
- 只有落点圆点，没有 invalid reason、check、last move、capture、arrow、lesson target、review variation 或 reduced-motion contract。

新 board 必须是受控渲染组件：`position + orientation + annotations + interactionMode + accessibilityModel` 输入，输出标准化 intent；Game/Lesson/Review/Analysis 各自 controller 决定 intent 是否有效和下一状态。视觉层不拥有比赛真相。

交叉点的视觉尺寸和触控尺寸应分离：可以用透明 hit target 重叠覆盖保证至少 44pt，而不是为了触控把棋盘改成错误的格子模型。

### P0.6 Kids 安全与进度不是占位页功能

Kids V1 的 Parent Gate、离线进度、删除/导出、声音/动效默认策略和 analytics 最小化都是产品结构，不是后补设置。

在以下 contract 完成前，不应增加 Kids 账号、购买、外链或多人功能：

- `ProgressRepository`（异步、版本化、可迁移、可重放）。
- `LessonAttempt` / `LessonCompleted` 事件 schema。
- Parent Gate 的保护范围和超时/返回行为。
- 本地 child profile 与未来 parent account 的数据隔离。
- 无广告、无公开社交、无精确个人数据的 capability policy。

### P0.7 发布身份在首个真机构建前闭环

两个 ID 不同不等于已经能安全发布。首个 internal build 前必须补齐：

- 两个不同 EAS project / `projectId`，并验证 update URL、runtime version 与 channel 不串包。
- 正式 icon、adaptive icon、splash、权限说明、隐私与儿童分级输入。
- Apple/Google 两套签名与商店记录。
- 每个 App 的 config snapshot test，阻止 bundle/package/scheme/extra.product 漂移。

## P1：骨架稳定后完成

### P1.1 拆共享包边界

建议边界：

| 包 | 应负责 | 不应负责 |
| --- | --- | --- |
| `xiangqi-core` | 棋盘模型、合法着、局面序列化、基础结果 | React、网络、存储、动画 |
| `curriculum` | lesson schema/data、prerequisite、mastery、迁移 | DOM、React Native 组件、平台存储 |
| `board-ui` | 几何、棋子、标注、动画、无障碍渲染 | 自建局面、回合裁判、课程完成 |
| `design-system` | tokens、字体层级、基础控件、主题 | route、业务 tab 列表、规则与课程 |
| `progress` | event schema、reducer、repository interface | AsyncStorage 直接调用、页面 UI |
| `api-client` | typed DTO、错误模型、取消/重试、auth provider | Clerk UI、SecureStore、SSE 具体实现 |
| `platform-adapters` | SecureStore/AsyncStorage、realtime、IAP、auth、telemetry | 规则和业务决策 |
| feature modules | Play/Learn/Review/Profile/Kids Progress 的 controller + screens | 发布 ID、跨产品条件分支 |

新出现的 `@qili/design-system` 是正确方向，但它应保持视觉 primitive 层。`BottomNavigation` 可以是控件，具体有哪些 tab 必须由各 App route tree 决定。

### P1.2 建立真实状态模型

- Game：authoritative snapshot、side-to-move、clock、move history、connection/result。
- Lesson：lesson ID、step、attempt、hint、feedback、mastery、resume。
- Review：game ID、move cursor、facts、analysis availability、variation。
- Session：guest/account、token hydration、claim state、entitlement。
- App：只保存 theme/locale/reduced-motion 等跨 feature preference。

不要用一个顶层 `useState(active)` 或页面内部临时 boolean 代替这些状态机。

### P1.3 端到端验证矩阵

当前两个 Node test 只检查初始棋盘和 26 数量。最低矩阵应包含：

- 两个 App 的 Expo config snapshot 与独立 build smoke test。
- 规则回归：七类棋子、阻挡/吃子/己方占位、自陷将、照面、将死/困毙。
- curriculum schema：所有 stable ID 唯一、prerequisite 可解析、chapter/order 连续、所有 position 可反序列化。
- lesson fixtures：开始、答错、提示、完成、退出、冷启动恢复、版本迁移。
- route/deep link：签入前后目的地恢复。
- iOS + Android 真机/模拟器：棋盘触控、safe area、Dynamic Type、VoiceOver/TalkBack、reduced motion。

### P1.4 产品视觉系统从结构派生

Adult 与 Kids 不能只是深色/浅色 palette 的同一组件：

- Adult 核心节奏是 Play → Result → Review → Targeted Learn，强调棋局、时间和证据。
- Kids 核心节奏是 Continue → One Task → Feedback → Progress，强调单一目标、可恢复和家长保护。
- 两端可以共享几何和 primitive，但页面密度、导航、动效、语气和完成反馈应由各自体验定义。
- emoji、汉字和 ASCII glyph 不能继续充当混合图标系统；选定一套可访问、跨平台一致的 icon/piece asset pipeline。

## P2：可在 V1 主路径成立后优化

- 从 typed product manifest 生成 Expo config 和商店元数据骨架。
- 为 design system、board states 和 lesson modes 建独立可视化 catalog/snapshot。
- 增加课程 authoring/schema 校验工具，禁止手改数组索引绑定。
- 建立 coarse analytics event registry 和隐私分级。
- 增加 tablet 多栏、离线 engine、相机识盘、社交/赛事等 later capability；这些都不应反向污染 V1 路由和 domain contract。

## 当前壳上禁止硬堆的功能

以下功能进入当前 `ProductApp` 或当前自持状态的 `XiangqiBoard`，都会形成高成本返工：

1. Online matchmaking、room、clock、reconnect。
2. Review/Analysis move timeline 和 engine variation。
3. Clerk/guest claim、订阅、IAP/restore。
4. 26 课完整播放器、mastery、离线恢复和进度迁移。
5. Parent Gate、儿童账号和外链/购买控制。
6. Deep link、push destination、登录后回跳。
7. Camera recognition、board editor、自由摆棋。

当前壳只适合继续做两类事情：视觉方向 demo，以及 shared package 的技术 spike。任何按钮都不应被产品验收为“功能已完成”。

## Sol 必须把关的结构性决策

为响应“重要和结构性的事情必须由 Sol 完成”，建议把以下内容设为 merge gate，由 Sol 直接设计或最终审阅：

1. 两个 App 的 route tree、deep-link contract 和 composition root。
2. Adult/Kids V1 scope 与 tab IA，尤其 Review、Practice、Parent Gate、Kids multiplayer 边界。
3. canonical `xiangqi-core`、curriculum schema、lesson runtime 和 progress migration。
4. board controlled-component contract 与 Game/Lesson/Review controller 分层。
5. API/auth/storage/realtime/IAP adapter 边界和服务端权威模型。
6. 双 App Expo/EAS identity、OTA/runtime/channel 隔离和发布检查。
7. 架构测试矩阵与“可进入视觉 polish / 可进入功能开发 / 可发布”的 gate 定义。

视觉负责人应拥有品牌语言、token、组件外观、动效语气和可用性打磨；但不应在视觉组件里决定 route、课程真源、回合状态、产品 capability 或发布身份。

## 建议实施顺序

1. Sol 签署 Adult/Kids route map、V1 scope 和 package dependency graph。
2. 将规则实现变为 canonical package，并让 Web/Server/Mobile 同时消费。
3. 提取 26 个完整 lesson records、schema、validator、mastery 和 progress migration。
4. 建立受控 `board-ui` 与四类 controller（Game/Lesson/Review/Analysis）。
5. 分别创建 Adult 和 Kids route tree/composition root，接入 design system。
6. 先完成 Kids 一条真实闭环：开始第 1 课 → 答错/提示 → 完成 → 退出 → 冷启动恢复。
7. 再完成 Adult 一条真实闭环：开始本地对局 → 结果 → Review → targeted Learn。
8. 最后接 Online/Auth/IAP，并进行两 App 独立 build、deep link、无障碍与隐私验收。

## 本次验证

已执行：

```sh
cd mobile
npm run check
```

结果：两个 App TypeScript 与 Expo public config 检查通过；`curriculum` 和 `xiangqi-core` 各 1 个最小 Node test 通过。该结果不包含模拟器/真机视觉、导航、课程闭环、在线、存储或发布验证。

本评审新增文档后另执行 whitespace/diff check；没有修改 `mobile-ui` 或 App 代码。

## 最终复审：2026-08-22

### Merge gate：GO

本轮允许合并移动结构重构，首次审计中的本阶段 P0 已收敛：

- 两个 App 不再经过共享 `ProductApp` 条件分流；分别以 `AdultApp` 和 `KidsApp` 作为 composition root，并拥有独立 route tree。
- Adult IA 为 Home / Play / Learn / Review / Profile；Kids IA 为 首页 / 学棋 / 练习 / 成长。Kids 没有 Play/多人 tab，capability manifest 的 `livePlay` 为关闭。
- Kids 新增稳定的 `/lesson/[lessonId]` 路由，26 个 lesson 均来自 Web 与 Mobile 共用的 `KIDS_PLAYABLE_LESSONS`。
- Mobile lesson renderer 支持 identify、sequence、zone、move、auto reply、check/mate verify 和两步 mini-game。错误的合法着只反馈、不改变题面；系统回应必须先通过共享规则验证。
- 棋盘使用 9 路 × 10 横交叉点几何、九宫线、河界、至少 44pt 透明触控目标和 side-to-move 约束；新增 controlled `position` / `onMoveIntent` 契约供课程 controller 使用。
- Parent Gate 保留“长按 3 秒 + 成人算术题”，关闭后会清除通过状态。尚未实现的家长设置被明确标注为未接入。
- 未实现的 Online、房间、计时对局、Auth、等级分、订阅、同步和课程持久化均已禁用或明确标注，不再显示虚假在线人数、默认 1200 分或可用 CTA。

### Release gate：NO-GO

本次 GO 只针对结构重构合并，不代表 V1 或商店发布完成。以下能力仍未实现：

- Online / computer game、authoritative clock、room、reconnect。
- Auth / guest claim、云历史、IAP / restore、entitlement。
- Kids 本地进度持久化、冷启动恢复、mastery 与家长设置页。
- Adult 课程播放器、真实 Review / Analysis 数据流。
- EAS project ID、正式素材、签名、隐私输入和真机无障碍/视觉验收。

### 最终验证

- `npm run check`：两个 App config/TypeScript、design system、mobile UI、product config、rules 和 curriculum 全部通过。
- Curriculum：6 项测试通过，覆盖 26 课对象同源、ID/章节映射、结构化数据、全部 authored move 合法、auto reply 合法、mini-game 唯一应将与最终将死。
- Expo export：QiliChess iOS、QiliChess Android、QiliChess Kids iOS、QiliChess Kids Android 四个 bundle 均成功。
- Kids bundle 中已确认包含动态 route `lesson/[lessonId]`。
- `git diff --check` 与本轮未跟踪文件 whitespace check 通过。
