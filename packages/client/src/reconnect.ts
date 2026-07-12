import type { ReconnectToken } from "@ofcpoker/data-provider";

export interface SavedLobbySession {
  readonly schemaVersion: 1;
  readonly lobbyId: string;
  readonly reconnectToken: ReconnectToken;
  readonly role: "host" | "peer";
}

export interface LobbySessionStore {
  load(lobbyId: string): SavedLobbySession | undefined;
  save(session: SavedLobbySession): void;
  remove(lobbyId: string): void;
}

const KEY_PREFIX = "ofcpoker:lobby-session:v1:";

function key(lobbyId: string): string {
  return `${KEY_PREFIX}${lobbyId}`;
}

export function createBrowserLobbySessionStore(
  storage: Storage = window.sessionStorage,
): LobbySessionStore {
  return {
    load(lobbyId) {
      const serialized = storage.getItem(key(lobbyId));
      if (!serialized) return undefined;
      try {
        const value = JSON.parse(serialized) as Partial<SavedLobbySession>;
        if (
          value.schemaVersion !== 1 ||
          value.lobbyId !== lobbyId ||
          typeof value.reconnectToken !== "string" ||
          (value.role !== "host" && value.role !== "peer")
        ) {
          storage.removeItem(key(lobbyId));
          return undefined;
        }
        return value as SavedLobbySession;
      } catch {
        storage.removeItem(key(lobbyId));
        return undefined;
      }
    },
    save(session) {
      storage.setItem(key(session.lobbyId), JSON.stringify(session));
    },
    remove(lobbyId) {
      storage.removeItem(key(lobbyId));
    },
  };
}

export function createMemoryLobbySessionStore(): LobbySessionStore {
  const sessions = new Map<string, SavedLobbySession>();
  return {
    load: (lobbyId) => sessions.get(lobbyId),
    save: (session) => sessions.set(session.lobbyId, session),
    remove: (lobbyId) => sessions.delete(lobbyId),
  };
}
