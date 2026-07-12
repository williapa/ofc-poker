import { describe, expect, test } from "vitest";
import {
  applyOfcHandEvent,
  createOfcHand,
  resolveOfcRound,
  serializeCard,
  shuffleDeck,
  transitionOfcHand,
  type CardPlacement,
  type GameConfiguration,
  type OfcHandAction,
  type OfcHandEvent,
  type OfcHandState,
  type PlacementRow,
  type SeatCount,
} from "../src/index";

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function configuration(seatCount: SeatCount): GameConfiguration {
  return {
    schemaVersion: 1,
    ruleset: "standard-ofc",
    seatCount,
    fantasyland: true,
    tiedRowPoints: 0,
  };
}

function randomPlacements(
  state: OfcHandState,
  random: () => number,
): readonly CardPlacement[] {
  const player = state.players.find(({ id }) => id === state.activePlayerId);
  if (player === undefined) throw new Error("Active player is not seated");
  const openRows: PlacementRow[] = [
    ...Array<PlacementRow>(3 - player.board.front.length).fill("front"),
    ...Array<PlacementRow>(5 - player.board.middle.length).fill("middle"),
    ...Array<PlacementRow>(5 - player.board.back.length).fill("back"),
  ];
  for (let index = openRows.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [openRows[index], openRows[swap]] = [openRows[swap]!, openRows[index]!];
  }
  return player.pendingCards.map((card, index) => ({
    card,
    row: openRows[index]!,
  }));
}

function actionFor(
  state: OfcHandState,
  placements: readonly CardPlacement[],
  actionId: string,
): OfcHandAction {
  const common = {
    schemaVersion: 1 as const,
    actionId,
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

describe("generated engine invariants", () => {
  test("preserves deck, capacity, replay, resolution, and zero-sum invariants across seeded hands", () => {
    for (let seed = 1; seed <= 72; seed += 1) {
      const seatCount = (2 + (seed % 3)) as SeatCount;
      const random = seededRandom(seed);
      const deck = shuffleDeck(random).map(serializeCard);
      const initial = createOfcHand({
        schemaVersion: 1,
        gameId: `generated-${seed}`,
        configuration: configuration(seatCount),
        players: Array.from({ length: seatCount }, (_, seat) => ({
          id: `player-${seat}`,
          displayName: `Player ${seat}`,
        })),
        dealerSeat: seed % seatCount,
        deck,
      });
      let state = initial;
      const events: OfcHandEvent[] = [];

      while (state.phase !== "complete") {
        const placements = randomPlacements(state, random);
        const result = transitionOfcHand(
          state,
          actionFor(state, placements, `seed-${seed}-${state.revision + 1}`),
        );
        if (!result.accepted) throw new Error(result.rejection.message);
        events.push(...result.events);
        state = result.state;
      }

      const placed = state.players.flatMap(({ board }) => [
        ...board.front,
        ...board.middle,
        ...board.back,
      ]);
      expect(new Set(placed).size).toBe(placed.length);
      expect(new Set(placed)).toEqual(new Set(deck.slice(0, seatCount * 13)));
      for (const player of state.players) {
        expect([
          player.board.front.length,
          player.board.middle.length,
          player.board.back.length,
        ]).toEqual([3, 5, 5]);
      }

      let replayed = initial;
      for (const event of events) {
        const application = applyOfcHandEvent(
          replayed,
          JSON.parse(JSON.stringify(event)),
        );
        if (!application.accepted) {
          throw new Error(application.rejection.message);
        }
        replayed = application.state;
      }
      expect(replayed).toEqual(state);

      const inputs = state.players.map((player) => ({
        playerId: player.id,
        board: player.board,
        wasInFantasyland: seed % 2 === player.seat % 2,
      }));
      const resolution = resolveOfcRound(inputs);
      const replayedResolution = resolveOfcRound(
        replayed.players.map((player) => ({
          playerId: player.id,
          board: player.board,
          wasInFantasyland: seed % 2 === player.seat % 2,
        })),
      );
      expect(replayedResolution).toEqual(resolution);
      expect(
        Object.values(resolution.totalDeltas).reduce(
          (sum, delta) => sum + delta,
          0,
        ),
      ).toBe(0);
    }
  });
});
