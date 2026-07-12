import { describe, expect, test } from "vitest";
import {
  compareHandEvaluations,
  evaluateFiveCardHand,
  evaluateThreeCardHand,
  parseCard,
  type Card,
  type FiveCardHandClass,
  type ThreeCardHandClass,
} from "../src/index";

function cards(codes: string): readonly Card[] {
  return codes.split(" ").map(parseCard);
}

describe("five-card evaluation", () => {
  test.each<[string, string, FiveCardHandClass, readonly number[]]>([
    ["high card", "As Jd 9c 5h 2s", "high-card", [0, 14, 11, 9, 5, 2]],
    ["one pair", "Qs Qh 9d 5c 2s", "one-pair", [1, 12, 9, 5, 2]],
    ["two pair", "Ks Kh 4d 4c 2s", "two-pair", [2, 13, 4, 2]],
    ["three of a kind", "7s 7h 7d Kc 2s", "three-of-a-kind", [3, 7, 13, 2]],
    ["straight", "9s 8h 7d 6c 5s", "straight", [4, 9]],
    ["flush", "As Js 9s 5s 2s", "flush", [5, 14, 11, 9, 5, 2]],
    ["full house", "Ts Th Td 4c 4s", "full-house", [6, 10, 4]],
    ["four of a kind", "3s 3h 3d 3c As", "four-of-a-kind", [7, 3, 14]],
    ["straight flush", "9h 8h 7h 6h 5h", "straight-flush", [8, 9]],
    ["royal flush", "As Ks Qs Js Ts", "royal-flush", [8, 14]],
  ])("recognizes %s", (_name, codes, handClass, comparisonKey) => {
    const evaluation = evaluateFiveCardHand(cards(codes));

    expect(evaluation).toEqual({
      cardCount: 5,
      handClass,
      comparisonKey,
      isRoyalFlush: handClass === "royal-flush",
    });
  });

  test("treats ace as low in a wheel straight", () => {
    const wheel = evaluateFiveCardHand(cards("As 2h 3d 4c 5s"));
    const sixHigh = evaluateFiveCardHand(cards("6s 5h 4d 3c 2s"));

    expect(wheel).toMatchObject({
      handClass: "straight",
      comparisonKey: [4, 5],
    });
    expect(compareHandEvaluations(wheel, sixHigh)).toBe(-1);
  });

  test.each([
    ["pair kicker", "As Ah Qd Jc 2s", "Ad Ac Qh Tc 9s", 1],
    ["two-pair lower pair", "As Ah 4d 4c 2s", "Ad Ac 3h 3c Ks", 1],
    ["two-pair kicker", "As Ah 4d 4c Qs", "Ad Ac 4h 4s Js", 1],
    ["trips kicker", "8s 8h 8d Ac 2s", "8c 8d 8h Kc Qs", 1],
    ["full-house trips", "5s 5h 5d 2c 2s", "4s 4h 4d Ac As", 1],
    ["quads kicker", "7s 7h 7d 7c As", "7s 7h 7d 7c Ks", 1],
    ["flush kicker", "As Qs 9s 4s 2s", "Ah Jh 9h 4h 2h", 1],
  ] as const)("compares by %s", (_name, first, second, expected) => {
    expect(
      compareHandEvaluations(
        evaluateFiveCardHand(cards(first)),
        evaluateFiveCardHand(cards(second)),
      ),
    ).toBe(expected);
  });

  test("returns exact ties without using suits", () => {
    const spades = evaluateFiveCardHand(cards("As Qs 9s 4s 2s"));
    const hearts = evaluateFiveCardHand(cards("Ah Qh 9h 4h 2h"));

    expect(compareHandEvaluations(spades, hearts)).toBe(0);
  });

  test("produces immutable JSON-serializable results", () => {
    const evaluation = evaluateFiveCardHand(cards("As Ks Qs Js Ts"));

    expect(Object.isFrozen(evaluation)).toBe(true);
    expect(Object.isFrozen(evaluation.comparisonKey)).toBe(true);
    expect(JSON.parse(JSON.stringify(evaluation))).toEqual(evaluation);
  });

  test("rejects wrong card counts and duplicate cards", () => {
    expect(() => evaluateFiveCardHand(cards("As Ks Qs Js"))).toThrow(
      "Expected 5 cards",
    );
    expect(() => evaluateFiveCardHand(cards("As As Qs Js Ts"))).toThrow(
      "duplicate",
    );
  });
});

describe("three-card front-row evaluation", () => {
  test.each<[string, string, ThreeCardHandClass, readonly number[]]>([
    ["high card", "As Jd 2c", "high-card", [0, 14, 11, 2]],
    ["one pair", "Qs Qh 2c", "one-pair", [1, 12, 2]],
    ["three of a kind", "7s 7h 7d", "three-of-a-kind", [3, 7]],
    ["a sequence", "5s 4h 3d", "high-card", [0, 5, 4, 3]],
    ["a flush", "As 8s 2s", "high-card", [0, 14, 8, 2]],
  ])("evaluates %s as %s", (_name, codes, handClass, comparisonKey) => {
    expect(evaluateThreeCardHand(cards(codes))).toEqual({
      cardCount: 3,
      handClass,
      comparisonKey,
    });
  });

  test("compares pairs by rank then kicker and ties without suits", () => {
    const queensAce = evaluateThreeCardHand(cards("Qs Qh Ac"));
    const queensKing = evaluateThreeCardHand(cards("Qd Qc Ks"));
    const sameRanks = evaluateThreeCardHand(cards("Qd Qc Ah"));

    expect(compareHandEvaluations(queensAce, queensKing)).toBe(1);
    expect(compareHandEvaluations(queensAce, sameRanks)).toBe(0);
  });

  test("uses strength-compatible keys for later row-legality comparison", () => {
    const frontTrips = evaluateThreeCardHand(cards("2s 2h 2d"));
    const middleTwoPair = evaluateFiveCardHand(cards("As Ah Kd Kc Qs"));

    expect(compareHandEvaluations(middleTwoPair, frontTrips)).toBe(-1);
  });
});
