import { describe, expect, test } from "vitest";
import {
  createCard,
  createStandardDeck,
  parseCard,
  serializeCard,
  shuffleDeck,
} from "../src/index";

describe("cards", () => {
  test("parses and serializes canonical card identity", () => {
    const card = parseCard("As");

    expect(card).toEqual({ rank: "A", suit: "s", code: "As" });
    expect(serializeCard(card)).toBe("As");
    expect(parseCard("As")).toBe(card);
    expect(createCard("A", "s")).toBe(card);
    expect(Object.isFrozen(card)).toBe(true);
  });

  test.each(["10s", "as", "AX", "", "joker"])(
    "rejects invalid card code %j",
    (code) => {
      expect(() => parseCard(code)).toThrow(RangeError);
    },
  );
});

describe("deck", () => {
  test("contains exactly 52 unique standard cards and no jokers", () => {
    const deck = createStandardDeck();

    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(serializeCard))).toHaveLength(52);
    expect(deck[0]?.code).toBe("2c");
    expect(deck.at(-1)?.code).toBe("As");
    expect(deck.some((card) => card.code.includes("joker"))).toBe(false);
    expect(Object.isFrozen(deck)).toBe(true);
  });

  test("accepts a complete deterministic deck order", () => {
    const reversed = [...createStandardDeck()].reverse();

    expect(createStandardDeck(reversed).map(serializeCard)).toEqual(
      reversed.map(serializeCard),
    );
  });

  test("rejects incomplete and duplicate deterministic orders", () => {
    const deck = createStandardDeck();

    expect(() => createStandardDeck(deck.slice(1))).toThrow("52 cards");
    expect(() =>
      createStandardDeck([...deck.slice(0, 51), deck[0]!] as const),
    ).toThrow("exactly once");
  });

  test("shuffles repeatably with an injected random source without mutating input", () => {
    const deck = createStandardDeck();
    const values = [0.1, 0.9, 0.4, 0.7];
    const makeRandom = () => {
      let index = 0;
      return () => values[index++ % values.length] as number;
    };

    const first = shuffleDeck(makeRandom(), deck);
    const second = shuffleDeck(makeRandom(), deck);

    expect(first).toEqual(second);
    expect(first).not.toEqual(deck);
    expect(deck).toEqual(createStandardDeck());
    expect(new Set(first.map(serializeCard))).toHaveLength(52);
    expect(Object.isFrozen(first)).toBe(true);
  });

  test.each([-0.1, 1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid random value %j",
    (value) => {
      expect(() => shuffleDeck(() => value)).toThrow(RangeError);
    },
  );
});
