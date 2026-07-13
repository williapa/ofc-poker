import { expect, test } from "@playwright/test";

test("creates a local AI lobby from the accessible setup form", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Build it in the open." }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: /Local AI/ })).toBeChecked();
  await page.getByLabel("Display name").fill("Ada");
  await page.getByRole("combobox", { name: "Players" }).selectOption("4");
  await page.getByRole("button", { name: /Create table/ }).click();

  await expect(page.getByRole("heading", { name: "OFC Poker" })).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Scores" }),
  ).toBeVisible();
  await expect(page.getByText(/Your turn/).first()).toBeVisible();

  const cards = page
    .getByRole("group", { name: "Cards to place" })
    .getByRole("button");
  await expect(cards).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) {
    await cards.first().press("Enter");
    await page.getByRole("button", { name: "Place in Back" }).press("Enter");
    await expect(cards).toHaveCount(4 - index);
  }
  await expect(page.getByRole("group", { name: "Card controls" })).toHaveCount(
    0,
  );
  await expect(page.locator(".game-dom-board")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Accessible game board" }),
  ).toHaveClass("game-accessible-board");
  await page.getByRole("button", { name: "Confirm initial five" }).click();
  await expect(page.getByLabel(/Back row, 5 committed/).first()).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveCount(0);
});

test("shows inline validation and handles an invalid join link", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Create table/ }).click();
  await expect(page.getByText("Enter a display name.")).toBeVisible();

  await page.goto("/?lobby=%20not%20valid");
  await expect(
    page.getByRole("heading", { name: "We can’t find that table." }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("valid lobby identifier");
});
