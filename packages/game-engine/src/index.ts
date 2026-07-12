export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type PlayerId = string;
export type GameId = string;
export type ActionId = string;
export type EventId = string;

export type SeatCount = 2 | 3 | 4;

/** Rules copied from lobby settings when the lobby is created; never mutated in place. */
export interface GameConfiguration {
  readonly schemaVersion: 1;
  readonly ruleset: "standard-ofc";
  readonly seatCount: SeatCount;
  readonly fantasyland: true;
  readonly tiedRowPoints: 0;
}

export type GamePhase = "waiting" | "placing" | "showdown" | "complete";

export interface PublicPlayerState {
  readonly id: PlayerId;
  readonly seat: number;
  readonly displayName: string;
  readonly connected: boolean;
  readonly score: number;
}

/** State safe to expose to every participant. Private cards are deliberately absent. */
export interface PublicEngineState {
  readonly schemaVersion: 1;
  readonly gameId: GameId;
  readonly revision: number;
  readonly phase: GamePhase;
  readonly configuration: GameConfiguration;
  readonly players: readonly PublicPlayerState[];
  readonly activePlayerId?: PlayerId;
}

/** A per-player projection. Only this projection, never authoritative state, is sent to AI/view code. */
export interface PlayerVisibleState extends PublicEngineState {
  readonly viewerId: PlayerId;
  readonly privateData: JsonValue;
}

export interface EngineAction<TPayload extends JsonValue = JsonValue> {
  readonly schemaVersion: 1;
  readonly actionId: ActionId;
  readonly expectedRevision: number;
  readonly playerId: PlayerId;
  readonly type: string;
  readonly payload: TPayload;
}

export interface GameEvent<TPayload extends JsonValue = JsonValue> {
  readonly schemaVersion: 1;
  readonly eventId: EventId;
  readonly revision: number;
  readonly causationId: ActionId;
  readonly type: string;
  readonly payload: TPayload;
}

export interface EngineSnapshot<TState extends JsonValue = JsonValue> {
  readonly schemaVersion: 1;
  readonly gameId: GameId;
  readonly revision: number;
  readonly state: TState;
  readonly lastEventId?: EventId;
}

export type ActionRejectionCode =
  | "duplicate-action"
  | "invalid-action"
  | "hand-complete"
  | "unknown-card"
  | "duplicate-card"
  | "card-already-committed"
  | "row-full"
  | "stale-revision"
  | "unauthorized-player"
  | "wrong-turn";

export interface ActionRejection {
  readonly actionId: ActionId;
  readonly code: ActionRejectionCode;
  readonly message: string;
}

export type EngineTransition<TState, TEvent extends GameEvent> =
  | {
      readonly accepted: true;
      readonly state: TState;
      readonly events: readonly TEvent[];
    }
  | {
      readonly accepted: false;
      readonly state: TState;
      readonly events: readonly [];
      readonly rejection: ActionRejection;
    };

/**
 * Pure engine port. Implementations must not read clocks, randomness, browser state, or networks.
 * All nondeterministic choices (for example deck order and IDs) arrive in configuration/actions.
 */
export interface DeterministicGameEngine<
  TState,
  TAction extends EngineAction,
  TEvent extends GameEvent,
  TSnapshot extends EngineSnapshot,
> {
  create(configuration: GameConfiguration, gameId: GameId): TState;
  transition(state: TState, action: TAction): EngineTransition<TState, TEvent>;
  snapshot(state: TState): TSnapshot;
  restore(snapshot: TSnapshot): TState;
  publicState(state: TState): PublicEngineState;
  playerView(state: TState, playerId: PlayerId): PlayerVisibleState;
  legalActions(state: TState, playerId: PlayerId): readonly TAction[];
}

export {
  RANKS,
  SUITS,
  createCard,
  parseCard,
  rankValue,
  serializeCard,
  type Card,
  type CardCode,
  type Rank,
  type Suit,
} from "./cards";
export { createStandardDeck, shuffleDeck, type RandomSource } from "./deck";
export {
  InvalidSnapshotError,
  UnsupportedVersionError,
  type VersionedArtifact,
} from "./persistence";
export {
  compareHandEvaluations,
  evaluateFiveCardHand,
  evaluateThreeCardHand,
  type ComparisonResult,
  type FiveCardEvaluation,
  type FiveCardHandClass,
  type HandEvaluation,
  type ThreeCardEvaluation,
  type ThreeCardHandClass,
} from "./poker";
export {
  applyOfcHandEvent,
  createOfcHand,
  createOfcHandSnapshot,
  nextDealerSeat,
  ofcHandPlayerView,
  ofcHandLegalActions,
  ofcHandPublicState,
  restoreOfcHandSnapshot,
  transitionOfcHand,
  type CardPlacement,
  type EventApplication,
  type EventRejection,
  type EventRejectionCode,
  type OfcBoard,
  type OfcHandAction,
  type OfcHandEvent,
  type OfcHandPlayerState,
  type OfcHandSetup,
  type OfcHandSnapshot,
  type OfcHandState,
  type LegalActionIdFactory,
  type OfcPlayerVisibleState,
  type OfcPublicEngineState,
  type PlaceCardAction,
  type PlaceInitialCardsAction,
  type PlacementRow,
  type PlayerSetup,
} from "./hand-lifecycle";
export {
  completeOfcMatchHand,
  createOfcMatch,
  createOfcMatchHand,
  createOfcMatchSnapshot,
  restoreOfcMatchSnapshot,
  type OfcCompletedHand,
  type OfcMatchCompletion,
  type OfcMatchPlayerState,
  type OfcMatchSetup,
  type OfcMatchSnapshot,
  type OfcMatchState,
} from "./match";
export {
  determineFantasyland,
  evaluateOfcBoard,
  fantasylandBoardVisibility,
  resolveOfcRound,
  scoreOfcPair,
  type FantasylandBoardVisibility,
  type FantasylandQualification,
  type FantasylandResult,
  type OfcBoardEvaluation,
  type OfcPairScore,
  type OfcRoundPlayerInput,
  type OfcRoundPlayerResult,
  type OfcRoundResult,
  type OfcRoyalties,
  type OfcRowEvaluations,
  type PairRowResults,
  type PairScoringKind,
} from "./scoring";
