import {
  compareHandEvaluations,
  evaluateFiveCardHand,
  evaluateOfcBoard,
  evaluateThreeCardHand,
  parseCard,
  rankValue,
  type CardCode,
  type EngineAction,
  type OfcBoard,
  type OfcHandAction,
  type OfcPlayerVisibleState,
  type PlacementRow,
  type PlayerId,
  type PlayerVisibleState,
  type RandomSource,
} from "@ofcpoker/game-engine";

export type AiStrategyName = "baseline" | "heuristic";
export type AiDifficulty = "easy" | "medium" | "hard";

export interface AiConfiguration {
  readonly strategy: AiStrategyName;
  readonly difficulty: AiDifficulty;
  /** General search/selection strength from 0 (loose) to 1 (strong). */
  readonly strength: number;
  /** Willingness to accept foul risk in exchange for upside, from 0 to 1. */
  readonly riskTolerance: number;
  /** Relative value assigned to royalty-producing hands, from 0 to 1. */
  readonly royaltyPreference: number;
  /** Relative penalty assigned to present and projected fouls, from 0 to 1. */
  readonly foulAvoidance: number;
  /** Optional presentation delay. It never affects which action is selected. */
  readonly thinkDelayMs: number;
}

export interface AiDecisionContext<
  TAction extends EngineAction = EngineAction,
  TState extends PlayerVisibleState = PlayerVisibleState,
> {
  readonly playerId: PlayerId;
  readonly state: TState;
  readonly legalActions: readonly TAction[];
  readonly configuration: AiConfiguration;
}

export interface AiDecision<TAction extends EngineAction = EngineAction> {
  readonly action: TAction;
  readonly rationale?: string;
}

/** AI receives only a player-visible projection and engine-provided legal actions. */
export interface AiPlayer<
  TAction extends EngineAction = EngineAction,
  TState extends PlayerVisibleState = PlayerVisibleState,
> {
  readonly id: string;
  decide(
    context: AiDecisionContext<TAction, TState>,
  ): Promise<AiDecision<TAction>>;
}

export interface AiDependencies {
  readonly random: RandomSource;
  readonly delay?: (milliseconds: number) => Promise<void>;
}

export const AI_PRESETS: Readonly<
  Record<AiDifficulty, Readonly<AiConfiguration>>
> = Object.freeze({
  easy: Object.freeze({
    strategy: "baseline",
    difficulty: "easy",
    strength: 0.15,
    riskTolerance: 0.65,
    royaltyPreference: 0.25,
    foulAvoidance: 0.35,
    thinkDelayMs: 0,
  }),
  medium: Object.freeze({
    strategy: "heuristic",
    difficulty: "medium",
    strength: 0.6,
    riskTolerance: 0.45,
    royaltyPreference: 0.55,
    foulAvoidance: 0.75,
    thinkDelayMs: 0,
  }),
  hard: Object.freeze({
    strategy: "heuristic",
    difficulty: "hard",
    strength: 0.95,
    riskTolerance: 0.25,
    royaltyPreference: 0.8,
    foulAvoidance: 1,
    thinkDelayMs: 0,
  }),
});

function assertUnitInterval(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1`);
  }
}

export function createAiConfiguration(
  difficulty: AiDifficulty,
  overrides: Partial<AiConfiguration> = {},
): AiConfiguration {
  const configuration = { ...AI_PRESETS[difficulty], ...overrides };
  assertUnitInterval("strength", configuration.strength);
  assertUnitInterval("riskTolerance", configuration.riskTolerance);
  assertUnitInterval("royaltyPreference", configuration.royaltyPreference);
  assertUnitInterval("foulAvoidance", configuration.foulAvoidance);
  if (
    !Number.isFinite(configuration.thinkDelayMs) ||
    configuration.thinkDelayMs < 0
  ) {
    throw new RangeError("thinkDelayMs must be a non-negative finite number");
  }
  return Object.freeze(configuration);
}

/** Mulberry32 seeded random source with stable unsigned 32-bit arithmetic. */
export function createSeededRandom(seed: number): RandomSource {
  if (!Number.isFinite(seed)) throw new RangeError("seed must be finite");
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function randomIndex(length: number, random: RandomSource): number {
  if (length === 0)
    throw new RangeError("AI cannot decide without legal actions");
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("random source must return a value in [0, 1)");
  }
  return Math.min(length - 1, Math.floor(value * length));
}

function actionPlacements(
  action: OfcHandAction,
): readonly { readonly card: CardCode; readonly row: PlacementRow }[] {
  return action.type === "ofc.place-initial-cards"
    ? action.payload.placements
    : [action.payload.placement];
}

function viewerBoard(state: OfcPlayerVisibleState): OfcBoard {
  const player = state.players.find(({ id }) => id === state.viewerId);
  if (player === undefined) throw new RangeError("AI viewer is not seated");
  return player.board;
}

function boardAfterAction(board: OfcBoard, action: OfcHandAction): OfcBoard {
  const placements = actionPlacements(action);
  return {
    front: [
      ...board.front,
      ...placements
        .filter(({ row }) => row === "front")
        .map(({ card }) => card),
    ],
    middle: [
      ...board.middle,
      ...placements
        .filter(({ row }) => row === "middle")
        .map(({ card }) => card),
    ],
    back: [
      ...board.back,
      ...placements.filter(({ row }) => row === "back").map(({ card }) => card),
    ],
  };
}

function groupedRankScore(cards: readonly CardCode[]): number {
  const counts = new Map<number, number>();
  let ranks = 0;
  for (const code of cards) {
    const value = rankValue(parseCard(code).rank);
    ranks += value;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const groups = [...counts.values()];
  const pairCount = groups.filter((count) => count === 2).length;
  const trips = groups.some((count) => count === 3) ? 1 : 0;
  const quads = groups.some((count) => count === 4) ? 1 : 0;
  return ranks + pairCount * 22 + trips * 52 + quads * 95;
}

function drawPotential(cards: readonly CardCode[]): number {
  if (cards.length < 2) return 0;
  const parsed = cards.map(parseCard);
  const suitCounts = new Map<string, number>();
  for (const card of parsed) {
    suitCounts.set(card.suit, (suitCounts.get(card.suit) ?? 0) + 1);
  }
  const suited = Math.max(...suitCounts.values()) ** 2;
  const ranks = [...new Set(parsed.map(({ rank }) => rankValue(rank)))].sort(
    (a, b) => a - b,
  );
  let connected = 0;
  for (let index = 1; index < ranks.length; index += 1) {
    if ((ranks[index] as number) - (ranks[index - 1] as number) <= 2)
      connected += 1;
  }
  return suited + connected * 3;
}

function completedStrength(
  board: OfcBoard,
  configuration: AiConfiguration,
): number {
  const evaluation = evaluateOfcBoard(board);
  if (evaluation.fouled) {
    return (
      -10_000 *
      (0.25 + configuration.foulAvoidance) *
      (1.25 - configuration.riskTolerance * 0.5)
    );
  }
  const rowStrength =
    (evaluation.rows.front.comparisonKey[0] ?? 0) * 35 +
    (evaluation.rows.middle.comparisonKey[0] ?? 0) * 45 +
    (evaluation.rows.back.comparisonKey[0] ?? 0) * 40;
  return (
    rowStrength +
    evaluation.royalties.total * (20 + configuration.royaltyPreference * 45)
  );
}

function partialFoulPenalty(
  board: OfcBoard,
  configuration: AiConfiguration,
): number {
  let penalty = 0;
  if (board.front.length === 3 && board.middle.length === 5) {
    const front = evaluateThreeCardHand(board.front.map(parseCard));
    const middle = evaluateFiveCardHand(board.middle.map(parseCard));
    if (compareHandEvaluations(middle, front) < 0) penalty += 1_500;
  }
  if (board.middle.length === 5 && board.back.length === 5) {
    const middle = evaluateFiveCardHand(board.middle.map(parseCard));
    const back = evaluateFiveCardHand(board.back.map(parseCard));
    if (compareHandEvaluations(back, middle) < 0) penalty += 1_500;
  }

  // A made front pair requires at least that pair rank in the middle. Penalize
  // late middle rows that have not yet caught up, while still allowing draws.
  if (board.front.length === 3 && board.middle.length >= 4) {
    const front = evaluateThreeCardHand(board.front.map(parseCard));
    if (front.handClass !== "high-card") {
      const middleScore = groupedRankScore(board.middle);
      const frontScore = groupedRankScore(board.front);
      if (middleScore < frontScore) penalty += 500;
    }
  }
  return (
    penalty *
    configuration.foulAvoidance *
    (1.2 - configuration.riskTolerance * 0.4)
  );
}

export function scoreOfcAction(
  state: OfcPlayerVisibleState,
  action: OfcHandAction,
  configuration: AiConfiguration,
): number {
  const board = boardAfterAction(viewerBoard(state), action);
  if (
    board.front.length === 3 &&
    board.middle.length === 5 &&
    board.back.length === 5
  ) {
    return completedStrength(board, configuration);
  }

  const front = groupedRankScore(board.front);
  const middle = groupedRankScore(board.middle) + drawPotential(board.middle);
  const back = groupedRankScore(board.back) + drawPotential(board.back);
  const royaltyUpside =
    (front * 0.25 + middle * 0.2 + back * 0.12) *
    configuration.royaltyPreference;
  const orderedRows = back * 1.12 + middle * 0.88 - front * 0.45;
  const capacityBalance =
    Math.min(board.front.length, 3) * 1.5 +
    Math.min(board.middle.length, 5) +
    Math.min(board.back.length, 5);
  return (
    orderedRows +
    royaltyUpside +
    capacityBalance * configuration.strength -
    partialFoulPenalty(board, configuration)
  );
}

function combinations(
  values: readonly number[],
  size: number,
): readonly (readonly number[])[] {
  const result: number[][] = [];
  const selected: number[] = [];
  const visit = (start: number): void => {
    if (selected.length === size) {
      result.push([...selected]);
      return;
    }
    const remaining = size - selected.length;
    for (let index = start; index <= values.length - remaining; index += 1) {
      selected.push(values[index] as number);
      visit(index + 1);
      selected.pop();
    }
  };
  visit(0);
  return result;
}

/**
 * Arranges a player-visible thirteen-card Fantasyland deal. The heuristic
 * exhaustively compares all 3/5/5 boards; seeded randomness breaks exact ties.
 */
export function arrangeFantasyland(
  cards: readonly CardCode[],
  configuration: AiConfiguration,
  random: RandomSource,
): OfcBoard {
  if (cards.length !== 13 || new Set(cards).size !== 13) {
    throw new RangeError("Fantasyland requires thirteen distinct cards");
  }
  cards.forEach((card) => parseCard(card));
  const indexes = cards.map((_, index) => index);
  let bestScore = Number.NEGATIVE_INFINITY;
  let best: OfcBoard | undefined;
  let tieCount = 0;

  for (const frontIndexes of combinations(indexes, 3)) {
    const frontSet = new Set(frontIndexes);
    const remaining = indexes.filter((index) => !frontSet.has(index));
    for (const middlePositions of combinations(remaining, 5)) {
      const middleSet = new Set(middlePositions);
      const board: OfcBoard = {
        front: frontIndexes.map((index) => cards[index] as CardCode),
        middle: middlePositions.map((index) => cards[index] as CardCode),
        back: remaining
          .filter((index) => !middleSet.has(index))
          .map((index) => cards[index] as CardCode),
      };
      const score = completedStrength(board, configuration);
      if (score > bestScore) {
        bestScore = score;
        best = board;
        tieCount = 1;
      } else if (score === bestScore) {
        tieCount += 1;
        if (random() < 1 / tieCount) best = board;
      }
    }
  }
  if (best === undefined) throw new Error("No Fantasyland arrangement found");
  return Object.freeze({
    front: Object.freeze([...best.front]),
    middle: Object.freeze([...best.middle]),
    back: Object.freeze([...best.back]),
  });
}

export interface CreateAiPlayerOptions {
  readonly id: string;
  readonly dependencies: AiDependencies;
}

export function createAiPlayer(
  options: CreateAiPlayerOptions,
): AiPlayer<OfcHandAction, OfcPlayerVisibleState> {
  if (options.id === "") throw new RangeError("AI id must be non-empty");
  const delay = options.dependencies.delay ?? (() => Promise.resolve());
  return Object.freeze({
    id: options.id,
    async decide(
      context: AiDecisionContext<OfcHandAction, OfcPlayerVisibleState>,
    ): Promise<AiDecision<OfcHandAction>> {
      if (context.playerId !== context.state.viewerId) {
        throw new RangeError("AI may decide only for its own player view");
      }
      if (context.legalActions.length === 0) {
        throw new RangeError("AI cannot decide without legal actions");
      }
      let action: OfcHandAction;
      let rationale: string;
      if (context.configuration.strategy === "baseline") {
        action = context.legalActions[
          randomIndex(context.legalActions.length, options.dependencies.random)
        ] as OfcHandAction;
        rationale = "Selected uniformly from engine-validated actions.";
      } else {
        const scored = context.legalActions.map((candidate) => ({
          candidate,
          score: scoreOfcAction(
            context.state,
            candidate,
            context.configuration,
          ),
        }));
        const best = Math.max(...scored.map(({ score }) => score));
        const tolerance = (1 - context.configuration.strength) * 12;
        const contenders = scored.filter(
          ({ score }) => score >= best - tolerance,
        );
        action = contenders[
          randomIndex(contenders.length, options.dependencies.random)
        ]?.candidate as OfcHandAction;
        rationale = `Heuristic placement score ${scoreOfcAction(
          context.state,
          action,
          context.configuration,
        ).toFixed(2)}.`;
      }
      if (context.configuration.thinkDelayMs > 0) {
        await delay(context.configuration.thinkDelayMs);
      }
      return { action, rationale };
    },
  });
}
