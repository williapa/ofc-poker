import type { CardCode } from "./cards";
import {
  createOfcHand,
  nextDealerSeat,
  type OfcHandState,
  type PlayerSetup,
} from "./hand-lifecycle";
import type { GameConfiguration, GameId, JsonValue, PlayerId } from "./index";
import { InvalidSnapshotError, UnsupportedVersionError } from "./persistence";
import { resolveOfcRound, type OfcRoundResult } from "./scoring";

export interface OfcMatchSetup {
  readonly schemaVersion: 1;
  readonly gameId: GameId;
  readonly configuration: GameConfiguration;
  readonly players: readonly PlayerSetup[];
  readonly initialDealerSeat: number;
}

export interface OfcMatchPlayerState {
  readonly id: PlayerId;
  readonly seat: number;
  readonly displayName: string;
  readonly cumulativeScore: number;
  readonly inFantasyland: boolean;
}

export interface OfcCompletedHand {
  readonly handNumber: number;
  readonly dealerSeat: number;
  readonly result: OfcRoundResult;
}

/** Immutable state carried between hands in one fixed-rules lobby. */
export interface OfcMatchState {
  readonly schemaVersion: 1;
  readonly gameId: GameId;
  readonly configuration: GameConfiguration;
  /** One-based number of the hand that should be created next. */
  readonly nextHandNumber: number;
  readonly dealerSeat: number;
  readonly players: readonly OfcMatchPlayerState[];
  readonly completedHands: readonly OfcCompletedHand[];
}

export interface OfcMatchCompletion {
  readonly state: OfcMatchState;
  readonly completedHand: OfcCompletedHand;
}

export interface OfcMatchSnapshot {
  readonly schemaVersion: 1;
  readonly gameId: GameId;
  readonly completedHandCount: number;
  readonly state: OfcMatchState & JsonValue;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertMatchSetup(setup: OfcMatchSetup): void {
  if (setup.schemaVersion !== 1) {
    throw new RangeError("Unsupported OFC match setup schema version");
  }
  const count = setup.players.length;
  if (count < 2 || count > 4 || setup.configuration.seatCount !== count) {
    throw new RangeError(
      "A match requires exactly two to four configured players",
    );
  }
  if (new Set(setup.players.map(({ id }) => id)).size !== count) {
    throw new RangeError("Match player IDs must be unique");
  }
  if (
    setup.players.some(({ id, displayName }) => id === "" || displayName === "")
  ) {
    throw new RangeError("Player IDs and display names must be non-empty");
  }
  if (
    !Number.isInteger(setup.initialDealerSeat) ||
    setup.initialDealerSeat < 0 ||
    setup.initialDealerSeat >= count
  ) {
    throw new RangeError("Dealer seat must identify a player seat");
  }
}

/** Creates an empty multi-hand match using the table-selected first dealer. */
export function createOfcMatch(setup: OfcMatchSetup): OfcMatchState {
  assertMatchSetup(setup);
  return deepFreeze({
    schemaVersion: 1,
    gameId: setup.gameId,
    configuration: { ...setup.configuration },
    nextHandNumber: 1,
    dealerSeat: setup.initialDealerSeat,
    players: setup.players.map((player, seat) => ({
      id: player.id,
      seat,
      displayName: player.displayName,
      cumulativeScore: 0,
      inFantasyland: false,
    })),
    completedHands: [],
  });
}

/** Creates the next deterministic hand from match seating and cumulative scores. */
export function createOfcMatchHand(
  state: OfcMatchState,
  deck: readonly CardCode[],
): OfcHandState {
  return createOfcHand({
    schemaVersion: 1,
    gameId: state.gameId,
    configuration: state.configuration,
    dealerSeat: state.dealerSeat,
    players: state.players.map(({ id, displayName, cumulativeScore }) => ({
      id,
      displayName,
      score: cumulativeScore,
    })),
    deck,
  });
}

/**
 * Resolves a completed hand, adds its zero-sum deltas to cumulative scores,
 * carries Fantasyland qualification forward, and rotates the dealer clockwise.
 */
export function completeOfcMatchHand(
  state: OfcMatchState,
  hand: OfcHandState,
): OfcMatchCompletion {
  if (hand.phase !== "complete") {
    throw new RangeError("Only a completed OFC hand can advance a match");
  }
  if (
    hand.gameId !== state.gameId ||
    hand.configuration.ruleset !== state.configuration.ruleset ||
    hand.configuration.seatCount !== state.configuration.seatCount ||
    hand.dealerSeat !== state.dealerSeat
  ) {
    throw new RangeError("Completed hand does not belong to the current match");
  }
  if (
    hand.players.some(
      (player, seat) =>
        player.id !== state.players[seat]?.id || player.seat !== seat,
    )
  ) {
    throw new RangeError("Completed hand seating does not match the match");
  }

  const result = resolveOfcRound(
    hand.players.map((player) => ({
      playerId: player.id,
      board: player.board,
      wasInFantasyland: state.players[player.seat]?.inFantasyland ?? false,
    })),
  );
  const completedHand: OfcCompletedHand = {
    handNumber: state.nextHandNumber,
    dealerSeat: state.dealerSeat,
    result,
  };
  const nextState: OfcMatchState = {
    ...state,
    nextHandNumber: state.nextHandNumber + 1,
    dealerSeat: nextDealerSeat(state.dealerSeat, state.configuration.seatCount),
    players: state.players.map((player) => {
      const roundPlayer = result.players[player.seat];
      if (roundPlayer === undefined || roundPlayer.playerId !== player.id) {
        throw new Error("Round result order does not match match seating");
      }
      return {
        ...player,
        cumulativeScore: player.cumulativeScore + roundPlayer.totalDelta,
        inFantasyland: roundPlayer.fantasyland.qualifiesForNextHand,
      };
    }),
    completedHands: [...state.completedHands, completedHand],
  };
  return deepFreeze({ state: nextState, completedHand });
}

export function createOfcMatchSnapshot(state: OfcMatchState): OfcMatchSnapshot {
  return deepFreeze({
    schemaVersion: 1,
    gameId: state.gameId,
    completedHandCount: state.completedHands.length,
    state: state as OfcMatchState & JsonValue,
  });
}

/** Restores the current schema or reports that an explicit migration is needed. */
export function restoreOfcMatchSnapshot(snapshot: unknown): OfcMatchState {
  if (!isRecord(snapshot) || snapshot.schemaVersion !== 1) {
    throw new UnsupportedVersionError(
      "ofc-match-snapshot",
      isRecord(snapshot) ? snapshot.schemaVersion : undefined,
      [1],
    );
  }
  const state = snapshot.state;
  if (
    !isRecord(state) ||
    state.schemaVersion !== 1 ||
    snapshot.gameId !== state.gameId ||
    !Array.isArray(state.completedHands) ||
    snapshot.completedHandCount !== state.completedHands.length
  ) {
    throw new InvalidSnapshotError(
      "ofc-match-snapshot",
      "metadata does not match the embedded state",
    );
  }
  return deepFreeze(structuredClone(state) as unknown as OfcMatchState);
}
