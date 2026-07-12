# Workflows

## Prerequisites and install

- Node.js 20 LTS, or Node.js 22 and newer (Node.js 21 is not supported by Vite 6)
- npm 10 or newer

From the repository root:

```sh
npm install
```

This installs all four workspaces and updates the single root lockfile. Do not run separate installs in workspace directories.

## Development

```sh
npm run dev
```

The command builds public declarations for domain packages, then starts the Vite client. Vite prints the local URL.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

`typecheck` and `test` build domain packages in dependency order so consumers resolve only declared public exports. During this contracts milestone, workspace `test` scripts perform strict compile-time contract checks; behavioral test tooling and lint/format/E2E gates remain planned work. `build` emits the static client to `packages/client/dist`.

Generated `dist`, TypeScript build-info, coverage, and browser-test artifacts are ignored by git.

## Deployment

GitHub Pages automation is not implemented yet. The deployment design is in `docs/architecture/deployment.md`; the production build command is `npm run build`.
