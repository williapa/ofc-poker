import {
  RPC,
  getParticipants,
  getRoomCode,
  insertCoin,
  isHost,
  myPlayer,
  onDisconnect,
  onPlayerJoin,
  type PlayerState,
} from "playroomkit";

import type { JsonValue, Unsubscribe } from "../index";

export interface PlayroomBoundaryPlayer {
  readonly id: string;
  readonly displayName: string;
}

export interface PlayroomBoundaryMessage {
  readonly payload: JsonValue;
  readonly sender: PlayroomBoundaryPlayer;
}

export interface PlayroomBoundarySession {
  readonly roomCode: string;
  readonly self: PlayroomBoundaryPlayer;
  readonly host: boolean;
  readonly participants: readonly PlayroomBoundaryPlayer[];
  sendToHost(payload: JsonValue): Promise<void>;
  sendToAll(payload: JsonValue): Promise<void>;
  onMessage(listener: (message: PlayroomBoundaryMessage) => void): Unsubscribe;
  onParticipantJoin(
    listener: (player: PlayroomBoundaryPlayer) => void,
  ): Unsubscribe;
  onParticipantQuit(
    listener: (player: PlayroomBoundaryPlayer) => void,
  ): Unsubscribe;
  onDisconnect(listener: () => void): Unsubscribe;
  leave(): Promise<void>;
}

export interface PlayroomBoundaryConnectOptions {
  readonly gameId: string;
  readonly roomCode?: string;
  readonly displayName: string;
  readonly maxPlayers: 2 | 3 | 4;
  readonly reconnectGracePeriodMs: number;
}

export interface PlayroomBoundary {
  connect(
    options: PlayroomBoundaryConnectOptions,
  ): Promise<PlayroomBoundarySession>;
}

const RPC_NAME = "ofcpoker:data-provider:v1";

function playerView(player: PlayerState): PlayroomBoundaryPlayer {
  return {
    id: player.id,
    displayName: player.getProfile().name,
  };
}

/** The only production module that translates Playroom Kit SDK concepts. */
export class PlayroomKitBoundary implements PlayroomBoundary {
  async connect(
    options: PlayroomBoundaryConnectOptions,
  ): Promise<PlayroomBoundarySession> {
    await insertCoin({
      gameId: options.gameId,
      ...(options.roomCode ? { roomCode: options.roomCode } : {}),
      skipLobby: true,
      maxPlayersPerRoom: options.maxPlayers,
      reconnectGracePeriod: options.reconnectGracePeriodMs,
      defaultPlayerStates: {
        ofcpokerDisplayName: options.displayName,
      },
    });

    const roomCode = getRoomCode();
    if (!roomCode) throw new Error("Playroom did not provide a room code");
    return new PlayroomKitSession(roomCode);
  }
}

class PlayroomKitSession implements PlayroomBoundarySession {
  readonly #messageListeners = new Set<
    (message: PlayroomBoundaryMessage) => void
  >();
  readonly #joinListeners = new Set<(player: PlayroomBoundaryPlayer) => void>();
  readonly #quitListeners = new Set<(player: PlayroomBoundaryPlayer) => void>();
  readonly #disconnectListeners = new Set<() => void>();
  readonly #cleanup: Unsubscribe[] = [];
  readonly #roomCode: string;
  #left = false;

  constructor(roomCode: string) {
    this.#roomCode = roomCode;
    this.#cleanup.push(
      RPC.register(RPC_NAME, async (payload, sender) => {
        const message = {
          payload: payload as JsonValue,
          sender: playerView(sender),
        };
        for (const listener of [...this.#messageListeners]) listener(message);
      }),
      onPlayerJoin((player) => {
        const view = playerView(player);
        for (const listener of [...this.#joinListeners]) listener(view);
        this.#cleanup.push(
          player.onQuit((quittingPlayer) => {
            const quittingView = playerView(quittingPlayer);
            for (const listener of [...this.#quitListeners])
              listener(quittingView);
          }),
        );
      }),
      onDisconnect(() => {
        for (const listener of [...this.#disconnectListeners]) listener();
      }),
    );
  }

  get roomCode(): string {
    return this.#roomCode;
  }

  get self(): PlayroomBoundaryPlayer {
    return playerView(myPlayer());
  }

  get host(): boolean {
    return isHost();
  }

  get participants(): readonly PlayroomBoundaryPlayer[] {
    return Object.values(getParticipants()).map(playerView);
  }

  async sendToHost(payload: JsonValue): Promise<void> {
    await RPC.call(RPC_NAME, payload, RPC.Mode.HOST);
  }

  async sendToAll(payload: JsonValue): Promise<void> {
    await RPC.call(RPC_NAME, payload, RPC.Mode.ALL);
  }

  onMessage(listener: (message: PlayroomBoundaryMessage) => void): Unsubscribe {
    this.#messageListeners.add(listener);
    return () => this.#messageListeners.delete(listener);
  }

  onParticipantJoin(
    listener: (player: PlayroomBoundaryPlayer) => void,
  ): Unsubscribe {
    this.#joinListeners.add(listener);
    return () => this.#joinListeners.delete(listener);
  }

  onParticipantQuit(
    listener: (player: PlayroomBoundaryPlayer) => void,
  ): Unsubscribe {
    this.#quitListeners.add(listener);
    return () => this.#quitListeners.delete(listener);
  }

  onDisconnect(listener: () => void): Unsubscribe {
    this.#disconnectListeners.add(listener);
    return () => this.#disconnectListeners.delete(listener);
  }

  async leave(): Promise<void> {
    if (this.#left) return;
    this.#left = true;
    for (const cleanup of this.#cleanup.splice(0)) cleanup();
    this.#messageListeners.clear();
    this.#joinListeners.clear();
    this.#quitListeners.clear();
    this.#disconnectListeners.clear();
    await myPlayer().leaveRoom();
  }
}
