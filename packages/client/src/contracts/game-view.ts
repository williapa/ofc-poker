import type { LobbyMetadata } from "@ofcpoker/data-provider";
import type {
  OfcHandAction,
  OfcPlayerVisibleState,
  PlayerId,
} from "@ofcpoker/game-engine";

export interface GameViewPlayer {
  readonly id: PlayerId;
  readonly displayName: string;
  readonly seat: number;
  readonly connection: "connected" | "disconnected";
  readonly score: number;
  readonly inFantasyland: boolean;
  readonly isAi: boolean;
}

/** Complete, immutable presentation state; views never inspect provider objects. */
export interface GameViewModel {
  readonly lobby: LobbyMetadata;
  readonly viewerId: PlayerId;
  readonly connection: "connecting" | "connected" | "reconnecting" | "closed";
  readonly phase: "waiting" | "placing" | "complete" | "closed";
  readonly handNumber: number;
  readonly dealerSeat?: number;
  readonly activePlayerId?: PlayerId;
  readonly isLocalTurn: boolean;
  readonly canStartNextHand: boolean;
  readonly players: readonly GameViewPlayer[];
  readonly state?: OfcPlayerVisibleState;
  readonly legalActions: readonly OfcHandAction[];
  readonly error?: string;
}

export type ViewActionListener = (action: OfcHandAction) => void;

/** Replaceable presentation port; React Three Fiber is one adapter, not the contract. */
export interface GameView {
  render(model: Readonly<GameViewModel>): void;
  onAction(listener: ViewActionListener): () => void;
  dispose(): void;
}
