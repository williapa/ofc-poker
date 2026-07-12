import { parseCard, type CardCode } from "./cards";
import { createStandardDeck } from "./deck";
import type {
  ActionRejection,
  EngineAction,
  EngineSnapshot,
  EngineTransition,
  GameConfiguration,
  GameEvent,
  GameId,
  JsonValue,
  PlayerId,
  PlayerVisibleState,
  PublicEngineState,
  SeatCount,
} from "./index";
import { InvalidSnapshotError, UnsupportedVersionError } from "./persistence";

export type PlacementRow = "front" | "middle" | "back";

export interface CardPlacement extends Readonly<Record<string, JsonValue>> {
  readonly card: CardCode;
  readonly row: PlacementRow;
}

export interface OfcBoard {
  readonly front: readonly CardCode[];
  readonly middle: readonly CardCode[];
  readonly back: readonly CardCode[];
}

export interface PlayerSetup {
  readonly id: PlayerId;
  readonly displayName: string;
  /** Cumulative score copied from match state; defaults to zero. */
  readonly score?: number;
}

export interface OfcHandSetup {
  readonly schemaVersion: 1;
  readonly gameId: GameId;
  readonly configuration: GameConfiguration;
  readonly players: readonly PlayerSetup[];
  readonly dealerSeat: number;
  readonly deck: readonly CardCode[];
}

export interface OfcHandPlayerState {
  readonly id: PlayerId;
  readonly seat: number;
  readonly displayName: string;
  readonly connected: boolean;
  readonly score: number;
  readonly board: OfcBoard;
  readonly pendingCards: readonly CardCode[];
}

export interface OfcHandState {
  readonly schemaVersion: 1;
  readonly gameId: GameId;
  readonly revision: number;
  readonly phase: "placing" | "complete";
  readonly configuration: GameConfiguration;
  readonly dealerSeat: number;
  readonly activePlayerId?: PlayerId;
  readonly players: readonly OfcHandPlayerState[];
  readonly deck: readonly CardCode[];
  readonly nextDeckIndex: number;
  readonly appliedActionIds: readonly string[];
  readonly appliedEventIds: readonly string[];
  readonly lastEventId?: string;
}

interface PlaceInitialPayload extends Readonly<Record<string, JsonValue>> {
  readonly placements: readonly CardPlacement[];
}

interface PlaceSinglePayload extends Readonly<Record<string, JsonValue>> {
  readonly placement: CardPlacement;
}

export type PlaceInitialCardsAction = EngineAction<PlaceInitialPayload> & {
  readonly type: "ofc.place-initial-cards";
};

export type PlaceCardAction = EngineAction<PlaceSinglePayload> & {
  readonly type: "ofc.place-card";
};

export type OfcHandAction = PlaceInitialCardsAction | PlaceCardAction;

/** Creates stable unique IDs for legal-action candidates at one revision. */
export type LegalActionIdFactory = (candidateIndex: number) => string;

interface CardsPlacedPayload extends Readonly<Record<string, JsonValue>> {
  readonly playerId: PlayerId;
  readonly stage: "initial" | "single";
  readonly placements: readonly CardPlacement[];
}

export type OfcHandEvent = GameEvent<CardsPlacedPayload> & {
  readonly type: "ofc.cards-placed";
};

export interface OfcHandSnapshot extends EngineSnapshot<
  OfcHandState & JsonValue
> {
  readonly state: OfcHandState & JsonValue;
}

export interface OfcPublicPlayerState {
  readonly id: PlayerId;
  readonly seat: number;
  readonly displayName: string;
  readonly connected: boolean;
  readonly score: number;
  readonly board: OfcBoard;
  readonly placedCardCount: number;
}

export interface OfcPublicEngineState extends PublicEngineState {
  readonly phase: "placing" | "complete";
  readonly dealerSeat: number;
  readonly players: readonly OfcPublicPlayerState[];
}

export type OfcPlayerVisibleState = OfcPublicEngineState &
  PlayerVisibleState & {
    readonly privateData: Readonly<
      Record<string, JsonValue> & { readonly pendingCards: readonly CardCode[] }
    >;
  };

export type EventRejectionCode =
  | "unsupported-event-version"
  | "malformed-event"
  | "duplicate-event"
  | "stale-revision"
  | "invalid-event";

export interface EventRejection {
  readonly code: EventRejectionCode;
  readonly message: string;
}

export type EventApplication =
  | { readonly accepted: true; readonly state: OfcHandState }
  | {
      readonly accepted: false;
      readonly state: OfcHandState;
      readonly rejection: EventRejection;
    };

const ROW_CAPACITY: Readonly<Record<PlacementRow, number>> = Object.freeze({
  front: 3,
  middle: 5,
  back: 5,
});

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

function isCardCode(value: unknown): value is CardCode {
  if (typeof value !== "string") return false;
  try {
    parseCard(value);
    return true;
  } catch {
    return false;
  }
}

function isPlacement(value: unknown): value is CardPlacement {
  return (
    isRecord(value) &&
    isCardCode(value.card) &&
    (value.row === "front" || value.row === "middle" || value.row === "back")
  );
}

function boardCards(board: OfcBoard): readonly CardCode[] {
  return [...board.front, ...board.middle, ...board.back];
}

function placedCardCount(player: OfcHandPlayerState): number {
  return boardCards(player.board).length;
}

function actionOrder(seatCount: number, dealerSeat: number): readonly number[] {
  return Array.from(
    { length: seatCount },
    (_, offset) => (dealerSeat + 1 + offset) % seatCount,
  );
}

function assertSetup(setup: OfcHandSetup): void {
  if (setup.schemaVersion !== 1)
    throw new RangeError("Unsupported hand schema");
  const count = setup.players.length;
  if (count < 2 || count > 4 || setup.configuration.seatCount !== count) {
    throw new RangeError(
      "A hand requires exactly two to four configured players",
    );
  }
  if (new Set(setup.players.map(({ id }) => id)).size !== count) {
    throw new RangeError("Player IDs must be unique");
  }
  if (
    setup.players.some(({ id, displayName }) => id === "" || displayName === "")
  ) {
    throw new RangeError("Player IDs and display names must be non-empty");
  }
  if (
    setup.players.some(
      ({ score }) =>
        score !== undefined &&
        (!Number.isFinite(score) || !Number.isInteger(score)),
    )
  ) {
    throw new RangeError("Player scores must be finite integers");
  }
  if (
    !Number.isInteger(setup.dealerSeat) ||
    setup.dealerSeat < 0 ||
    setup.dealerSeat >= count
  ) {
    throw new RangeError("Dealer seat must identify a player seat");
  }
  createStandardDeck(setup.deck.map(parseCard));
}

export function createOfcHand(setup: OfcHandSetup): OfcHandState {
  assertSetup(setup);
  const count = setup.players.length;
  const pendingBySeat: CardCode[][] = Array.from({ length: count }, () => []);
  const order = actionOrder(count, setup.dealerSeat);
  let deckIndex = 0;

  // Standard dealing order: five clockwise rounds beginning left of the dealer.
  for (let round = 0; round < 5; round += 1) {
    for (const seat of order) {
      pendingBySeat[seat]?.push(setup.deck[deckIndex] as CardCode);
      deckIndex += 1;
    }
  }

  const players = setup.players.map((player, seat): OfcHandPlayerState => ({
    ...player,
    seat,
    connected: true,
    score: player.score ?? 0,
    board: { front: [], middle: [], back: [] },
    pendingCards: pendingBySeat[seat] as readonly CardCode[],
  }));

  return deepFreeze({
    schemaVersion: 1,
    gameId: setup.gameId,
    revision: 0,
    phase: "placing",
    configuration: { ...setup.configuration },
    dealerSeat: setup.dealerSeat,
    activePlayerId: players[order[0] as number]?.id as PlayerId,
    players,
    deck: [...setup.deck],
    nextDeckIndex: deckIndex,
    appliedActionIds: [],
    appliedEventIds: [],
  });
}

function rejection(
  state: OfcHandState,
  actionId: string,
  code: ActionRejection["code"],
  message: string,
): EngineTransition<OfcHandState, OfcHandEvent> {
  return {
    accepted: false,
    state,
    events: [],
    rejection: { actionId, code, message },
  };
}

function validatePlacements(
  state: OfcHandState,
  player: OfcHandPlayerState,
  placements: readonly CardPlacement[],
  actionId: string,
): ActionRejection | undefined {
  const codes = placements.map(({ card }) => card);
  if (new Set(codes).size !== codes.length) {
    return {
      actionId,
      code: "duplicate-card",
      message: "A card may be placed only once per action",
    };
  }

  const committed = new Set(
    state.players.flatMap(({ board }) => boardCards(board)),
  );
  for (const code of codes) {
    if (committed.has(code)) {
      return {
        actionId,
        code: "card-already-committed",
        message: `Card ${code} is already committed`,
      };
    }
    if (!player.pendingCards.includes(code)) {
      return {
        actionId,
        code: "unknown-card",
        message: `Card ${code} is not dealt to the active player`,
      };
    }
  }

  for (const row of ["front", "middle", "back"] as const) {
    const added = placements.filter(
      (placement) => placement.row === row,
    ).length;
    if (player.board[row].length + added > ROW_CAPACITY[row]) {
      return {
        actionId,
        code: "row-full",
        message: `${row} row capacity is ${ROW_CAPACITY[row]}`,
      };
    }
  }
  return undefined;
}

function parseAction(action: unknown):
  | {
      readonly valid: true;
      readonly action: OfcHandAction;
      readonly placements: readonly CardPlacement[];
      readonly stage: "initial" | "single";
    }
  | { readonly valid: false; readonly actionId: string } {
  const actionId =
    isRecord(action) && typeof action.actionId === "string"
      ? action.actionId
      : "unknown-action";
  if (
    !isRecord(action) ||
    action.schemaVersion !== 1 ||
    typeof action.actionId !== "string" ||
    action.actionId === "" ||
    !Number.isInteger(action.expectedRevision) ||
    typeof action.playerId !== "string" ||
    !isRecord(action.payload)
  )
    return { valid: false, actionId };

  if (
    action.type === "ofc.place-initial-cards" &&
    Array.isArray(action.payload.placements) &&
    action.payload.placements.length === 5 &&
    action.payload.placements.every(isPlacement)
  ) {
    return {
      valid: true,
      action: action as unknown as PlaceInitialCardsAction,
      placements: action.payload.placements,
      stage: "initial",
    };
  }
  if (
    action.type === "ofc.place-card" &&
    isPlacement(action.payload.placement)
  ) {
    return {
      valid: true,
      action: action as unknown as PlaceCardAction,
      placements: [action.payload.placement],
      stage: "single",
    };
  }
  return { valid: false, actionId };
}

export function transitionOfcHand(
  state: OfcHandState,
  input: OfcHandAction | unknown,
): EngineTransition<OfcHandState, OfcHandEvent> {
  const parsed = parseAction(input);
  if (!parsed.valid)
    return rejection(
      state,
      parsed.actionId,
      "invalid-action",
      "Malformed or unsupported action",
    );
  const { action, placements, stage } = parsed;

  if (state.appliedActionIds.includes(action.actionId)) {
    return rejection(
      state,
      action.actionId,
      "duplicate-action",
      "Action was already applied",
    );
  }
  if (action.expectedRevision !== state.revision) {
    return rejection(
      state,
      action.actionId,
      "stale-revision",
      "Action revision does not match current state",
    );
  }
  if (state.phase === "complete") {
    return rejection(
      state,
      action.actionId,
      "hand-complete",
      "The hand is already complete",
    );
  }
  const player = state.players.find(({ id }) => id === action.playerId);
  if (player === undefined) {
    return rejection(
      state,
      action.actionId,
      "unauthorized-player",
      "Player is not seated in this hand",
    );
  }
  if (state.activePlayerId !== action.playerId) {
    return rejection(
      state,
      action.actionId,
      "wrong-turn",
      "It is another player's turn",
    );
  }
  const expectedStage = placedCardCount(player) === 0 ? "initial" : "single";
  if (
    stage !== expectedStage ||
    (stage === "initial"
      ? player.pendingCards.length !== 5
      : player.pendingCards.length !== 1)
  ) {
    return rejection(
      state,
      action.actionId,
      "invalid-action",
      `Expected a ${expectedStage} placement`,
    );
  }
  const placementError = validatePlacements(
    state,
    player,
    placements,
    action.actionId,
  );
  if (placementError !== undefined) {
    return { accepted: false, state, events: [], rejection: placementError };
  }

  const event: OfcHandEvent = deepFreeze({
    schemaVersion: 1,
    eventId: `${action.actionId}:cards-placed`,
    revision: state.revision + 1,
    causationId: action.actionId,
    type: "ofc.cards-placed",
    payload: { playerId: action.playerId, stage, placements: [...placements] },
  });
  const applied = applyOfcHandEvent(state, event);
  if (!applied.accepted) {
    return rejection(
      state,
      action.actionId,
      "invalid-action",
      applied.rejection.message,
    );
  }
  return { accepted: true, state: applied.state, events: [event] };
}

/**
 * Enumerates every action that the concrete OFC validator will accept for the
 * requested player at the current revision. Non-active players have no legal
 * actions. Candidate IDs are injected so callers retain control of identity.
 */
export function ofcHandLegalActions(
  state: OfcHandState,
  playerId: PlayerId,
  createActionId: LegalActionIdFactory,
): readonly OfcHandAction[] {
  if (state.phase === "complete" || state.activePlayerId !== playerId)
    return [];
  const player = state.players.find(({ id }) => id === playerId);
  if (player === undefined) return [];

  const availableRows = (board: OfcBoard): readonly PlacementRow[] =>
    (["front", "middle", "back"] as const).filter(
      (row) => board[row].length < ROW_CAPACITY[row],
    );
  const candidates: OfcHandAction[] = [];

  if (placedCardCount(player) === 0 && player.pendingCards.length === 5) {
    const placements: CardPlacement[] = [];
    const counts = {
      front: player.board.front.length,
      middle: player.board.middle.length,
      back: player.board.back.length,
    };
    const visit = (cardIndex: number): void => {
      if (cardIndex === player.pendingCards.length) {
        const candidateIndex = candidates.length;
        candidates.push({
          schemaVersion: 1,
          actionId: createActionId(candidateIndex),
          expectedRevision: state.revision,
          playerId,
          type: "ofc.place-initial-cards",
          payload: {
            placements: placements.map((placement) => ({ ...placement })),
          },
        });
        return;
      }
      const card = player.pendingCards[cardIndex];
      if (card === undefined) return;
      for (const row of ["front", "middle", "back"] as const) {
        if (counts[row] >= ROW_CAPACITY[row]) continue;
        counts[row] += 1;
        placements.push({ card, row });
        visit(cardIndex + 1);
        placements.pop();
        counts[row] -= 1;
      }
    };
    visit(0);
  } else if (player.pendingCards.length === 1) {
    const card = player.pendingCards[0];
    if (card !== undefined) {
      for (const row of availableRows(player.board)) {
        const candidateIndex = candidates.length;
        candidates.push({
          schemaVersion: 1,
          actionId: createActionId(candidateIndex),
          expectedRevision: state.revision,
          playerId,
          type: "ofc.place-card",
          payload: { placement: { card, row } },
        });
      }
    }
  }

  return deepFreeze(candidates);
}

function nextPlayerAfterPlacement(
  players: readonly OfcHandPlayerState[],
  currentSeat: number,
): OfcHandPlayerState | undefined {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const candidate = players[(currentSeat + offset) % players.length];
    if (candidate !== undefined && placedCardCount(candidate) < 13)
      return candidate;
  }
  return undefined;
}

function isOfcHandEvent(event: unknown): event is OfcHandEvent {
  return (
    isRecord(event) &&
    event.schemaVersion === 1 &&
    typeof event.eventId === "string" &&
    event.eventId !== "" &&
    Number.isInteger(event.revision) &&
    typeof event.causationId === "string" &&
    event.causationId !== "" &&
    event.type === "ofc.cards-placed" &&
    isRecord(event.payload) &&
    typeof event.payload.playerId === "string" &&
    (event.payload.stage === "initial" || event.payload.stage === "single") &&
    Array.isArray(event.payload.placements) &&
    event.payload.placements.every(isPlacement) &&
    event.payload.placements.length ===
      (event.payload.stage === "initial" ? 5 : 1)
  );
}

function rejectEvent(
  state: OfcHandState,
  code: EventRejectionCode,
  message: string,
): EventApplication {
  return { accepted: false, state, rejection: { code, message } };
}

export function applyOfcHandEvent(
  state: OfcHandState,
  input: OfcHandEvent | unknown,
): EventApplication {
  if (isRecord(input) && input.schemaVersion !== 1) {
    const error = new UnsupportedVersionError(
      "ofc-hand-event",
      input.schemaVersion,
      [1],
    );
    return rejectEvent(state, "unsupported-event-version", error.message);
  }
  if (!isOfcHandEvent(input))
    return rejectEvent(
      state,
      "malformed-event",
      "Malformed or unsupported hand event",
    );
  const event = input;
  if (
    state.appliedEventIds.includes(event.eventId) ||
    state.appliedActionIds.includes(event.causationId)
  ) {
    return rejectEvent(state, "duplicate-event", "Event was already applied");
  }
  if (event.revision !== state.revision + 1) {
    return rejectEvent(
      state,
      "stale-revision",
      "Event revision is not the next state revision",
    );
  }
  if (
    state.phase === "complete" ||
    state.activePlayerId !== event.payload.playerId
  ) {
    return rejectEvent(
      state,
      "invalid-event",
      "Event does not match the active hand state",
    );
  }
  const player = state.players.find(({ id }) => id === event.payload.playerId);
  if (player === undefined)
    return rejectEvent(state, "invalid-event", "Event player is not seated");
  const expectedStage = placedCardCount(player) === 0 ? "initial" : "single";
  if (
    event.payload.stage !== expectedStage ||
    player.pendingCards.length !== event.payload.placements.length
  ) {
    return rejectEvent(
      state,
      "invalid-event",
      "Event placement stage is invalid",
    );
  }
  const placementError = validatePlacements(
    state,
    player,
    event.payload.placements,
    event.causationId,
  );
  if (placementError !== undefined)
    return rejectEvent(state, "invalid-event", placementError.message);

  const placedCodes = new Set(event.payload.placements.map(({ card }) => card));
  let players = state.players.map((existing): OfcHandPlayerState => {
    if (existing.id !== player.id) return existing;
    const additions = (row: PlacementRow) =>
      event.payload.placements
        .filter((p) => p.row === row)
        .map(({ card }) => card);
    return {
      ...existing,
      board: {
        front: [...existing.board.front, ...additions("front")],
        middle: [...existing.board.middle, ...additions("middle")],
        back: [...existing.board.back, ...additions("back")],
      },
      pendingCards: existing.pendingCards.filter(
        (card) => !placedCodes.has(card),
      ),
    };
  });

  const updatedPlayer = players[player.seat] as OfcHandPlayerState;
  const next = nextPlayerAfterPlacement(players, updatedPlayer.seat);
  const phase = next === undefined ? "complete" : "placing";
  let nextDeckIndex = state.nextDeckIndex;

  // During initial placement the other players already hold five cards. Once all
  // initial groups are committed, and after each single placement, deal exactly
  // one card to the next player when their action begins.
  if (next !== undefined && next.pendingCards.length === 0) {
    const card = state.deck[nextDeckIndex];
    if (card === undefined)
      return rejectEvent(
        state,
        "invalid-event",
        "Deck exhausted before hand completion",
      );
    players = players.map((existing) =>
      existing.id === next.id
        ? { ...existing, pendingCards: [card] }
        : existing,
    );
    nextDeckIndex += 1;
  }

  const nextState: OfcHandState = {
    schemaVersion: state.schemaVersion,
    gameId: state.gameId,
    revision: event.revision,
    phase,
    configuration: state.configuration,
    dealerSeat: state.dealerSeat,
    players,
    deck: state.deck,
    nextDeckIndex,
    appliedActionIds: [...state.appliedActionIds, event.causationId],
    appliedEventIds: [...state.appliedEventIds, event.eventId],
    lastEventId: event.eventId,
    ...(next === undefined ? {} : { activePlayerId: next.id }),
  };
  return { accepted: true, state: deepFreeze(nextState) };
}

export function ofcHandPublicState(state: OfcHandState): OfcPublicEngineState {
  return deepFreeze({
    schemaVersion: 1,
    gameId: state.gameId,
    revision: state.revision,
    phase: state.phase,
    configuration: state.configuration,
    dealerSeat: state.dealerSeat,
    ...(state.activePlayerId === undefined
      ? {}
      : { activePlayerId: state.activePlayerId }),
    players: state.players.map((player) => ({
      id: player.id,
      seat: player.seat,
      displayName: player.displayName,
      connected: player.connected,
      score: player.score,
      board: player.board,
      placedCardCount: boardCards(player.board).length,
    })),
  });
}

export function ofcHandPlayerView(
  state: OfcHandState,
  playerId: PlayerId,
): OfcPlayerVisibleState {
  const player = state.players.find(({ id }) => id === playerId);
  if (player === undefined)
    throw new RangeError("Player is not seated in this hand");
  return deepFreeze({
    ...ofcHandPublicState(state),
    viewerId: playerId,
    privateData: { pendingCards: [...player.pendingCards] },
  });
}

export function createOfcHandSnapshot(state: OfcHandState): OfcHandSnapshot {
  return deepFreeze({
    schemaVersion: 1,
    gameId: state.gameId,
    revision: state.revision,
    state: state as OfcHandState & JsonValue,
    ...(state.lastEventId === undefined
      ? {}
      : { lastEventId: state.lastEventId }),
  });
}

export function restoreOfcHandSnapshot(snapshot: unknown): OfcHandState {
  if (!isRecord(snapshot) || snapshot.schemaVersion !== 1) {
    throw new UnsupportedVersionError(
      "ofc-hand-snapshot",
      isRecord(snapshot) ? snapshot.schemaVersion : undefined,
      [1],
    );
  }
  const state = snapshot.state;
  if (
    !isRecord(state) ||
    state.schemaVersion !== 1 ||
    snapshot.gameId !== state.gameId ||
    snapshot.revision !== state.revision
  ) {
    throw new InvalidSnapshotError(
      "ofc-hand-snapshot",
      "metadata does not match the embedded state",
    );
  }
  return deepFreeze(structuredClone(state) as unknown as OfcHandState);
}

export function nextDealerSeat(
  dealerSeat: number,
  seatCount: SeatCount,
): number {
  if (
    !Number.isInteger(dealerSeat) ||
    dealerSeat < 0 ||
    dealerSeat >= seatCount
  ) {
    throw new RangeError("Dealer seat must identify a player seat");
  }
  return (dealerSeat + 1) % seatCount;
}
