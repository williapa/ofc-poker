# `@ofcpoker/game-engine`

Pure, deterministic Open-Face Chinese Poker rules. The package has no React,
browser, network, clock, or hidden-randomness dependency. Every returned domain
object and collection is deeply frozen; callers should create new actions and
retain engine-returned state rather than mutating it.

## Cards, decks, and poker evaluation

- `createCard`, `parseCard`, and `serializeCard` use compact canonical codes such
  as `"As"` and return immutable card values.
- `createStandardDeck` returns the canonical 52-card deck or validates a supplied
  order.
- `shuffleDeck` performs Fisher-Yates with a caller-injected `RandomSource`.
- `evaluateThreeCardHand` and `evaluateFiveCardHand` return immutable comparison
  keys; `compareHandEvaluations` returns `-1`, `0`, or `1` and never breaks ties
  by suit.

```ts
import {
  createStandardDeck,
  serializeCard,
  shuffleDeck,
} from "@ofcpoker/game-engine";

const randomValues = [0.1, 0.9, 0.4];
let randomIndex = 0;
const deck = shuffleDeck(
  () => randomValues[randomIndex++ % randomValues.length]!,
  createStandardDeck(),
).map(serializeCard);
```

## One-hand lifecycle and replay

`createOfcHand` validates two to four ordered seats, the dealer, and a complete
deck order. It deals the initial five clockwise. `transitionOfcHand` validates a
versioned player action and returns either an accepted immutable state/event or
a typed rejection with the original state. `applyOfcHandEvent` replays an
accepted event without reading external state. `ofcHandPublicState` omits pending
cards, while `ofcHandPlayerView` includes only the viewer's pending cards.

```ts
import {
  applyOfcHandEvent,
  createOfcHand,
  createStandardDeck,
  serializeCard,
  transitionOfcHand,
} from "@ofcpoker/game-engine";

const initial = createOfcHand({
  schemaVersion: 1,
  gameId: "table-42",
  configuration: {
    schemaVersion: 1,
    ruleset: "standard-ofc",
    seatCount: 2,
    fantasyland: true,
    tiedRowPoints: 0,
  },
  players: [
    { id: "alice", displayName: "Alice" },
    { id: "bob", displayName: "Bob" },
  ],
  dealerSeat: 1,
  deck: createStandardDeck().map(serializeCard),
});

const pending = initial.players[0]!.pendingCards;
const accepted = transitionOfcHand(initial, {
  schemaVersion: 1,
  actionId: "action-1",
  expectedRevision: 0,
  playerId: "alice",
  type: "ofc.place-initial-cards",
  payload: {
    placements: pending.map((card, index) => ({
      card,
      row: index < 3 ? "front" : "middle",
    })),
  },
});

if (accepted.accepted) {
  const replayed = applyOfcHandEvent(initial, accepted.events[0]);
  // replayed.state equals accepted.state when replayed.accepted is true
}
```

Accepted actions are `PlaceInitialCardsAction` and `PlaceCardAction`. The single
event type is `OfcHandEvent`. `ActionRejectionCode` and `EventRejectionCode`
enumerate stable machine-readable rejection categories. `nextDealerSeat` exposes
the standard clockwise rotation policy. `ofcHandLegalActions` enumerates every
currently valid initial-five or single-card action for the active player, using
an injected action-ID factory. The same candidates can be presented to humans or
AI players and are still submitted through `transitionOfcHand`.

## Board resolution and Fantasyland

`evaluateOfcBoard` validates `3 / 5 / 5`, evaluates row legality, and calculates
royalties. `scoreOfcPair` gives a detailed first-player-perspective breakdown.
`resolveOfcRound` validates unique cards across two to four boards, scores every
unordered pair, enforces zero-sum totals, and returns next-hand Fantasyland
qualification. `determineFantasyland` and `fantasylandBoardVisibility` expose the
same policies independently.

```ts
const round = resolveOfcRound([
  { playerId: "alice", board: aliceBoard, wasInFantasyland: false },
  { playerId: "bob", board: bobBoard, wasInFantasyland: true },
]);

const aliceDelta = round.totalDeltas.alice;
const aliceNextFantasyland = round.players[0]!.fantasyland.qualifiesForNextHand;
```

## Multi-hand matches

`createOfcMatch` creates the persistent table state. `createOfcMatchHand` copies
seats and cumulative scores into the next hand using an injected deck.
`completeOfcMatchHand` accepts a completed hand, resolves it, appends immutable
history, accumulates scores, carries Fantasyland status forward, and rotates the
dealer. The lobby owns when a match ends; standard OFC does not define a fixed
hand count or target score.

```ts
let match = createOfcMatch({
  schemaVersion: 1,
  gameId: "table-42",
  configuration,
  players,
  initialDealerSeat: 0,
});

const hand = createOfcMatchHand(match, nextDeck);
// Submit placements until hand.phase === "complete".
const completion = completeOfcMatchHand(match, completedHand);
match = completion.state;
```

## Snapshots and compatibility

`createOfcHandSnapshot` / `restoreOfcHandSnapshot` and
`createOfcMatchSnapshot` / `restoreOfcMatchSnapshot` round-trip JSON-compatible
checkpoints. Schema version `1` is currently supported; no implicit migrations
exist. Unsupported versions throw `UnsupportedVersionError` with the artifact,
received version, supported versions, and migration guidance. A corrupt snapshot
claiming the current version throws `InvalidSnapshotError`. Unsupported events
are rejected with `unsupported-event-version` and the same actionable guidance.

Catch errors by class or by stable `code`:

```ts
try {
  const state = restoreOfcMatchSnapshot(persistedJson);
} catch (error) {
  if (error instanceof UnsupportedVersionError) {
    scheduleSnapshotMigration(error.receivedVersion);
  }
}
```

The generic `DeterministicGameEngine` interface and its action, event, snapshot,
transition, public-state, and player-view types are transport-neutral ports for
future runners. The OFC functions above are the concrete version-1 API.
