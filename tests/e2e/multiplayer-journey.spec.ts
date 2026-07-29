import { expect, test } from "@playwright/test";
import { completeHand, createTable, joinTable } from "./helpers";

test("two isolated browser contexts join, synchronize placements, and reach showdown", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const hostContext = await browser.newContext();
  const peerContext = await browser.newContext();
  const host = await hostContext.newPage();
  const peer = await peerContext.newPage();
  await createTable(host, "Host", "multiplayer");
  const invite = await host.getByLabel("Invite link").inputValue();
  await joinTable(peer, invite, "Guest");

  await expect(
    host.getByRole("complementary", { name: "Scores" }).getByText("Guest"),
  ).toBeVisible();
  await expect(
    peer.getByText("Settings cannot be changed after creation."),
  ).toHaveCount(0);
  await expect(peer.getByRole("combobox")).toHaveCount(0);
  await completeHand([host, peer]);
  await expect(host.getByRole("heading", { name: "Showdown" })).toBeVisible();
  await expect(peer.getByRole("heading", { name: "Showdown" })).toBeVisible();
  await hostContext.close();
  await peerContext.close();
});

test("enforces two-to-four player capacity and rejects an extra browser", async ({
  browser,
}) => {
  test.setTimeout(60_000);
  for (const capacity of [2, 3, 4] as const) {
    const contexts = await Promise.all(
      Array.from({ length: capacity + 1 }, () => browser.newContext()),
    );
    const pages = await Promise.all(
      contexts.map((context) => context.newPage()),
    );
    await createTable(
      pages[0],
      `Host ${capacity}`,
      "multiplayer",
      String(capacity),
    );
    const invite = await pages[0].getByLabel("Invite link").inputValue();
    for (let index = 1; index < capacity; index += 1)
      await joinTable(pages[index], invite, `Guest ${index}`);
    await pages[capacity].goto(invite);
    await pages[capacity].getByLabel("Display name").fill("Extra");
    await pages[capacity].getByRole("button", { name: "Join lobby" }).click();
    await expect(pages[capacity].getByRole("alert")).toContainText(
      "already full",
    );
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("shows missing-lobby and host-refresh recovery policies", async ({
  page,
}) => {
  await page.goto("./?lobby=E2E-MISSING");
  await page.getByLabel("Display name").fill("Guest");
  await page.getByRole("button", { name: "Join lobby" }).click();
  await expect(page.getByRole("alert")).toContainText("could not be found");

  await createTable(page, "Host", "multiplayer");
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "host session cannot be restored",
  );
});
