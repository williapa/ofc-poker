# Agents

- Read `README.md` and the relevant files under `docs/` before changing code. Treat `docs/requirements.md` and `docs/reference/open-face-chinese-poker-rules-engine-spec.md` as the product and rules sources of truth.
- Use TypeScript in strict mode. Prefer explicit domain types and dependency injection over hidden global state.
- Keep the game engine, AI, and data-provider independent of React, browser APIs, Three.js, and each other except through documented interfaces.
- Make the smallest coherent change for the prompt. Do not implement later prompts early unless a small prerequisite is necessary.
- Preserve existing working behavior and user changes. Avoid committing secrets, Playroom credentials, generated build output, or machine-specific files.
- Add or update tests with every behavior change. Use deterministic clocks, random-number generators, deck order, and player IDs in tests.
- Run the relevant format, lint, type-check, unit, integration, build, and end-to-end commands. Report commands and results, including anything that could not be run.
- Update `docs/tasks.md` with completed work and requirement references. Update `docs/workflows.md` when commands or developer workflows change. Mark an item in `docs/requirements.md` complete only after its acceptance criteria are demonstrably satisfied.
- End each prompt with a concise summary of files changed, decisions made, tests run, and remaining risks or follow-up work.
