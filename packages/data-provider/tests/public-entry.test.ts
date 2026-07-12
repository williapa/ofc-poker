import { expect, test } from "vitest";

test("loads the transport contract without browser APIs", async () => {
  const publicEntry = await import("../src/index");

  expect(publicEntry).toBeDefined();
  expect("document" in globalThis).toBe(false);
});
