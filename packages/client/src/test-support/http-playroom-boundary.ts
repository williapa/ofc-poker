import type {
  PlayroomBoundary,
  PlayroomBoundaryConnectOptions,
  PlayroomBoundaryMessage,
  PlayroomBoundaryPlayer,
  PlayroomBoundarySession,
} from "@ofcpoker/data-provider/playroom";
import type { JsonValue } from "@ofcpoker/data-provider";

type Event =
  | { readonly type: "message"; readonly message: PlayroomBoundaryMessage }
  | { readonly type: "join"; readonly player: PlayroomBoundaryPlayer }
  | { readonly type: "quit"; readonly player: PlayroomBoundaryPlayer }
  | { readonly type: "disconnect" };

interface Connected {
  readonly sessionId: string;
  readonly roomCode: string;
  readonly self: PlayroomBoundaryPlayer;
  readonly host: boolean;
  readonly participants: readonly PlayroomBoundaryPlayer[];
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL}__e2e/${path}`, {
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(
      result.error ?? `E2E transport failed (${response.status})`,
    );
  return result;
}

class HttpSession implements PlayroomBoundarySession {
  readonly #listeners = {
    message: new Set<(value: PlayroomBoundaryMessage) => void>(),
    join: new Set<(value: PlayroomBoundaryPlayer) => void>(),
    quit: new Set<(value: PlayroomBoundaryPlayer) => void>(),
    disconnect: new Set<() => void>(),
  };
  #active = true;
  #participants: readonly PlayroomBoundaryPlayer[];

  constructor(readonly connected: Connected) {
    this.#participants = connected.participants;
    void this.#poll();
  }
  get roomCode() {
    return this.connected.roomCode;
  }
  get self() {
    return this.connected.self;
  }
  get host() {
    return this.connected.host;
  }
  get participants() {
    return this.#participants;
  }
  async sendToHost(payload: JsonValue) {
    await request("send", {
      sessionId: this.connected.sessionId,
      target: "host",
      payload,
    });
  }
  async sendToAll(payload: JsonValue) {
    await request("send", {
      sessionId: this.connected.sessionId,
      target: "all",
      payload,
    });
  }
  onMessage(listener: (value: PlayroomBoundaryMessage) => void) {
    this.#listeners.message.add(listener);
    return () => this.#listeners.message.delete(listener);
  }
  onParticipantJoin(listener: (value: PlayroomBoundaryPlayer) => void) {
    this.#listeners.join.add(listener);
    return () => this.#listeners.join.delete(listener);
  }
  onParticipantQuit(listener: (value: PlayroomBoundaryPlayer) => void) {
    this.#listeners.quit.add(listener);
    return () => this.#listeners.quit.delete(listener);
  }
  onDisconnect(listener: () => void) {
    this.#listeners.disconnect.add(listener);
    return () => this.#listeners.disconnect.delete(listener);
  }
  async leave() {
    if (!this.#active) return;
    this.#active = false;
    await request("leave", { sessionId: this.connected.sessionId });
  }
  async #poll(): Promise<void> {
    while (this.#active) {
      try {
        const { events } = await request<{ events: readonly Event[] }>(
          `poll?sessionId=${encodeURIComponent(this.connected.sessionId)}`,
        );
        if (events.length === 0)
          await new Promise((resolve) => setTimeout(resolve, 10));
        for (const event of events) {
          if (event.type === "join")
            this.#participants = [...this.#participants, event.player];
          if (event.type === "quit")
            this.#participants = this.#participants.filter(
              ({ id }) => id !== event.player.id,
            );
          const listeners = this.#listeners[event.type];
          const value =
            event.type === "message"
              ? event.message
              : event.type === "disconnect"
                ? undefined
                : event.player;
          for (const listener of [...listeners] as Array<
            (arg?: unknown) => void
          >)
            listener(value);
        }
      } catch {
        if (this.#active)
          await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }
}

export class HttpPlayroomBoundary implements PlayroomBoundary {
  async connect(
    options: PlayroomBoundaryConnectOptions,
  ): Promise<PlayroomBoundarySession> {
    return new HttpSession(await request<Connected>("connect", options));
  }
}
