import { describe, expect, test } from "vitest";
import {
  TUTORIAL_DRAW_CARDS,
  TUTORIAL_FANTASYLAND,
  TUTORIAL_INITIAL_CARDS,
  TUTORIAL_OPPONENT_EVALUATION,
  TUTORIAL_PAIR_SCORE,
  TUTORIAL_PLAYER_BOARD,
  TUTORIAL_PLAYER_EVALUATION,
} from "../src/tutorial/tutorial-example";

describe("guided tutorial example hand", () => {
  test("uses one unique thirteen-card deal with the standard five-plus-eight lifecycle", () => {
    const dealt = [...TUTORIAL_INITIAL_CARDS, ...TUTORIAL_DRAW_CARDS];
    expect(TUTORIAL_INITIAL_CARDS).toHaveLength(5);
    expect(TUTORIAL_DRAW_CARDS).toHaveLength(8);
    expect(new Set(dealt).size).toBe(13);
    expect([
      ...TUTORIAL_PLAYER_BOARD.front,
      ...TUTORIAL_PLAYER_BOARD.middle,
      ...TUTORIAL_PLAYER_BOARD.back,
    ]).toEqual(expect.arrayContaining(dealt));
  });

  test("is legal, scoops the opponent for +7, and earns Fantasyland", () => {
    expect(TUTORIAL_PLAYER_EVALUATION).toMatchObject({
      fouled: false,
      rows: {
        front: { handClass: "one-pair" },
        middle: { handClass: "two-pair" },
        back: { handClass: "straight" },
      },
      royalties: { front: 7, middle: 0, back: 2, total: 9 },
    });
    expect(TUTORIAL_OPPONENT_EVALUATION).toMatchObject({
      fouled: false,
      royalties: { front: 6, middle: 0, back: 2, total: 8 },
    });
    expect(TUTORIAL_PAIR_SCORE).toMatchObject({
      rows: { front: 1, middle: 1, back: 1 },
      rowDelta: 3,
      scoopDelta: 3,
      royaltyDelta: 1,
      totalDelta: 7,
    });
    expect(TUTORIAL_FANTASYLAND).toEqual({
      wasInFantasyland: false,
      qualifiesForNextHand: true,
      qualification: "entry",
    });
  });
});
