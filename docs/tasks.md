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

## 3. Standardize the development runtime on Node.js 24

Status: complete (2026-07-11)

Requirement references: R1–R13 development-tooling foundation.

- Pinned Node.js 24.18.0 for nvm and constrained package engines to Node.js 24 with npm 11.
- Reinstalled workspace dependencies under Node.js 24 and refreshed the root lockfile runtime metadata.
- Updated development and clean-install documentation with the nvm selection workflow.
