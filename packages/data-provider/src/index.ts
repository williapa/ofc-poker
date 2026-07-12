export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type LobbyId = string;
export type ParticipantId = string;
export type RequestId = string;
export type ProviderEventId = string;
export type ReconnectToken = string;
export type Unsubscribe = () => void;

export interface LobbySettings {
  readonly schemaVersion: 1;
  readonly seatCount: 2 | 3 | 4;
  readonly mode: "local-ai" | "multiplayer";
  readonly rules: JsonValue;
}

/** Untrusted participant input. The provider, not the caller, assigns identity. */
export interface ParticipantProfile {
  readonly displayName: string;
}

export interface ParticipantIdentity extends ParticipantProfile {
  readonly id: ParticipantId;
}

export interface ParticipantPresence extends ParticipantIdentity {
  readonly connection: "connected" | "disconnected";
}

export interface LobbyMetadata {
  readonly id: LobbyId;
  readonly settings: LobbySettings;
  readonly hostId: ParticipantId;
  readonly participants: readonly ParticipantPresence[];
  readonly status: "waiting" | "active" | "closed";
}

export interface ActionRequest<TAction = JsonValue> {
  readonly requestId: RequestId;
  readonly expectedRevision: number;
  readonly action: TAction;
}

export type ActionResult =
  | { readonly requestId: RequestId; readonly accepted: true }
  | {
      readonly requestId: RequestId;
      readonly accepted: false;
      readonly rejection: JsonValue;
    };

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

export type LobbyClosedReason = "host-left" | "disposed" | "provider-error";

export type ProviderMessage<TAction, TSnapshot, TEvent> =
  | { readonly type: "lobby"; readonly lobby: LobbyMetadata }
  | {
      readonly type: "action-requested";
      readonly senderId: ParticipantId;
      readonly request: ActionRequest<TAction>;
    }
  | { readonly type: "action-result"; readonly result: ActionResult }
  | {
      readonly type: "authoritative-update";
      readonly update: AuthoritativeUpdate<TSnapshot, TEvent>;
    }
  | {
      readonly type: "participant-disconnected";
      readonly participantId: ParticipantId;
    }
  | { readonly type: "connection-lost" }
  | { readonly type: "lobby-closed"; readonly reason: LobbyClosedReason };

export type DataProviderErrorCode =
  | "invalid-settings"
  | "invalid-payload"
  | "lobby-missing"
  | "lobby-closed"
  | "lobby-full"
  | "lobby-active"
  | "invalid-reconnect-token"
  | "invalid-lifecycle"
  | "not-host"
  | "unknown-request"
  | "stale-update"
  | "incompatible-version"
  | "initialization-failed"
  | "provider-disposed"
  | "injected-error";

export class DataProviderError extends Error {
  public constructor(
    public readonly code: DataProviderErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DataProviderError";
  }
}

export interface LobbyConnection<TAction, TSnapshot, TEvent> {
  /** A fresh, deeply immutable view of current lobby metadata. */
  readonly lobby: LobbyMetadata;
  readonly participant: ParticipantIdentity;
  readonly role: "host" | "peer";
  readonly reconnectToken: ReconnectToken;
  submitAction(request: ActionRequest<TAction>): Promise<void>;
  /** Delivers a validation outcome to the original requester. Host-only. */
  publishActionResult(result: ActionResult): Promise<void>;
  publishAuthoritative(
    update: AuthoritativeUpdate<TSnapshot, TEvent>,
  ): Promise<void>;
  /** Closes admission for new participants. Host-only and one-way. */
  activateLobby(): Promise<void>;
  subscribe(
    listener: (message: ProviderMessage<TAction, TSnapshot, TEvent>) => void,
  ): Unsubscribe;
  /** Temporarily disconnects while retaining the participant's reserved seat. */
  disconnect(): Promise<void>;
  /** Permanently leaves. Host departure closes the lobby. */
  leave(): Promise<void>;
  /** Idempotent connection cleanup; equivalent to leave while connected. */
  dispose(): Promise<void>;
}

/** Rules-neutral transport port. Payloads must be JSON-serializable. */
export interface DataProvider<TAction, TSnapshot, TEvent> {
  createLobby(
    settings: LobbySettings,
    participant: ParticipantProfile,
  ): Promise<LobbyConnection<TAction, TSnapshot, TEvent>>;
  joinLobby(
    lobbyId: LobbyId,
    participant: ParticipantProfile,
  ): Promise<LobbyConnection<TAction, TSnapshot, TEvent>>;
  reconnectLobby(
    lobbyId: LobbyId,
    reconnectToken: ReconnectToken,
  ): Promise<LobbyConnection<TAction, TSnapshot, TEvent>>;
  dispose(): Promise<void>;
}

export {
  LocalDataProvider,
  type LocalDataProviderOptions,
  type LocalProviderHook,
  type LocalProviderOperation,
} from "./local-data-provider";
