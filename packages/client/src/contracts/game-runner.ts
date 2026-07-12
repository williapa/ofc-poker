import type { AiConfiguration, AiPlayer } from "@ofcpoker/ai-player";
import type { LobbyConnection } from "@ofcpoker/data-provider";
import type {
  CardCode,
  EngineSnapshot,
  JsonValue,
  OfcHandAction,
  OfcHandEvent,
  OfcHandState,
  OfcMatchState,
  OfcPlayerVisibleState,
} from "@ofcpoker/game-engine";
import type { GameView } from "./game-view";

export interface OfcRunnerSnapshotState extends Readonly<
  Record<string, JsonValue>
> {
  readonly authorityRevision: number;
  readonly match: OfcMatchState & JsonValue;
  readonly hand: OfcHandState & JsonValue;
}

export interface OfcRunnerSnapshot extends EngineSnapshot<OfcRunnerSnapshotState> {
  readonly state: OfcRunnerSnapshotState;
}

export type OfcLobbyConnection = LobbyConnection<
  OfcHandAction,
  OfcRunnerSnapshot,
  OfcHandEvent
>;

export interface RunnerAiSeat {
  readonly player: AiPlayer<OfcHandAction, OfcPlayerVisibleState>;
  readonly displayName: string;
  readonly configuration: AiConfiguration;
  /** Cancels client-owned presentation work such as a pending think delay. */
  readonly dispose?: () => void | Promise<void>;
}

export interface GameRunnerDependencies {
  readonly connection: OfcLobbyConnection;
  readonly aiSeats?: readonly RunnerAiSeat[];
  readonly view: GameView;
  /** Host-only deterministic deck source, called exactly once per hand. */
  readonly deckForHand: (handNumber: number) => readonly CardCode[];
  readonly initialDealerSeat?: number;
  readonly idFactory?: (kind: "action" | "update", sequence: number) => string;
  /** Use disconnect for a remountable session; leave permanently exits the seat. */
  readonly disposeMode?: "disconnect" | "leave";
}

/** Client-owned coordinator. Exactly one runner owns an active lobby connection. */
export interface GameRunner {
  start(): Promise<void>;
  startNextHand(): Promise<boolean>;
  dispose(): Promise<void>;
}

/** Composition-root owner that guarantees one runner for the selected lobby. */
export interface GameRunnerLifecycle {
  activate(
    lobbyId: string,
    createRunner: () => GameRunner,
  ): Promise<GameRunner>;
  dispose(): Promise<void>;
}
