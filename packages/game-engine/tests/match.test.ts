import { describe, expect, test } from "vitest";
import {
  InvalidSnapshotError,
  UnsupportedVersionError,
  completeOfcMatchHand,
  createOfcMatch,
  createOfcMatchHand,
  createOfcMatchSnapshot,
  createStandardDeck,
  restoreOfcMatchSnapshot,
  serializeCard,
  type CardCode,
  type GameConfiguration,
  type OfcBoard,
  type OfcHandState,
  type OfcMatchState,
} from "../src/index";

const configuration: GameConfiguration = {
  schemaVersion: 1,
  ruleset: "standard-ofc",
  seatCount: 2,
  fantasyland: true,
  tiedRowPoints: 0,
};

function board(front: string, middle: string, back: string): OfcBoard {
  return {
    front: front.split(" ") as CardCode[],
    middle: middle.split(" ") as CardCode[],
    back: back.split(" ") as CardCode[],
  };
}

function createMatch(): OfcMatchState {
  return createOfcMatch({
    schemaVersion: 1,
    gameId: "match-1",
    configuration,
    initialDealerSeat: 1,
    players: [
      { id: "alice", displayName: "Alice" },
      { id: "bob", displayName: "Bob" },
    ],
  });
}

function completedHand(
  match: OfcMatchState,
  boards: readonly [OfcBoard, OfcBoard],
): OfcHandState {
  const hand = createOfcMatchHand(
    match,
    createStandardDeck().map(serializeCard),
  );
  const { activePlayerId: _activePlayerId, ...handWithoutActivePlayer } = hand;
  void _activePlayerId;
  return {
    ...handWithoutActivePlayer,
    phase: "complete",
    players: hand.players.map((player) => ({
      ...player,
      board: boards[player.seat]!,
      pendingCards: [],
    })),
  };
}

describe("multi-hand match state", () => {
  test("validates match identities, table size, dealer, and carried scores", () => {
    const setup = {
      schemaVersion: 1 as const,
      gameId: "invalid",
      configuration,
      initialDealerSeat: 0,
      players: [
        { id: "alice", displayName: "Alice" },
        { id: "bob", displayName: "Bob" },
      ],
    };
    expect(() =>
      createOfcMatch({ ...setup, players: setup.players.slice(0, 1) }),
    ).toThrow("two to four");
    expect(() =>
      createOfcMatch({
        ...setup,
        players: [
          { id: "same", displayName: "Alice" },
          { id: "same", displayName: "Bob" },
        ],
      }),
    ).toThrow("unique");
    expect(() =>
      createOfcMatch({
        ...setup,
        players: [
          { id: "", displayName: "Alice" },
          { id: "bob", displayName: "Bob" },
        ],
      }),
    ).toThrow("non-empty");
    expect(() => createOfcMatch({ ...setup, initialDealerSeat: 2 })).toThrow(
      "Dealer seat",
    );
    expect(() =>
      createOfcMatchHand(
        {
          ...createMatch(),
          players: createMatch().players.map((player, seat) => ({
            ...player,
            cumulativeScore: seat === 0 ? Number.NaN : 0,
          })),
        },
        createStandardDeck().map(serializeCard),
      ),
    ).toThrow("finite integers");
  });

  test("accumulates zero-sum scores and rotates dealer and Fantasyland status", () => {
    const firstBoards = [
      board("Qc Qd 2c", "2h 3h 4h 5h 6h", "Ts Js Qs Ks As"),
      board("Kc Kd 3c", "4c 5c 6c 7c 8c", "Th Jh Qh Kh Ah"),
    ] as const;
    const secondBoards = [
      board("7c 7d 7h", "2h 3h 4h 5h 6h", "Ts Js Qs Ks As"),
      board("Qc Qd 2c", "3c 5c 8c 9c Kc", "Jc Jd Jh 4d 4s"),
    ] as const;

    const initial = createMatch();
    expect(initial).toMatchObject({
      nextHandNumber: 1,
      dealerSeat: 1,
      players: [
        { cumulativeScore: 0, inFantasyland: false },
        { cumulativeScore: 0, inFantasyland: false },
      ],
    });
    const first = completeOfcMatchHand(
      initial,
      completedHand(initial, firstBoards),
    );
    expect(first.state.dealerSeat).toBe(0);
    expect(first.state.nextHandNumber).toBe(2);
    expect(
      first.state.players.map(({ inFantasyland }) => inFantasyland),
    ).toEqual([true, true]);
    expect(
      first.state.players.map(({ cumulativeScore }) => cumulativeScore),
    ).toEqual(
      first.completedHand.result.players.map(({ totalDelta }) => totalDelta),
    );

    const second = completeOfcMatchHand(
      first.state,
      completedHand(first.state, secondBoards),
    );
    expect(second.state.dealerSeat).toBe(1);
    expect(second.state.nextHandNumber).toBe(3);
    expect(second.state.completedHands).toHaveLength(2);
    expect(
      second.state.players.map(({ inFantasyland }) => inFantasyland),
    ).toEqual([true, false]);
    expect(
      second.state.players.reduce(
        (sum, player) => sum + player.cumulativeScore,
        0,
      ),
    ).toBe(0);
    expect(
      second.state.players.map(
        (_player, seat) =>
          (first.state.players[seat]?.cumulativeScore ?? 0) +
          (second.completedHand.result.players[seat]?.totalDelta ?? 0),
      ),
    ).toEqual(
      second.state.players.map(({ cumulativeScore }) => cumulativeScore),
    );
    expect(Object.isFrozen(second.state.completedHands)).toBe(true);
    expect(Object.isFrozen(second.state.completedHands[0]?.result.pairs)).toBe(
      true,
    );
  });

  test("copies cumulative scores into the next hand without exposing mutable collections", () => {
    const initial = createMatch();
    const advanced = completeOfcMatchHand(
      initial,
      completedHand(initial, [
        board("Qc Qd 2c", "2h 3h 4h 5h 6h", "Ts Js Qs Ks As"),
        board("Kc Kd 3c", "4c 5c 6c 7c 8c", "Th Jh Qh Kh Ah"),
      ]),
    ).state;
    const hand = createOfcMatchHand(
      advanced,
      createStandardDeck().map(serializeCard),
    );

    expect(hand.players.map(({ score }) => score)).toEqual(
      advanced.players.map(({ cumulativeScore }) => cumulativeScore),
    );
    expect(() =>
      (
        advanced.players as unknown as OfcMatchState["players"] & unknown[]
      ).push(advanced.players[0]!),
    ).toThrow(TypeError);
  });

  test("round-trips snapshots and reports typed migration and validation failures", () => {
    const state = createMatch();
    const snapshot = createOfcMatchSnapshot(state);
    const restored = restoreOfcMatchSnapshot(
      JSON.parse(JSON.stringify(snapshot)),
    );

    expect(restored).toEqual(state);
    expect(restored).not.toBe(state);
    expect(() =>
      restoreOfcMatchSnapshot({ ...snapshot, schemaVersion: 2 }),
    ).toThrow(UnsupportedVersionError);
    expect(() =>
      restoreOfcMatchSnapshot({ ...snapshot, completedHandCount: 3 }),
    ).toThrow(InvalidSnapshotError);
  });

  test("rejects incomplete or unrelated hands", () => {
    const match = createMatch();
    const placing = createOfcMatchHand(
      match,
      createStandardDeck().map(serializeCard),
    );
    expect(() => completeOfcMatchHand(match, placing)).toThrow("completed");
    expect(() =>
      completeOfcMatchHand(match, {
        ...placing,
        phase: "complete",
        gameId: "other",
      }),
    ).toThrow("current match");
    expect(() =>
      completeOfcMatchHand(match, {
        ...placing,
        phase: "complete",
        players: [...placing.players].reverse(),
      }),
    ).toThrow("seating");
  });
});
