import type {
  EngineAction,
  PlayerId,
  PlayerVisibleState,
} from "@ofcpoker/game-engine";

export interface AiConfiguration {
  readonly strategy: string;
  readonly strength: number;
  readonly riskTolerance: number;
  readonly royaltyPreference: number;
  readonly foulAvoidance: number;
}

export interface AiDecisionContext<
  TAction extends EngineAction = EngineAction,
> {
  readonly playerId: PlayerId;
  readonly state: PlayerVisibleState;
  readonly legalActions: readonly TAction[];
  readonly configuration: AiConfiguration;
}

export interface AiDecision<TAction extends EngineAction = EngineAction> {
  readonly action: TAction;
  readonly rationale?: string;
}

/** AI receives only a player-visible projection and engine-provided legal actions. */
export interface AiPlayer<TAction extends EngineAction = EngineAction> {
  readonly id: string;
  decide(context: AiDecisionContext<TAction>): Promise<AiDecision<TAction>>;
}
