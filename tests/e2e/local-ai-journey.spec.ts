import { expect, test } from "@playwright/test";
import { completeHand, createTable } from "./helpers";

test("validates settings and completes consecutive deterministic AI hands", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("./");
  await page.getByRole("button", { name: /Create table/ }).click();
  await expect(page.getByText("Enter a display name.")).toBeVisible();

  await createTable(page, "Ada", "local-ai");
  await completeHand([page]);
  await expect(
    page.getByRole("complementary", { name: "Scores" }),
  ).toContainText("points");
  await expect(page.getByRole("heading", { name: "Showdown" })).toBeVisible();
  await page.getByRole("button", { name: /Start next hand/ }).click();
  await expect(page.getByText("Hand 2").first()).toBeVisible();
  await expect(page.getByText(/Your turn/).first()).toBeVisible();
});

test("keeps the semantic game surface available when WebGL cannot start", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (String(type).startsWith("webgl")) return null;
      return original.call(this, type, ...(args as never[]));
    } as typeof original;
  });
  await createTable(page, "No GPU", "local-ai");
  await expect(page.getByText("3D table unavailable")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Accessible game board" }),
  ).toBeVisible();
});
