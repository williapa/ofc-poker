import { rankValue, serializeCard, type Card } from "./cards";

export type ComparisonResult = -1 | 0 | 1;

export type FiveCardHandClass =
  | "high-card"
  | "one-pair"
  | "two-pair"
  | "three-of-a-kind"
  | "straight"
  | "flush"
  | "full-house"
  | "four-of-a-kind"
  | "straight-flush"
  | "royal-flush";

export type ThreeCardHandClass = "high-card" | "one-pair" | "three-of-a-kind";

export interface HandEvaluation<TClass extends string = string> {
  readonly handClass: TClass;
  /** Lexicographically ordered from broad hand strength to final kicker. */
  readonly comparisonKey: readonly number[];
}

export type FiveCardEvaluation = HandEvaluation<FiveCardHandClass> & {
  readonly cardCount: 5;
  readonly isRoyalFlush: boolean;
};

export type ThreeCardEvaluation = HandEvaluation<ThreeCardHandClass> & {
  readonly cardCount: 3;
};

function assertDistinctCards(
  cards: readonly Card[],
  expectedCount: number,
): void {
  if (cards.length !== expectedCount) {
    throw new RangeError(
      `Expected ${expectedCount} cards; received ${cards.length}`,
    );
  }

  if (new Set(cards.map(serializeCard)).size !== expectedCount) {
    throw new RangeError("A poker hand cannot contain duplicate cards");
  }
}

function rankGroups(
  cards: readonly Card[],
): readonly (readonly [number, number])[] {
  const counts = new Map<number, number>();
  for (const card of cards) {
    const value = rankValue(card.rank);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort(
    ([rankA, countA], [rankB, countB]) => countB - countA || rankB - rankA,
  );
}

function descendingRanks(cards: readonly Card[]): readonly number[] {
  return cards.map((card) => rankValue(card.rank)).sort((a, b) => b - a);
}

function straightHighCard(cards: readonly Card[]): number | undefined {
  const ranks = [...new Set(descendingRanks(cards))];
  if (ranks.length !== 5) return undefined;
  if (ranks.join(",") === "14,5,4,3,2") return 5;
  return (ranks[0] as number) - (ranks[4] as number) === 4
    ? ranks[0]
    : undefined;
}

function freezeEvaluation<T extends HandEvaluation>(evaluation: T): T {
  Object.freeze(evaluation.comparisonKey);
  return Object.freeze(evaluation);
}

export function evaluateFiveCardHand(
  cards: readonly Card[],
): FiveCardEvaluation {
  assertDistinctCards(cards, 5);
  const groups = rankGroups(cards);
  const ranks = descendingRanks(cards);
  const flush = cards.every((card) => card.suit === cards[0]?.suit);
  const straightHigh = straightHighCard(cards);

  if (flush && straightHigh !== undefined) {
    const isRoyalFlush = straightHigh === 14;
    return freezeEvaluation({
      cardCount: 5,
      handClass: isRoyalFlush ? "royal-flush" : "straight-flush",
      comparisonKey: [8, straightHigh],
      isRoyalFlush,
    });
  }

  const first = groups[0];
  const second = groups[1];

  if (first?.[1] === 4) {
    return freezeEvaluation({
      cardCount: 5,
      handClass: "four-of-a-kind",
      comparisonKey: [7, first[0], second?.[0] as number],
      isRoyalFlush: false,
    });
  }
  if (first?.[1] === 3 && second?.[1] === 2) {
    return freezeEvaluation({
      cardCount: 5,
      handClass: "full-house",
      comparisonKey: [6, first[0], second[0]],
      isRoyalFlush: false,
    });
  }
  if (flush) {
    return freezeEvaluation({
      cardCount: 5,
      handClass: "flush",
      comparisonKey: [5, ...ranks],
      isRoyalFlush: false,
    });
  }
  if (straightHigh !== undefined) {
    return freezeEvaluation({
      cardCount: 5,
      handClass: "straight",
      comparisonKey: [4, straightHigh],
      isRoyalFlush: false,
    });
  }
  if (first?.[1] === 3) {
    return freezeEvaluation({
      cardCount: 5,
      handClass: "three-of-a-kind",
      comparisonKey: [3, first[0], ...groups.slice(1).map(([rank]) => rank)],
      isRoyalFlush: false,
    });
  }
  if (first?.[1] === 2 && second?.[1] === 2) {
    return freezeEvaluation({
      cardCount: 5,
      handClass: "two-pair",
      comparisonKey: [2, first[0], second[0], groups[2]?.[0] as number],
      isRoyalFlush: false,
    });
  }
  if (first?.[1] === 2) {
    return freezeEvaluation({
      cardCount: 5,
      handClass: "one-pair",
      comparisonKey: [1, first[0], ...groups.slice(1).map(([rank]) => rank)],
      isRoyalFlush: false,
    });
  }
  return freezeEvaluation({
    cardCount: 5,
    handClass: "high-card",
    comparisonKey: [0, ...ranks],
    isRoyalFlush: false,
  });
}

export function evaluateThreeCardHand(
  cards: readonly Card[],
): ThreeCardEvaluation {
  assertDistinctCards(cards, 3);
  const groups = rankGroups(cards);
  const first = groups[0];

  if (first?.[1] === 3) {
    return freezeEvaluation({
      cardCount: 3,
      handClass: "three-of-a-kind",
      comparisonKey: [3, first[0]],
    });
  }
  if (first?.[1] === 2) {
    return freezeEvaluation({
      cardCount: 3,
      handClass: "one-pair",
      comparisonKey: [1, first[0], groups[1]?.[0] as number],
    });
  }
  return freezeEvaluation({
    cardCount: 3,
    handClass: "high-card",
    comparisonKey: [0, ...descendingRanks(cards)],
  });
}

export function compareHandEvaluations(
  first: HandEvaluation,
  second: HandEvaluation,
): ComparisonResult {
  const length = Math.max(
    first.comparisonKey.length,
    second.comparisonKey.length,
  );
  for (let index = 0; index < length; index += 1) {
    const firstValue = first.comparisonKey[index] ?? 0;
    const secondValue = second.comparisonKey[index] ?? 0;
    if (firstValue > secondValue) return 1;
    if (firstValue < secondValue) return -1;
  }
  return 0;
}
