import type { AiPlayer } from "@ofcpoker/ai-player";
import type { DataProvider } from "@ofcpoker/data-provider";
import type {
  DeterministicGameEngine,
  EngineAction,
  EngineSnapshot,
  GameEvent,
} from "@ofcpoker/game-engine";
import type { GameView } from "./game-view";

export interface GameRunnerDependencies<
  TState,
  TAction extends EngineAction,
  TEvent extends GameEvent,
  TSnapshot extends EngineSnapshot,
> {
  readonly engine: DeterministicGameEngine<TState, TAction, TEvent, TSnapshot>;
  readonly provider: DataProvider<TAction, TSnapshot, TEvent>;
  readonly aiPlayers: readonly AiPlayer<TAction>[];
  readonly view: GameView;
}

/** Client-owned coordinator. Exactly one runner owns an active lobby and all its cleanup. */
export interface GameRunner {
  start(): Promise<void>;
  dispose(): Promise<void>;
}
