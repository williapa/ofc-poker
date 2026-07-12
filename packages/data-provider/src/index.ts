export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type LobbyId = string;
export type ParticipantId = string;
export type RequestId = string;
export type ProviderEventId = string;
export type Unsubscribe = () => void;

export interface LobbySettings {
  readonly schemaVersion: 1;
  readonly seatCount: 2 | 3 | 4;
  readonly mode: "local-ai" | "multiplayer";
  readonly rules: JsonValue;
}

export interface ParticipantIdentity {
  readonly id: ParticipantId;
  readonly displayName: string;
}

export interface LobbyMetadata {
  readonly id: LobbyId;
  readonly settings: LobbySettings;
  readonly hostId: ParticipantId;
  readonly participants: readonly ParticipantIdentity[];
  readonly status: "waiting" | "active" | "closed";
}

export interface ActionRequest<TAction = JsonValue> {
  readonly requestId: RequestId;
  readonly expectedRevision: number;
  readonly action: TAction;
}

export interface AuthoritativeUpdate<
  TSnapshot = JsonValue,
  TEvent = JsonValue,
> {
  readonly eventId: ProviderEventId;
  readonly revision: number;
  readonly causationId?: RequestId;
  readonly snapshot: TSnapshot;
  readonly events: readonly TEvent[];
}

export type ProviderMessage<TAction, TSnapshot, TEvent> =
  | { readonly type: "lobby"; readonly lobby: LobbyMetadata }
  | { readonly type: "action-requested"; readonly senderId: ParticipantId; readonly request: ActionRequest<TAction> }
  | { readonly type: "authoritative-update"; readonly update: AuthoritativeUpdate<TSnapshot, TEvent> }
  | { readonly type: "participant-disconnected"; readonly participantId: ParticipantId }
  | { readonly type: "lobby-closed"; readonly reason: "host-left" | "disposed" | "provider-error" };

export interface LobbyConnection<TAction, TSnapshot, TEvent> {
  readonly lobby: LobbyMetadata;
  readonly participant: ParticipantIdentity;
  readonly role: "host" | "peer";
  readonly reconnectToken: string;
  submitAction(request: ActionRequest<TAction>): Promise<void>;
  publishAuthoritative(update: AuthoritativeUpdate<TSnapshot, TEvent>): Promise<void>;
  subscribe(listener: (message: ProviderMessage<TAction, TSnapshot, TEvent>) => void): Unsubscribe;
  disconnect(): Promise<void>;
  dispose(): Promise<void>;
}

/** Rules-neutral transport port. Generic payloads must be JSON-serializable at the adapter boundary. */
export interface DataProvider<TAction, TSnapshot, TEvent> {
  createLobby(settings: LobbySettings, participant: ParticipantIdentity): Promise<LobbyConnection<TAction, TSnapshot, TEvent>>;
  joinLobby(lobbyId: LobbyId, participant: ParticipantIdentity): Promise<LobbyConnection<TAction, TSnapshot, TEvent>>;
  reconnectLobby(lobbyId: LobbyId, reconnectToken: string): Promise<LobbyConnection<TAction, TSnapshot, TEvent>>;
  dispose(): Promise<void>;
}
