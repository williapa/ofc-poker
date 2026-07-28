import { expect, type Page } from "@playwright/test";

export async function createTable(
  page: Page,
  name: string,
  mode: "local-ai" | "multiplayer",
  players = "2",
) {
  await page.goto("./");
  await page.getByLabel("Display name").fill(name);
  await page
    .getByRole("radio", {
      name: new RegExp(mode === "local-ai" ? "^Local\\b" : "^Multiplayer\\b"),
    })
    .check();
  await page.getByRole("combobox", { name: "Players" }).selectOption(players);
  await page.getByRole("button", { name: /Create table/ }).click();
  await expect(page.getByRole("heading", { name: "OFC Poker" })).toBeVisible();
}

export async function joinTable(page: Page, url: string, name: string) {
  await page.goto(url);
  await page.getByLabel("Display name").fill(name);
  await page.getByRole("button", { name: "Join lobby" }).click();
  await expect(page.getByRole("heading", { name: "OFC Poker" })).toBeVisible();
}

export async function placeTurn(page: Page) {
  const hand = page.getByRole("group", { name: "Cards to place" });
  const cards = hand.getByRole("button");
  const count = await cards.count();
  if (count > 1) {
    for (let index = 0; index < count; index += 1) {
      await cards.first().press("Enter");
      await page
        .getByRole("button", {
          name: index < 3 ? "Place in Front" : "Place in Middle",
        })
        .press("Enter");
    }
    await page
      .getByRole("button", { name: "Confirm initial five" })
      .press("Enter");
    return;
  }
  await cards.first().press("Enter");
  await page
    .getByRole("button", { name: /^Place in (Front|Middle|Back)$/ })
    .first()
    .press("Enter");
}

export async function completeHand(pages: readonly Page[]) {
  for (let turns = 0; turns < 30; turns += 1) {
    for (const page of pages) {
      if (await page.getByRole("heading", { name: "Showdown" }).isVisible())
        return;
    }
    let activePage = -1;
    await expect
      .poll(async () => {
        for (let index = 0; index < pages.length; index += 1) {
          const pending = pages[index]
            .getByRole("group", { name: "Cards to place" })
            .getByRole("button")
            .first();
          if (
            (await pages[index]
              .getByText("Your turn — arrange your cards", { exact: true })
              .isVisible()) &&
            (await pending.count()) > 0 &&
            (await pending.isEnabled())
          ) {
            activePage = index;
            return index;
          }
        }
        return -1;
      })
      .toBeGreaterThanOrEqual(0);
    const pending = pages[activePage]
      .getByRole("group", { name: "Cards to place" })
      .getByRole("button")
      .first();
    if ((await pending.count()) === 0) continue;
    await expect(pending).toBeEnabled();
    await placeTurn(pages[activePage]);
  }
  await expect(
    pages[0].getByRole("heading", { name: "Showdown" }),
  ).toBeVisible();
}
