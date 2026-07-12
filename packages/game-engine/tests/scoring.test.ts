import { describe, expect, test } from "vitest";
import {
  RANKS,
  createStandardDeck,
  determineFantasyland,
  evaluateOfcBoard,
  fantasylandBoardVisibility,
  resolveOfcRound,
  scoreOfcPair,
  serializeCard,
  type CardCode,
  type OfcBoard,
  type OfcRoundPlayerInput,
} from "../src/index";

function codes(value: string): readonly CardCode[] {
  return value.split(" ") as CardCode[];
}

function board(front: string, middle: string, back: string): OfcBoard {
  return {
    front: codes(front),
    middle: codes(middle),
    back: codes(back),
  };
}

const LEGAL_WITH_BACK_STRAIGHT = board(
  "Ac 3d 2h",
  "6c 6d 9h 8s 4c",
  "9c 8c 7d 6h 5s",
);

const LOWER_LEGAL = board("Kd 3c 2d", "5c 5d 9d 8h 4d", "7c 7h Qd Js 4s");

const FOULED = board("Ac Ad 2c", "Kc Kd 9h 8s 4c", "9c 8c 7d 6h 5s");

function boardWithFrontMatches(
  rank: (typeof RANKS)[number],
  count: 2 | 3,
): OfcBoard {
  const reserved = new Set(codes("2h 3h 4h 5h 6h Ts Js Qs Ks As"));
  const matches = (["c", "d", "h", "s"] as const)
    .map((suit) => `${rank}${suit}` as CardCode)
    .filter((card) => !reserved.has(card))
    .slice(0, count);
  const kickerRank = rank === "9" ? "8" : "9";
  return {
    front: count === 2 ? [...matches, `${kickerRank}c` as CardCode] : matches,
    middle: codes("2h 3h 4h 5h 6h"),
    back: codes("Ts Js Qs Ks As"),
  };
}

describe("completed board evaluation and royalties", () => {
  test("uses back >= middle >= front and permits adjacent equality", () => {
    const equalFiveCardRows = board(
      "2c 3d 4h",
      "5c 5d Ah Ks Qc",
      "5h 5s Ad Kh Qd",
    );
    expect(evaluateOfcBoard(equalFiveCardRows).fouled).toBe(false);
    expect(evaluateOfcBoard(FOULED)).toMatchObject({
      fouled: true,
      royalties: { front: 0, middle: 0, back: 0, total: 0 },
    });
  });

  test.each([
    ...RANKS.map(
      (rank, index) =>
        [
          `${rank}${rank}`,
          boardWithFrontMatches(rank, 2),
          Math.max(0, index - 3),
        ] as const,
    ),
    ...RANKS.map(
      (rank, index) =>
        [
          `${rank}${rank}${rank}`,
          boardWithFrontMatches(rank, 3),
          index + 10,
        ] as const,
    ),
  ])("awards the front royalty for %s", (_name, value, points) => {
    const result = evaluateOfcBoard(value);
    expect(result.fouled).toBe(false);
    expect(result.royalties.front).toBe(points);
  });

  test.each([
    ["high card", "Ac Kd 9h 7s 5d", 0],
    ["one pair", "7c 7d 9h 5s 2d", 0],
    ["two pair", "7c 7d 9h 9s 2d", 0],
    ["trips", "7c 7d 7s 9c 2d", 2],
    ["straight", "5c 6d 7s 8c 9d", 4],
    ["flush", "2s 5s 7s 9s Js", 8],
    ["full house", "7c 7d 7s 9c 9d", 12],
    ["quads", "7c 7d 7h 7s 9c", 20],
    ["straight flush", "5s 6s 7s 8s 9s", 30],
    ["royal flush", "Tc Jc Qc Kc Ac", 50],
  ] as const)("awards the middle %s royalty", (_name, middle, points) => {
    expect(
      evaluateOfcBoard(board("2c 3d 4h", middle, "Th Jh Qh Kh Ah")).royalties
        .middle,
    ).toBe(points);
  });

  test.each([
    ["high card", "Ac Kd Qs 9h 7d", 0],
    ["one pair", "6c 6d Qs 9h 7d", 0],
    ["two pair", "6c 6d 8c 8d Qs", 0],
    ["trips", "6c 6d 6h 8c Qs", 0],
    ["straight", "Th Jd Qs Kc Ah", 2],
    ["flush", "2s 5s 7s 9s Js", 4],
    ["full house", "6c 6d 6h 8c 8d", 6],
    ["quads", "6c 6d 6h 6s 8c", 10],
    ["straight flush", "9d Td Jd Qd Kd", 15],
    ["royal flush", "Ts Js Qs Ks As", 25],
  ] as const)("awards the back %s royalty", (_name, back, points) => {
    expect(
      evaluateOfcBoard(board("2c 3d 4h", "5c 5d 7h 8s 9c", back)).royalties
        .back,
    ).toBe(points);
  });

  test("keeps royal flush distinct in round output", () => {
    const result = evaluateOfcBoard(
      board("Qc Qd 2c", "Th Jh Qh Kh Ah", "Ts Js Qs Ks As"),
    );
    expect(result.rows.middle.handClass).toBe("royal-flush");
    expect(result.rows.back.handClass).toBe("royal-flush");
    expect(result.royalties).toEqual({
      front: 7,
      middle: 50,
      back: 25,
      total: 82,
    });
  });
});

describe("standard pairwise scoring", () => {
  test("scores a legal scoop, row results, bonus, and net royalties", () => {
    const result = scoreOfcPair(
      "first",
      evaluateOfcBoard(LEGAL_WITH_BACK_STRAIGHT),
      "second",
      evaluateOfcBoard(LOWER_LEGAL),
    );
    expect(result).toEqual({
      firstPlayerId: "first",
      secondPlayerId: "second",
      kind: "legal",
      rows: { front: 1, middle: 1, back: 1 },
      rowDelta: 3,
      scoopDelta: 3,
      foulDelta: 0,
      royaltyDelta: 2,
      totalDelta: 8,
    });
  });

  test("scores tied rows as zero and does not award a scoop", () => {
    const tied = board("As 3h 2c", "6h 6s 9d 8d 4h", "9s 8h 7c 6d 5c");
    expect(
      scoreOfcPair(
        "first",
        evaluateOfcBoard(LEGAL_WITH_BACK_STRAIGHT),
        "second",
        evaluateOfcBoard(tied),
      ),
    ).toMatchObject({
      rows: { front: 0, middle: 0, back: 0 },
      rowDelta: 0,
      scoopDelta: 0,
      royaltyDelta: 0,
      totalDelta: 0,
    });
  });

  test("scores legal-versus-fouled and both-fouled exactly", () => {
    const legal = evaluateOfcBoard(LEGAL_WITH_BACK_STRAIGHT);
    const foul = evaluateOfcBoard(FOULED);
    expect(scoreOfcPair("legal", legal, "foul", foul)).toMatchObject({
      kind: "second-fouled",
      rows: { front: null, middle: null, back: null },
      foulDelta: 6,
      royaltyDelta: 2,
      totalDelta: 8,
    });
    expect(scoreOfcPair("foul", foul, "legal", legal).totalDelta).toBe(-8);
    expect(scoreOfcPair("one", foul, "two", foul)).toMatchObject({
      kind: "both-fouled",
      totalDelta: 0,
    });
  });
});

describe("multiplayer round resolution", () => {
  test.each([2, 3, 4] as const)(
    "scores every unordered pair for %i players and remains zero-sum",
    (playerCount) => {
      const deck = createStandardDeck().map(serializeCard);
      const players: OfcRoundPlayerInput[] = Array.from(
        { length: playerCount },
        (_, index) => {
          const cards = deck.slice(index * 13, index * 13 + 13);
          return {
            playerId: `player-${index}`,
            wasInFantasyland: false,
            board: {
              front: cards.slice(0, 3),
              middle: cards.slice(3, 8),
              back: cards.slice(8, 13),
            },
          };
        },
      );
      const result = resolveOfcRound(players);

      expect(result.pairs).toHaveLength((playerCount * (playerCount - 1)) / 2);
      expect(result.players).toHaveLength(playerCount);
      expect(
        Object.values(result.totalDeltas).reduce(
          (sum, delta) => sum + delta,
          0,
        ),
      ).toBe(0);
      expect(result.players.map(({ totalDelta }) => totalDelta)).toEqual(
        Object.values(result.totalDeltas),
      );
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(players[0]?.board)).toBe(false);
    },
  );

  test("rejects incomplete, duplicate-player, and cross-board duplicate cards", () => {
    expect(() =>
      evaluateOfcBoard({ ...LEGAL_WITH_BACK_STRAIGHT, front: ["Ac"] }),
    ).toThrow("3 / 5 / 5");
    expect(() =>
      resolveOfcRound([
        {
          playerId: "same",
          board: LEGAL_WITH_BACK_STRAIGHT,
          wasInFantasyland: false,
        },
        { playerId: "same", board: LOWER_LEGAL, wasInFantasyland: false },
      ]),
    ).toThrow("IDs");
    expect(() =>
      resolveOfcRound([
        {
          playerId: "one",
          board: LEGAL_WITH_BACK_STRAIGHT,
          wasInFantasyland: false,
        },
        {
          playerId: "two",
          board: LEGAL_WITH_BACK_STRAIGHT,
          wasInFantasyland: false,
        },
      ]),
    ).toThrow("multiple");
  });
});

describe("Fantasyland policy", () => {
  test.each([
    ["JJ does not enter", "Jc Jd 2c", false, "none"],
    ["QQ enters", "Qc Qd 2c", true, "entry"],
    ["AA enters", "Ac Ad 2c", true, "entry"],
    ["trips enter", "7c 7d 7h", true, "entry"],
  ] as const)("%s", (_name, front, qualifies, qualification) => {
    const evaluation = evaluateOfcBoard(
      board(front, "2h 3h 4h 5h 6h", "Ts Js Qs Ks As"),
    );
    expect(determineFantasyland(evaluation, false)).toMatchObject({
      qualifiesForNextHand: qualifies,
      qualification,
    });
  });

  test.each([
    ["front trips", board("7c 7d 7h", "2h 3h 4h 5h 6h", "Ts Js Qs Ks As")],
    [
      "middle full house",
      board("2c 3d 4h", "7c 7d 7s 9c 9d", "Ts Js Qs Ks As"),
    ],
    ["back quads", board("2c 3d 4h", "5c 5d 7h 8s 9c", "6c 6d 6h 6s 8c")],
  ] as const)("re-enters with %s", (_name, value) => {
    expect(determineFantasyland(evaluateOfcBoard(value), true)).toMatchObject({
      qualifiesForNextHand: true,
      qualification: "re-entry",
    });
  });

  test("does not enter or re-enter from a foul", () => {
    expect(determineFantasyland(evaluateOfcBoard(FOULED), false)).toMatchObject(
      {
        qualifiesForNextHand: false,
        qualification: "none",
      },
    );
    expect(determineFantasyland(evaluateOfcBoard(FOULED), true)).toMatchObject({
      qualifiesForNextHand: false,
      qualification: "none",
    });
  });

  test("uses stricter re-entry thresholds than initial entry", () => {
    const belowReEntry = evaluateOfcBoard(
      board("Qc Qd 2c", "2h 5h 7h 9h Jh", "6c 6d 6h 8c 8d"),
    );
    expect(belowReEntry.fouled).toBe(false);
    expect(determineFantasyland(belowReEntry, false)).toMatchObject({
      qualifiesForNextHand: true,
      qualification: "entry",
    });
    expect(determineFantasyland(belowReEntry, true)).toMatchObject({
      qualifiesForNextHand: false,
      qualification: "none",
    });
  });

  test("allows simultaneous Fantasyland entry and reveals both at showdown", () => {
    const result = resolveOfcRound([
      {
        playerId: "queens",
        wasInFantasyland: false,
        board: board("Qc Qd 2c", "2h 3h 4h 5h 6h", "Ts Js Qs Ks As"),
      },
      {
        playerId: "kings",
        wasInFantasyland: false,
        board: board("Kc Kd 3c", "4c 5c 6c 7c 8c", "Th Jh Qh Kh Ah"),
      },
    ]);

    expect(
      result.players.map(({ fantasyland, boardVisibility }) => ({
        fantasyland,
        boardVisibility,
      })),
    ).toEqual([
      {
        fantasyland: {
          wasInFantasyland: false,
          qualifiesForNextHand: true,
          qualification: "entry",
        },
        boardVisibility: "face-up",
      },
      {
        fantasyland: {
          wasInFantasyland: false,
          qualifiesForNextHand: true,
          qualification: "entry",
        },
        boardVisibility: "face-up",
      },
    ]);
  });

  test("keeps every Fantasyland board face down until simultaneous showdown", () => {
    expect(fantasylandBoardVisibility(true, "placing")).toBe("face-down");
    expect(fantasylandBoardVisibility(false, "placing")).toBe("face-up");
    expect(fantasylandBoardVisibility(true, "showdown")).toBe("face-up");
    expect(fantasylandBoardVisibility(false, "showdown")).toBe("face-up");
  });
});
