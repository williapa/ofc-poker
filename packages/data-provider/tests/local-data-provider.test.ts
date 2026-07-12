import { describe, expect, test, vi } from "vitest";
import { DataProviderError, LocalDataProvider } from "../src/index";
import { dataProviderContract, type TestProvider } from "./contract";

dataProviderContract("local", () => new LocalDataProvider() as TestProvider);

describe("LocalDataProvider options", () => {
  test("uses an injected deterministic ID factory", async () => {
    const counts = { lobby: 0, participant: 0, token: 0 };
    const provider = new LocalDataProvider({
      idFactory: (kind) => `${kind}-${++counts[kind]}`,
    });
    const host = await provider.createLobby(
      { schemaVersion: 1, seatCount: 2, mode: "local-ai", rules: {} },
      { displayName: "Host" },
    );
    expect(host.lobby.id).toBe("lobby-1");
    expect(host.participant.id).toBe("participant-1");
    expect(host.reconnectToken).toBe("token-1");
  });

  test("applies injected latency and wraps injected failures", async () => {
    vi.useFakeTimers();
    const operations: string[] = [];
    const provider = new LocalDataProvider({
      latencyMs: 25,
      beforeOperation: ({ operation }) => {
        operations.push(operation);
        if (operation === "join") throw new Error("offline");
      },
    });
    const creating = provider.createLobby(
      { schemaVersion: 1, seatCount: 2, mode: "local-ai", rules: {} },
      { displayName: "Host" },
    );
    await vi.advanceTimersByTimeAsync(25);
    const host = await creating;
    const joining = provider.joinLobby(host.lobby.id, { displayName: "Peer" });
    const rejection = expect(joining).rejects.toMatchObject({
      code: "injected-error",
    });
    await vi.advanceTimersByTimeAsync(25);
    await rejection;
    expect(operations).toEqual(["create", "join"]);
    vi.useRealTimers();
  });

  test("rejects non-JSON payloads before delivery", async () => {
    const provider = new LocalDataProvider<unknown>();
    const host = await provider.createLobby(
      { schemaVersion: 1, seatCount: 2, mode: "local-ai", rules: {} },
      { displayName: "Host" },
    );
    await expect(
      host.submitAction({ requestId: "bad", expectedRevision: 0, action: 1n }),
    ).rejects.toBeInstanceOf(DataProviderError);
  });
});
