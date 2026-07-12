import { beforeEach, describe, expect, test } from "vitest";
import {
  createBrowserLobbySessionStore,
  createMemoryLobbySessionStore,
} from "../src/reconnect";

describe("lobby session reconnect storage", () => {
  beforeEach(() => window.sessionStorage.clear());

  test("round-trips a session-scoped capability and removes it permanently", () => {
    const store = createBrowserLobbySessionStore(window.sessionStorage);
    const session = {
      schemaVersion: 1 as const,
      lobbyId: "ROOM-7",
      reconnectToken: "private-token",
      role: "peer" as const,
    };

    store.save(session);
    expect(store.load(session.lobbyId)).toEqual(session);
    expect(window.sessionStorage.length).toBe(1);
    store.remove(session.lobbyId);
    expect(store.load(session.lobbyId)).toBeUndefined();
  });

  test("discards malformed or incompatible saved data", () => {
    window.sessionStorage.setItem(
      "ofcpoker:lobby-session:v1:ROOM-OLD",
      JSON.stringify({
        schemaVersion: 2,
        lobbyId: "ROOM-OLD",
        reconnectToken: "old-token",
        role: "peer",
      }),
    );
    const store = createBrowserLobbySessionStore(window.sessionStorage);

    expect(store.load("ROOM-OLD")).toBeUndefined();
    expect(window.sessionStorage.length).toBe(0);
  });

  test("supports an injected in-memory store without browser globals", () => {
    const store = createMemoryLobbySessionStore();
    store.save({
      schemaVersion: 1,
      lobbyId: "ROOM-HOST",
      reconnectToken: "host-token",
      role: "host",
    });
    expect(store.load("ROOM-HOST")?.role).toBe("host");
  });
});
