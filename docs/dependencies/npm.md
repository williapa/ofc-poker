# NPM

Use npm as the package manager to maintain independently buildable domain packages and the React + Vite client.

The root workspace, "ofcpoker", should be a package with scripts pointing to the internal workspace projects and shortcuts to their individual scripts, as well as a script to build the entire project.

The workspace packages are `client`, `data-provider`, `game-engine`, and `ai-player`. There is one root `package-lock.json`; dependencies must not be installed from within a workspace.
