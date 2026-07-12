# Tasks

## 1. Define contracts and workspace boundaries

Status: complete (2026-07-11)

Requirement references: R1–R13 architecture foundation; especially R1, R2, R5–R9, R12, and R13.

- Established the four npm workspaces and one-way dependency graph.
- Added strict, versioned public contracts for deterministic engine actions/events/snapshots, rules-neutral providers, configurable AI decisions, the client-owned runner, and replaceable view adapters.
- Recorded host authority, validation, identity, idempotency, capacity, disconnect/reconnect, host departure, and late-join policies.
- Selected query-string lobby links and relative Vite assets for GitHub repository-page hosting without server rewrites.
- Made lobby settings immutable after creation and separated them from runtime state.
- Installed React, Vite, React Three Fiber, Three.js, TypeScript, and workspace dependencies; added a minimal static client shell.
- Documented install, development, verification, build, and future deployment workflows.

No product requirement is marked complete yet: these contracts and the shell are prerequisites, while the corresponding playable/tested behaviors remain for later tasks in `docs/plan/0. Create Prompt Outline.md`.

## 2. Establish workspace quality gates and test scaffold

Status: complete (2026-07-11)

Requirement references: R1 static client foundation, R10 unit-test foundation, and R11 end-to-end-test foundation.

- Added root formatting, linting, strict type-checking, unit-test, production-build, and Playwright E2E gates that fail on workspace errors.
- Configured Vitest with JSDOM for accessible React component tests and Node for fast domain-package tests.
- Added independent lint and unit-test scripts to all four workspaces while preserving public package entry points and dependency boundaries.
- Added a Chromium E2E smoke test for the statically built accessible application shell.
- Documented reproducible installation and all development and verification commands.

Requirements R10 and R11 remain open because the scaffold does not yet test features that will be implemented in later tasks.

## 2a. Standardize the development runtime on Node.js 24

Status: complete (2026-07-11)

Requirement references: R1–R13 development-tooling foundation.

- Pinned Node.js 24.18.0 for nvm and constrained package engines to Node.js 24 with npm 11.
- Reinstalled workspace dependencies under Node.js 24 and refreshed the root lockfile runtime metadata.
- Updated development and clean-install documentation with the nvm selection workflow.

## 3. Build card, deck, and poker-hand primitives

Status: complete (2026-07-11)

Requirement references: R4 standard OFC hand evaluation foundation and R10 unit tests.

- Added canonical immutable card values with strict compact parsing and serialization.
- Added a validated standard 52-card deck, caller-supplied deterministic order, and Fisher-Yates shuffling with an injected random source.
- Added immutable, JSON-serializable three-card and five-card evaluations with shared comparison keys, complete kicker rules, wheel straights, identifiable royal flushes, and suit-independent ties.
- Added table-driven tests for all hand classes, front-row exceptions, important kickers, exact ties, invalid hands, deck integrity, and deterministic shuffling.

Requirements R4 and R10 remain open because full OFC gameplay and unit coverage for later features are not yet implemented.

## 4. Implement the event-driven hand lifecycle

Status: complete (2026-07-12)

Requirement references: R4 standard OFC hand lifecycle, R5 two-to-four-player support, and R10 unit tests.

- Added a pure, deterministic placement lifecycle with injected seats, dealer position, and validated 52-card deck order.
- Added versioned initial-five and single-card actions, accepted placement events, replay validation, typed action/event rejections, immutable state, and transport-safe snapshots and projections.
- Implemented clockwise action beginning left of the dealer, five-round initial dealing, turn-time single-card reveals, fixed row capacities, committed-card immutability, and exact `3 / 5 / 5` completion accounting.
- Added dealer-rotation policy and kept full multi-hand match state out of scope for the later engine-hardening task.
- Added deterministic tests for complete two-, three-, and four-player hands, replay, every placement boundary, turn/deal timing, serialization, privacy projections, snapshots, and dealer rotation.

Requirements R4, R5, and R10 remain open because scoring, Fantasyland, complete game integration, and unit coverage for later features are not yet implemented.

## 5. Complete OFC round resolution and Fantasyland rules

Status: complete (2026-07-12)

Requirement references: R4 standard OFC scoring and Fantasyland rules, R5 two-to-four-player pairwise scoring, and R10 unit tests.

- Added complete-board validation, per-row evaluations, `back >= middle >= front` foul detection with equality, and zero royalties for fouled boards.
- Implemented every standard front, middle, and back royalty, including distinct royal-flush awards.
- Added standard 1–6 pair scoring with tied rows, scoops, net royalties, legal-versus-fouled, and both-fouled breakdowns.
- Added deterministic two-to-four-player round resolution across every unordered pair with per-player deltas and a zero-sum invariant.
- Added Fantasyland entry and re-entry qualification, simultaneous qualification, placement visibility, and showdown reveal policy.
- Added exhaustive table-driven tests for royalty classes and boundaries, legality, fouls, ties, scoops, multiplayer totals, round validation, and Fantasyland conditions.

Requirements R4, R5, and R10 remain open because lobby/game integration and unit coverage for later features are not yet implemented.

## 6. Harden and document the game engine

Status: complete (2026-07-12)

Requirement references: R4 standard OFC multi-hand continuity and persistence, R5 two-to-four-player invariants, and R10 engine unit and generated testing.

- Added immutable multi-hand match state with cumulative zero-sum scores, completed-hand history, clockwise dealer rotation, and Fantasyland entry/re-entry continuity.
- Added version-1 hand and match snapshot restoration with typed, actionable unsupported-version and invalid-snapshot failures; unsupported event versions now have a distinct typed rejection code.
- Added deterministic generated testing across 72 seeded two-to-four-player hands covering unique cards, exact row capacities, full event replay, identical resolution, and zero-sum scoring.
- Documented every public engine API group with lifecycle, replay, scoring, match, immutability, and snapshot compatibility examples in `packages/game-engine/README.md`.
- Added an independently runnable V8 coverage gate with minimum thresholds of 90% statements, 85% branches, 95% functions, and 90% lines.

Requirements R4, R5, and R10 remain open because the lobby runner and remaining product features are not yet implemented or covered.

## 7. Define the data-provider contract and local provider

Status: complete (2026-07-12)

Requirement references: R2 lobby transport foundation, R5 two-to-four-player capacity, R6 local AI transport foundation, R8 fixed lobby rules, R10 provider unit tests, and R12 quota-free local provider.

- Expanded the rules-neutral provider contract with provider-assigned trusted identities, connected/disconnected presence, typed validation results, host-only activation and publication, temporary disconnect, permanent leave, and typed lifecycle errors.
- Implemented a complete in-memory `LocalDataProvider` with fixed deeply immutable settings, deterministic injectable IDs, optional latency/failure hooks, two-to-four-seat capacity, reserved reconnect seats, late-join/reconnect snapshot replay, and no browser, network, Playroom, or credential dependency.
- Made action requests, validation results, and authoritative events idempotent; enforced monotonic authoritative revisions and safe repeatable subscription/connection/provider cleanup.
- Applied the documented no-host-migration policy: host departure closes the lobby, while peer disconnect preserves identity and seat until reconnect or permanent leave.
- Added a reusable provider contract suite plus local-only tests covering capacity, missing/closed rooms, authority, invalid lifecycle, duplicate delivery, reconnect, late join, cleanup, deterministic IDs, latency, failures, and JSON boundaries.
- Documented the public provider behavior and local adapter test hooks in `packages/data-provider/README.md`.

Requirement R12 is complete. R2, R5, R6, R8, and R10 remain open until their client, runner, AI, and whole-product acceptance criteria are implemented and tested.
