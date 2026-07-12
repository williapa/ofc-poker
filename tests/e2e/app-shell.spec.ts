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

  await expect(
    page.getByRole("heading", { name: "Your game is ready." }),
  ).toBeFocused();
  await expect(
    page.getByText("Settings cannot be changed after creation."),
  ).toBeVisible();
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
