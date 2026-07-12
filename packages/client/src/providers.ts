import { LocalDataProvider, type DataProvider } from "@ofcpoker/data-provider";
import type { OfcHandAction, OfcHandEvent } from "@ofcpoker/game-engine";
import type { OfcRunnerSnapshot } from "./contracts/game-runner";
import type { LobbyMode } from "./lobby";

export type ClientDataProvider = DataProvider<
  OfcHandAction,
  OfcRunnerSnapshot,
  OfcHandEvent
>;

export interface ProviderFactory {
  create(mode: LobbyMode): Promise<ClientDataProvider>;
}

export interface BrowserProviderFactoryOptions {
  readonly playroomGameId?: string;
  readonly localProvider?: () => ClientDataProvider;
}

/** Composition root: UI components never select or initialize provider SDKs. */
export function createBrowserProviderFactory(
  options: BrowserProviderFactoryOptions = {},
): ProviderFactory {
  return {
    async create(mode) {
      if (mode === "local-ai") {
        return options.localProvider?.() ?? new LocalDataProvider();
      }

      const gameId = options.playroomGameId?.trim();
      if (!gameId) {
        throw new Error(
          "Multiplayer is not configured for this deployment. Choose Local AI or ask the site owner to configure Playroom.",
        );
      }
      const { PlayroomDataProvider } =
        await import("@ofcpoker/data-provider/playroom");
      return new PlayroomDataProvider({ gameId });
    },
  };
}
