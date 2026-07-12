import { describe, expect, test } from "vitest";
import {
  createOfcHand,
  createStandardDeck,
  evaluateOfcBoard,
  ofcHandLegalActions,
  ofcHandPlayerView,
  resolveOfcRound,
  serializeCard,
  shuffleDeck,
  transitionOfcHand,
  type CardCode,
  type GameConfiguration,
  type OfcBoard,
  type OfcHandAction,
  type OfcHandState,
  type OfcPlayerVisibleState,
  type SeatCount,
} from "@ofcpoker/game-engine";
import {
  AI_PRESETS,
  arrangeFantasyland,
  createAiConfiguration,
  createAiPlayer,
  createSeededRandom,
  scoreOfcAction,
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

function createHand(seatCount: SeatCount, seed: number): OfcHandState {
  return createOfcHand({
    schemaVersion: 1,
    gameId: `simulation-${seatCount}-${seed}`,
    configuration: configuration(seatCount),
    players: Array.from({ length: seatCount }, (_, seat) => ({
      id: `player-${seat}`,
      displayName: `Player ${seat}`,
    })),
    dealerSeat: seatCount - 1,
    deck: shuffleDeck(createSeededRandom(seed), createStandardDeck()).map(
      serializeCard,
    ),
  });
}

function visibleState(
  board: OfcBoard,
  pendingCards: readonly CardCode[],
): OfcPlayerVisibleState {
  const state = {
    schemaVersion: 1,
    gameId: "scenario",
    revision: 20,
    phase: "placing",
    configuration: configuration(2),
    dealerSeat: 1,
    activePlayerId: "ai",
    players: [
      {
        id: "ai",
        seat: 0,
        displayName: "AI",
        connected: true,
        score: 0,
        board,
        placedCardCount: 13 - pendingCards.length,
      },
      {
        id: "opponent",
        seat: 1,
        displayName: "Opponent",
        connected: true,
        score: 0,
        board: { front: [], middle: [], back: [] },
        placedCardCount: 0,
      },
    ],
    viewerId: "ai",
    privateData: { pendingCards },
  };
  return state as unknown as OfcPlayerVisibleState;
}

function singleAction(
  card: CardCode,
  row: "front" | "middle" | "back",
  id = row,
): OfcHandAction {
  return {
    schemaVersion: 1,
    actionId: id,
    expectedRevision: 20,
    playerId: "ai",
    type: "ofc.place-card",
    payload: { placement: { card, row } },
  };
}

describe("configuration and deterministic dependencies", () => {
  test("provides named, validated presets and an optional injected delay", async () => {
    expect(AI_PRESETS.easy.strategy).toBe("baseline");
    expect(AI_PRESETS.hard.strategy).toBe("heuristic");
    expect(() => createAiConfiguration("hard", { foulAvoidance: 1.1 })).toThrow(
      "between 0 and 1",
    );

    const delays: number[] = [];
    const ai = createAiPlayer({
      id: "delayed",
      dependencies: {
        random: () => 0,
        delay: (milliseconds) => {
          delays.push(milliseconds);
          return Promise.resolve();
        },
      },
    });
    const state = createHand(2, 1);
    const playerId = state.activePlayerId!;
    await ai.decide({
      playerId,
      state: ofcHandPlayerView(state, playerId),
      legalActions: ofcHandLegalActions(
        state,
        playerId,
        (index) => `a-${index}`,
      ),
      configuration: createAiConfiguration("easy", { thinkDelayMs: 25 }),
    });
    expect(delays).toEqual([25]);
  });

  test("produces identical decisions from identical seeds", async () => {
    const state = createHand(2, 42);
    const playerId = state.activePlayerId!;
    const legalActions = ofcHandLegalActions(
      state,
      playerId,
      (index) => `candidate-${index}`,
    );
    const decide = async () =>
      createAiPlayer({
        id: "seeded",
        dependencies: { random: createSeededRandom(9876) },
      }).decide({
        playerId,
        state: ofcHandPlayerView(state, playerId),
        legalActions,
        configuration: createAiConfiguration("hard"),
      });

    expect(await decide()).toEqual(await decide());
  });
});

describe("baseline and heuristic placement", () => {
  test("baseline completes arbitrary valid hands and respects row-capacity pressure", async () => {
    let state = createHand(2, 99);
    const players = new Map(
      state.players.map(({ id }, seat) => [
        id,
        createAiPlayer({
          id,
          dependencies: { random: createSeededRandom(100 + seat) },
        }),
      ]),
    );
    while (state.phase !== "complete") {
      const playerId = state.activePlayerId!;
      const legalActions = ofcHandLegalActions(
        state,
        playerId,
        (index) => `${state.revision}-${playerId}-${index}`,
      );
      const decision = await players.get(playerId)!.decide({
        playerId,
        state: ofcHandPlayerView(state, playerId),
        legalActions,
        configuration: createAiConfiguration("easy"),
      });
      expect(legalActions).toContain(decision.action);
      const transition = transitionOfcHand(state, decision.action);
      expect(transition.accepted).toBe(true);
      if (!transition.accepted) throw new Error(transition.rejection.message);
      state = transition.state;
    }
    for (const player of state.players) {
      expect(player.board.front).toHaveLength(3);
      expect(player.board.middle).toHaveLength(5);
      expect(player.board.back).toHaveLength(5);
    }
  });

  test("heuristic evaluates initial-five actions instead of choosing uniformly", async () => {
    const state = createHand(2, 7);
    const playerId = state.activePlayerId!;
    const legalActions = ofcHandLegalActions(
      state,
      playerId,
      (index) => `initial-${index}`,
    );
    const config = createAiConfiguration("hard");
    const view = ofcHandPlayerView(state, playerId);
    const decision = await createAiPlayer({
      id: "heuristic",
      dependencies: { random: () => 0 },
    }).decide({ playerId, state: view, legalActions, configuration: config });
    const scores = legalActions.map((action) =>
      scoreOfcAction(view, action, config),
    );

    expect(scoreOfcAction(view, decision.action, config)).toBe(
      Math.max(...scores),
    );
    expect(new Set(scores).size).toBeGreaterThan(1);
  });

  test("single-card heuristic catches up a made front pair in a near-foul board", async () => {
    const board: OfcBoard = {
      front: ["Qh", "Qs", "2c"],
      middle: ["Qc", "5d", "7s", "9h"],
      back: ["Ah", "Ad", "Kc", "Kd", "3s"],
    };
    const state = visibleState(board, ["Qd"]);
    const legalActions = [
      singleAction("Qd", "middle"),
      singleAction("Qd", "back"),
    ];
    const decision = await createAiPlayer({
      id: "foul-aware",
      dependencies: { random: () => 0 },
    }).decide({
      playerId: "ai",
      state,
      legalActions,
      configuration: createAiConfiguration("hard"),
    });

    expect(decision.action).toBe(legalActions[0]);
  });

  test("arranges a seeded Fantasyland deal into the best legal scoring board", () => {
    const cards = [
      "Qh",
      "Qs",
      "2c",
      "Ah",
      "Kh",
      "Jh",
      "Th",
      "9h",
      "Ac",
      "Ad",
      "Kc",
      "Kd",
      "2d",
    ] as const;
    const arrange = () =>
      arrangeFantasyland(
        cards,
        createAiConfiguration("hard"),
        createSeededRandom(123),
      );
    const first = arrange();

    expect(first).toEqual(arrange());
    expect(evaluateOfcBoard(first).fouled).toBe(false);
    expect(evaluateOfcBoard(first).royalties.total).toBeGreaterThan(0);
  });
});

describe("mixed-AI simulation", () => {
  test.each([2, 3, 4] as const)(
    "completes seeded %i-player games without invalid actions",
    async (seatCount) => {
      const foulDiagnostics: number[] = [];
      for (let game = 0; game < 8; game += 1) {
        let state = createHand(seatCount, seatCount * 1_000 + game);
        const ais = new Map(
          state.players.map(({ id }, seat) => [
            id,
            createAiPlayer({
              id,
              dependencies: {
                random: createSeededRandom(game * 100 + seat + 1),
              },
            }),
          ]),
        );
        let actionCount = 0;
        while (state.phase !== "complete") {
          expect(actionCount).toBeLessThan(seatCount * 14);
          const playerId = state.activePlayerId!;
          const legalActions = ofcHandLegalActions(
            state,
            playerId,
            (index) => `g${game}-r${state.revision}-c${index}`,
          );
          const decision = await ais.get(playerId)!.decide({
            playerId,
            state: ofcHandPlayerView(state, playerId),
            legalActions,
            configuration: createAiConfiguration(
              Number(playerId.at(-1)) % 2 === 0 ? "hard" : "easy",
            ),
          });
          const transition = transitionOfcHand(state, decision.action);
          expect(transition.accepted).toBe(true);
          if (!transition.accepted)
            throw new Error(transition.rejection.message);
          state = transition.state;
          actionCount += 1;
        }
        expect(actionCount).toBe(seatCount * 9);
        const round = resolveOfcRound(
          state.players.map((player) => ({
            playerId: player.id,
            board: player.board,
            wasInFantasyland: false,
          })),
        );
        foulDiagnostics.push(
          round.players.filter(({ evaluation }) => evaluation.fouled).length /
            seatCount,
        );
      }

      // Diagnostic only: it intentionally has no strategy-quality threshold.
      expect(foulDiagnostics).toHaveLength(8);
      expect(foulDiagnostics.every((rate) => rate >= 0 && rate <= 1)).toBe(
        true,
      );
      const meanFoulRate =
        foulDiagnostics.reduce((total, rate) => total + rate, 0) /
        foulDiagnostics.length;
      console.info(
        `AI simulation diagnostic (${seatCount} players): mean foul rate ${meanFoulRate.toFixed(3)}`,
      );
    },
  );
});
