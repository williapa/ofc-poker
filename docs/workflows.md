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
npm run test:coverage
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

The root coverage command runs V8 coverage gates for every package. Thresholds
and exclusions are justified in `docs/test-traceability.md`; coverage output is
generated in each package's `coverage` directory and is ignored by git. The
GitHub Actions quality workflow runs clean install, format, lint, type-check,
coverage, production build, and the Chromium E2E subset on pull requests. The
Pages workflow repeats that gate on `main` before deployment.

The client build uses an explicit 1,100 kB minified chunk warning budget. This
covers the current separate Three.js and lazy Playroom dependency boundaries
while preserving a failing warning if either boundary grows materially.

Playroom provider contract tests use an in-memory fake SDK boundary and consume
no Playroom quota. The optional real-service, two-browser sandbox procedure and
its public game-ID setup are documented in `packages/data-provider/README.md`.
Account credentials and reconnect tokens must not be committed.

The complete manual procedure now covers two-, three-, and four-browser
capacity, private-card visibility, peer refresh/reconnect, host closure, full and
missing rooms, initialization and compatibility failures, cleanup, and the
documented 10-daily-user free-tier constraint. Peer reconnect capabilities are
stored only in that browser profile's session storage; host sessions are not
recoverable under the project's no-host-migration policy.

Generated `dist`, TypeScript build-info, coverage, and browser-test artifacts are ignored by git.

## GitHub Pages deployment

In **Settings → Pages**, select **GitHub Actions** as the source. Keep the default
`github-pages` environment; optionally add deployment review protection. Enable
Actions, and require the `Quality / verify` check in `main` branch protection.

Every push to `main` runs `.github/workflows/pages.yml`. Validation must pass
before a fresh artifact is uploaded and deployed. The `pages` concurrency group
serializes deployments without cancelling one in progress. Only artifact and
deployment jobs receive `pages: write` and `id-token: write`; other jobs have
read-only repository access.

For a repository named `ofcpoker`, the URL is
`https://<owner>.github.io/ofcpoker/`. Reproduce the Pages build and browser
checks without Playroom credentials:

```sh
VITE_BASE_PATH=ofcpoker npm run build
npx playwright install chromium
VITE_BASE_PATH=ofcpoker npm run test:e2e
```

Supported URLs are the repository index and query-based join links such as
`/ofcpoker/?lobby=<id>`. Both resolve to `index.html`, so direct navigation and
refresh need no `404.html` fallback. E2E verifies home, join, and refreshed join
loads under the configured repository path.

If assets return 404, confirm the exact repository name (including case) and
inspect `packages/client/dist/index.html` for `/<repository>/assets/` URLs. If
deployment does not run, confirm Pages uses GitHub Actions, validation passed,
and the environment is not awaiting approval. Keep `?lobby=` in join URLs. A
missing `VITE_PLAYROOM_GAME_ID` disables only multiplayer; local AI, CI, builds,
and deployment need no credentials and consume no Playroom quota.
