import type { EngineAction, PlayerVisibleState } from "@ofcpoker/game-engine";

export interface GameViewModel {
  readonly state: PlayerVisibleState;
  readonly connection: "connecting" | "connected" | "reconnecting" | "closed";
  readonly legalActions: readonly EngineAction[];
  readonly error?: string;
}

export type ViewActionListener = (action: EngineAction) => void;

/** Replaceable presentation port; React Three Fiber is one adapter, not the contract. */
export interface GameView {
  render(model: GameViewModel): void;
  onAction(listener: ViewActionListener): () => void;
  dispose(): void;
}
