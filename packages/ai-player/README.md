# `@ofcpoker/ai-player`

Deterministic, UI-independent Open-Face Chinese Poker players. The package reads
only `OfcPlayerVisibleState` plus engine-enumerated `OfcHandAction` candidates.
The selected action must still be submitted through `transitionOfcHand`, exactly
like a human action.

## Configuration

`createAiConfiguration` provides three named presets:

| Difficulty | Strategy    | Intended behavior                         |
| ---------- | ----------- | ----------------------------------------- |
| `easy`     | `baseline`  | Uniform choice among legal actions        |
| `medium`   | `heuristic` | Balanced legality and scoring opportunity |
| `hard`     | `heuristic` | Stronger foul avoidance and royalty value |

Every preset can be overridden without changing the engine:

- `strength`: how narrowly the heuristic selects from top-scoring actions.
- `riskTolerance`: willingness to retain foul risk for possible upside.
- `royaltyPreference`: weight assigned to royalty-producing patterns.
- `foulAvoidance`: weight assigned to completed and projected foul penalties.
- `thinkDelayMs`: optional presentation delay; it does not affect selection.

The four tuning weights use the inclusive range `0..1`; delay is a non-negative
finite number. Invalid values throw `RangeError` when configuration is created.

## Usage

```ts
import {
  ofcHandLegalActions,
  ofcHandPlayerView,
  transitionOfcHand,
} from "@ofcpoker/game-engine";
import {
  createAiConfiguration,
  createAiPlayer,
  createSeededRandom,
} from "@ofcpoker/ai-player";

const playerId = hand.activePlayerId!;
const ai = createAiPlayer({
  id: playerId,
  dependencies: { random: createSeededRandom(42) },
});
const decision = await ai.decide({
  playerId,
  state: ofcHandPlayerView(hand, playerId),
  legalActions: ofcHandLegalActions(
    hand,
    playerId,
    (index) => `hand-${hand.revision}-${index}`,
  ),
  configuration: createAiConfiguration("hard"),
});
const result = transitionOfcHand(hand, decision.action);
```

All nondeterminism is injected. `createSeededRandom` makes baseline selection,
heuristic tie-breaking, Fantasyland arrangement, and tests repeatable. A caller
can inject a delay function for UI pacing; the package never reads a clock or
uses browser APIs.

The heuristic scores current row strength, rank/suit/sequence potential, row
ordering, royalties, capacity, and present or near-term foul risk.
`arrangeFantasyland` exhaustively evaluates every `3 / 5 / 5` arrangement of a
visible thirteen-card deal and uses the same configuration weights.
