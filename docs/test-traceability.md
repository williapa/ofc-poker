# Test traceability

This table maps each product requirement to the automated suites that currently
protect it. A mapping is evidence for implemented behavior, not a claim that an
otherwise-open product requirement is complete.

| Requirement            | Automated evidence                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 browser application | `packages/client/tests/App.test.tsx` (home and game shell), `tests/e2e/app-shell.spec.ts` (production browser load)                                                           |
| R2 shareable lobby     | `packages/client/tests/App.test.tsx` (create/join/invite/recovery), `packages/data-provider/tests/contract.ts`, `packages/data-provider/tests/playroom-data-provider.test.ts` |
| R3 settings form       | `packages/client/tests/lobby.test.ts`, `packages/client/tests/App.test.tsx`, `tests/e2e/app-shell.spec.ts`                                                                    |
| R4 standard OFC game   | `packages/game-engine/tests/hand-lifecycle.test.ts`, `scoring.test.ts`, `match.test.ts`; `packages/client/tests/game-runner.test.ts`, `game-view.test.tsx`                    |
| R5 two to four players | provider contract capacity cases, generated engine invariants, AI simulations, client runner cases, and client seat-layout cases for each supported count                     |
| R6 local AI lobby      | `packages/client/tests/providers.test.ts`, `local-ai.test.ts`, `game-runner.test.ts`; local creation browser case                                                             |
| R7 configurable AI     | `packages/ai-player/tests/ai-player.test.ts` (presets, seeded baseline/heuristic decisions, every deal action shape, Fantasyland arrangement, simulations)                    |
| R8 fixed lobby rules   | provider contract immutable-settings case; `packages/client/tests/App.test.tsx` join summary; `lobby.test.ts` settings construction                                           |
| R9 3D UI               | `packages/client/tests/game-view.test.tsx` (2–4 seats, camera, cards, fallback, DOM states); production build                                                                 |
| R10 unit tests         | all Vitest suites; package coverage gates run through root `npm run test:coverage`                                                                                            |
| R11 browser tests      | `tests/e2e/app-shell.spec.ts` (production load, local creation and keyboard placement, validation, malformed join, repository-path refresh); complete journeys remain open    |
| R12 local provider     | local provider contract and option/failure tests; `packages/client/tests/providers.test.ts` proves no network or Playroom loading                                             |
| R13 GitHub Pages       | `pages.yml` gates deployment on validation; Playwright builds and reloads home/join URLs under the configured repository base path                                            |

## OFC rule traceability

| Rule or invariant                                                             | Automated evidence                                                                     |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 52 unique cards, no jokers, injected order                                    | `cards-and-deck.test.ts`                                                               |
| 2–4 seats; clockwise action left of dealer                                    | `hand-lifecycle.test.ts`, generated `engine-invariants.test.ts`                        |
| Initial five, then eight single cards; no movement/discards; 3/5/5 capacities | `hand-lifecycle.test.ts`, `engine-invariants.test.ts`, AI action tests                 |
| Five-card classes, wheel, kickers, ties without suits                         | `poker.test.ts` table cases                                                            |
| Front high card/pair/trips only                                               | `poker.test.ts` front-row cases                                                        |
| Board legality `back >= middle >= front` and fouls                            | `scoring.test.ts` legality and foul cases                                              |
| 1–6 row, tie, scoop, royalties, zero-sum pair scoring                         | `scoring.test.ts` pairwise and multiplayer tables                                      |
| Every front/middle/back royalty class and boundary                            | `scoring.test.ts` royalty tables                                                       |
| Fantasyland entry, privacy, reveal, re-entry                                  | `scoring.test.ts`, `hand-lifecycle.test.ts`, client runner/view tests                  |
| Round order, persistence, dealer rotation, match totals                       | `match.test.ts`, `game-runner.test.ts`                                                 |
| Replay, snapshots, version and validation failures                            | `hand-lifecycle.test.ts`, `match.test.ts`, `game-runner.test.ts` invalid-snapshot case |

## Cross-boundary and resilience traceability

| Risk                                          | Automated evidence                                                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Local and Playroom provider parity            | reusable `packages/data-provider/tests/contract.ts` runs against both adapters                                         |
| Slow and failed operations                    | local provider injected latency/failure case uses fake timers; Playroom initialization/disconnect cases                |
| Duplicate and out-of-order messages           | provider idempotency contract; runner duplicate/delayed update and submission cases                                    |
| Reconnect and latest-snapshot replay          | provider contract reconnect case; client reconnect store, runner remount, and App automatic restore cases              |
| Invalid/malicious actions and snapshots       | engine validation tables; runner malicious payload and invalid-snapshot recovery cases                                 |
| Listener, connection, runner, AI cleanup      | provider disposal contract; runner lifecycle, remount, and AI cancellation cases                                       |
| SDK/protocol failures                         | Playroom boundary RPC acknowledgement, adapter initialization and incompatible-version cases; App recovery-copy cases  |
| WebGL absence                                 | game-view fallback case retains the complete accessible DOM surface                                                    |
| Home, waiting, active, showdown accessibility | axe-core serious/critical scans in `App.test.tsx` and `game-view.test.tsx`, plus focused role/name/keyboard assertions |

Tests use explicit deck order, seeded random sources, injected IDs, fake timers, and
in-memory providers. The suite contains no focused/skipped tests or arbitrary
sleeps; asynchronous assertions observe state transitions with bounded polling.

## Coverage policy

Coverage is a regression guard, not a target for assertions that only execute a
line. All packages require 100% of tests to pass in addition to these floors:

| Package       | Statements / branches / functions / lines | Rationale                                                                                                                                                                                                   |
| ------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| game engine   | 90 / 85 / 95 / 90                         | Pure domain logic supports high exhaustive and generated coverage.                                                                                                                                          |
| AI player     | 90 / 80 / 95 / 90                         | Deterministic decisions and simulations cover public behavior; defensive heuristic branches remain input-sensitive.                                                                                         |
| data provider | 85 / 80 / 85 / 85                         | Both adapters share a contract; the thin real SDK boundary is exercised through an in-memory boundary because CI must not spend quota.                                                                      |
| client        | 80 / 80 / 80 / 80                         | Runner and DOM behavior are heavily tested. The browser entrypoint and type-only contracts are excluded; R3F rendering internals are complemented by layout, fallback, component, and future browser tests. |

CI enforces these floors with `npm run test:coverage` after format, lint, and
type-check, then verifies the production build and Chromium E2E subset.

## Manual evidence boundary

On 2026-07-13, the project owner manually created a two-player Playroom lobby,
joined it by link, and exercised basic gameplay successfully. The result closes
the real-service smoke gap for that narrow scenario only. Automated two-,
three-, and four-player evidence uses the local provider or fake Playroom
boundary; three/four-player, reconnect, host-departure, and mobile real-service
behavior is not inferred from the two-player result. Automated audits must not
contact Playroom or consume its quota.
