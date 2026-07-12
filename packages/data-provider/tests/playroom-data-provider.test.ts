import { describe, expect, test } from "vitest";
import {
  DataProviderError,
  type JsonValue,
  type LobbySettings,
} from "../src/index";
import {
  PlayroomDataProvider,
  createPlayroomLobbyLink,
  type PlayroomBoundary,
} from "../src/playroom/index";
import { dataProviderContract, type TestProvider } from "./contract";
import { FakePlayroomBoundary } from "./fake-playroom-boundary";

function provider(
  boundary: PlayroomBoundary = new FakePlayroomBoundary(),
): PlayroomDataProvider {
  let token = 0;
  return new PlayroomDataProvider({
    gameId: "public-test-game",
    boundary,
    tokenFactory: () => `secret-token-${++token}`,
    handshakeTimeoutMs: 100,
  });
}

dataProviderContract(
  "playroom fake boundary",
  () => provider(new FakePlayroomBoundary()) as unknown as TestProvider,
);

describe("PlayroomDataProvider adapter", () => {
  const settings: LobbySettings = {
    schemaVersion: 1,
    seatCount: 2,
    mode: "multiplayer",
    rules: { fantasyland: true },
  };

  test("requires public configuration without embedding a credential", () => {
    expect(() => new PlayroomDataProvider({ gameId: "" })).toThrowError(
      DataProviderError,
    );
  });

  test("connects once for each explicit lifecycle operation", async () => {
    const boundary = new FakePlayroomBoundary();
    const dataProvider = provider(boundary);
    const host = await dataProvider.createLobby(settings, {
      displayName: "Host",
    });
    expect(boundary.connectCount).toBe(1);
    const peer = await dataProvider.joinLobby(host.lobby.id, {
      displayName: "Peer",
    });
    expect(boundary.connectCount).toBe(2);
    const token = peer.reconnectToken;
    await peer.disconnect();
    await dataProvider.reconnectLobby(host.lobby.id, token);
    expect(boundary.connectCount).toBe(3);
    await dataProvider.dispose();
  });

  test("prevents repeated SDK initialization for one browser provider", async () => {
    const boundary = new FakePlayroomBoundary();
    const dataProvider = new PlayroomDataProvider({
      gameId: "public-test-game",
      boundary,
      singleSession: true,
    });
    await dataProvider.createLobby(settings, { displayName: "Host" });
    await expect(
      dataProvider.createLobby(settings, { displayName: "Duplicate" }),
    ).rejects.toMatchObject({ code: "invalid-lifecycle" });
    expect(boundary.connectCount).toBe(1);
    await dataProvider.dispose();
  });

  test("creates repository-page-safe links and excludes reconnect capabilities", () => {
    expect(
      createPlayroomLobbyLink(
        "https://example.test/ofcpoker/?old=value#fragment",
        "A B/C",
      ),
    ).toBe("https://example.test/ofcpoker/?lobby=A+B%2FC");
  });

  test("never broadcasts reconnect capability tokens", async () => {
    const boundary = new FakePlayroomBoundary();
    const dataProvider = provider(boundary);
    const host = await dataProvider.createLobby(settings, {
      displayName: "Host",
    });
    const peer = await dataProvider.joinLobby(host.lobby.id, {
      displayName: "Peer",
    });
    expect(JSON.stringify(boundary.broadcastPayloads)).not.toContain(
      peer.reconnectToken,
    );
    await dataProvider.dispose();
  });

  test("rejects local-only settings", async () => {
    await expect(
      provider().createLobby(
        { ...settings, mode: "local-ai" },
        { displayName: "Host" },
      ),
    ).rejects.toMatchObject({ code: "invalid-settings" });
  });

  test("distinguishes a missing room from SDK initialization failure", async () => {
    const missing = provider(new FakePlayroomBoundary());
    await expect(
      missing.joinLobby("DOES-NOT-EXIST", { displayName: "Peer" }),
    ).rejects.toMatchObject({ code: "lobby-missing" });

    const failed = provider({
      connect: async () => {
        throw new Error("SDK_BOOT_FAILED");
      },
    });
    await expect(
      failed.joinLobby("ROOM-1", { displayName: "Peer" }),
    ).rejects.toMatchObject({ code: "initialization-failed" });
  });

  test("rejects an incompatible host protocol before exposing a connection", async () => {
    const boundary = new FakePlayroomBoundary();
    const dataProvider = provider(boundary);
    const host = await dataProvider.createLobby(settings, {
      displayName: "Host",
    });
    boundary.transformBroadcast = (payload) => {
      const record = payload as { readonly [key: string]: JsonValue };
      if (
        typeof payload === "object" &&
        payload !== null &&
        !Array.isArray(payload) &&
        record.kind === "welcome" &&
        record.accepted === true
      ) {
        return {
          ...record,
          lobby: { ...(record.lobby as object), schemaVersion: 99 },
        } as JsonValue;
      }
      return payload;
    };

    await expect(
      dataProvider.joinLobby(host.lobby.id, { displayName: "Peer" }),
    ).rejects.toMatchObject({ code: "incompatible-version" });
    await dataProvider.dispose();
  });

  test("reports unexpected peer disconnects before cleaning listeners", async () => {
    const boundary = new FakePlayroomBoundary();
    const dataProvider = provider(boundary);
    const host = await dataProvider.createLobby(settings, {
      displayName: "Host",
    });
    const peer = await dataProvider.joinLobby(host.lobby.id, {
      displayName: "Peer",
    });
    const messages: string[] = [];
    peer.subscribe((message) => messages.push(message.type));

    boundary.disconnect(peer.participant.id);

    expect(messages).toContain("connection-lost");
    await dataProvider.dispose();
  });
});
