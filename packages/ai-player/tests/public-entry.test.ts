import { expect, test } from "vitest";

test("loads the AI implementation without browser APIs", async () => {
  const publicEntry = await import("../src/index");

  expect(publicEntry.createAiPlayer).toBeTypeOf("function");
  expect("document" in globalThis).toBe(false);
});
