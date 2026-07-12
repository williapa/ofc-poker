import type { OfcHandAction, OfcHandEvent } from "@ofcpoker/game-engine";
import { afterEach, expect, test, vi } from "vitest";
import type { OfcRunnerSnapshot } from "../src/contracts/game-runner";
import { createBrowserProviderFactory } from "../src/providers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("@ofcpoker/data-provider/playroom");
});

test("creates and plays local AI lobbies without loading Playroom or using network APIs", async () => {
  const playroomModuleFactory = vi.fn(() => ({
    PlayroomDataProvider: vi.fn(),
  }));
  vi.doMock("@ofcpoker/data-provider/playroom", playroomModuleFactory);
  const webSocket = vi.fn();
  const fetch = vi.fn();
  vi.stubGlobal("WebSocket", webSocket);
  vi.stubGlobal("fetch", fetch);

  const { LocalDataProvider } = await import("@ofcpoker/data-provider");
  const localProvider = vi.fn(
    () =>
      new LocalDataProvider<OfcHandAction, OfcRunnerSnapshot, OfcHandEvent>(),
  );
  const factory = createBrowserProviderFactory({
    playroomGameId: "must-not-be-used",
    localProvider,
  });
  const provider = await factory.create("local-ai");
  const connection = await provider.createLobby(
    {
      schemaVersion: 1,
      mode: "local-ai",
      seatCount: 2,
      rules: {
        variant: "standard-ofc",
        fantasyland: true,
        tiedRowPoints: 0,
      },
    },
    { displayName: "Ada" },
  );

  expect(connection.lobby.status).toBe("waiting");
  expect(localProvider).toHaveBeenCalledTimes(1);
  expect(playroomModuleFactory).not.toHaveBeenCalled();
  expect(webSocket).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();

  await connection.dispose();
  await provider.dispose();
});
