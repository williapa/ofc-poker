import { expect, test } from "@playwright/test";

test("creates a local AI lobby from the accessible setup form", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Build it in the open." }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Local\b/ })).toBeChecked();
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

test("loads home and join routes from the configured repository path", async ({
  page,
}) => {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Build it in the open." }),
  ).toBeVisible();

  await page.goto("./?lobby=pages-smoke-room");
  await expect(
    page.getByRole("heading", { name: "Join the table" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Join the table" }),
  ).toBeVisible();
});

test("opens, refreshes, and navigates the guided tutorial beneath the repository path", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("link", { name: /Learn how to play/ }).click();
  await expect(page).toHaveURL(/\?view=tutorial$/);
  await expect(
    page.getByRole("heading", { name: "Build three poker hands." }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByText("Step 1 of 10")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("heading", { name: "Start with five cards." }),
  ).toBeFocused();

  await page
    .getByRole("button", {
      name: "Go to step 7: Compare matching rows.",
    })
    .click();
  await expect(page.getByText("+7", { exact: true })).toBeVisible();
  await page
    .getByRole("button", {
      name: "Go to step 8: Queens or better in front earn Fantasyland.",
    })
    .click();
  await expect(
    page.getByText("A full house or better in middle, or"),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Go to step 9: Know your royalties.",
    })
    .click();
  await expect(page.getByRole("table")).toHaveCount(3);
  await page
    .getByRole("button", {
      name: "Go to step 10: Congratulations!",
    })
    .click();
  await expect(page.getByText(/You finished the tutorial/)).toBeVisible();
  await page.getByRole("button", { name: /Redo tutorial/ }).click();
  await expect(
    page.getByRole("heading", { name: "Build three poker hands." }),
  ).toBeFocused();
  await page
    .getByRole("button", {
      name: "Go to step 10: Congratulations!",
    })
    .click();
  await page.getByRole("link", { name: /Start playing/ }).click();
  await expect(page).not.toHaveURL(/view=tutorial/);
  await expect(
    page.getByRole("heading", { name: "Build it in the open." }),
  ).toBeVisible();

  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Build three poker hands." }),
  ).toBeVisible();
});

for (const viewport of [
  { name: "mobile portrait", width: 393, height: 852 },
  { name: "mobile landscape", width: 852, height: 393 },
] as const) {
  test(`keeps tutorial navigation reachable in ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("./?view=tutorial");
    const shell = page.locator(".tutorial-shell");
    const navigation = page.locator(".tutorial-navigation");
    await expect(shell).toBeVisible();
    await expect(navigation).toBeVisible();
    await page
      .getByRole("button", { name: "Go to step 9: Know your royalties." })
      .click();
    await expect(page.getByRole("table")).toHaveCount(3);

    const geometry = await page.evaluate(() => {
      const shell = document.querySelector(".tutorial-shell");
      const navigation = document.querySelector(".tutorial-navigation");
      if (
        !(shell instanceof HTMLElement) ||
        !(navigation instanceof HTMLElement)
      )
        throw new Error("Missing tutorial layout");
      const shellBox = shell.getBoundingClientRect();
      const navigationBox = navigation.getBoundingClientRect();
      return {
        shell: {
          left: shellBox.left,
          right: shellBox.right,
          top: shellBox.top,
          bottom: shellBox.bottom,
        },
        navigation: {
          left: navigationBox.left,
          right: navigationBox.right,
          top: navigationBox.top,
          bottom: navigationBox.bottom,
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        horizontalOverflow:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1,
      };
    });

    expect(geometry.shell.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.shell.top).toBeGreaterThanOrEqual(-1);
    expect(geometry.shell.right).toBeLessThanOrEqual(
      geometry.viewport.width + 1,
    );
    expect(geometry.shell.bottom).toBeLessThanOrEqual(
      geometry.viewport.height + 1,
    );
    expect(geometry.navigation.bottom).toBeLessThanOrEqual(
      geometry.viewport.height + 1,
    );
    expect(geometry.horizontalOverflow).toBe(false);
    await expect(page.getByRole("button", { name: /Next/ })).toBeVisible();
  });
}
