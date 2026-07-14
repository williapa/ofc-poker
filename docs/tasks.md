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

## 8. Implement and contract-test the Playroom provider

Status: complete (2026-07-12)

Requirement references: R2 shareable multiplayer lobby transport, R5 two-to-four-player capacity, R8 fixed lobby rules, and R10 provider unit/contract tests.

- Installed and verified Playroom Kit 0.0.97, isolating all SDK imports and concepts inside the Playroom boundary and adapter.
- Added a host-authoritative Playroom protocol with SDK-derived sender identity, host-only publication, idempotent requests/updates, monotonic revisions, capacity and activation enforcement, reserved reconnect seats, snapshot replay, and the documented no-host-migration policy.
- Added repeatable listener/session cleanup, one-session browser initialization protection, and repository-page-safe `?lobby=` share-link generation that never includes reconnect capabilities.
- Ran the reusable provider contract against an in-memory fake Playroom boundary and added adapter-specific configuration, initialization, link, and settings tests without spending service quota.
- Documented the verified SDK surface, public game-ID configuration, security boundaries, and manual two-browser sandbox procedure.

R2, R5, R8, and R10 remain open until the client runner and complete product acceptance criteria are implemented and tested. No requirement is newly marked complete by this provider-only task.

## 9. Build configurable AI players

Status: complete (2026-07-12)

Requirement references: R7 internally configurable AI players and R10 AI unit and simulation tests.

- Added engine-enumerated OFC legal actions with injected stable IDs, covering every capacity-safe initial-five assignment and available row on single-card turns; every enumerated action is exercised through the ordinary engine validator.
- Added easy, medium, and hard AI presets with baseline and heuristic strategies plus validated strength, risk-tolerance, royalty-preference, foul-avoidance, and optional injected think-delay parameters.
- Added a seeded random source, uniform legal baseline selection, and a tunable heuristic that evaluates row ordering, draw potential, scoring opportunity, royalties, capacity, and present or projected foul risk using only player-visible state.
- Added exhaustive deterministic Fantasyland arrangement across all `3 / 5 / 5` boards for a visible thirteen-card deal.
- Added deterministic tests for initial-five placement, single-card turns, row-capacity pressure, near-foul choices, Fantasyland arrangement, configuration and delays, and repeatable decisions.
- Added seeded simulations of 24 complete two-to-four-player games with mixed strategies, ordinary engine validation on every action, hang guards, and reported foul-rate diagnostics without flaky quality thresholds.
- Documented the public AI API, presets, parameters, dependency injection, legal-action flow, and Fantasyland helper.

R7 is complete. R10 remains open until all remaining product features are implemented and covered.

## 10. Implement the app shell, settings form, and static routing

Status: complete (2026-07-12)

Requirement references: R1 static browser client, R2 shareable lobby links, R3 lobby settings form, R5 two-to-four-player configuration, R6 quota-free local AI selection, R8 fixed lobby rules, R10 component/unit coverage, and R11 browser coverage.

- Replaced the placeholder shell with a responsive, semantic pre-game experience for display name, local AI or multiplayer mode, two-to-four-player count, and the fixed standard-OFC rules.
- Added typed defaults and pure validation for display names, supported seat counts, and immutable lobby settings, with inline errors, error focus, route-change focus, labels, fieldsets, and keyboard-native controls.
- Added query-string parsing and link construction that retain the current repository pathname, reject malformed or duplicated lobby identifiers, and clear stale query/hash state when returning home.
- Wired provider selection through an injected composition-root factory. Local AI uses the in-memory provider, while the Playroom adapter is dynamically imported only after a multiplayer create or join submission.
- Added create and join flows, helpful provider errors, share-link display, and a read-only lobby summary with no controls suggesting that settings can be changed.
- Added unit/component coverage for defaults, validation, provider failures, local and multiplayer create flows, static routing, join behavior, invalid and missing lobbies, immutable settings, and the no-eager-provider guarantee; expanded Playwright coverage for local creation and invalid links.

R1–R3, R5, R6, R8, R10, and R11 remain open until the full user journey, deployment, and remaining feature coverage are complete.

## 11. Implement the game runner and lobby lifecycle

Status: complete (2026-07-12)

Requirement references: R2 multiplayer lobby coordination, R4 multi-hand OFC continuity, R5 two-to-four-seat lifecycle, R6 local AI coordination, R8 fixed lobby rules, and R10 runner unit/integration tests.

- Added a client-owned OFC runner that owns one lobby connection and view subscription, starts idempotently, and performs repeatable leave or reconnect-preserving cleanup.
- Enforced capacity and connected-seat start rules for two-to-four human and/or configured AI seats, with host-only deck creation, lobby activation, engine validation, and authoritative publication.
- Routed human provider requests and configured AI decisions through one trusted-sender engine command path; untrusted action player IDs are replaced with provider or configured AI identity.
- Added a monotonic match-wide authority revision and snapshot envelope around engine hand and match state so duplicate, delayed, reconnect, and cross-hand updates cannot double-apply or regress state.
- Expanded the read-only view model with waiting/placing/complete/closed phase, local connection and turn state, legal actions, seats and presence, cumulative scores, dealer, Fantasyland status, next-hand availability, and actionable errors.
- Added host-only next-hand transitions that retain match totals and Fantasyland qualification, rotate the dealer, inject a fresh deterministic deck, and publish the new hand without resetting transport authority.
- Added local-provider/fake-view integration coverage for waiting and activation, peer non-authority, full deterministic play, trusted identity, duplicate and delayed delivery, reconnect/remount, AI turns, cancellation, and idempotent cleanup.

No product requirement is newly marked complete: the runner is the coordination foundation for the later 3D/human interaction, complete local AI, multiplayer UI, and end-to-end prompts.

## 12. Establish the minimal 3D game-view design system

Status: complete (2026-07-12)

Requirement references: R4 standard OFC board presentation, R5 two-to-four-seat layouts, R9 minimal 3D UI, and R10 rendering/component tests.

- Added a typed React Three Fiber game view behind the existing view-model/action boundary, with no reducer or provider SDK imports.
- Defined stable local-seat layouts for two through four seats, responsive orthographic camera framing, felt geometry, restrained lighting, design tokens, and reduced-motion behavior.
- Added legible generated rank/suit card faces, consistent Fantasyland card backs, selected-card treatment, and valid/unavailable target states.
- Added an accessible DOM overlay for status, scores, row labels and `3 / 5 / 5` capacities, public and hidden card information, errors, and keyboard-native controls.
- Added WebGL feature detection, render-error containment, and a fallback that preserves the DOM game surface.
- Added deterministic component and layout tests for every seat count, camera behavior, row semantics, card/action semantics, Fantasyland privacy, configured open seats, and fallback behavior.

R9 and R10 remain open until the game view is connected to the complete application journey and the remaining product features are implemented and tested end to end.

## 13. Complete human card-placement and showdown UX

Status: complete (2026-07-12)

Requirement references: R4 standard OFC and Fantasyland play, R5 two-to-four-seat feedback, R9 integrated 3D game view, R10 component/integration coverage, and R11 browser coverage.

- Connected lobby creation and joining to the host-authoritative runner and game view, including configured local AI seats, deterministic injected deck boundaries, waiting/invite presentation, cleanup, and next-hand control.
- Added click- and keyboard-complete staged initial-five and private thirteen-card Fantasyland arrangement with explicit confirmation, capacity-safe targets, immutable committed cards, immediate single-card commits, and rejection reset/error announcements.
- Extended hand setup to deal thirteen private cards to qualified Fantasyland players, keep their committed boards hidden from opponents during placement, expose the owner’s board, and reveal all boards at showdown.
- Added dealer, active-turn, waiting, disconnect/reconnect, Fantasyland, foul, royalty, scoop, per-hand delta, and cumulative-score presentation.
- Added a pairwise showdown breakdown for row results, scoop, foul, royalties, and totals, plus an explicit host-only next-hand action.
- Added engine, runner, component, application, and browser coverage for normal and Fantasyland placement, privacy/reveal, staged versus committed cards, full/unavailable rows, rejection feedback, disconnect/reconnect status, showdown, and next-hand flow.

No product requirement is newly marked complete: later prompts still cover the complete offline AI journey, multiplayer hardening, deployment, and whole-product acceptance coverage.

## 14. Deliver the complete offline AI-lobby mode

Status: complete (2026-07-12)

Requirement references: R4 multi-hand score, dealer, and Fantasyland continuity; R5 two-to-four-seat local play; R6 quota-free offline AI lobby; R7 centralized AI configuration; R10 unit/integration coverage; and R11 local journey browser coverage.

- Added one client-owned production AI profile registry for opponent names, strategies, difficulty, tuning, and presentation pacing, with deterministic per-lobby random sources and support for one to three AI seats.
- Added cancellable client-side think delays while keeping the AI package clock-free; runner disposal now cancels each seat's pending presentation work and generation/revision guards prevent duplicate or late actions.
- Exposed deterministic AI-thinking state through the view model and accessible status/scoreboard text without making tests advance real timers.
- Asserted that local AI creation does not load the Playroom adapter, construct a WebSocket, or call `fetch`, even when multiplayer configuration is present.
- Added deterministic integration coverage that completes consecutive human-plus-AI hands, verifies cumulative zero-sum scores and dealer rotation, and renders the resulting showdown score screen.
- Retained the existing deterministic multi-hand runner coverage that proves Fantasyland qualification, hidden placement, reveal, score preservation, and dealer rotation across hands.

R6 is complete. R4, R5, R10, and R11 remain open pending the later multiplayer hardening, deployment, and whole-product acceptance prompts.

## 15. Deliver the complete multiplayer lobby flow

Status: complete (2026-07-12)

Requirement references: R2 invite-by-link multiplayer lobbies, R4 synchronized
host-authoritative play, R5 two-to-four-player capacity, R8 fixed lobby rules,
R10 adapter/client integration coverage, and R11 multiplayer journey coverage.

- Completed production client composition around the dynamically loaded
  Playroom provider, with visible room codes, repository-page-safe invite URLs,
  clipboard copy feedback, fixed settings, occupied/open seats, and
  capacity-driven start behavior.
- Added session-scoped peer reconnect capability persistence outside the URL.
  Refresh restores the same provider identity, reserved seat, metadata, and
  latest authoritative snapshot during the provider grace period; expired
  tokens give a precise rejoin/new-lobby path.
- Kept the documented no-host-migration policy explicit: host refresh/departure
  closes the lobby, peers receive closure feedback, and the prior host is told to
  create and share a new lobby.
- Added distinct missing, full, active, closed, incompatible-version,
  initialization-failure, and connection-loss messages with retry, reconnect,
  return-home, or new-table actions as appropriate.
- Preserved trusted SDK sender identity and host authority while adding
  integration coverage proving spoofed, malformed, duplicate, and stale actions
  do not change authoritative state.
- Made multiplayer runner cleanup reconnect-preserving on remount/refresh and
  explicit leave permanent, with repeatable provider/session/listener cleanup.
- Expanded fake-boundary, runner, component, and application tests for protocol
  compatibility, SDK failures, transport loss, automatic peer restoration,
  host recovery policy, room-code/copy UX, and recovery controls without using
  Playroom quota.
- Updated the real Playroom smoke procedure for two to four browser profiles,
  privacy/synchronization, reconnect and host lifecycle, failure states,
  cleanup, and the documented 10-daily-user free-tier constraint.

No product requirement is newly marked complete: real-service behavior remains
covered by the documented manual smoke test rather than CI, and the final
whole-product/deployment prompts still need to close the aggregate requirements.

## 16. Expand unit, integration, accessibility, and resilience coverage

Status: complete (2026-07-12)

Requirement references: R1–R13 traceability, R4 rules regression coverage, R10
whole-product unit/integration quality, and R11 accessibility foundations.

- Added requirement, OFC-rule, package-boundary, resilience, and accessibility
  traceability for every implemented feature and the remaining deployment gap.
- Added automated serious/critical accessibility scans for home, waiting-room,
  active-game, and showdown states while retaining focused semantic and keyboard
  assertions.
- Added malformed authoritative-snapshot recovery coverage alongside existing
  deterministic latency, failure, duplicate, out-of-order, reconnect, disposal,
  SDK failure, and WebGL fallback cases.
- Added justified V8 coverage gates to the AI, provider, and client packages and
  a root command that enforces every package gate.
- Added a GitHub Actions quality workflow for format, lint, type-check, coverage,
  and production-build verification without service credentials or quota use.
- Confirmed the suite has no skipped/focused tests or arbitrary sleeps and uses
  deterministic decks, IDs, seeded random sources, in-memory transports, and
  fake time where timing behavior matters.

R10 is complete. R11 remains open for the broader browser journey automation in
the next prompt; R13 remains open until GitHub Pages deployment is implemented.

## 17. Improve table card readability and pending placement feedback

Status: complete (2026-07-12)

Requirement references: R9 readable minimal 3D game UI, R10 unit tests, and R11 browser interaction coverage.

- Increased each 3D card to more than twice its previous area and enlarged the rank and suit artwork within the card face.
- Preserved every seat position while presenting all player boards upright with the standard `3 / 5 / 5` row order.
- Spaced the local hand below the back row and adjusted table geometry so the larger cards remain within the table framing.
- Projected initial-five assignments into local board slots immediately, removed staged cards from the hand, kept the proposal private until confirmation, and allowed staged cards to be selected and moved.
- Added component assertions for card scale, upright seats, pending-card movement, and staged-card reselection.
- Enlarged the cards by another 59% over the first readability pass, expanded the table layout, and removed the visible duplicate hand controls beside the confirmation action while retaining screen-reader placement controls.
- Removed the footer layer entirely, moved confirmation and next-hand actions into the top HUD, and visually hid the redundant row-list panel so neither overlay intercepts table interactions or obscures the fourth seat.
- Replaced the splash-page numeric motif with three centered slot rows of `3 / 5 / 5`, slowed local AI presentation to 850–1,050 ms, simplified card faces to one central suit, and added reduced-motion-safe attention animation to enabled confirm and next-hand actions.

Requirements R9 and R11 remain open pending complete product-level visual and end-to-end acceptance. R10 remains complete for the behavior implemented so far.

## 18. Configure CI and GitHub Pages deployment

Status: complete (2026-07-12)

Requirement references: R1 static browser application, R2 repository-safe shareable links, R6 quota-free local AI, R10 automated validation, R11 browser coverage, and R13 GitHub Pages deployment.

- Added pull-request validation for clean install, formatting, lint, type-checking, unit/integration coverage, production build, and Chromium E2E tests.
- Added a `main` workflow that repeats validation before building and uploading a Pages artifact, grants Pages/OIDC permissions only to deployment jobs, and serializes deployments without cancelling one in progress.
- Made the Vite base path configurable and normalized for repository-page asset URLs while retaining `/` for ordinary local builds.
- Retained query-string static routing so home and join URLs resolve to the real repository index, and added browser coverage for direct and refreshed join loads beneath a repository base path.
- Documented Pages settings, branch protection, deployment URL, local reproduction, permissions, routing, asset troubleshooting, and the credential-free/quota-free CI boundary.

R13 remains open until a successful deployment demonstrates that the public repository page is available. No other product requirement is newly marked complete.

## 19. Fix Playroom join broadcast completion

Status: implementation complete (2026-07-13); real-service smoke verification remains manual

Requirement references: R2 shareable lobby, R5 two-to-four-player lobby capacity, and R10 unit tests.

- Corrected the production Playroom boundary to acknowledge every inbound RPC. Playroom 0.0.97 delivers an RPC payload but leaves the sender's `RPC.call` promise pending unless the registered handler returns a response; the pending promise stalled the host runner before it could render the second participant or publish the initial authoritative game state.
- Added a boundary-level regression test that exercises the installed SDK's response contract rather than relying only on the in-memory Playroom fake, whose send methods had resolved without requiring a handler response.
- Kept the existing in-memory provider and fake boundary as the quota-free local testing strategy. A network-faithful Playroom clone remains medium-to-high complexity and would duplicate room routing, presence, ordering, host authority, reconnect grace periods, and failure behavior without improving coverage of this SDK-specific defect.

No requirement is newly marked complete until the documented two-browser Playroom smoke procedure confirms the hosted service behavior.
