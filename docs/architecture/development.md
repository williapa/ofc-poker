# Development Architecture

Use the Node.js 24 release pinned by `.nvmrc` with npm 11. One root lockfile owns all dependencies. Workspace packages expose only their package entry points; generated `dist` declarations are built in dependency order before the client is checked or built.

The client is the only package permitted to use React, Vite, React Three Fiber, Three.js, browser APIs, or compose runtime dependencies. Domain package tests must use injected IDs, deck orders, clocks, and random sources so replay remains deterministic.

Commands and generated-output rules are documented in `docs/workflows.md`.
