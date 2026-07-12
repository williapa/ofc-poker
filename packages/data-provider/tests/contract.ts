import { describe, expect, test } from "vitest";
import {
  DataProviderError,
  type AuthoritativeUpdate,
  type DataProvider,
  type LobbyConnection,
  type LobbySettings,
  type ProviderMessage,
} from "../src/index";

type TestAction = { readonly kind: "place"; readonly card: string };
type TestSnapshot = { readonly revision: number; readonly phase: string };
type TestEvent = { readonly kind: "placed"; readonly card: string };
type TestProvider = DataProvider<TestAction, TestSnapshot, TestEvent>;
type TestConnection = LobbyConnection<TestAction, TestSnapshot, TestEvent>;

const settings = (seatCount: 2 | 3 | 4 = 2): LobbySettings => ({
  schemaVersion: 1,
  seatCount,
  mode: "local-ai",
  rules: { fantasyland: true, tiedRows: 0 },
});

const update = (
  eventId: string,
  revision: number,
): AuthoritativeUpdate<TestSnapshot, TestEvent> => ({
  eventId,
  revision,
  snapshot: { revision, phase: "placing" },
  events: [{ kind: "placed", card: "As" }],
});

function collect(connection: TestConnection): {
  readonly messages: ProviderMessage<TestAction, TestSnapshot, TestEvent>[];
  readonly unsubscribe: () => void;
} {
  const messages: ProviderMessage<TestAction, TestSnapshot, TestEvent>[] = [];
  return {
    messages,
    unsubscribe: connection.subscribe((message) => messages.push(message)),
  };
}

function errorCode(error: unknown): string | undefined {
  return error instanceof DataProviderError ? error.code : undefined;
}

/** Reusable behavioral suite for local and future remote provider adapters. */
export function dataProviderContract(
  name: string,
  createProvider: () => TestProvider,
): void {
  describe(`${name} data-provider contract`, () => {
    test("assigns trusted deterministic identities and exposes immutable settings", async () => {
      const provider = createProvider();
      const candidate = settings(3);
      const host = await provider.createLobby(candidate, {
        displayName: "Host",
      });
      (candidate.rules as { fantasyland: boolean }).fantasyland = false;
      const peer = await provider.joinLobby(host.lobby.id, {
        displayName: "Peer",
      });

      expect(host.role).toBe("host");
      expect(peer.role).toBe("peer");
      expect(peer.participant.id).not.toBe(host.participant.id);
      expect(peer.lobby.settings).toEqual(settings(3));
      expect(Object.isFrozen(peer.lobby.settings)).toBe(true);
      expect(
        peer.lobby.participants.map((participant) => participant.connection),
      ).toEqual(["connected", "connected"]);
      await provider.dispose();
    });

    test.each([2, 3, 4] as const)(
      "supports %i clients and enforces fixed capacity",
      async (seatCount) => {
        const provider = createProvider();
        const host = await provider.createLobby(settings(seatCount), {
          displayName: "P1",
        });
        const connections = [host];
        for (let index = 1; index < seatCount; index += 1) {
          connections.push(
            await provider.joinLobby(host.lobby.id, {
              displayName: `P${index + 1}`,
            }),
          );
        }
        expect(connections.at(-1)?.lobby.participants).toHaveLength(seatCount);
        await expect(
          provider.joinLobby(host.lobby.id, { displayName: "Extra" }),
        ).rejects.toSatisfy(
          (error: unknown) => errorCode(error) === "lobby-full",
        );
        await provider.dispose();
      },
    );

    test("routes trusted action requests and validation results exactly once", async () => {
      const provider = createProvider();
      const host = await provider.createLobby(settings(), {
        displayName: "Host",
      });
      const peer = await provider.joinLobby(host.lobby.id, {
        displayName: "Peer",
      });
      const hostFeed = collect(host);
      const peerFeed = collect(peer);
      const request = {
        requestId: "request-1",
        expectedRevision: 0,
        action: { kind: "place" as const, card: "As" },
      };

      await peer.submitAction(request);
      await peer.submitAction(request);
      const routed = hostFeed.messages.filter(
        (message) => message.type === "action-requested",
      );
      expect(routed).toEqual([
        { type: "action-requested", senderId: peer.participant.id, request },
      ]);

      await host.publishActionResult({
        requestId: request.requestId,
        accepted: false,
        rejection: { code: "out-of-turn" },
      });
      await host.publishActionResult({
        requestId: request.requestId,
        accepted: true,
      });
      expect(
        peerFeed.messages.filter((message) => message.type === "action-result"),
      ).toHaveLength(1);
      await peer.submitAction(request);
      expect(
        peerFeed.messages.filter((message) => message.type === "action-result"),
      ).toHaveLength(2);
      await provider.dispose();
    });

    test("enforces host authority and idempotent monotonic updates", async () => {
      const provider = createProvider();
      const host = await provider.createLobby(settings(), {
        displayName: "Host",
      });
      const peer = await provider.joinLobby(host.lobby.id, {
        displayName: "Peer",
      });
      const peerFeed = collect(peer);

      await expect(
        peer.publishAuthoritative(update("event-1", 1)),
      ).rejects.toSatisfy((error: unknown) => errorCode(error) === "not-host");
      await host.publishAuthoritative(update("event-1", 1));
      await host.publishAuthoritative(update("event-1", 999));
      await expect(
        host.publishAuthoritative(update("event-2", 1)),
      ).rejects.toSatisfy(
        (error: unknown) => errorCode(error) === "stale-update",
      );
      expect(
        peerFeed.messages.filter(
          (message) => message.type === "authoritative-update",
        ),
      ).toHaveLength(1);
      await provider.dispose();
    });

    test("replays metadata and the latest snapshot to late joiners and reconnects", async () => {
      const provider = createProvider();
      const host = await provider.createLobby(settings(3), {
        displayName: "Host",
      });
      await host.publishAuthoritative(update("waiting-1", 0));
      const peer = await provider.joinLobby(host.lobby.id, {
        displayName: "Peer",
      });
      const firstFeed = collect(peer);
      expect(firstFeed.messages.map((message) => message.type)).toEqual([
        "lobby",
        "authoritative-update",
      ]);

      const token = peer.reconnectToken;
      await peer.disconnect();
      expect(
        host.lobby.participants.find(
          (participant) => participant.id === peer.participant.id,
        )?.connection,
      ).toBe("disconnected");
      const reconnected = await provider.reconnectLobby(host.lobby.id, token);
      expect(reconnected.participant).toEqual(peer.participant);
      expect(
        collect(reconnected).messages.map((message) => message.type),
      ).toEqual(["lobby", "authoritative-update"]);
      await provider.dispose();
    });

    test("reserves disconnected seats, allows permanent peer leave, and removes subscriptions safely", async () => {
      const provider = createProvider();
      const host = await provider.createLobby(settings(), {
        displayName: "Host",
      });
      const peer = await provider.joinLobby(host.lobby.id, {
        displayName: "Peer",
      });
      const hostFeed = collect(host);
      hostFeed.unsubscribe();
      hostFeed.unsubscribe();
      await peer.disconnect();
      await expect(
        provider.joinLobby(host.lobby.id, { displayName: "Blocked" }),
      ).rejects.toSatisfy(
        (error: unknown) => errorCode(error) === "lobby-full",
      );
      await peer.leave();
      const replacement = await provider.joinLobby(host.lobby.id, {
        displayName: "Replacement",
      });
      expect(replacement.lobby.participants).toHaveLength(2);
      expect(hostFeed.messages).toHaveLength(1);
      await provider.dispose();
    });

    test("rejects new joins after activation but permits reserved reconnect", async () => {
      const provider = createProvider();
      const host = await provider.createLobby(settings(3), {
        displayName: "Host",
      });
      const peer = await provider.joinLobby(host.lobby.id, {
        displayName: "Peer",
      });
      const token = peer.reconnectToken;
      await peer.disconnect();
      await host.activateLobby();
      await expect(
        provider.joinLobby(host.lobby.id, { displayName: "Late" }),
      ).rejects.toSatisfy(
        (error: unknown) => errorCode(error) === "lobby-active",
      );
      await expect(
        provider.reconnectLobby(host.lobby.id, token),
      ).resolves.toBeDefined();
      await expect(host.activateLobby()).rejects.toSatisfy(
        (error: unknown) => errorCode(error) === "invalid-lifecycle",
      );
      await provider.dispose();
    });

    test("closes on host departure and distinguishes closed from missing lobbies", async () => {
      const provider = createProvider();
      const host = await provider.createLobby(settings(), {
        displayName: "Host",
      });
      const peer = await provider.joinLobby(host.lobby.id, {
        displayName: "Peer",
      });
      const peerFeed = collect(peer);
      const lobbyId = host.lobby.id;
      const token = peer.reconnectToken;
      await host.disconnect();
      expect(peerFeed.messages.at(-1)).toEqual({
        type: "lobby-closed",
        reason: "host-left",
      });
      await expect(provider.reconnectLobby(lobbyId, token)).rejects.toSatisfy(
        (error: unknown) => errorCode(error) === "lobby-closed",
      );
      await expect(
        provider.joinLobby("never-created", { displayName: "Peer" }),
      ).rejects.toSatisfy(
        (error: unknown) => errorCode(error) === "lobby-missing",
      );
      await provider.dispose();
    });

    test("disposes connections and providers idempotently", async () => {
      const provider = createProvider();
      const host = await provider.createLobby(settings(), {
        displayName: "Host",
      });
      await host.dispose();
      await host.dispose();
      await provider.dispose();
      await provider.dispose();
      await expect(
        provider.createLobby(settings(), { displayName: "Nope" }),
      ).rejects.toSatisfy(
        (error: unknown) => errorCode(error) === "provider-disposed",
      );
    });
  });
}

export type { TestProvider };
