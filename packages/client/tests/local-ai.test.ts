import { describe, expect, test, vi } from "vitest";
import { createLocalAiSeats, LOCAL_AI_PROFILE_REGISTRY } from "../src/local-ai";

describe("local AI profile registry", () => {
  test.each([2, 3, 4] as const)(
    "fills a %i-seat lobby with one human and configured AI opponents",
    (seatCount) => {
      const dispose = vi.fn();
      const seats = createLocalAiSeats({
        lobbyId: "local-table",
        seatCount,
        delayFactory: () => ({ wait: vi.fn(async () => undefined), dispose }),
      });

      expect(seats).toHaveLength(seatCount - 1);
      expect(new Set(seats.map(({ player }) => player.id)).size).toBe(
        seatCount - 1,
      );
      expect(seats.map(({ displayName }) => displayName)).toEqual(
        ["Mina", "Theo", "Iris"].slice(0, seatCount - 1),
      );
      for (const seat of seats) seat.dispose?.();
      expect(dispose).toHaveBeenCalledTimes(seatCount - 1);
    },
  );

  test("owns all production strategy and presentation tuning in one registry", () => {
    expect(Object.isFrozen(LOCAL_AI_PROFILE_REGISTRY)).toBe(true);
    expect(LOCAL_AI_PROFILE_REGISTRY.steady).toMatchObject({
      difficulty: "medium",
      overrides: { thinkDelayMs: 850 },
    });
    expect(LOCAL_AI_PROFILE_REGISTRY.careful).toMatchObject({
      difficulty: "hard",
      overrides: { thinkDelayMs: 1050 },
    });
  });
});
