import type { AiPlayer } from "@ofcpoker/ai-player";
import type {
  ActionRequest,
  LobbyMetadata,
  ProviderMessage,
} from "@ofcpoker/data-provider";
import { DataProviderError } from "@ofcpoker/data-provider";
import {
  completeOfcMatchHand,
  createOfcMatch,
  createOfcMatchHand,
  ofcHandLegalActions,
  ofcHandPlayerView,
  restoreOfcHandSnapshot,
  restoreOfcMatchSnapshot,
  transitionOfcHand,
  type GameConfiguration,
  type OfcHandAction,
  type OfcHandEvent,
  type OfcHandState,
  type OfcMatchState,
  type OfcPlayerVisibleState,
} from "@ofcpoker/game-engine";
import type {
  GameRunner,
  GameRunnerDependencies,
  GameRunnerLifecycle,
  OfcRunnerSnapshot,
  RunnerAiSeat,
} from "./contracts/game-runner";
import type { GameViewModel, GameViewPlayer } from "./contracts/game-view";

interface RunnerState {
  readonly authorityRevision: number;
  readonly match: OfcMatchState;
  readonly hand: OfcHandState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function configurationFrom(lobby: LobbyMetadata): GameConfiguration {
  const rules = lobby.settings.rules;
  if (
    !isRecord(rules) ||
    rules.variant !== "standard-ofc" ||
    rules.fantasyland !== true ||
    rules.tiedRowPoints !== 0
  ) {
    throw new RangeError("Lobby rules are not supported by this runner");
  }
  return {
    schemaVersion: 1,
    ruleset: "standard-ofc",
    seatCount: lobby.settings.seatCount,
    fantasyland: true,
    tiedRowPoints: 0,
  };
}

function snapshotOf(state: RunnerState): OfcRunnerSnapshot {
  return {
    schemaVersion: 1,
    gameId: state.match.gameId,
    revision: state.authorityRevision,
    state: {
      authorityRevision: state.authorityRevision,
      match: state.match,
      hand: state.hand,
    },
    ...(state.hand.lastEventId ? { lastEventId: state.hand.lastEventId } : {}),
  } as OfcRunnerSnapshot;
}

function restoreRunnerSnapshot(snapshot: OfcRunnerSnapshot): RunnerState {
  if (
    snapshot.schemaVersion !== 1 ||
    snapshot.revision !== snapshot.state.authorityRevision ||
    snapshot.gameId !== snapshot.state.match.gameId ||
    snapshot.gameId !== snapshot.state.hand.gameId
  ) {
    throw new RangeError("Authoritative runner snapshot metadata is invalid");
  }
  const match = restoreOfcMatchSnapshot({
    schemaVersion: 1,
    gameId: snapshot.gameId,
    completedHandCount: snapshot.state.match.completedHands.length,
    state: snapshot.state.match,
  });
  const hand = restoreOfcHandSnapshot({
    schemaVersion: 1,
    gameId: snapshot.gameId,
    revision: snapshot.state.hand.revision,
    state: snapshot.state.hand,
    ...(snapshot.state.hand.lastEventId
      ? { lastEventId: snapshot.state.hand.lastEventId }
      : {}),
  });
  return { authorityRevision: snapshot.revision, match, hand };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The game runner failed";
}

function freezeModel(model: GameViewModel): Readonly<GameViewModel> {
  for (const player of model.players) Object.freeze(player);
  Object.freeze(model.players);
  Object.freeze(model.legalActions);
  return Object.freeze(model);
}

class OfcGameRunner implements GameRunner {
  readonly #dependencies: GameRunnerDependencies;
  readonly #aiById: ReadonlyMap<string, RunnerAiSeat>;
  #lobby: LobbyMetadata;
  #state: RunnerState | undefined;
  #unsubscribeProvider: (() => void) | undefined;
  #unsubscribeView: (() => void) | undefined;
  #connectionState: GameViewModel["connection"] = "connecting";
  #error: string | undefined;
  #started = false;
  #disposed = false;
  #sequence = 0;
  #queue: Promise<void> = Promise.resolve();
  #aiGeneration = 0;
  #aiInFlight: string | undefined;
  readonly #seenUpdateIds = new Set<string>();

  public constructor(dependencies: GameRunnerDependencies) {
    this.#dependencies = dependencies;
    this.#lobby = dependencies.connection.lobby;
    const aiSeats = dependencies.aiSeats ?? [];
    if (
      new Set(aiSeats.map(({ player }) => player.id)).size !== aiSeats.length
    ) {
      throw new RangeError("AI player IDs must be unique");
    }
    this.#aiById = new Map(aiSeats.map((seat) => [seat.player.id, seat]));
  }

  #nextId(kind: "action" | "update"): string {
    this.#sequence += 1;
    return (
      this.#dependencies.idFactory?.(kind, this.#sequence) ??
      `${this.#lobby.id}:${this.#dependencies.connection.participant.id}:${kind}:${this.#sequence}`
    );
  }

  public async start(): Promise<void> {
    if (this.#disposed) throw new Error("Cannot start a disposed game runner");
    if (this.#started) return;
    this.#started = true;
    this.#unsubscribeView = this.#dependencies.view.onAction((action) => {
      void this.#submitHumanAction(action);
    });
    this.#unsubscribeProvider = this.#dependencies.connection.subscribe(
      (message) => {
        this.#queue = this.#queue
          .then(() => this.#handleMessage(message))
          .catch((error: unknown) => this.#fail(error));
      },
    );
    this.#connectionState = "connected";
    this.#render();
    await this.#queue;
  }

  async #handleMessage(
    message: ProviderMessage<OfcHandAction, OfcRunnerSnapshot, OfcHandEvent>,
  ): Promise<void> {
    if (this.#disposed) return;
    switch (message.type) {
      case "lobby":
        this.#lobby = message.lobby;
        if (message.lobby.status === "closed") {
          this.#connectionState = "closed";
        } else if (this.#dependencies.connection.role === "host") {
          await this.#startLobbyIfReady();
        }
        break;
      case "action-requested":
        if (this.#dependencies.connection.role === "host") {
          await this.#processAction(message.senderId, message.request, true);
        }
        break;
      case "action-result":
        if (!message.result.accepted) {
          const rejection = message.result.rejection;
          this.#error =
            isRecord(rejection) && typeof rejection.message === "string"
              ? rejection.message
              : "That action was rejected";
        } else {
          this.#error = undefined;
        }
        break;
      case "authoritative-update":
        this.#acceptAuthoritative(
          message.update.eventId,
          message.update.snapshot,
        );
        break;
      case "participant-disconnected":
        break;
      case "connection-lost":
        this.#connectionState = "disconnected";
        this.#error =
          "Connection lost. Reconnect from this browser to restore your reserved seat.";
        this.#aiGeneration += 1;
        break;
      case "lobby-closed":
        this.#connectionState = "closed";
        this.#error =
          message.reason === "host-left"
            ? "The host left, so this lobby is closed"
            : "This lobby is closed";
        this.#aiGeneration += 1;
        break;
    }
    this.#render();
  }

  async #startLobbyIfReady(): Promise<void> {
    if (this.#state || this.#lobby.status !== "waiting") return;
    const humans = this.#lobby.participants;
    const aiSeats = [...this.#aiById.values()];
    const occupied = humans.length + aiSeats.length;
    if (occupied !== this.#lobby.settings.seatCount) return;
    if (humans.some(({ connection }) => connection !== "connected")) return;
    if (this.#lobby.settings.mode === "multiplayer" && aiSeats.length !== 0) {
      throw new RangeError("Multiplayer lobbies cannot contain local AI seats");
    }
    if (this.#lobby.settings.mode === "local-ai" && humans.length !== 1) {
      throw new RangeError("A local AI lobby requires exactly one human");
    }
    const playerIds = [
      ...humans.map(({ id }) => id),
      ...aiSeats.map(({ player }) => player.id),
    ];
    if (new Set(playerIds).size !== playerIds.length) {
      throw new RangeError("Human and AI player IDs must be unique");
    }
    const configuration = configurationFrom(this.#lobby);
    const initialDealerSeat = this.#dependencies.initialDealerSeat ?? 0;
    const match = createOfcMatch({
      schemaVersion: 1,
      gameId: this.#lobby.id,
      configuration,
      initialDealerSeat,
      players: [
        ...humans.map(({ id, displayName }) => ({ id, displayName })),
        ...aiSeats.map(({ player, displayName }) => ({
          id: player.id,
          displayName,
        })),
      ],
    });
    const hand = createOfcMatchHand(
      match,
      this.#dependencies.deckForHand(match.nextHandNumber),
    );
    this.#state = { authorityRevision: 0, match, hand };
    await this.#dependencies.connection.activateLobby();
    await this.#publishState(this.#nextId("update"), []);
  }

  #acceptAuthoritative(eventId: string, snapshot: OfcRunnerSnapshot): void {
    if (this.#seenUpdateIds.has(eventId)) return;
    if (
      this.#state &&
      snapshot.state.authorityRevision <= this.#state.authorityRevision
    ) {
      this.#seenUpdateIds.add(eventId);
      return;
    }
    const restored = restoreRunnerSnapshot(snapshot);
    this.#seenUpdateIds.add(eventId);
    this.#state = restored;
    this.#connectionState = "connected";
    this.#error = undefined;
    this.#aiInFlight = undefined;
    this.#aiGeneration += 1;
  }

  async #submitHumanAction(action: OfcHandAction): Promise<void> {
    if (this.#disposed || !this.#state) return;
    try {
      await this.#dependencies.connection.submitAction({
        requestId: action.actionId,
        expectedRevision: this.#state.authorityRevision,
        action,
      });
    } catch (error) {
      this.#fail(error);
    }
  }

  async #processAction(
    senderId: string,
    request: ActionRequest<OfcHandAction>,
    publishResult: boolean,
  ): Promise<void> {
    const current = this.#state;
    if (!current) return;
    if (request.expectedRevision !== current.authorityRevision) {
      if (publishResult) {
        await this.#dependencies.connection.publishActionResult({
          requestId: request.requestId,
          accepted: false,
          rejection: {
            code: "stale-revision",
            message: "Action revision does not match authoritative state",
          },
        });
      }
      return;
    }
    const trustedAction = {
      ...request.action,
      actionId: request.requestId,
      expectedRevision: current.hand.revision,
      playerId: senderId,
    } as OfcHandAction;
    const transition = transitionOfcHand(current.hand, trustedAction);
    if (!transition.accepted) {
      if (publishResult) {
        await this.#dependencies.connection.publishActionResult({
          requestId: request.requestId,
          accepted: false,
          rejection: {
            actionId: transition.rejection.actionId,
            code: transition.rejection.code,
            message: transition.rejection.message,
          },
        });
      }
      return;
    }

    let match = current.match;
    if (transition.state.phase === "complete") {
      match = completeOfcMatchHand(match, transition.state).state;
    }
    this.#state = {
      authorityRevision: current.authorityRevision + 1,
      match,
      hand: transition.state,
    };
    await this.#publishState(
      transition.events[0]?.eventId ?? this.#nextId("update"),
      transition.events,
      request.requestId,
    );
    if (publishResult) {
      await this.#dependencies.connection.publishActionResult({
        requestId: request.requestId,
        accepted: true,
      });
    }
  }

  async #publishState(
    eventId: string,
    events: readonly OfcHandEvent[],
    causationId?: string,
  ): Promise<void> {
    const state = this.#state;
    if (!state) return;
    await this.#dependencies.connection.publishAuthoritative({
      eventId,
      revision: state.authorityRevision,
      ...(causationId ? { causationId } : {}),
      snapshot: snapshotOf(state),
      events,
    });
  }

  public async startNextHand(): Promise<boolean> {
    if (
      this.#disposed ||
      this.#dependencies.connection.role !== "host" ||
      !this.#state ||
      this.#state.hand.phase !== "complete"
    ) {
      return false;
    }
    const hand = createOfcMatchHand(
      this.#state.match,
      this.#dependencies.deckForHand(this.#state.match.nextHandNumber),
    );
    this.#state = {
      authorityRevision: this.#state.authorityRevision + 1,
      match: this.#state.match,
      hand,
    };
    await this.#publishState(this.#nextId("update"), []);
    this.#render();
    return true;
  }

  #players(): readonly GameViewPlayer[] {
    if (!this.#state) {
      const humans: GameViewPlayer[] = this.#lobby.participants.map(
        (participant, seat) => ({
          id: participant.id,
          displayName: participant.displayName,
          seat,
          connection: participant.connection,
          score: 0,
          inFantasyland: false,
          isAi: false,
          isThinking: false,
        }),
      );
      return [
        ...humans,
        ...[...this.#aiById.values()].map(({ player, displayName }, index) => ({
          id: player.id,
          displayName,
          seat: humans.length + index,
          connection: "connected" as const,
          score: 0,
          inFantasyland: false,
          isAi: true,
          isThinking: this.#aiInFlight?.endsWith(`:${player.id}`) ?? false,
        })),
      ];
    }
    return this.#state.match.players.map((player) => {
      const participant = this.#lobby.participants.find(
        ({ id }) => id === player.id,
      );
      return {
        id: player.id,
        displayName: player.displayName,
        seat: player.seat,
        connection: participant?.connection ?? "connected",
        score: player.cumulativeScore,
        inFantasyland: player.inFantasyland,
        isAi: this.#aiById.has(player.id),
        isThinking: this.#aiInFlight?.endsWith(`:${player.id}`) ?? false,
      };
    });
  }

  #render(scheduleAi = true): void {
    if (this.#disposed) return;
    const state = this.#state;
    const viewerId = this.#dependencies.connection.participant.id;
    let visibleState: OfcPlayerVisibleState | undefined;
    let legalActions: readonly OfcHandAction[] = [];
    if (state) {
      visibleState = ofcHandPlayerView(state.hand, viewerId);
      const participant = this.#lobby.participants.find(
        ({ id }) => id === viewerId,
      );
      if (
        this.#connectionState === "connected" &&
        participant?.connection === "connected"
      ) {
        const actionBase = this.#nextId("action");
        legalActions = ofcHandLegalActions(
          state.hand,
          viewerId,
          (candidate) => `${actionBase}:${candidate}`,
        );
      }
    }
    const phase =
      this.#connectionState === "closed"
        ? "closed"
        : (state?.hand.phase ?? "waiting");
    const showdown =
      state?.hand.phase === "complete"
        ? state.match.completedHands.at(-1)?.result
        : undefined;
    this.#dependencies.view.render(
      freezeModel({
        lobby: this.#lobby,
        viewerId,
        connection: this.#connectionState,
        phase,
        handNumber: state
          ? state.hand.phase === "complete"
            ? state.match.nextHandNumber - 1
            : state.match.nextHandNumber
          : 1,
        ...(state ? { dealerSeat: state.hand.dealerSeat } : {}),
        ...(state?.hand.activePlayerId
          ? { activePlayerId: state.hand.activePlayerId }
          : {}),
        isLocalTurn: state?.hand.activePlayerId === viewerId,
        canStartNextHand:
          this.#dependencies.connection.role === "host" &&
          state?.hand.phase === "complete",
        players: [...this.#players()],
        ...(visibleState ? { state: visibleState } : {}),
        legalActions: [...legalActions],
        ...(showdown ? { showdown } : {}),
        ...(this.#error ? { error: this.#error } : {}),
      }),
    );
    if (scheduleAi) this.#scheduleAi();
  }

  #scheduleAi(): void {
    const state = this.#state;
    if (
      this.#disposed ||
      this.#dependencies.connection.role !== "host" ||
      !state?.hand.activePlayerId
    ) {
      return;
    }
    const seat = this.#aiById.get(state.hand.activePlayerId);
    const key = `${state.authorityRevision}:${state.hand.activePlayerId}`;
    if (!seat || this.#aiInFlight === key) return;
    this.#aiInFlight = key;
    const generation = this.#aiGeneration;
    const actionBase = this.#nextId("action");
    const legalActions = ofcHandLegalActions(
      state.hand,
      seat.player.id,
      (candidate) => `${actionBase}:ai:${candidate}`,
    );
    if (legalActions.length === 0) {
      this.#aiInFlight = undefined;
      return;
    }
    this.#render(false);
    void this.#decideAi(
      seat.player,
      seat,
      state,
      legalActions,
      generation,
      key,
    );
  }

  async #decideAi(
    player: AiPlayer<OfcHandAction, OfcPlayerVisibleState>,
    seat: RunnerAiSeat,
    state: RunnerState,
    legalActions: readonly OfcHandAction[],
    generation: number,
    key: string,
  ): Promise<void> {
    try {
      const decision = await player.decide({
        playerId: player.id,
        state: ofcHandPlayerView(state.hand, player.id),
        legalActions,
        configuration: seat.configuration,
      });
      if (
        this.#disposed ||
        generation !== this.#aiGeneration ||
        this.#aiInFlight !== key ||
        this.#state?.authorityRevision !== state.authorityRevision
      ) {
        return;
      }
      await this.#processAction(
        player.id,
        {
          requestId: decision.action.actionId,
          expectedRevision: state.authorityRevision,
          action: decision.action,
        },
        false,
      );
      this.#render();
    } catch (error) {
      if (this.#aiInFlight === key) this.#aiInFlight = undefined;
      this.#fail(error);
    }
  }

  #fail(error: unknown): void {
    if (this.#disposed) return;
    this.#error = errorMessage(error);
    this.#render();
  }

  public async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#aiGeneration += 1;
    this.#unsubscribeProvider?.();
    this.#unsubscribeView?.();
    this.#unsubscribeProvider = undefined;
    this.#unsubscribeView = undefined;
    await Promise.allSettled(
      [...this.#aiById.values()].map(async (seat) => seat.dispose?.()),
    );
    this.#dependencies.view.dispose();
    try {
      if (this.#dependencies.disposeMode === "disconnect") {
        await this.#dependencies.connection.disconnect();
      } else {
        await this.#dependencies.connection.dispose();
      }
    } catch (error) {
      if (
        !(error instanceof DataProviderError) ||
        error.code !== "invalid-lifecycle"
      )
        throw error;
    }
  }
}

export function createOfcGameRunner(
  dependencies: GameRunnerDependencies,
): GameRunner {
  return new OfcGameRunner(dependencies);
}

class ActiveGameRunnerLifecycle implements GameRunnerLifecycle {
  #active:
    { readonly lobbyId: string; readonly runner: GameRunner } | undefined;
  #pending = new Map<string, Promise<GameRunner>>();
  #tail: Promise<void> = Promise.resolve();

  public activate(
    lobbyId: string,
    createRunner: () => GameRunner,
  ): Promise<GameRunner> {
    if (lobbyId === "")
      return Promise.reject(new RangeError("Lobby ID is required"));
    if (this.#active?.lobbyId === lobbyId)
      return Promise.resolve(this.#active.runner);
    const existing = this.#pending.get(lobbyId);
    if (existing) return existing;
    const activation = this.#tail.then(async () => {
      if (this.#active?.lobbyId === lobbyId) return this.#active.runner;
      await this.#active?.runner.dispose();
      this.#active = undefined;
      const runner = createRunner();
      try {
        await runner.start();
        this.#active = { lobbyId, runner };
        return runner;
      } catch (error) {
        await runner.dispose();
        throw error;
      }
    });
    this.#tail = activation.then(
      () => undefined,
      () => undefined,
    );
    this.#pending.set(lobbyId, activation);
    const clearPending = () => {
      if (this.#pending.get(lobbyId) === activation)
        this.#pending.delete(lobbyId);
    };
    void activation.then(clearPending, clearPending);
    return activation;
  }

  public async dispose(): Promise<void> {
    await this.#tail;
    await this.#active?.runner.dispose();
    this.#active = undefined;
  }
}

export function createGameRunnerLifecycle(): GameRunnerLifecycle {
  return new ActiveGameRunnerLifecycle();
}
