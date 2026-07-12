import { expect, test } from "@playwright/test";

test("renders the accessible application shell", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Build your board." }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Three-dimensional table preview" }),
  ).toBeVisible();
});
