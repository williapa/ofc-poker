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
  type RequestId,
  type Unsubscribe,
} from "./index";

export type LocalProviderOperation =
  | "create"
  | "join"
  | "reconnect"
  | "submit-action"
  | "publish-result"
  | "publish-authoritative"
  | "activate"
  | "disconnect"
  | "leave";

export interface LocalProviderHookContext {
  readonly operation: LocalProviderOperation;
  readonly lobbyId?: LobbyId;
  readonly participantId?: string;
}

export type LocalProviderHook = (
  context: LocalProviderHookContext,
) => void | Promise<void>;

export interface LocalDataProviderOptions {
  /** Deterministic by default; inject a namespaced factory when sharing a process. */
  readonly idFactory?: (kind: "lobby" | "participant" | "token") => string;
  readonly latencyMs?: number | ((operation: LocalProviderOperation) => number);
  readonly beforeOperation?: LocalProviderHook;
}

type ConnectionState = "connected" | "disconnected" | "left";

interface Member<TAction, TSnapshot, TEvent> {
  readonly identity: ParticipantIdentity;
  readonly token: ReconnectToken;
  connected: boolean;
  connection: LocalLobbyConnection<TAction, TSnapshot, TEvent> | undefined;
}

interface PendingRequest {
  readonly senderId: string;
  result?: ActionResult;
}

interface Room<TAction, TSnapshot, TEvent> {
  readonly id: LobbyId;
  readonly settings: LobbySettings;
  readonly hostId: string;
  readonly members: Map<string, Member<TAction, TSnapshot, TEvent>>;
  readonly tokenToParticipant: Map<ReconnectToken, string>;
  readonly requests: Map<RequestId, PendingRequest>;
  readonly updateIds: Set<string>;
  status: "waiting" | "active" | "closed";
  closedReason?: "host-left" | "disposed" | "provider-error";
  latestUpdate?: AuthoritativeUpdate<TSnapshot, TEvent>;
}

function cloneJson<T>(value: T): T {
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

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function immutableCopy<T>(value: T): T {
  return deepFreeze(cloneJson(value));
}

function validateProfile(profile: ParticipantProfile): void {
  if (
    typeof profile.displayName !== "string" ||
    profile.displayName.trim().length === 0
  ) {
    throw new DataProviderError("invalid-payload", "Display name is required");
  }
}

function validateSettings(settings: LobbySettings): void {
  if (
    settings.schemaVersion !== 1 ||
    ![2, 3, 4].includes(settings.seatCount) ||
    !["local-ai", "multiplayer"].includes(settings.mode)
  ) {
    throw new DataProviderError(
      "invalid-settings",
      "Lobby settings must use schema 1 and support two to four seats",
    );
  }
  cloneJson(settings);
}

function validateRequest<TAction>(request: ActionRequest<TAction>): void {
  if (
    !request.requestId ||
    !Number.isSafeInteger(request.expectedRevision) ||
    request.expectedRevision < 0
  ) {
    throw new DataProviderError("invalid-payload", "Invalid action request");
  }
  cloneJson(request);
}

export class LocalDataProvider<
  TAction = JsonValue,
  TSnapshot = JsonValue,
  TEvent = JsonValue,
> implements DataProvider<TAction, TSnapshot, TEvent> {
  readonly #rooms = new Map<LobbyId, Room<TAction, TSnapshot, TEvent>>();
  readonly #closedLobbyIds = new Set<LobbyId>();
  readonly #options: LocalDataProviderOptions;
  #sequence = 0;
  #disposed = false;

  public constructor(options: LocalDataProviderOptions = {}) {
    this.#options = options;
  }

  async #before(
    operation: LocalProviderOperation,
    room?: Room<TAction, TSnapshot, TEvent>,
    participantId?: string,
  ): Promise<void> {
    this.#assertProviderActive();
    const delay =
      typeof this.#options.latencyMs === "function"
        ? this.#options.latencyMs(operation)
        : (this.#options.latencyMs ?? 0);
    if (delay > 0)
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    try {
      await this.#options.beforeOperation?.({
        operation,
        ...(room ? { lobbyId: room.id } : {}),
        ...(participantId ? { participantId } : {}),
      });
    } catch (cause) {
      throw new DataProviderError(
        "injected-error",
        `Injected ${operation} failure`,
        { cause },
      );
    }
  }

  #next(kind: "lobby" | "participant" | "token"): string {
    return this.#options.idFactory?.(kind) ?? `${kind}-${++this.#sequence}`;
  }

  #assertProviderActive(): void {
    if (this.#disposed)
      throw new DataProviderError("provider-disposed", "Provider is disposed");
  }

  #room(lobbyId: LobbyId): Room<TAction, TSnapshot, TEvent> {
    const room = this.#rooms.get(lobbyId);
    if (room) return room;
    if (this.#closedLobbyIds.has(lobbyId)) {
      throw new DataProviderError("lobby-closed", `Lobby ${lobbyId} is closed`);
    }
    throw new DataProviderError(
      "lobby-missing",
      `Lobby ${lobbyId} does not exist`,
    );
  }

  public async createLobby(
    settings: LobbySettings,
    profile: ParticipantProfile,
  ): Promise<LobbyConnection<TAction, TSnapshot, TEvent>> {
    await this.#before("create");
    validateSettings(settings);
    validateProfile(profile);
    const roomId = this.#next("lobby");
    const participantId = this.#next("participant");
    const token = this.#next("token");
    const identity = immutableCopy({
      id: participantId,
      displayName: profile.displayName.trim(),
    });
    const room: Room<TAction, TSnapshot, TEvent> = {
      id: roomId,
      settings: immutableCopy(settings),
      hostId: participantId,
      members: new Map(),
      tokenToParticipant: new Map([[token, participantId]]),
      requests: new Map(),
      updateIds: new Set(),
      status: "waiting",
    };
    const member: Member<TAction, TSnapshot, TEvent> = {
      identity,
      token,
      connected: true,
      connection: undefined,
    };
    room.members.set(participantId, member);
    this.#rooms.set(roomId, room);
    return this.#connect(room, member);
  }

  public async joinLobby(
    lobbyId: LobbyId,
    profile: ParticipantProfile,
  ): Promise<LobbyConnection<TAction, TSnapshot, TEvent>> {
    this.#assertProviderActive();
    const room = this.#room(lobbyId);
    await this.#before("join", room);
    validateProfile(profile);
    if (room.status === "active")
      throw new DataProviderError("lobby-active", "Lobby has already started");
    if (room.status === "closed")
      throw new DataProviderError("lobby-closed", "Lobby is closed");
    if (room.members.size >= room.settings.seatCount)
      throw new DataProviderError("lobby-full", "Lobby is full");
    const participantId = this.#next("participant");
    const token = this.#next("token");
    const member: Member<TAction, TSnapshot, TEvent> = {
      identity: immutableCopy({
        id: participantId,
        displayName: profile.displayName.trim(),
      }),
      token,
      connected: true,
      connection: undefined,
    };
    room.members.set(participantId, member);
    room.tokenToParticipant.set(token, participantId);
    const connection = this.#connect(room, member);
    this.#broadcastLobby(room);
    return connection;
  }

  public async reconnectLobby(
    lobbyId: LobbyId,
    token: ReconnectToken,
  ): Promise<LobbyConnection<TAction, TSnapshot, TEvent>> {
    this.#assertProviderActive();
    const room = this.#room(lobbyId);
    await this.#before("reconnect", room);
    const participantId = room.tokenToParticipant.get(token);
    const member = participantId ? room.members.get(participantId) : undefined;
    if (!member)
      throw new DataProviderError(
        "invalid-reconnect-token",
        "Reconnect token is invalid",
      );
    if (member.connected)
      throw new DataProviderError(
        "invalid-lifecycle",
        "Participant is already connected",
      );
    member.connected = true;
    const connection = this.#connect(room, member);
    this.#broadcastLobby(room);
    return connection;
  }

  #connect(
    room: Room<TAction, TSnapshot, TEvent>,
    member: Member<TAction, TSnapshot, TEvent>,
  ): LocalLobbyConnection<TAction, TSnapshot, TEvent> {
    const connection = new LocalLobbyConnection<TAction, TSnapshot, TEvent>(
      member.identity,
      member.identity.id === room.hostId ? "host" : "peer",
      member.token,
      {
        metadata: () => this.#metadata(room),
        replay: (listener) => this.#replay(room, listener),
        submit: (request) => this.#submit(room, member, request),
        publishResult: (result) => this.#publishResult(room, member, result),
        publishUpdate: (update) => this.#publishUpdate(room, member, update),
        activate: () => this.#activate(room, member),
        disconnect: (current) => this.#disconnect(room, member, current),
        leave: (current) => this.#leave(room, member, current),
      },
    );
    member.connection = connection;
    return connection;
  }

  #metadata(room: Room<TAction, TSnapshot, TEvent>): LobbyMetadata {
    return immutableCopy({
      id: room.id,
      settings: room.settings,
      hostId: room.hostId,
      participants: [...room.members.values()].map((member) => ({
        ...member.identity,
        connection: member.connected
          ? ("connected" as const)
          : ("disconnected" as const),
      })),
      status: room.status,
    });
  }

  #replay(
    room: Room<TAction, TSnapshot, TEvent>,
    listener: (message: ProviderMessage<TAction, TSnapshot, TEvent>) => void,
  ): void {
    listener({ type: "lobby", lobby: this.#metadata(room) });
    if (room.latestUpdate)
      listener({
        type: "authoritative-update",
        update: immutableCopy(room.latestUpdate),
      });
    if (room.status === "closed" && room.closedReason)
      listener({ type: "lobby-closed", reason: room.closedReason });
  }

  async #submit(
    room: Room<TAction, TSnapshot, TEvent>,
    member: Member<TAction, TSnapshot, TEvent>,
    request: ActionRequest<TAction>,
  ): Promise<void> {
    await this.#before("submit-action", room, member.identity.id);
    validateRequest(request);
    const prior = room.requests.get(request.requestId);
    if (prior) {
      if (prior.senderId === member.identity.id && prior.result)
        member.connection?.emit({
          type: "action-result",
          result: immutableCopy(prior.result),
        });
      return;
    }
    room.requests.set(request.requestId, { senderId: member.identity.id });
    room.members.get(room.hostId)?.connection?.emit({
      type: "action-requested",
      senderId: member.identity.id,
      request: immutableCopy(request),
    });
  }

  async #publishResult(
    room: Room<TAction, TSnapshot, TEvent>,
    member: Member<TAction, TSnapshot, TEvent>,
    result: ActionResult,
  ): Promise<void> {
    await this.#before("publish-result", room, member.identity.id);
    this.#assertHost(room, member);
    cloneJson(result);
    if (!result.requestId)
      throw new DataProviderError("invalid-payload", "Invalid action result");
    const pending = room.requests.get(result.requestId);
    if (!pending)
      throw new DataProviderError(
        "unknown-request",
        "No matching action request",
      );
    if (pending.result) return;
    pending.result = immutableCopy(result);
    room.members
      .get(pending.senderId)
      ?.connection?.emit({ type: "action-result", result: pending.result });
  }

  async #publishUpdate(
    room: Room<TAction, TSnapshot, TEvent>,
    member: Member<TAction, TSnapshot, TEvent>,
    update: AuthoritativeUpdate<TSnapshot, TEvent>,
  ): Promise<void> {
    await this.#before("publish-authoritative", room, member.identity.id);
    this.#assertHost(room, member);
    cloneJson(update);
    if (
      !update.eventId ||
      !Number.isSafeInteger(update.revision) ||
      update.revision < 0
    )
      throw new DataProviderError(
        "invalid-payload",
        "Invalid authoritative update",
      );
    if (room.updateIds.has(update.eventId)) return;
    if (room.latestUpdate && update.revision <= room.latestUpdate.revision)
      throw new DataProviderError(
        "stale-update",
        "Authoritative revision must increase",
      );
    const copy = immutableCopy(update);
    room.updateIds.add(update.eventId);
    room.latestUpdate = copy;
    this.#broadcast(room, { type: "authoritative-update", update: copy });
  }

  async #activate(
    room: Room<TAction, TSnapshot, TEvent>,
    member: Member<TAction, TSnapshot, TEvent>,
  ): Promise<void> {
    await this.#before("activate", room, member.identity.id);
    this.#assertHost(room, member);
    if (room.status !== "waiting")
      throw new DataProviderError(
        "invalid-lifecycle",
        "Lobby cannot be activated",
      );
    room.status = "active";
    this.#broadcastLobby(room);
  }

  async #disconnect(
    room: Room<TAction, TSnapshot, TEvent>,
    member: Member<TAction, TSnapshot, TEvent>,
    connection: LocalLobbyConnection<TAction, TSnapshot, TEvent>,
  ): Promise<void> {
    await this.#before("disconnect", room, member.identity.id);
    if (member.connection !== connection || !member.connected)
      throw new DataProviderError(
        "invalid-lifecycle",
        "Connection is not active",
      );
    if (member.identity.id === room.hostId) {
      this.#close(room, "host-left");
      return;
    }
    member.connected = false;
    member.connection = undefined;
    this.#broadcast(room, {
      type: "participant-disconnected",
      participantId: member.identity.id,
    });
    this.#broadcastLobby(room);
  }

  async #leave(
    room: Room<TAction, TSnapshot, TEvent>,
    member: Member<TAction, TSnapshot, TEvent>,
    connection: LocalLobbyConnection<TAction, TSnapshot, TEvent>,
  ): Promise<void> {
    await this.#before("leave", room, member.identity.id);
    if (member.connection !== connection && member.connected)
      throw new DataProviderError(
        "invalid-lifecycle",
        "Connection is not current",
      );
    if (member.identity.id === room.hostId) {
      this.#close(room, "host-left");
      return;
    }
    room.members.delete(member.identity.id);
    room.tokenToParticipant.delete(member.token);
    member.connected = false;
    member.connection = undefined;
    this.#broadcastLobby(room);
  }

  #assertHost(
    room: Room<TAction, TSnapshot, TEvent>,
    member: Member<TAction, TSnapshot, TEvent>,
  ): void {
    if (member.identity.id !== room.hostId)
      throw new DataProviderError(
        "not-host",
        "Only the host may publish authority",
      );
    if (room.status === "closed")
      throw new DataProviderError("invalid-lifecycle", "Lobby is closed");
  }

  #broadcastLobby(room: Room<TAction, TSnapshot, TEvent>): void {
    this.#broadcast(room, { type: "lobby", lobby: this.#metadata(room) });
  }

  #broadcast(
    room: Room<TAction, TSnapshot, TEvent>,
    message: ProviderMessage<TAction, TSnapshot, TEvent>,
  ): void {
    for (const member of room.members.values())
      member.connection?.emit(message);
  }

  #close(
    room: Room<TAction, TSnapshot, TEvent>,
    reason: "host-left" | "disposed" | "provider-error",
  ): void {
    if (room.status === "closed") return;
    room.status = "closed";
    room.closedReason = reason;
    this.#broadcast(room, { type: "lobby-closed", reason });
    for (const member of room.members.values()) {
      member.connected = false;
      member.connection?.closeFromProvider();
      member.connection = undefined;
    }
    this.#rooms.delete(room.id);
    this.#closedLobbyIds.add(room.id);
  }

  public async dispose(): Promise<void> {
    if (this.#disposed) return;
    for (const room of [...this.#rooms.values()]) this.#close(room, "disposed");
    this.#disposed = true;
  }
}

interface ConnectionDelegates<TAction, TSnapshot, TEvent> {
  readonly metadata: () => LobbyMetadata;
  readonly replay: (
    listener: (message: ProviderMessage<TAction, TSnapshot, TEvent>) => void,
  ) => void;
  readonly submit: (request: ActionRequest<TAction>) => Promise<void>;
  readonly publishResult: (result: ActionResult) => Promise<void>;
  readonly publishUpdate: (
    update: AuthoritativeUpdate<TSnapshot, TEvent>,
  ) => Promise<void>;
  readonly activate: () => Promise<void>;
  readonly disconnect: (
    connection: LocalLobbyConnection<TAction, TSnapshot, TEvent>,
  ) => Promise<void>;
  readonly leave: (
    connection: LocalLobbyConnection<TAction, TSnapshot, TEvent>,
  ) => Promise<void>;
}

class LocalLobbyConnection<
  TAction,
  TSnapshot,
  TEvent,
> implements LobbyConnection<TAction, TSnapshot, TEvent> {
  readonly #listeners = new Set<
    (message: ProviderMessage<TAction, TSnapshot, TEvent>) => void
  >();
  readonly #identity: ParticipantIdentity;
  readonly #role: "host" | "peer";
  readonly #token: ReconnectToken;
  readonly #delegates: ConnectionDelegates<TAction, TSnapshot, TEvent>;
  #state: ConnectionState = "connected";

  public constructor(
    identity: ParticipantIdentity,
    role: "host" | "peer",
    token: ReconnectToken,
    delegates: ConnectionDelegates<TAction, TSnapshot, TEvent>,
  ) {
    this.#identity = identity;
    this.#role = role;
    this.#token = token;
    this.#delegates = delegates;
  }

  public get lobby(): LobbyMetadata {
    return this.#delegates.metadata();
  }
  public get participant(): ParticipantIdentity {
    return this.#identity;
  }
  public get role(): "host" | "peer" {
    return this.#role;
  }
  public get reconnectToken(): ReconnectToken {
    return this.#token;
  }

  #assertConnected(): void {
    if (this.#state !== "connected")
      throw new DataProviderError(
        "invalid-lifecycle",
        "Connection is not connected",
      );
  }

  public async submitAction(request: ActionRequest<TAction>): Promise<void> {
    this.#assertConnected();
    await this.#delegates.submit(request);
  }
  public async publishActionResult(result: ActionResult): Promise<void> {
    this.#assertConnected();
    await this.#delegates.publishResult(result);
  }
  public async publishAuthoritative(
    update: AuthoritativeUpdate<TSnapshot, TEvent>,
  ): Promise<void> {
    this.#assertConnected();
    await this.#delegates.publishUpdate(update);
  }
  public async activateLobby(): Promise<void> {
    this.#assertConnected();
    await this.#delegates.activate();
  }

  public subscribe(
    listener: (message: ProviderMessage<TAction, TSnapshot, TEvent>) => void,
  ): Unsubscribe {
    this.#assertConnected();
    this.#listeners.add(listener);
    this.#delegates.replay(listener);
    let subscribed = true;
    return () => {
      if (subscribed) {
        subscribed = false;
        this.#listeners.delete(listener);
      }
    };
  }

  public emit(message: ProviderMessage<TAction, TSnapshot, TEvent>): void {
    if (this.#state !== "connected") return;
    for (const listener of [...this.#listeners]) {
      try {
        listener(immutableCopy(message));
      } catch {
        /* Listener failures do not break transport delivery. */
      }
    }
  }

  public async disconnect(): Promise<void> {
    this.#assertConnected();
    await this.#delegates.disconnect(this);
    if (this.#state === "connected") this.#state = "disconnected";
    this.#listeners.clear();
  }

  public async leave(): Promise<void> {
    if (this.#state === "left") return;
    await this.#delegates.leave(this);
    this.#state = "left";
    this.#listeners.clear();
  }

  public async dispose(): Promise<void> {
    await this.leave();
  }
  public closeFromProvider(): void {
    this.#state = "left";
    this.#listeners.clear();
  }
}
