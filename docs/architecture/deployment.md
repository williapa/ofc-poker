# Deployment Architecture

The client builds to `packages/client/dist` as static assets. A later GitHub Actions workflow will validate the repository and deploy that directory to GitHub Pages on pushes to `main`.

Repository-page deployments live below `/<repository>/`, so Vite is configured with relative asset paths. Lobby navigation uses `?lobby=<id>` on the repository index; no history-fallback rewrite or custom `404.html` router shim is required. See `docs/architecture/system.md` for URL construction and validation rules.

Deployment must not contain Playroom credentials. AI/local builds and automated tests use the local provider and do not initialize the Playroom adapter.
