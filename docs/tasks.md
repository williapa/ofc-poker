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
