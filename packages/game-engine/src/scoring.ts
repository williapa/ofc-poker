import { parseCard, rankValue } from "./cards";
import type { OfcBoard } from "./hand-lifecycle";
import type { PlayerId } from "./index";
import {
  compareHandEvaluations,
  evaluateFiveCardHand,
  evaluateThreeCardHand,
  type ComparisonResult,
  type FiveCardEvaluation,
  type FiveCardHandClass,
  type ThreeCardEvaluation,
} from "./poker";

export interface OfcRowEvaluations {
  readonly front: ThreeCardEvaluation;
  readonly middle: FiveCardEvaluation;
  readonly back: FiveCardEvaluation;
}

export interface OfcRoyalties {
  readonly front: number;
  readonly middle: number;
  readonly back: number;
  readonly total: number;
}

export interface OfcBoardEvaluation {
  readonly rows: OfcRowEvaluations;
  readonly fouled: boolean;
  readonly royalties: OfcRoyalties;
}

export type FantasylandBoardVisibility = "face-up" | "face-down";
export type FantasylandQualification = "entry" | "re-entry" | "none";

export interface FantasylandResult {
  readonly wasInFantasyland: boolean;
  readonly qualifiesForNextHand: boolean;
  readonly qualification: FantasylandQualification;
}

export interface OfcRoundPlayerInput {
  readonly playerId: PlayerId;
  readonly board: OfcBoard;
  readonly wasInFantasyland: boolean;
}

export interface OfcRoundPlayerResult {
  readonly playerId: PlayerId;
  readonly board: OfcBoard;
  readonly boardVisibility: "face-up";
  readonly evaluation: OfcBoardEvaluation;
  readonly fantasyland: FantasylandResult;
  readonly totalDelta: number;
}

export type PairScoringKind =
  "legal" | "first-fouled" | "second-fouled" | "both-fouled";

export interface PairRowResults {
  readonly front: ComparisonResult | null;
  readonly middle: ComparisonResult | null;
  readonly back: ComparisonResult | null;
}

export interface OfcPairScore {
  readonly firstPlayerId: PlayerId;
  readonly secondPlayerId: PlayerId;
  readonly kind: PairScoringKind;
  /** Results are from the first player's perspective; null means rows were not scored. */
  readonly rows: PairRowResults;
  readonly rowDelta: number;
  readonly scoopDelta: number;
  readonly foulDelta: number;
  readonly royaltyDelta: number;
  readonly totalDelta: number;
}

export interface OfcRoundResult {
  readonly players: readonly OfcRoundPlayerResult[];
  readonly pairs: readonly OfcPairScore[];
  readonly totalDeltas: Readonly<Record<PlayerId, number>>;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function assertCompleteBoard(board: OfcBoard): void {
  if (
    board.front.length !== 3 ||
    board.middle.length !== 5 ||
    board.back.length !== 5
  ) {
    throw new RangeError("A completed OFC board must contain 3 / 5 / 5 cards");
  }
  const cards = [...board.front, ...board.middle, ...board.back];
  for (const card of cards) parseCard(card);
  if (new Set(cards).size !== 13) {
    throw new RangeError(
      "A completed OFC board cannot contain duplicate cards",
    );
  }
}

function frontRoyalty(evaluation: ThreeCardEvaluation): number {
  const rank = evaluation.comparisonKey[1];
  if (rank === undefined) return 0;
  if (evaluation.handClass === "one-pair") return Math.max(0, rank - 5);
  if (evaluation.handClass === "three-of-a-kind") return rank + 8;
  return 0;
}

const MIDDLE_ROYALTIES: Readonly<Record<FiveCardHandClass, number>> =
  Object.freeze({
    "high-card": 0,
    "one-pair": 0,
    "two-pair": 0,
    "three-of-a-kind": 2,
    straight: 4,
    flush: 8,
    "full-house": 12,
    "four-of-a-kind": 20,
    "straight-flush": 30,
    "royal-flush": 50,
  });

const BACK_ROYALTIES: Readonly<Record<FiveCardHandClass, number>> =
  Object.freeze({
    "high-card": 0,
    "one-pair": 0,
    "two-pair": 0,
    "three-of-a-kind": 0,
    straight: 2,
    flush: 4,
    "full-house": 6,
    "four-of-a-kind": 10,
    "straight-flush": 15,
    "royal-flush": 25,
  });

export function evaluateOfcBoard(board: OfcBoard): OfcBoardEvaluation {
  assertCompleteBoard(board);
  const rows: OfcRowEvaluations = {
    front: evaluateThreeCardHand(board.front.map(parseCard)),
    middle: evaluateFiveCardHand(board.middle.map(parseCard)),
    back: evaluateFiveCardHand(board.back.map(parseCard)),
  };
  const fouled =
    compareHandEvaluations(rows.back, rows.middle) < 0 ||
    compareHandEvaluations(rows.middle, rows.front) < 0;
  const front = fouled ? 0 : frontRoyalty(rows.front);
  const middle = fouled ? 0 : (MIDDLE_ROYALTIES[rows.middle.handClass] ?? 0);
  const back = fouled ? 0 : (BACK_ROYALTIES[rows.back.handClass] ?? 0);

  return deepFreeze({
    rows,
    fouled,
    royalties: { front, middle, back, total: front + middle + back },
  });
}

export function fantasylandBoardVisibility(
  isInFantasyland: boolean,
  phase: "placing" | "showdown",
): FantasylandBoardVisibility {
  return isInFantasyland && phase === "placing" ? "face-down" : "face-up";
}

export function determineFantasyland(
  evaluation: OfcBoardEvaluation,
  wasInFantasyland: boolean,
): FantasylandResult {
  if (evaluation.fouled) {
    return deepFreeze({
      wasInFantasyland,
      qualifiesForNextHand: false,
      qualification: "none",
    });
  }

  const { front, middle, back } = evaluation.rows;
  const frontRank = front.comparisonKey[1] ?? 0;
  const enters =
    front.handClass === "three-of-a-kind" ||
    (front.handClass === "one-pair" && frontRank >= rankValue("Q"));
  const reEnters =
    front.handClass === "three-of-a-kind" ||
    (middle.comparisonKey[0] ?? 0) >= 6 ||
    (back.comparisonKey[0] ?? 0) >= 7;
  const qualifies = wasInFantasyland ? reEnters : enters;

  return deepFreeze({
    wasInFantasyland,
    qualifiesForNextHand: qualifies,
    qualification: qualifies
      ? wasInFantasyland
        ? "re-entry"
        : "entry"
      : "none",
  });
}

const NULL_ROWS: PairRowResults = Object.freeze({
  front: null,
  middle: null,
  back: null,
});

export function scoreOfcPair(
  firstPlayerId: PlayerId,
  first: OfcBoardEvaluation,
  secondPlayerId: PlayerId,
  second: OfcBoardEvaluation,
): OfcPairScore {
  if (firstPlayerId === secondPlayerId) {
    throw new RangeError("Pair scoring requires two different players");
  }

  if (first.fouled && second.fouled) {
    return deepFreeze({
      firstPlayerId,
      secondPlayerId,
      kind: "both-fouled",
      rows: NULL_ROWS,
      rowDelta: 0,
      scoopDelta: 0,
      foulDelta: 0,
      royaltyDelta: 0,
      totalDelta: 0,
    });
  }

  if (first.fouled || second.fouled) {
    const firstIsLegal = !first.fouled;
    const foulDelta = firstIsLegal ? 6 : -6;
    const royaltyDelta = firstIsLegal
      ? first.royalties.total
      : -second.royalties.total;
    return deepFreeze({
      firstPlayerId,
      secondPlayerId,
      kind: firstIsLegal ? "second-fouled" : "first-fouled",
      rows: NULL_ROWS,
      rowDelta: 0,
      scoopDelta: 0,
      foulDelta,
      royaltyDelta,
      totalDelta: foulDelta + royaltyDelta,
    });
  }

  const front = compareHandEvaluations(first.rows.front, second.rows.front);
  const middle = compareHandEvaluations(first.rows.middle, second.rows.middle);
  const back = compareHandEvaluations(first.rows.back, second.rows.back);
  const rows: PairRowResults = { front, middle, back };
  const rowValues = [front, middle, back] as const;
  const rowDelta = rowValues.reduce<number>((sum, result) => sum + result, 0);
  const scoopDelta = rowValues.every((result) => result === 1)
    ? 3
    : rowValues.every((result) => result === -1)
      ? -3
      : 0;
  const royaltyDelta = first.royalties.total - second.royalties.total;

  return deepFreeze({
    firstPlayerId,
    secondPlayerId,
    kind: "legal",
    rows,
    rowDelta,
    scoopDelta,
    foulDelta: 0,
    royaltyDelta,
    totalDelta: rowDelta + scoopDelta + royaltyDelta,
  });
}

export function resolveOfcRound(
  inputs: readonly OfcRoundPlayerInput[],
): OfcRoundResult {
  if (inputs.length < 2 || inputs.length > 4) {
    throw new RangeError("An OFC round requires two to four players");
  }
  if (new Set(inputs.map(({ playerId }) => playerId)).size !== inputs.length) {
    throw new RangeError("Round player IDs must be unique");
  }
  const allCards = inputs.flatMap(({ board }) => [
    ...board.front,
    ...board.middle,
    ...board.back,
  ]);
  if (new Set(allCards).size !== allCards.length) {
    throw new RangeError("A card cannot appear on multiple round boards");
  }

  const evaluated = inputs.map((input) => ({
    input,
    evaluation: evaluateOfcBoard(input.board),
  }));
  const pairs: OfcPairScore[] = [];
  const totals: Record<PlayerId, number> = Object.fromEntries(
    inputs.map(({ playerId }) => [playerId, 0]),
  );

  for (let firstIndex = 0; firstIndex < evaluated.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < evaluated.length;
      secondIndex += 1
    ) {
      const first = evaluated[firstIndex];
      const second = evaluated[secondIndex];
      if (first === undefined || second === undefined) continue;
      const pair = scoreOfcPair(
        first.input.playerId,
        first.evaluation,
        second.input.playerId,
        second.evaluation,
      );
      pairs.push(pair);
      totals[pair.firstPlayerId] =
        (totals[pair.firstPlayerId] ?? 0) + pair.totalDelta;
      totals[pair.secondPlayerId] =
        (totals[pair.secondPlayerId] ?? 0) - pair.totalDelta;
    }
  }

  const players = evaluated.map(({ input, evaluation }) => ({
    playerId: input.playerId,
    board: {
      front: [...input.board.front],
      middle: [...input.board.middle],
      back: [...input.board.back],
    },
    boardVisibility: "face-up" as const,
    evaluation,
    fantasyland: determineFantasyland(evaluation, input.wasInFantasyland),
    totalDelta: totals[input.playerId] ?? 0,
  }));

  if (Object.values(totals).reduce((sum, delta) => sum + delta, 0) !== 0) {
    throw new Error("OFC round scoring must be zero-sum");
  }
  return deepFreeze({ players, pairs, totalDeltas: totals });
}
