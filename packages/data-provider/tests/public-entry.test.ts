import { expect, test } from "vitest";

test("loads the transport contract without browser APIs", async () => {
  const publicEntry = await import("../src/index");

  expect(publicEntry).toBeDefined();
  expect(publicEntry.LocalDataProvider).toBeTypeOf("function");
  expect("document" in globalThis).toBe(false);
});

test("loads Playroom only from its explicit adapter entry", async () => {
  const playroomEntry = await import("../src/playroom/index");
  expect(playroomEntry.PlayroomDataProvider).toBeTypeOf("function");
  expect(playroomEntry.createPlayroomLobbyLink).toBeTypeOf("function");
});
