import {
  DataProviderError,
  type ActionRequest,
  type ActionResult,
  type AuthoritativeUpdate,
  type DataProvider,
  type JsonValue,
  type LobbyConnection,
  type LobbyId,
  type LobbyMetadata,
  type LobbySettings,
  type ParticipantIdentity,
  type ParticipantProfile,
  type ProviderMessage,
  type ReconnectToken,
  type Unsubscribe,
} from "../index";
import {
  PlayroomKitBoundary,
  type PlayroomBoundary,
  type PlayroomBoundaryMessage,
  type PlayroomBoundarySession,
} from "./playroom-boundary";

const HANDSHAKE_TIMEOUT_MS = 10_000;

export interface PlayroomDataProviderOptions {
  /** Public Playroom project ID. It is configuration, not a secret. */
  readonly gameId: string;
  readonly boundary?: PlayroomBoundary;
  readonly reconnectGracePeriodMs?: number;
  readonly tokenFactory?: () => string;
  readonly handshakeTimeoutMs?: number;
  /** Keep true in browsers. False is only for multi-client contract fakes. */
  readonly singleSession?: boolean;
}

interface WireMember {
  readonly id: string;
  readonly displayName: string;
  readonly connection: "connected" | "disconnected";
  readonly boundaryId: string;
}

interface WireLobby<TSnapshot, TEvent> {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly settings: LobbySettings;
  readonly hostId: string;
  readonly members: readonly WireMember[];
  readonly status: "waiting" | "active" | "closed";
  readonly latestUpdate?: AuthoritativeUpdate<TSnapshot, TEvent>;
}

type WireMessage<TAction, TSnapshot, TEvent> =
  | {
      readonly kind: "hello";
      readonly operation: "join" | "reconnect";
      readonly displayName?: string;
      readonly reconnectToken?: string;
    }
  | {
      readonly kind: "welcome";
      readonly targetBoundaryId: string;
      readonly accepted: true;
      readonly participantId: string;
      readonly lobby: WireLobby<TSnapshot, TEvent>;
    }
  | {
      readonly kind: "welcome";
      readonly targetBoundaryId: string;
      readonly accepted: false;
      readonly errorCode:
        | "lobby-active"
        | "lobby-closed"
        | "lobby-full"
        | "invalid-reconnect-token";
    }
  | { readonly kind: "lobby"; readonly lobby: WireLobby<TSnapshot, TEvent> }
  | { readonly kind: "action"; readonly request: ActionRequest<TAction> }
  | {
      readonly kind: "action-result";
      readonly targetParticipantId: string;
      readonly result: ActionResult;
    }
  | {
      readonly kind: "authoritative";
      readonly update: AuthoritativeUpdate<TSnapshot, TEvent>;
    }
  | { readonly kind: "activate" }
  | { readonly kind: "disconnect" }
  | { readonly kind: "leave" }
  | { readonly kind: "closed"; readonly reason: "host-left" | "disposed" };

interface HostState<TSnapshot, TEvent> {
  lobby: WireLobby<TSnapshot, TEvent>;
  readonly tokens: Map<string, string>;
  readonly requests: Map<string, { senderId: string; result?: ActionResult }>;
  readonly updateIds: Set<string>;
}

function jsonCopy<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch (cause) {
    throw new DataProviderError(
      "invalid-payload",
      "Provider payloads must be JSON-serializable",
      { cause },
    );
  }
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

function immutable<T>(value: T): T {
  return freeze(jsonCopy(value));
}

function validateProfile(profile: ParticipantProfile): string {
  if (
    typeof profile.displayName !== "string" ||
    profile.displayName.trim().length === 0
  )
    throw new DataProviderError("invalid-payload", "Display name is required");
  return profile.displayName.trim();
}

function validateSettings(settings: LobbySettings): void {
  if (
    settings.schemaVersion !== 1 ||
    ![2, 3, 4].includes(settings.seatCount) ||
    settings.mode !== "multiplayer"
  )
    throw new DataProviderError(
      "invalid-settings",
      "Playroom lobbies require schema 1 multiplayer settings and 2-4 seats",
    );
  jsonCopy(settings);
}

function metadata<TSnapshot, TEvent>(
  lobby: WireLobby<TSnapshot, TEvent>,
): LobbyMetadata {
  return immutable({
    id: lobby.id,
    settings: lobby.settings,
    hostId: lobby.hostId,
    participants: lobby.members.map(({ id, displayName, connection }) => ({
      id,
      displayName,
      connection,
    })),
    status: lobby.status,
  });
}

function validateWireLobby<TSnapshot, TEvent>(
  lobby: WireLobby<TSnapshot, TEvent>,
): void {
  if (
    !isRecord(lobby) ||
    lobby.schemaVersion !== 1 ||
    !isRecord(lobby.settings) ||
    lobby.settings.schemaVersion !== 1
  ) {
    throw new DataProviderError(
      "incompatible-version",
      "This lobby was created by an incompatible version of OFC Poker",
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export class PlayroomDataProvider<
  TAction = JsonValue,
  TSnapshot = JsonValue,
  TEvent = JsonValue,
> implements DataProvider<TAction, TSnapshot, TEvent> {
  readonly #options: Required<
    Pick<
      PlayroomDataProviderOptions,
      "gameId" | "reconnectGracePeriodMs" | "handshakeTimeoutMs"
    >
  > &
    Pick<PlayroomDataProviderOptions, "tokenFactory">;
  readonly #boundary: PlayroomBoundary;
  readonly #singleSession: boolean;
  readonly #connections = new Set<
    PlayroomLobbyConnection<TAction, TSnapshot, TEvent>
  >();
  readonly #closedLobbyIds = new Set<LobbyId>();
  #sequence = 0;
  #disposed = false;
  #connecting = false;

  constructor(options: PlayroomDataProviderOptions) {
    if (!options.gameId.trim())
      throw new DataProviderError("invalid-settings", "gameId is required");
    this.#options = {
      gameId: options.gameId,
      reconnectGracePeriodMs: options.reconnectGracePeriodMs ?? 60_000,
      handshakeTimeoutMs: options.handshakeTimeoutMs ?? HANDSHAKE_TIMEOUT_MS,
      ...(options.tokenFactory ? { tokenFactory: options.tokenFactory } : {}),
    };
    this.#boundary = options.boundary ?? new PlayroomKitBoundary();
    this.#singleSession =
      options.singleSession ?? options.boundary === undefined;
  }

  #assertActive(): void {
    if (this.#disposed)
      throw new DataProviderError("provider-disposed", "Provider is disposed");
  }

  #token(): string {
    return (
      this.#options.tokenFactory?.() ??
      globalThis.crypto?.randomUUID?.() ??
      `playroom-token-${Date.now()}-${++this.#sequence}`
    );
  }

  async #session(
    roomCode: string | undefined,
    displayName: string,
    maxPlayers: 2 | 3 | 4,
  ): Promise<PlayroomBoundarySession> {
    if (this.#singleSession && (this.#connecting || this.#connections.size > 0))
      throw new DataProviderError(
        "invalid-lifecycle",
        "This Playroom provider already owns a browser session",
      );
    this.#connecting = true;
    try {
      return await this.#boundary.connect({
        gameId: this.#options.gameId,
        ...(roomCode ? { roomCode } : {}),
        displayName,
        maxPlayers,
        reconnectGracePeriodMs: this.#options.reconnectGracePeriodMs,
      });
    } catch (cause) {
      if (cause instanceof DataProviderError) throw cause;
      const message = cause instanceof Error ? cause.message : String(cause);
      if (message.includes("ROOM_LIMIT_EXCEEDED"))
        throw new DataProviderError("lobby-full", "Lobby is full", { cause });
      if (
        message.includes("ROOM_MISSING") ||
        message.includes("ROOM_NOT_FOUND")
      )
        throw new DataProviderError("lobby-missing", "Lobby was not found", {
          cause,
        });
      throw new DataProviderError(
        "initialization-failed",
        "Playroom could not initialize",
        {
          cause,
        },
      );
    } finally {
      this.#connecting = false;
    }
  }

  public async createLobby(
    settings: LobbySettings,
    profile: ParticipantProfile,
  ): Promise<LobbyConnection<TAction, TSnapshot, TEvent>> {
    this.#assertActive();
    validateSettings(settings);
    const displayName = validateProfile(profile);
    const session = await this.#session(
      undefined,
      displayName,
      settings.seatCount,
    );
    if (!session.host) {
      await session.leave();
      throw new DataProviderError(
        "invalid-lifecycle",
        "A newly created Playroom room must be hosted by its creator",
      );
    }
    const token = this.#token();
    const host: WireMember = {
      id: session.self.id,
      displayName,
      connection: "connected",
      boundaryId: session.self.id,
    };
    const hostState: HostState<TSnapshot, TEvent> = {
      lobby: immutable({
        schemaVersion: 1,
        id: session.roomCode,
        settings: immutable(settings),
        hostId: host.id,
        members: [host],
        status: "waiting",
      }),
      tokens: new Map([[token, host.id]]),
      requests: new Map(),
      updateIds: new Set(),
    };
    const connection = new PlayroomLobbyConnection<TAction, TSnapshot, TEvent>(
      session,
      host.id,
      token,
      hostState,
      () => this.#connections.delete(connection),
      (lobbyId) => this.#closedLobbyIds.add(lobbyId),
    );
    this.#connections.add(connection);
    return connection;
  }

  public async joinLobby(
    lobbyId: LobbyId,
    profile: ParticipantProfile,
  ): Promise<LobbyConnection<TAction, TSnapshot, TEvent>> {
    this.#assertActive();
    if (!lobbyId.trim())
      throw new DataProviderError("lobby-missing", "Lobby ID is required");
    if (this.#closedLobbyIds.has(lobbyId))
      throw new DataProviderError("lobby-closed", "Lobby is closed");
    const displayName = validateProfile(profile);
    const session = await this.#session(lobbyId, displayName, 4);
    const reconnectToken = this.#token();
    return this.#join(
      session,
      {
        kind: "hello",
        operation: "join",
        displayName,
        reconnectToken,
      },
      reconnectToken,
    );
  }

  public async reconnectLobby(
    lobbyId: LobbyId,
    reconnectToken: ReconnectToken,
  ): Promise<LobbyConnection<TAction, TSnapshot, TEvent>> {
    this.#assertActive();
    if (this.#closedLobbyIds.has(lobbyId))
      throw new DataProviderError("lobby-closed", "Lobby is closed");
    if (!reconnectToken)
      throw new DataProviderError(
        "invalid-reconnect-token",
        "Reconnect token is required",
      );
    const session = await this.#session(lobbyId, "Reconnecting player", 4);
    return this.#join(
      session,
      {
        kind: "hello",
        operation: "reconnect",
        reconnectToken,
      },
      reconnectToken,
    );
  }

  async #join(
    session: PlayroomBoundarySession,
    hello: WireMessage<TAction, TSnapshot, TEvent>,
    reconnectToken: ReconnectToken,
  ): Promise<LobbyConnection<TAction, TSnapshot, TEvent>> {
    if (session.host) {
      await session.leave();
      throw new DataProviderError(
        "lobby-missing",
        "Playroom lobby has no host",
      );
    }
    const welcome = await new Promise<
      Extract<WireMessage<TAction, TSnapshot, TEvent>, { kind: "welcome" }>
    >((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(
          new DataProviderError(
            "lobby-missing",
            "Timed out waiting for the Playroom host",
          ),
        );
      }, this.#options.handshakeTimeoutMs);
      const unsubscribe = session.onMessage((message) => {
        const wire = parseWire<TAction, TSnapshot, TEvent>(message.payload);
        if (
          wire?.kind !== "welcome" ||
          wire.targetBoundaryId !== session.self.id
        )
          return;
        clearTimeout(timeout);
        unsubscribe();
        resolve(wire);
      });
      void session.sendToHost(hello as JsonValue).catch((cause) => {
        clearTimeout(timeout);
        unsubscribe();
        reject(cause);
      });
    });
    if (!welcome.accepted) {
      await session.leave();
      throw new DataProviderError(welcome.errorCode, "Playroom join rejected");
    }
    try {
      validateWireLobby(welcome.lobby);
    } catch (cause) {
      await session.leave();
      throw cause;
    }
    const connection = new PlayroomLobbyConnection<TAction, TSnapshot, TEvent>(
      session,
      welcome.participantId,
      reconnectToken,
      undefined,
      () => this.#connections.delete(connection),
      (closedLobbyId) => this.#closedLobbyIds.add(closedLobbyId),
      welcome.lobby,
    );
    this.#connections.add(connection);
    return connection;
  }

  public async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    await Promise.all(
      [...this.#connections].map((connection) =>
        connection.dispose("disposed"),
      ),
    );
    this.#connections.clear();
  }
}

function parseWire<TAction, TSnapshot, TEvent>(
  payload: JsonValue,
): WireMessage<TAction, TSnapshot, TEvent> | undefined {
  if (!isRecord(payload) || typeof payload.kind !== "string") return undefined;
  return payload as unknown as WireMessage<TAction, TSnapshot, TEvent>;
}

class PlayroomLobbyConnection<
  TAction,
  TSnapshot,
  TEvent,
> implements LobbyConnection<TAction, TSnapshot, TEvent> {
  readonly #session: PlayroomBoundarySession;
  readonly #participantId: string;
  readonly #token: string;
  readonly #hostState: HostState<TSnapshot, TEvent> | undefined;
  readonly #onDisposed: () => void;
  readonly #onLobbyClosed: (lobbyId: LobbyId) => void;
  readonly #listeners = new Set<
    (message: ProviderMessage<TAction, TSnapshot, TEvent>) => void
  >();
  readonly #cleanup: Unsubscribe[] = [];
  #lobby: WireLobby<TSnapshot, TEvent>;
  #state: "connected" | "disconnected" | "left" = "connected";

  constructor(
    session: PlayroomBoundarySession,
    participantId: string,
    token: string,
    hostState: HostState<TSnapshot, TEvent> | undefined,
    onDisposed: () => void,
    onLobbyClosed: (lobbyId: LobbyId) => void,
    initialLobby?: WireLobby<TSnapshot, TEvent>,
  ) {
    this.#session = session;
    this.#participantId = participantId;
    this.#token = token;
    this.#hostState = hostState;
    this.#onDisposed = onDisposed;
    this.#onLobbyClosed = onLobbyClosed;
    this.#lobby = hostState?.lobby ?? initialLobby!;
    this.#cleanup.push(
      session.onMessage((message) => this.#receive(message)),
      session.onParticipantQuit((player) => this.#participantQuit(player.id)),
      session.onDisconnect(() => void this.#unexpectedDisconnect()),
    );
  }

  get lobby(): LobbyMetadata {
    return metadata(this.#lobby);
  }

  get participant(): ParticipantIdentity {
    const participant = this.#lobby.members.find(
      (member) => member.id === this.#participantId,
    );
    if (!participant)
      throw new DataProviderError("invalid-lifecycle", "Participant has left");
    return immutable({
      id: participant.id,
      displayName: participant.displayName,
    });
  }

  get role(): "host" | "peer" {
    return this.#participantId === this.#lobby.hostId ? "host" : "peer";
  }

  get reconnectToken(): ReconnectToken {
    return this.#token;
  }

  #assertConnected(): void {
    if (this.#state !== "connected")
      throw new DataProviderError(
        "invalid-lifecycle",
        "Connection is not connected",
      );
  }

  #assertHost(): HostState<TSnapshot, TEvent> {
    if (!this.#hostState)
      throw new DataProviderError(
        "not-host",
        "Only the host may publish authority",
      );
    if (this.#lobby.status === "closed")
      throw new DataProviderError("invalid-lifecycle", "Lobby is closed");
    return this.#hostState;
  }

  #emit(message: ProviderMessage<TAction, TSnapshot, TEvent>): void {
    if (this.#state !== "connected") return;
    for (const listener of [...this.#listeners]) {
      try {
        listener(immutable(message));
      } catch {
        // A consumer listener cannot break transport delivery.
      }
    }
  }

  #setLobby(lobby: WireLobby<TSnapshot, TEvent>): void {
    this.#lobby = immutable(lobby);
    if (this.#hostState) this.#hostState.lobby = this.#lobby;
    this.#emit({ type: "lobby", lobby: metadata(this.#lobby) });
  }

  async #broadcastLobby(): Promise<void> {
    await this.#session.sendToAll(
      jsonCopy({ kind: "lobby", lobby: this.#lobby }) as unknown as JsonValue,
    );
    this.#emit({ type: "lobby", lobby: metadata(this.#lobby) });
  }

  #receive(message: PlayroomBoundaryMessage): void {
    const wire = parseWire<TAction, TSnapshot, TEvent>(message.payload);
    if (!wire) return;
    if (this.#hostState) {
      void this.#receiveAsHost(wire, message.sender.id);
      return;
    }
    if (message.sender.id !== this.#lobby.members[0]?.boundaryId) return;
    switch (wire.kind) {
      case "lobby":
        this.#setLobby(wire.lobby);
        break;
      case "action-result":
        if (wire.targetParticipantId === this.#participantId)
          this.#emit({ type: "action-result", result: wire.result });
        break;
      case "authoritative":
        this.#lobby = immutable({ ...this.#lobby, latestUpdate: wire.update });
        this.#emit({ type: "authoritative-update", update: wire.update });
        break;
      case "closed":
        this.#lobby = immutable({ ...this.#lobby, status: "closed" });
        this.#emit({ type: "lobby-closed", reason: wire.reason });
        this.#closeLocal();
        void this.#session.leave();
        break;
      default:
        break;
    }
  }

  async #receiveAsHost(
    wire: WireMessage<TAction, TSnapshot, TEvent>,
    senderBoundaryId: string,
  ): Promise<void> {
    const state = this.#hostState!;
    if (wire.kind === "hello") {
      await this.#handshake(wire, senderBoundaryId);
      return;
    }
    const member = state.lobby.members.find(
      (candidate) => candidate.boundaryId === senderBoundaryId,
    );
    if (!member) return;
    if (wire.kind === "action") {
      if (!isRecord(wire.request) || typeof wire.request.requestId !== "string")
        return;
      const prior = state.requests.get(wire.request.requestId);
      if (prior) {
        if (prior.senderId === member.id && prior.result)
          await this.#sendResult(member.id, prior.result);
        return;
      }
      if (
        !Number.isSafeInteger(wire.request.expectedRevision) ||
        wire.request.expectedRevision < 0
      )
        return;
      jsonCopy(wire.request);
      state.requests.set(wire.request.requestId, { senderId: member.id });
      this.#emit({
        type: "action-requested",
        senderId: member.id,
        request: wire.request,
      });
    } else if (wire.kind === "disconnect") {
      await this.#markDisconnected(member.id);
    } else if (wire.kind === "leave") {
      await this.#removeMember(member.id);
    }
  }

  async #handshake(
    hello: Extract<WireMessage<TAction, TSnapshot, TEvent>, { kind: "hello" }>,
    boundaryId: string,
  ): Promise<void> {
    const state = this.#hostState!;
    let member: WireMember | undefined;
    let token: string | undefined;
    let errorCode:
      | "lobby-active"
      | "lobby-closed"
      | "lobby-full"
      | "invalid-reconnect-token"
      | undefined;
    if (hello.operation === "reconnect") {
      const participantId = hello.reconnectToken
        ? state.tokens.get(hello.reconnectToken)
        : undefined;
      const prior = participantId
        ? state.lobby.members.find(
            (candidate) => candidate.id === participantId,
          )
        : undefined;
      if (!prior) errorCode = "invalid-reconnect-token";
      else {
        token = hello.reconnectToken;
        member = { ...prior, boundaryId, connection: "connected" };
        this.#replaceMember(member);
      }
    } else if (state.lobby.status === "active") errorCode = "lobby-active";
    else if (state.lobby.status === "closed") errorCode = "lobby-closed";
    else if (state.lobby.members.length >= state.lobby.settings.seatCount)
      errorCode = "lobby-full";
    else if (
      !hello.displayName?.trim() ||
      !hello.reconnectToken ||
      state.tokens.has(hello.reconnectToken)
    )
      errorCode = "invalid-reconnect-token";
    else {
      token = hello.reconnectToken;
      member = {
        id: boundaryId,
        displayName: hello.displayName.trim(),
        connection: "connected",
        boundaryId,
      };
      state.tokens.set(token, member.id);
      this.#setLobby({
        ...state.lobby,
        members: [...state.lobby.members, member],
      });
    }
    const welcome = errorCode
      ? {
          kind: "welcome" as const,
          targetBoundaryId: boundaryId,
          accepted: false as const,
          errorCode,
        }
      : {
          kind: "welcome" as const,
          targetBoundaryId: boundaryId,
          accepted: true as const,
          participantId: member!.id,
          lobby: state.lobby,
        };
    await this.#session.sendToAll(jsonCopy(welcome) as JsonValue);
    if (!errorCode) await this.#broadcastLobby();
  }

  #replaceMember(member: WireMember): void {
    this.#setLobby({
      ...this.#lobby,
      members: this.#lobby.members.map((candidate) =>
        candidate.id === member.id ? member : candidate,
      ),
    });
  }

  async #markDisconnected(participantId: string): Promise<void> {
    const member = this.#lobby.members.find(
      (candidate) => candidate.id === participantId,
    );
    if (!member || member.connection === "disconnected") return;
    this.#replaceMember({ ...member, connection: "disconnected" });
    this.#emit({ type: "participant-disconnected", participantId });
    await this.#broadcastLobby();
  }

  async #removeMember(participantId: string): Promise<void> {
    if (participantId === this.#lobby.hostId) return;
    const state = this.#hostState!;
    if (!this.#lobby.members.some((member) => member.id === participantId))
      return;
    state.lobby = immutable({
      ...this.#lobby,
      members: this.#lobby.members.filter(
        (member) => member.id !== participantId,
      ),
    });
    for (const [token, id] of state.tokens)
      if (id === participantId) state.tokens.delete(token);
    await this.#broadcastLobby();
  }

  #participantQuit(boundaryId: string): void {
    if (boundaryId === this.#lobby.members[0]?.boundaryId) {
      if (!this.#hostState) {
        this.#lobby = immutable({ ...this.#lobby, status: "closed" });
        this.#emit({ type: "lobby-closed", reason: "host-left" });
        this.#closeLocal();
        void this.#session.leave();
      }
      return;
    }
    if (!this.#hostState) return;
    const member = this.#lobby.members.find(
      (candidate) => candidate.boundaryId === boundaryId,
    );
    if (member) void this.#markDisconnected(member.id);
  }

  async #unexpectedDisconnect(): Promise<void> {
    if (this.#state !== "connected") return;
    if (this.role === "host") await this.#closeLobby("host-left");
    else {
      this.#emit({ type: "connection-lost" });
      this.#state = "disconnected";
      this.#listeners.clear();
      this.#cleanupNow();
      this.#onDisposed();
    }
  }

  public subscribe(
    listener: (message: ProviderMessage<TAction, TSnapshot, TEvent>) => void,
  ): Unsubscribe {
    this.#assertConnected();
    this.#listeners.add(listener);
    listener({ type: "lobby", lobby: this.lobby });
    if (this.#lobby.latestUpdate)
      listener({
        type: "authoritative-update",
        update: immutable(this.#lobby.latestUpdate),
      });
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.#listeners.delete(listener);
    };
  }

  public async submitAction(request: ActionRequest<TAction>): Promise<void> {
    this.#assertConnected();
    if (
      !request.requestId ||
      !Number.isSafeInteger(request.expectedRevision) ||
      request.expectedRevision < 0
    )
      throw new DataProviderError("invalid-payload", "Invalid action request");
    jsonCopy(request);
    if (this.#hostState) {
      await this.#receiveAsHost(
        { kind: "action", request },
        this.#session.self.id,
      );
    } else {
      await this.#session.sendToHost(
        jsonCopy({ kind: "action", request }) as unknown as JsonValue,
      );
    }
  }

  async #sendResult(
    participantId: string,
    result: ActionResult,
  ): Promise<void> {
    const wire = {
      kind: "action-result" as const,
      targetParticipantId: participantId,
      result,
    };
    if (participantId === this.#participantId)
      this.#emit({ type: "action-result", result });
    await this.#session.sendToAll(jsonCopy(wire) as unknown as JsonValue);
  }

  public async publishActionResult(result: ActionResult): Promise<void> {
    this.#assertConnected();
    const state = this.#assertHost();
    jsonCopy(result);
    if (!result.requestId)
      throw new DataProviderError("invalid-payload", "Invalid action result");
    const pending = state.requests.get(result.requestId);
    if (!pending)
      throw new DataProviderError(
        "unknown-request",
        "No matching action request",
      );
    if (pending.result) return;
    pending.result = immutable(result);
    await this.#sendResult(pending.senderId, pending.result);
  }

  public async publishAuthoritative(
    update: AuthoritativeUpdate<TSnapshot, TEvent>,
  ): Promise<void> {
    this.#assertConnected();
    const state = this.#assertHost();
    jsonCopy(update);
    if (
      !update.eventId ||
      !Number.isSafeInteger(update.revision) ||
      update.revision < 0
    )
      throw new DataProviderError(
        "invalid-payload",
        "Invalid authoritative update",
      );
    if (state.updateIds.has(update.eventId)) return;
    if (
      state.lobby.latestUpdate &&
      update.revision <= state.lobby.latestUpdate.revision
    )
      throw new DataProviderError(
        "stale-update",
        "Authoritative revision must increase",
      );
    state.updateIds.add(update.eventId);
    state.lobby = immutable({ ...state.lobby, latestUpdate: update });
    this.#lobby = state.lobby;
    const wire = { kind: "authoritative" as const, update };
    await this.#session.sendToAll(jsonCopy(wire) as unknown as JsonValue);
    this.#emit({ type: "authoritative-update", update });
  }

  public async activateLobby(): Promise<void> {
    this.#assertConnected();
    this.#assertHost();
    if (this.#lobby.status !== "waiting")
      throw new DataProviderError(
        "invalid-lifecycle",
        "Lobby cannot be activated",
      );
    this.#setLobby({ ...this.#lobby, status: "active" });
    await this.#broadcastLobby();
  }

  public async disconnect(): Promise<void> {
    this.#assertConnected();
    if (this.role === "host") {
      await this.#closeLobby("host-left");
    } else {
      try {
        await this.#session.sendToHost({ kind: "disconnect" });
      } finally {
        this.#state = "disconnected";
        this.#cleanupNow();
        this.#listeners.clear();
        this.#onDisposed();
      }
    }
  }

  public async leave(): Promise<void> {
    if (this.#state === "left") return;
    if (this.#state === "connected" && this.role === "host") {
      await this.#closeLobby("host-left");
      return;
    }
    try {
      if (this.role === "peer")
        await this.#session.sendToHost({ kind: "leave" });
    } finally {
      this.#state = "left";
      this.#cleanupNow();
      this.#listeners.clear();
      this.#onDisposed();
      await this.#session.leave();
    }
  }

  async #closeLobby(reason: "host-left" | "disposed"): Promise<void> {
    if (this.#state === "left") return;
    try {
      if (this.#hostState) {
        this.#lobby = immutable({ ...this.#lobby, status: "closed" });
        this.#hostState.lobby = this.#lobby;
        this.#onLobbyClosed(this.#lobby.id);
        await this.#session.sendToAll({ kind: "closed", reason });
      }
    } finally {
      this.#emit({ type: "lobby-closed", reason });
      this.#closeLocal();
      await this.#session.leave();
    }
  }

  #cleanupNow(): void {
    for (const cleanup of this.#cleanup.splice(0)) cleanup();
  }

  #closeLocal(): void {
    this.#state = "left";
    this.#cleanupNow();
    this.#listeners.clear();
    this.#onDisposed();
  }

  public async dispose(reason: "disposed" = "disposed"): Promise<void> {
    if (this.#state === "left") return;
    if (this.role === "host") await this.#closeLobby(reason);
    else await this.leave();
  }
}

export function createPlayroomLobbyLink(
  baseUrl: string | URL,
  lobbyId: LobbyId,
): string {
  if (!lobbyId.trim())
    throw new DataProviderError("invalid-payload", "Lobby ID is required");
  const url = new URL(baseUrl);
  url.hash = "";
  url.search = "";
  url.searchParams.set("lobby", lobbyId);
  return url.toString();
}
