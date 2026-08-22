# Mobile shared-code audit

Scope: the current web client/server modules in this repository, with React Native as the target for both `qilichess` and `qilichesskids`. This is an extraction map, not a claim that the current browser files can be imported directly. The safest shape is a shared TypeScript/ESM package consumed by web, iOS and Android; keep platform adapters at the edges.

## Executive recommendation

Extract deterministic game and teaching logic first. Do not put Redis, Postgres, engine binaries, API keys, Clerk browser code, or DOM rendering into the mobile bundle. Mobile should call the existing online/engine/coach HTTP APIs, with a native transport/auth/storage adapter. The two apps should share the same `@qili/core`, `@qili/curriculum`, and API client packages; only branding, navigation, entitlements and lesson presentation differ.

## Reuse map

| Module | Mobile disposition | What can be reused | Required work / risk |
|---|---|---|---|
| `xiangqi-server-rules.mjs` | **Extract unchanged logic** | Board constants, labels, initial setup, pseudo/legal move generation, check and game status | Rename to a shared package module and add tests for every rule. It is pure, but `applyMove` currently does not itself validate a candidate; callers must continue using `validateMove`. Add immutable/public state types before exposing it to UI. |
| `xiangqi-teaching-curriculum.mjs` | **Extract unchanged logic** | Curriculum stages, kids chapters, concept index, mastery model, teaching focus and prompts | It is data plus pure functions and is the best shared source for both products. Split prompt text from UI copy eventually; keep stable lesson/concept IDs for progress migration. |
| `tactical-analyzer.js` | **Extract with adapter boundary** | Attack maps, attackers, status, move comparisons and route analysis | It expects an `adapters` object (`cloneBoard`, `isInCheck`, `generateLegalMoves`, `pieceValues`, notation/UCI helpers). Make that interface explicit and import rules directly from the shared package. It already has a safe `window` guard. |
| `time-controls.mjs` | **Extract pure subset** | Catalog, key, estimated duration, rating-pool mapping, normalization | `timeControlSelectHtml` is web-only. Export catalog/normalizers from core and render controls natively. Server must remain authority for clocks and timeout. |
| `qili-rating.mjs` | **Extract unchanged logic** | Glicko-2 normalization/update, inactivity inflation, status, public record, bot seeds | Pure math and safe for mobile display/offline preview, but authoritative rating updates must stay server-side. Add deterministic tests around inactivity timestamps and clamping. |
| `coach-tools.js` | **Extract with adapter boundary** | Level settings, line selection, score formatting, verified coach analysis construction | `window.XiangqiCoachTools = ...` is web-global and must become named ESM exports. It depends on `tactical-analyzer` and engine-line shapes; define shared DTOs and keep random line selection out of deterministic review where possible. |
| `online-room-core.mjs` | **Server-only core; optionally duplicate protocol types** | Room state shape and action semantics are useful as shared schemas | Uses `node:crypto`, process-level `Map`, server timers and authoritative mutation. Do not run this authoritative room store in React Native. Extract `RoomSnapshot`, `MoveAction`, result/time-control schemas; keep room mutation on server. |
| `online-client.js` | **Rewrite as native API client** | Endpoint/action concepts, move formatting, clock presentation rules | Direct DOM, `localStorage`, `EventSource`/SSE and browser globals. Implement `OnlineApiClient` with `fetch`, SecureStore/AsyncStorage session adapter, and a native realtime transport (SSE polyfill or WebSocket gateway). |
| `online-persistence.mjs` | **Server-only** | Data model and endpoint contract | Hard dependency on `redis`, `pg`, `process.env`, SQL migrations and server room objects. Never bundle in either app. Treat exported methods as backend repositories and document JSON DTOs. |
| `engine-client.js` | **Rewrite as shared API client + native adapter** | FEN/UCI conversion, numeric score parsing, analyze DTO mapping | `window`, browser origin discovery, global identity/premium events and `fetch` are coupled to web. Keep `boardToFen`, `squareToUci`, `moveToUci`, `uciToMove`, `numericScore` in core; inject `baseUrl`, auth token provider and entitlement/error callbacks. |
| `coach-service.mjs` | **Server-only** | Request/response schema, evidence validation, curriculum prompt contract | API key, environment config, timeout and provider call must stay backend. Mobile invokes `/api/coach/explain`; never expose `COACH_API_KEY`. |
| `analysis-service.mjs` | **Server-only** | Recognition DTO and validation rules can be shared later | Vision provider key/config, fetch and model call are backend-only. Mobile sends a camera/photo payload to the API; native camera/image encoding is an adapter. |
| `analysis-client.js` | **Web-only UI; API parts portable** | Board-recognition response shape and review request concept | Canvas, DOM, paste/keyboard events, browser file APIs and globals. Rebuild review screen natively and call the same backend routes. |
| `identity-client.js` / `auth-client.js` | **Rewrite per platform** | Account/profile DTOs and API route semantics | Browser Clerk script loading, DOM controls and `localStorage`. Use Clerk React Native/native SDK (or an injected OIDC provider), SecureStore token storage, then send bearer tokens to existing identity routes. |
| `kids-client.js` / `learn-client.js` / `app.js` | **Web-only presentation** | Lesson IDs, progress event names/concepts as contracts | DOM construction, CSS classes, browser storage, global namespace and click/event wiring. Rebuild with React Native components and shared curriculum/rules. Preserve progress versioning and migration semantics. |
| `premium-client.js` / `ability-client.js` | **Rewrite as policy + native UI** | Entitlement names and capability checks | DOM/paywall HTML, localStorage and browser events. Extract a pure `can(feature, subscription)` policy; use native IAP/RevenueCat or store adapters and server-verified entitlements. |
| `payments-service.mjs` / `identity-service.mjs` | **Server-only** | REST contracts | Clerk/backend, cookies/tokens, Postgres and server environment. Mobile must not import them. |

## Dependency risks found

1. **Rules are named “server” but are already the natural shared domain module.** Keep one implementation; otherwise web, native and server will drift on cannon screens, horse legs, elephant eyes, facing generals, and self-check legality.
2. **ESM/browser loading is inconsistent.** `online-client.js` imports `/xiangqi-server-rules.mjs` by absolute web URL, while other browser files use globals. A package import (`@qili/core`) avoids Vite path assumptions and React Native Metro resolution failures.
3. **Global namespace coupling is extensive.** `window.QiliIdentity`, `window.QiliPremium`, `window.XiangqiEngineClient`, `window.QiliLearn`, and custom DOM events are not portable. Replace with dependency injection/hooks in the mobile layer; keep a thin web compatibility shim during migration.
4. **Persistence is deliberately server authoritative.** Local mobile storage can cache settings, lesson progress and an interrupted game, but must not authoritatively write online moves, clocks, ratings, subscriptions or finished games.
5. **Realtime protocol differs by platform.** Browser SSE/EventSource is not uniformly available in React Native. Preserve room snapshot/action semantics and add a native-compatible stream (SSE polyfill first; WebSocket later if needed). Reconnect must resync from a full snapshot.
6. **Engine is not a mobile dependency today.** `engine-client.js` calls `/api/engine/*`; `engine-server.mjs` launches a native Pikafish/Fairy-Stockfish binary. Keep engine server-side for v1 to avoid large binaries, battery cost, platform packaging, and licensing/reproducibility issues.
7. **Coach/vision secrets must never cross the app boundary.** `coach-service.mjs` and `analysis-service.mjs` read provider keys from environment. Mobile gets sanitized, evidence-backed DTOs only.
8. **Rating updates need idempotency.** The client may display provisional/offline estimates, but only the server should call `updateGlicko2` after a verified finished game. Use game ID as the idempotency key.
9. **React Native storage is asynchronous.** `localStorage` calls in `kids-client.js`, `ability-client.js`, `identity-client.js`, `online-client.js`, and `app.js` need an async `StorageAdapter` (SecureStore for tokens, AsyncStorage for non-secret progress) and hydration states.
10. **Two products should not fork game logic.** `qilichesskids` should select a kids curriculum/theme/navigation configuration; it should not maintain a second rules engine, rating implementation, online protocol, or coach evidence model.

## Suggested extraction order

1. Create `packages/core` and move rules plus FEN/UCI helpers; run current web tests against the package.
2. Move curriculum and time-control/rating pure modules; add JSON-safe DTO schemas and progress-version migration tests.
3. Port tactical/coach tools behind an explicit adapter interface and remove `window` exports from their source (retain a web shim).
4. Create `packages/api-client` with injected `baseUrl`, token provider, storage and realtime transport; make web and React Native clients use it.
5. Build native UI shells for `qilichess` and `qilichesskids`, then add native auth, IAP and camera adapters.

The high-confidence shared foundation is rules + curriculum + pure rating/time-control math. Everything that renders, persists secrets, talks to provider services, owns timers/rooms, or manipulates browser globals needs an adapter or must stay on the server.
