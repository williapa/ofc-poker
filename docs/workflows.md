# Workflows

## Prerequisites and install

- Node.js 24 (the repository pins 24.18.0 in `.nvmrc`)
- npm 11

Select the repository runtime before installing dependencies:

```sh
nvm install
nvm use
node --version
```

The reported version should be `v24.18.0`.

For a clean, lockfile-reproducible install from the repository root:

```sh
npm ci
```

Use `npm install` when intentionally adding or updating dependencies. Both commands install all four workspaces through the single root lockfile. Do not run separate installs in workspace directories.

## Development

```sh
npm run dev
```

The command builds public declarations for domain packages, then starts the Vite client. Vite prints the local URL.

Local AI lobby creation needs no credentials or network service. To create or join
real multiplayer lobbies from the client, expose the public Playroom game ID to
Vite before starting or building the client:

```sh
VITE_PLAYROOM_GAME_ID=your-public-game-id npm run dev
```

Without this value, the home page and local AI flow remain fully available and a
multiplayer submission shows a configuration error. The Playroom module is loaded
only when a multiplayer create or join is submitted.

## Verification

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

The aggregate commands fail when any workspace fails. `typecheck` and `test` build domain packages in dependency order so consumers resolve only declared public exports. Vitest runs client component tests in JSDOM and domain package tests in Node. Playwright builds and serves the static client, then runs the browser suite in Chromium. The production build emits the static client to `packages/client/dist`.

Each package can also be checked independently from the repository root:

```sh
npm run build --workspace @ofcpoker/game-engine
npm run test --workspace @ofcpoker/game-engine
npm run lint --workspace @ofcpoker/game-engine
npm run test:coverage --workspace @ofcpoker/game-engine
```

Replace the workspace name with `@ofcpoker/data-provider`, `@ofcpoker/ai-player`, or `@ofcpoker/client` as needed. Install Playwright's Chromium browser once on a new development machine with `npx playwright install chromium` before running E2E tests.

The engine coverage command uses V8 coverage and enforces minimums of 90% statements, 85% branches, 95% functions, and 90% lines. Coverage output is generated under `packages/game-engine/coverage` and is ignored by git.

Playroom provider contract tests use an in-memory fake SDK boundary and consume
no Playroom quota. The optional real-service, two-browser sandbox procedure and
its public game-ID setup are documented in `packages/data-provider/README.md`.
Account credentials and reconnect tokens must not be committed.

Generated `dist`, TypeScript build-info, coverage, and browser-test artifacts are ignored by git.

## Deployment

GitHub Pages automation is not implemented yet. The deployment design is in `docs/architecture/deployment.md`; the production build command is `npm run build`.
