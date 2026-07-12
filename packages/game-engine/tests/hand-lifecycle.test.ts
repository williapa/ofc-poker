import { describe, expect, test } from "vitest";
import {
  applyOfcHandEvent,
  createOfcHand,
  createOfcHandSnapshot,
  createStandardDeck,
  nextDealerSeat,
  ofcHandPlayerView,
  ofcHandPublicState,
  restoreOfcHandSnapshot,
  serializeCard,
  transitionOfcHand,
  type CardPlacement,
  type GameConfiguration,
  type OfcHandAction,
  type OfcHandEvent,
  type OfcHandState,
  type SeatCount,
} from "../src/index";

function configuration(seatCount: SeatCount): GameConfiguration {
  return {
    schemaVersion: 1,
    ruleset: "standard-ofc",
    seatCount,
    fantasyland: true,
    tiedRowPoints: 0,
  };
}

function createHand(seatCount: SeatCount = 2, dealerSeat = seatCount - 1) {
  return createOfcHand({
    schemaVersion: 1,
    gameId: "game-1",
    configuration: configuration(seatCount),
    players: Array.from({ length: seatCount }, (_, seat) => ({
      id: `player-${seat}`,
      displayName: `Player ${seat}`,
    })),
    dealerSeat,
    deck: createStandardDeck().map(serializeCard),
  });
}

function placementForBoard(state: OfcHandState): CardPlacement[] {
  const player = state.players.find(({ id }) => id === state.activePlayerId)!;
  const availableRows: CardPlacement["row"][] = [];
  availableRows.push(...Array(3 - player.board.front.length).fill("front"));
  availableRows.push(...Array(5 - player.board.middle.length).fill("middle"));
  availableRows.push(...Array(5 - player.board.back.length).fill("back"));
  return player.pendingCards.map((card, index) => ({
    card,
    row: availableRows[index]!,
  }));
}

function nextAction(state: OfcHandState, actionNumber: number): OfcHandAction {
  const placements = placementForBoard(state);
  const common = {
    schemaVersion: 1 as const,
    actionId: `action-${actionNumber}`,
    expectedRevision: state.revision,
    playerId: state.activePlayerId!,
  };
  return placements.length === 5
    ? {
        ...common,
        type: "ofc.place-initial-cards",
        payload: { placements },
      }
    : {
        ...common,
        type: "ofc.place-card",
        payload: { placement: placements[0]! },
      };
}

function playCompleteHand(initial: OfcHandState) {
  let state = initial;
  const actions: OfcHandAction[] = [];
  const events: OfcHandEvent[] = [];
  while (state.phase !== "complete") {
    const action = nextAction(state, actions.length + 1);
    const result = transitionOfcHand(state, action);
    expect(result.accepted).toBe(true);
    if (!result.accepted) throw new Error(result.rejection.message);
    actions.push(action);
    events.push(...result.events);
    state = result.state;
  }
  return { state, actions, events };
}

function expectRejected(
  state: OfcHandState,
  action: unknown,
  code: string,
): void {
  const result = transitionOfcHand(state, action);
  expect(result).toMatchObject({ accepted: false, state, events: [] });
  if (result.accepted) throw new Error("Expected action rejection");
  expect(result.rejection.code).toBe(code);
  expect(result.state).toBe(state);
}

describe("OFC hand setup and dealing", () => {
  test.each([2, 3, 4] as const)(
    "creates a serializable %i-player hand with the first turn left of dealer",
    (seatCount) => {
      const state = createHand(seatCount, 0);

      expect(state.players).toHaveLength(seatCount);
      expect(state.deck).toHaveLength(52);
      expect(state.activePlayerId).toBe("player-1");
      expect(state.nextDeckIndex).toBe(seatCount * 5);
      expect(
        state.players.every((player) => player.pendingCards.length === 5),
      ).toBe(true);
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
      expect(Object.isFrozen(state)).toBe(true);
      expect(Object.isFrozen(state.players[0]?.board)).toBe(true);
    },
  );

  test("deals the initial five in clockwise rounds beginning left of dealer", () => {
    const state = createHand(2, 1);

    expect(state.players[0]?.pendingCards).toEqual([
      "2c",
      "4c",
      "6c",
      "8c",
      "Tc",
    ]);
    expect(state.players[1]?.pendingCards).toEqual([
      "3c",
      "5c",
      "7c",
      "9c",
      "Jc",
    ]);
  });

  test("rejects invalid seat counts, identities, dealer positions, and decks", () => {
    const base = {
      schemaVersion: 1 as const,
      gameId: "bad-game",
      dealerSeat: 0,
      deck: createStandardDeck().map(serializeCard),
    };
    expect(() =>
      createOfcHand({
        ...base,
        configuration: configuration(2),
        players: [{ id: "one", displayName: "One" }],
      }),
    ).toThrow("two to four");
    expect(() =>
      createOfcHand({
        ...base,
        configuration: configuration(2),
        players: [
          { id: "same", displayName: "One" },
          { id: "same", displayName: "Two" },
        ],
      }),
    ).toThrow("unique");
    expect(() =>
      createOfcHand({
        ...base,
        dealerSeat: 2,
        configuration: configuration(2),
        players: [
          { id: "one", displayName: "One" },
          { id: "two", displayName: "Two" },
        ],
      }),
    ).toThrow("Dealer seat");
    expect(() =>
      createOfcHand({
        ...base,
        deck: base.deck.slice(1),
        configuration: configuration(2),
        players: [
          { id: "one", displayName: "One" },
          { id: "two", displayName: "Two" },
        ],
      }),
    ).toThrow("52 cards");
  });
});

describe("OFC placement lifecycle", () => {
  test.each([2, 3, 4] as const)(
    "completes a deterministic %i-player hand",
    (seatCount) => {
      const initial = createHand(seatCount);
      const { state, actions, events } = playCompleteHand(initial);

      expect(actions).toHaveLength(seatCount * 9);
      expect(events).toHaveLength(actions.length);
      expect(state.revision).toBe(actions.length);
      expect(state.activePlayerId).toBeUndefined();
      expect(state.nextDeckIndex).toBe(seatCount * 13);
      for (const player of state.players) {
        expect(player.board.front).toHaveLength(3);
        expect(player.board.middle).toHaveLength(5);
        expect(player.board.back).toHaveLength(5);
        expect(player.pendingCards).toEqual([]);
      }
      const dealt = state.players.flatMap(({ board }) => [
        ...board.front,
        ...board.middle,
        ...board.back,
      ]);
      expect(dealt).toHaveLength(seatCount * 13);
      expect(new Set(dealt)).toHaveLength(dealt.length);
      expect(new Set(dealt)).toEqual(
        new Set(state.deck.slice(0, state.nextDeckIndex)),
      );
    },
  );

  test("advances clockwise and reveals one single card only when its turn begins", () => {
    let state = createHand(2, 1);
    const firstPending = state.players[0]?.pendingCards;
    let result = transitionOfcHand(state, nextAction(state, 1));
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    state = result.state;
    expect(state.activePlayerId).toBe("player-1");
    expect(state.players[0]?.pendingCards).toEqual([]);
    expect(state.players[1]?.pendingCards).toHaveLength(5);

    result = transitionOfcHand(state, nextAction(state, 2));
    expect(result.accepted).toBe(true);
    if (!result.accepted) return;
    state = result.state;
    expect(state.activePlayerId).toBe("player-0");
    expect(state.players[0]?.pendingCards).toEqual([state.deck[10]]);
    expect(firstPending).toHaveLength(5);
  });

  test("permits placements that could eventually foul", () => {
    const state = createHand();
    const pending = state.players[0]?.pendingCards ?? [];
    const result = transitionOfcHand(state, {
      schemaVersion: 1,
      actionId: "possible-foul",
      expectedRevision: 0,
      playerId: "player-0",
      type: "ofc.place-initial-cards",
      payload: {
        placements: [
          { card: pending[0]!, row: "front" },
          { card: pending[1]!, row: "front" },
          { card: pending[2]!, row: "front" },
          { card: pending[3]!, row: "middle" },
          { card: pending[4]!, row: "middle" },
        ],
      },
    });

    expect(result.accepted).toBe(true);
  });

  test("replays accepted events to the identical state", () => {
    const initial = createHand();
    const played = playCompleteHand(initial);
    let replayed = initial;
    for (const event of played.events) {
      const result = applyOfcHandEvent(
        replayed,
        JSON.parse(JSON.stringify(event)),
      );
      expect(result.accepted).toBe(true);
      if (!result.accepted) throw new Error(result.rejection.message);
      replayed = result.state;
    }

    expect(replayed).toEqual(played.state);
    expect(playCompleteHand(createHand())).toEqual(played);

    const historicalDuplicate = applyOfcHandEvent(played.state, {
      ...played.events[0],
      revision: played.state.revision + 1,
      causationId: "different-causation",
    });
    expect(historicalDuplicate).toMatchObject({
      accepted: false,
      state: played.state,
      rejection: { code: "duplicate-event" },
    });
  });
});

describe("action and event validation", () => {
  test("rejects malformed, stale, unknown-player, wrong-turn, and wrong-stage actions", () => {
    const state = createHand();
    expectRejected(state, { type: "nope" }, "invalid-action");
    expectRejected(
      state,
      { ...nextAction(state, 1), expectedRevision: 5 },
      "stale-revision",
    );
    expectRejected(
      state,
      { ...nextAction(state, 1), playerId: "intruder" },
      "unauthorized-player",
    );
    expectRejected(
      state,
      { ...nextAction(state, 1), playerId: "player-1" },
      "wrong-turn",
    );
    expectRejected(
      state,
      {
        schemaVersion: 1,
        actionId: "wrong-stage",
        expectedRevision: 0,
        playerId: "player-0",
        type: "ofc.place-card",
        payload: { placement: placementForBoard(state)[0] },
      },
      "invalid-action",
    );
  });

  test("rejects duplicate, unknown, committed-card, and over-capacity placements", () => {
    const state = createHand();
    const pending = state.players[0]?.pendingCards ?? [];
    const base = {
      schemaVersion: 1 as const,
      expectedRevision: 0,
      playerId: "player-0",
      type: "ofc.place-initial-cards" as const,
    };
    expectRejected(
      state,
      {
        ...base,
        actionId: "duplicate-card",
        payload: {
          placements: pending.map((card, index) => ({
            card: index === 4 ? pending[0] : card,
            row: "middle",
          })),
        },
      },
      "duplicate-card",
    );
    expectRejected(
      state,
      {
        ...base,
        actionId: "unknown-card",
        payload: {
          placements: pending.map((card, index) => ({
            card: index === 4 ? "3c" : card,
            row: "middle",
          })),
        },
      },
      "unknown-card",
    );
    expectRejected(
      state,
      {
        ...base,
        actionId: "row-full",
        payload: {
          placements: pending.map((card, index) => ({
            card,
            row: index < 4 ? "front" : "back",
          })),
        },
      },
      "row-full",
    );

    const accepted = transitionOfcHand(state, nextAction(state, 1));
    if (!accepted.accepted) throw new Error("setup action failed");
    let later = accepted.state;
    const second = transitionOfcHand(later, nextAction(later, 2));
    if (!second.accepted) throw new Error("setup action failed");
    later = second.state;
    expectRejected(
      later,
      {
        schemaVersion: 1,
        actionId: "move-card",
        expectedRevision: later.revision,
        playerId: "player-0",
        type: "ofc.place-card",
        payload: { placement: { card: pending[0], row: "back" } },
      },
      "card-already-committed",
    );
  });

  test("rejects duplicate actions and action after completion", () => {
    const initial = createHand();
    const action = nextAction(initial, 1);
    const accepted = transitionOfcHand(initial, action);
    if (!accepted.accepted) throw new Error("setup action failed");
    expectRejected(accepted.state, action, "duplicate-action");

    const complete = playCompleteHand(createHand()).state;
    expectRejected(
      complete,
      { ...action, actionId: "after", expectedRevision: complete.revision },
      "hand-complete",
    );
  });

  test("rejects malformed, duplicate, stale, and semantically invalid events without mutation", () => {
    const state = createHand();
    const transition = transitionOfcHand(state, nextAction(state, 1));
    if (!transition.accepted) throw new Error("setup action failed");
    const event = transition.events[0]!;

    const malformed = applyOfcHandEvent(state, {
      ...event,
      payload: { placements: [] },
    });
    expect(malformed).toMatchObject({
      accepted: false,
      state,
      rejection: { code: "malformed-event" },
    });
    expect(malformed.state).toBe(state);
    const stale = applyOfcHandEvent(state, { ...event, revision: 2 });
    expect(stale).toMatchObject({
      accepted: false,
      state,
      rejection: { code: "stale-revision" },
    });
    const wrongPlayer = applyOfcHandEvent(state, {
      ...event,
      payload: { ...event.payload, playerId: "player-1" },
    });
    expect(wrongPlayer).toMatchObject({
      accepted: false,
      state,
      rejection: { code: "invalid-event" },
    });
    const duplicate = applyOfcHandEvent(transition.state, event);
    expect(duplicate).toMatchObject({
      accepted: false,
      state: transition.state,
      rejection: { code: "duplicate-event" },
    });
  });
});

describe("transport projections and hand policy", () => {
  test("keeps pending cards private while exposing committed boards", () => {
    const state = createHand();
    const publicState = ofcHandPublicState(state);
    const playerView = ofcHandPlayerView(state, "player-0");

    expect(JSON.stringify(publicState)).not.toContain("pendingCards");
    expect(playerView.privateData).toEqual({
      pendingCards: state.players[0]?.pendingCards,
    });
    expect(() => ofcHandPlayerView(state, "intruder")).toThrow("not seated");
  });

  test("snapshots round-trip without sharing mutable state", () => {
    const played = transitionOfcHand(createHand(), nextAction(createHand(), 1));
    if (!played.accepted) throw new Error("setup action failed");
    const snapshot = createOfcHandSnapshot(played.state);
    const restored = restoreOfcHandSnapshot(
      JSON.parse(JSON.stringify(snapshot)),
    );

    expect(restored).toEqual(played.state);
    expect(restored).not.toBe(played.state);
    expect(Object.isFrozen(restored)).toBe(true);
    expect(() => restoreOfcHandSnapshot({ ...snapshot, revision: 99 })).toThrow(
      "Invalid",
    );
  });

  test("does not freeze caller-owned configuration input", () => {
    const gameConfiguration = configuration(2);
    createOfcHand({
      schemaVersion: 1,
      gameId: "input-ownership",
      configuration: gameConfiguration,
      players: [
        { id: "one", displayName: "One" },
        { id: "two", displayName: "Two" },
      ],
      dealerSeat: 0,
      deck: createStandardDeck().map(serializeCard),
    });

    expect(Object.isFrozen(gameConfiguration)).toBe(false);
  });

  test.each([
    [0, 2, 1],
    [1, 2, 0],
    [0, 4, 1],
    [3, 4, 0],
  ] as const)(
    "rotates dealer seat %i at a %i-player table to %i",
    (dealer, seats, expected) => {
      expect(nextDealerSeat(dealer, seats)).toBe(expected);
    },
  );
});
