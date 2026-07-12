import { describe, expect, test } from "vitest";
import {
  createHomeUrl,
  createJoinUrl,
  createLobbySettings,
  parseAppRoute,
  validateDisplayName,
  validateSeatCount,
} from "../src/lobby";

describe("lobby form validation", () => {
  test("validates names and the supported two-to-four player range", () => {
    expect(validateDisplayName("  ")).toBe("Enter a display name.");
    expect(validateDisplayName("A".repeat(33))).toContain("32");
    expect(validateDisplayName("Ada")).toBeUndefined();
    expect(validateSeatCount(1)).toContain("2 and 4");
    expect(validateSeatCount(2)).toBeUndefined();
    expect(validateSeatCount(4)).toBeUndefined();
    expect(validateSeatCount(5)).toContain("2 and 4");
  });

  test("creates typed standard settings and rejects unsupported counts", () => {
    expect(createLobbySettings({ mode: "local-ai", seatCount: 3 })).toEqual({
      schemaVersion: 1,
      mode: "local-ai",
      seatCount: 3,
      rules: { variant: "standard-ofc", fantasyland: true, tiedRowPoints: 0 },
    });
    expect(() =>
      createLobbySettings({ mode: "multiplayer", seatCount: 5 as 4 }),
    ).toThrow("2 and 4");
  });
});

describe("static routing", () => {
  test("parses home, valid joins, and invalid joins", () => {
    expect(parseAppRoute("https://example.test/ofcpoker/")).toEqual({
      page: "home",
    });
    expect(
      parseAppRoute("https://example.test/ofcpoker/?lobby=room_42-abc"),
    ).toEqual({ page: "join", lobbyId: "room_42-abc" });
    expect(parseAppRoute("https://example.test/ofcpoker/?lobby=").page).toBe(
      "invalid-join",
    );
    expect(
      parseAppRoute("https://example.test/ofcpoker/?lobby=one&lobby=two").page,
    ).toBe("invalid-join");
  });

  test("preserves a repository base path and clears stale query/hash state", () => {
    expect(
      createJoinUrl(
        "https://example.test/ofcpoker/index.html?old=1#top",
        "room-1",
      ),
    ).toBe("https://example.test/ofcpoker/index.html?lobby=room-1");
    expect(
      createHomeUrl(
        "https://example.test/ofcpoker/index.html?lobby=room-1#top",
      ),
    ).toBe("https://example.test/ofcpoker/index.html");
  });
});
