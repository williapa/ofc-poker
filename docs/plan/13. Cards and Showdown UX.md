# Prompt 13 - Complete human card-placement and showdown UX

## Goal

Connect the game view to the runner and implement the full human interaction loop. Support initial-five arrangement, single-card placement, confirmation where appropriate, turn feedback, permanent committed placements, Fantasyland private arrangement, showdown reveal, score breakdown, and next-hand flow.

## Acceptance criteria

- A player can place the initial five cards into any non-overflowing rows and clearly distinguish staged from committed cards.
- Single-card turns expose only valid non-full row targets and commit exactly one placement.
- Committed cards cannot be dragged, clicked, or otherwise moved; rejected actions restore coherent UI and announce an error.
- Keyboard and pointer users can complete every placement action without relying solely on 3D hit targets.
- Opponents' face-up cards update from authoritative state; Fantasyland cards stay hidden until showdown.
- Turn, dealer, connection/reconnect, waiting, foul, royalty, scoop, and Fantasyland states are clearly communicated.
- Showdown includes a comprehensible pairwise and total score breakdown and an explicit next-hand action.
- Component/integration tests cover normal and Fantasyland hands, invalid attempts, full rows, disconnect feedback, and showdown.

## Usage
36 percent
