# QiliChessKids mobile product spec

Status: v1 product/UX specification  
Platforms: iPhone and Android phones  
Audience: children roughly 6–12, with a parent or guardian controlling setup

## Product promise

QiliChessKids turns the existing interactive Chinese-chess lessons into a short, calm, board-first mobile experience. A child learns by pointing at the actual board, moving a piece, and seeing a small animation explain why the move is legal or illegal. The mobile app must reuse the existing lesson definitions, rule engine, copy, and theme tokens; it is an app shell and renderer, not a second curriculum.

The two products stay separate:

- **QiliChess**: full chess play, online games, analysis, notation, and adult learning.
- **QiliChessKids**: guided lessons, practice boards, age-appropriate feedback, and parent-visible progress. No public chat or open social surface in v1.

## Mobile shell and navigation

Use a shared cross-platform mobile codebase (React Native/Expo or the chosen equivalent) with platform-native builds from the same source. Keep the web rule/curriculum packages platform-neutral so future web and mobile clients consume the same contracts.

The child-facing shell has four bottom tabs:

1. **首页 Home** — continue lesson, today’s small goal, and a friendly board preview.
2. **学棋 Learn** — three curriculum chapters and the 26 lesson cards.
3. **练习 Practice** — unlocked repeat drills and “try again” positions.
4. **我的 Progress** — stars, completed lessons, streak, and parent entry point.

The parent gate is a separate, persistent control rather than a fifth child tab. Access it from Progress and from Settings. Use a simple adult task (press-and-hold for three seconds, then a number question) rather than relying on a child-safe PIN alone. Parent actions include sound/animation settings, language, reset progress, export/delete data, and a link to the adult QiliChess app. Never expose account, purchase, or external-link controls behind a child-facing button without the gate.

## Core screens

### Home

- Large **继续学习** card resumes the first incomplete lesson.
- Show one concrete goal: “完成第 3 课：小马跳一个日”.
- Board preview uses the same piece art and colors as the lesson board; it is decorative until the child taps Continue.
- Secondary actions: **复习一个旧课** and **自由摆棋** (the latter can be disabled in v1 if it requires a broader rules surface).
- No leaderboards, streak pressure, ads, or competitive language.

### Learn / chapter map

Show three friendly chapters, each with progress and an explicit unlock rule:

- **第一次走进象棋世界** — board, pieces, movement, capture, check, and mate basics (14 lessons).
- **学会吃子和保护自己** — attack, protection, safe capture, recapture, and exchange (6 lessons).
- **听见将军，找到最后一击** — check detection, responses, check versus mate, and mate in one (6 lessons).

Each lesson card shows title, one-line objective, estimated time, and completion state. Do not show adult rating labels (16/15/14/13) in the child UI. A chapter can unlock sequentially; review lessons remain available after completion.

### Guided lesson player

The lesson player is board-first and portrait-safe:

- Board occupies the main width with large touch targets on intersections (minimum 44 pt logical target).
- A single animated pointer, glow, or arrow indicates the next action; never animate every piece at once.
- Child taps a piece, then taps a destination. Valid destinations glow; invalid choices give a short, friendly explanation and leave the position unchanged.
- Use the existing lesson modes (`landmarks`, `identify`, and `moves`) and lesson payloads. The mobile adapter should not duplicate move legality.
- Bottom area contains one short instruction, optional **提示**, **重来**, and **下一步**. Keep feedback to one idea at a time.
- Support VoiceOver/TalkBack labels for board intersections and pieces, Dynamic Type, reduced motion, and left/right handed board controls.
- Completion is earned by the lesson’s existing mastery criteria; animations and stars are rewards, not substitutes for correctness.

### Practice

Practice is a safe replay surface, not a second game mode in v1. It lists completed lessons with **再练一次**, prioritizes missed concepts, and allows a parent to disable free practice. Every position is deterministic and offline-capable.

### Progress

Child view: chapter progress, stars, “最近学会”, and a gentle review suggestion.  
Parent view (after gate): lesson accuracy, attempts, time spent, concepts needing review, and reset/export/delete controls. Store only the minimum local profile data in v1; sync is later.

## The 26-lesson curriculum contract

The existing `KIDS_CHAPTERS` definition remains the source of truth: `lessonStart`/`lessonCount`, `conceptIds`, titles, objectives, prerequisites, and mastery evidence are passed to the mobile client through a shared package or generated JSON. The app maps the current 26 concepts as follows:

| Chapter | Lessons | Existing concept IDs | Mobile treatment |
|---|---:|---|---|
| 第一次走进象棋世界 | 1–14 | `piece-family`, `starting-lineup`, `board-palace`, `general-move`, `rook-move`, `horse-move`, `horse-leg`, `cannon-screen`, `pawn-river`, `capture`, `check`, `respond-check`, `facing-generals`, `checkmate` | Guided board animation and tap-to-answer; introduce one rule per screen. |
| 学会吃子和保护自己 | 15–20 | `attack`, `protection`, `safe-capture`, `recapture-risk`, `exchange`, `capture-safety` | Compare two candidate moves and show the capture/recapture sequence. |
| 听见将军，找到最后一击 | 21–26 | `check-detection`, `respond-check`, `respond-check`, `respond-check`, `check-vs-mate`, `mate-in-one` | Hear/see the check signal, then choose escape, block, capture, or the finishing move. |

Repeated `respond-check` entries are intentional: they represent different response mechanisms and positions, not duplicate UI. The lesson renderer should use the lesson ID and position payload to distinguish them.

Existing desktop lesson content currently includes the board landmarks, rook, horse-leg, elephant/advisor, cannon screen, pawn-after-river, facing-generals, and mixed quiz interactions. Those are the first mobile acceptance fixtures. The remaining 18 lessons should use the same data shape and rule services before adding new visual effects.

## Safe, child-centered UX requirements

- Offline lesson playback and progress save on device in v1.
- No ads, public chat, direct messaging, location, or contact discovery.
- Parent gate before purchases, external links, account changes, analytics opt-out, or deleting progress.
- No dark patterns: no countdowns, forced streaks, shame copy, or “wrong child” language.
- Sound and haptics are off by default on first launch until the child/parent chooses otherwise; provide a reduced-motion mode.
- Store analytics as coarse lesson events only (started, completed, answer result); avoid names, photos, contacts, and precise location.
- If cloud sync is later added, clearly separate child progress from parent account data and provide deletion controls.

## v1 scope and acceptance criteria

V1 ships two independent store apps from the shared mobile repository: **QiliChess** shell can start with its existing play/learn foundation, while **QiliChessKids** ships the complete 26-lesson guided flow. Both must use the same `xiangqi-core` legality and board model.

V1 includes:

- iPhone and Android portrait layouts, with tablet/web responsive work deferred.
- Home, Learn, Practice, Progress, parent gate, local persistence, and the 26 Kids lesson records.
- Shared theme tokens and reusable board/piece components.
- Unit tests for curriculum mapping and legality; a device smoke test for starting, completing, leaving, and resuming a lesson.
- App names, bundle IDs, icons, privacy text, and deep links kept distinct for the two products.

Later (not required for the first store-ready build): cloud account sync, parent dashboard web view, narrated voice packs, adaptive difficulty, free-play AI, multiplayer, achievements beyond stars, tablet landscape layouts, and shared lesson authoring tools.

## Architecture boundary

Recommended shared packages:

- `xiangqi-core`: board model, legal moves, check/mate, and serialization.
- `curriculum`: Kids and adult lesson definitions, concept IDs, prerequisites, mastery, and localized copy.
- `board-ui`: board geometry, pieces, arrows, highlights, animation primitives, and accessibility labels.
- `progress`: local event schema and mastery calculation.
- `apps/qilichess` and `apps/qilichesskids`: branding, navigation, feature flags, and product-specific screens.

The mobile app must never fork the legality rules or hard-code lesson order in screen components. A curriculum update should change shared lesson data once and be reflected in both web and mobile clients.

