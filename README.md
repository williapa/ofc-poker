# OFC Poker - Multiplayer Browser Card Game

## Summary

Browser implementation of multiplayer Open-Face Chinese Poker, a 2-4 player card game where players create 3 poker hands from 13 cards, dealt face-up, to score points. Create a lobby and invite friends with a link. Play games right away with no account required.

The implementation uses four npm workspaces: a React + Vite client, a deterministic game engine, configurable AI players, and a transport-neutral data provider. See `docs/architecture/code.md` for dependency rules and `docs/workflows.md` for current commands.

The game engine's public API, deterministic lifecycle, replay, scoring, match, and persistence examples are documented in `packages/game-engine/README.md`.

## Agents.md

Instructions to be included with all agent prompts.

## Docs structure

### reference/

Summarize key results from research that influences choices related to the requirements, code, architecture or dependencies of the project.

### architecture/

Document design for the system, code, and deployments.

### dependencies/

Overview of libraries, services, platforms, or tools on which this project depend, and the reasons why they have been chosen. 1 per file.

### workflows.md

Define automated workflows related to setup/install as well as development and deployment processes.

### requirements.md (what, why)

Lists the requirements, tracking completion and connected tasks.

### tasks.md (how, where)

Units of work accomplished in logical steps, referencing a requirement #.

### plan/

Outline of prompts for completing the project requirements.
