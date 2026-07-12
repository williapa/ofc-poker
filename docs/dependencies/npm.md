# NPM

Use NPM as the package manager, in order to leverage NPM workspaces to separately maintain the game engine from the next.js code. 

The root workspace, "ofcpoker", should be a package with scripts pointing to the internal workspace projects and shortcuts to their individual scripts, as well as a script to build the entire project.

The workspace packages are "client", "data-provider", and "game-engine".