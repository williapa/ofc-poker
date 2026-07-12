import type { JsonValue, Unsubscribe } from "../src/index";
import type {
  PlayroomBoundary,
  PlayroomBoundaryConnectOptions,
  PlayroomBoundaryMessage,
  PlayroomBoundaryPlayer,
  PlayroomBoundarySession,
} from "../src/playroom/index";

interface FakeRoom {
  readonly code: string;
  readonly sessions: Map<string, FakePlayroomSession>;
  readonly hostId: string;
  readonly broadcasts: JsonValue[];
}

export class FakePlayroomBoundary implements PlayroomBoundary {
  readonly #rooms = new Map<string, FakeRoom>();
  #sequence = 0;
  connectCount = 0;

  get broadcastPayloads(): readonly JsonValue[] {
    return [...this.#rooms.values()].flatMap((room) => room.broadcasts);
  }

  async connect(
    options: PlayroomBoundaryConnectOptions,
  ): Promise<PlayroomBoundarySession> {
    this.connectCount += 1;
    let room = options.roomCode ? this.#rooms.get(options.roomCode) : undefined;
    if (options.roomCode && !room) throw new Error("ROOM_MISSING");
    const id = `sdk-player-${++this.#sequence}`;
    if (!room) {
      const code = `ROOM-${this.#sequence}`;
      room = { code, sessions: new Map(), hostId: id, broadcasts: [] };
      this.#rooms.set(code, room);
    }
    const session = new FakePlayroomSession(room, {
      id,
      displayName: options.displayName,
    });
    const existing = [...room.sessions.values()];
    room.sessions.set(id, session);
    for (const peer of existing) peer.emitJoin(session.self);
    return session;
  }
}

class FakePlayroomSession implements PlayroomBoundarySession {
  readonly #room: FakeRoom;
  readonly #self: PlayroomBoundaryPlayer;
  readonly #messageListeners = new Set<
    (message: PlayroomBoundaryMessage) => void
  >();
  readonly #joinListeners = new Set<(player: PlayroomBoundaryPlayer) => void>();
  readonly #quitListeners = new Set<(player: PlayroomBoundaryPlayer) => void>();
  readonly #disconnectListeners = new Set<() => void>();
  #left = false;

  constructor(room: FakeRoom, self: PlayroomBoundaryPlayer) {
    this.#room = room;
    this.#self = self;
  }

  get roomCode(): string {
    return this.#room.code;
  }
  get self(): PlayroomBoundaryPlayer {
    return this.#self;
  }
  get host(): boolean {
    return this.#room.hostId === this.#self.id;
  }
  get participants(): readonly PlayroomBoundaryPlayer[] {
    return [...this.#room.sessions.values()].map((session) => session.self);
  }

  async sendToHost(payload: JsonValue): Promise<void> {
    this.#room.sessions
      .get(this.#room.hostId)
      ?.emitMessage({ payload, sender: this.#self });
  }

  async sendToAll(payload: JsonValue): Promise<void> {
    this.#room.broadcasts.push(payload);
    for (const session of this.#room.sessions.values())
      session.emitMessage({ payload, sender: this.#self });
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

  emitMessage(message: PlayroomBoundaryMessage): void {
    for (const listener of [...this.#messageListeners]) listener(message);
  }
  emitJoin(player: PlayroomBoundaryPlayer): void {
    for (const listener of [...this.#joinListeners]) listener(player);
  }

  async leave(): Promise<void> {
    if (this.#left) return;
    this.#left = true;
    this.#room.sessions.delete(this.#self.id);
    for (const session of this.#room.sessions.values())
      session.emitQuit(this.#self);
    this.#messageListeners.clear();
    this.#joinListeners.clear();
    this.#quitListeners.clear();
    this.#disconnectListeners.clear();
  }

  private emitQuit(player: PlayroomBoundaryPlayer): void {
    for (const listener of [...this.#quitListeners]) listener(player);
  }
}
