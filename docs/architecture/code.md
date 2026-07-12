# Code Architecture

The System will be split into 4 layers:

1: data provider: abstract playroomKit integration away so that it could be swapped in the future.

2: game engine: This project will build a Open Face Chinese Poker engine but will be designed to accept other types of card game engines in the future. The game engine is built to accept events and return current state. 

3: ai player: this code should be configurable and able to create an AI players with varying levels of ability. 

4: game runner: a singleton that accepts an engine, a data provider, and a view to render the game UI. Part of the client vite app.

5: game view: an interface to separate the UI logic from the game logic. This project will focus on building a 3d view but should be separated to accept a different view (simple 2d one, maybe, or alternate 3d view) in the future. part of the client vite app.

6: initial form view: to get a code for your lobby, I am pretty sure playroomKit comes with a default UI. But in case they don't then there will have to be a small layer that is dedicated to this initial form interaction. The game view may also have its own separate form(s) for configuring the game rules.

Build the game engine, ai player, the data provider in 3 separate packages, using npm workspaces to import the packages into the client vite app.