# Deployment Architecture

The client builds to `packages/client/dist` as static assets. `.github/workflows/pages.yml` validates pushes to `main`, builds with `VITE_BASE_PATH` set to the repository name, uploads that directory as the Pages artifact, and deploys it only after validation succeeds.

Repository-page deployments live below `/<repository>/`, so Vite normalizes the configurable base to `/<repository>/`. Lobby navigation uses `?lobby=<id>` on the repository index; both home and join links therefore request the real `index.html`, and no history-fallback rewrite or custom `404.html` router shim is required. See `docs/architecture/system.md` for URL construction and validation rules.

Deployment must not contain Playroom credentials. AI/local builds and automated tests use the local provider and do not initialize the Playroom adapter.

## Current release state

A static version with multiplayer disabled was successfully deployed through
the GitHub Actions Pages workflow before the multiplayer-enabled release was
staged. That deployment satisfies R1 and R13. The remaining release action is
to deploy and smoke-test the staged `VITE_PLAYROOM_GAME_ID` configuration on
the public page; this is multiplayer release verification rather than a blocker
for the static application or repository-page deployment requirements.
