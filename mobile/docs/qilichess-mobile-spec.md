# QiliChess mobile product specification

Status: v0 planning spec  
Scope: adult QiliChess iPhone and Android apps (not QiliChessKids)

## Product direction

Build one cross-platform mobile client for iOS and Android, with a shared TypeScript/React Native presentation layer and a shared chess domain layer. The web app remains a supported surface, but the mobile information architecture should be optimized for one-handed play, short sessions, and a board-first experience.

The two branded apps should share the same service contracts and chess engine/rules packages. QiliChessKids may use the same board, move, notation, identity, and analytics primitives later, while keeping its lesson UX and visual language separate.

## Mobile information architecture

Use five bottom tabs:

| Tab | Purpose | Web source |
| --- | --- | --- |
| Home | Resume the next action: continue game, recommended lesson, recent review | `homeView`, `landing.js` |
| Play | Start computer game, quick match, or private room | `playView`, `onlineView`, `app.js`, `online-client.js` |
| Learn | Skill lessons and targeted training | `learnView`, `trainView`, `learn-client.js`, `ability-client.js` |
| Review | Saved games, game replay, mistakes and coach explanations | `reviewDropzone`, `identity-client.js`, `analysis-client.js` |
| Profile | Identity, ratings, history, subscription and settings | `profileView`, `identity-client.js`, `premium-client.js` |

Analysis is a contextual full-screen tool, opened from Play or Review, rather than a bottom tab. Kids is a separate app entry point and must not appear in adult navigation.

## Core screens

### Home

- Signed-out state: `Play computer`, `Quick match`, and `Learn basics`.
- Signed-in state: resume last unfinished game, latest rating change, next training recommendation, and recent game shortcut.
- Do not show ability scores until there is enough real game evidence; preserve the web copy and empty state.

### Play hub

Three clear cards: `Computer`, `Quick match`, and `Private room`.

- Computer setup: side, difficulty/Qili level, time disabled or casual mode, coach toggle.
- Online setup: display name, time control, quick match, create room, join by code.
- Game screen: board-first layout, opponent/player seats and clock, move list in a bottom sheet, undo/new game only for computer games, resign/draw for online games.
- Preserve board orientation, legal move highlighting, check state, result overlay, and replay route controls from the web implementation.

### Learn

- `Continue learning` card at the top.
- Skill list grouped by rules, tactical awareness, protection/exchange, and opening development.
- Lesson screen uses the existing interactive board model; a lesson step must be playable, resumable, and able to deep-link to targeted training after a review finding.

### Review

- Recent games list with result, opponent, time control, date, rating delta, and source.
- Game replay screen with a board, move timeline, `Your route` / `Best route`, and step navigation.
- Pro users can request full-game engine analysis; free users can replay and inspect available per-move facts.
- Screenshot-to-position import remains a later capability on mobile unless native camera/file permissions are explicitly approved.

### Analysis

- Open from a selected review move or as an empty analysis board.
- Board editor, side-to-move switch, candidate lines, evaluation bar, verified facts, coach explanation, and variation replay.
- On phones, stack the evidence panel below the board and use a draggable bottom sheet; never put the primary explanation behind a desktop-style side rail.
- Engine and AI calls must show loading, unavailable, entitlement, and retry states.

### Profile

- Account/guest identity and sign-in/passkey.
- Rapid, Blitz, and Bullet Qili ratings.
- Game count, recent history, ability profile, subscription status, restore purchase, privacy/terms, and app settings.
- Guest play should remain possible; sign-in claims the local guest history through the existing claim flow.

## Navigation flows

1. First launch → Home → `Play computer` → setup → game → result → `Review this game`.
2. Home recommendation → Learn → lesson → completion → next lesson or Play.
3. Play → Quick match → matchmaking → online game → result → Review or Play again.
4. Play → Private room → create/join code → online game → result → lobby.
5. Review → game → move timeline → Analysis → coach evidence → targeted Learn lesson.
6. Profile → sign in → claim guest identity → ratings/history refresh.
7. Any Pro-gated engine/coach action → subscription sheet → native purchase flow → retry original action.

Deep links should support `qilichess://game/{id}`, `qilichess://review/{id}`, `qilichess://lesson/{lessonId}`, and `qilichess://room/{code}`. If authentication is required, retain the destination after sign-in.

## Reuse and mobile boundaries

### Reuse directly or extract into shared packages

- Board representation, legal move generation, check/checkmate detection, notation, FEN/UCI conversion: current game/rules modules used by `app.js`, `engine-client.js`, and `tactical-analyzer.js`.
- Coach evidence and ability classification: `coach-tools.js`, `ability-client.js`, and the structured analysis payloads.
- Lesson data and progression model: `learn-client.js` (rendering should be replaced with native components).
- API contracts and entitlement behavior: `online-client.js`, `identity-client.js`, `engine-client.js`, and `premium-client.js`.

### Rebuild for mobile

- All HTML/CSS view rendering and desktop platform navigation.
- Board touch interaction, gesture-safe controls, bottom sheets, toast/dialogs, accessibility labels, and platform purchase/auth wrappers.
- Persistence adapter: use secure storage for tokens and a local database/cache for unfinished games and guest history; do not duplicate server truth.

## Existing API mapping

The first mobile client should target the current service routes, behind a typed client module:

| Capability | Existing route(s) |
| --- | --- |
| Auth configuration / claim | `GET /api/auth/config`, `POST /api/auth/claim` |
| Guest and profile identity | `POST /api/identity/guest`, `GET /api/identity/me`, `POST /api/identity/me/name` |
| Computer levels/results | `GET /api/identity/computer-levels`, `POST /api/identity/me/computer-result` |
| Saved games/history | `GET /api/identity/me/games?limit=20` |
| Position analysis | `POST /api/engine/analyze` |
| Full-game analysis | `POST /api/engine/analyze-game` |
| Coach explanation | `POST /api/coach/explain` |
| Board screenshot recognition | `POST /api/coach/recognize-board` (later mobile feature) |
| Engine status | `GET /api/engine/health` |
| Online rooms/matchmaking | `GET/POST /api/online/rooms`, `POST /api/online/rooms/{code}/join`, `POST /api/online/matchmaking`, `POST /api/online/matchmaking/cancel`, `GET /api/online/rooms/{roomId}`, `POST /api/online/rooms/{roomId}/action`, SSE `/api/online/rooms/{roomId}/events` |
| Billing/entitlements | `GET /api/billing/config`, `GET /api/billing/entitlement`, `POST /api/billing/trial`, `POST /api/billing/checkout` |

Mobile must send the same bearer/account and guest headers, handle 401/402/429/503 consistently, and centralize API base URL, retries, cancellation, and telemetry.

## V1 acceptance scope

- iOS and Android from one codebase.
- Guest and signed-in identity, profile, ratings, and cloud game history.
- Computer games with legal moves, board orientation, move list, result, and local unfinished-game resume.
- Online quick match and private room with clocks, reconnect, resign, and draw offer.
- Learn list plus at least the existing beginner lesson path.
- Review saved games with replay and per-move verified analysis.
- Pro entitlement checks and native purchase/restore integration.
- VoiceOver/TalkBack labels for board squares, move controls, and result states; dynamic type-safe layouts; reduced-motion setting.

## Later, not V1

- Camera/screenshot board recognition and automatic position setup.
- Push notifications, friends, chat, tournaments, leaderboards, spectating, and social feeds.
- Offline engine analysis or a bundled Pikafish binary in the app.
- Full competition rules including long-check/long-capture repetition adjudication.
- Cross-app parent controls, kids accounts, and shared lesson progression between QiliChess and QiliChessKids.
- Tablet-specific multi-column layouts and Apple/Google platform widgets.

## Technical decision

Use Expo React Native with TypeScript for the mobile shell, and extract the current board/rules/analysis data into framework-neutral packages. Keep the backend as the single source of truth. This gives one iPhone/Android implementation while allowing the web client to consume the same domain and API client packages, reducing long-term drift without forcing the existing desktop UI into a mobile layout.
