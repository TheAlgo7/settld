// The Splitwise-parity features: line icons, search, comments, restore,
// repeats, itemised bills, foreign currency, a saved default split, one-to-one
// expenses and the Splitwise import. Everything runs on this device with the
// sample trip (invented people) and no account.

import { expect, test } from "@playwright/test";

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

async function start(page, name = "Aarav") {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const deviceButton = page.getByRole("button", { name: "Continue on this device" });
  const nameInput = page.getByLabel("Your name");
  await expect(deviceButton.or(nameInput)).toBeVisible();
  if (await deviceButton.isVisible()) await deviceButton.click();
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Explore a sample trip" }).click();
  await expect(page.getByRole("heading", { name: "Goa trip" })).toBeVisible();
  return errors;
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("line icons stand in for every emoji", async ({ page }) => {
  const errors = await start(page);
  expect(await page.locator("body").innerText()).not.toMatch(EMOJI);
  await expect(page.locator(".group-emoji svg")).toHaveCount(1);
  await expect(page.locator(".ex-row .ico svg")).toHaveCount(4);
  await page.getByRole("button", { name: "Back to groups" }).click();
  await expect(page.locator(".group-row .tile svg")).toHaveCount(1);
  await page.getByRole("button", { name: "New group" }).click();
  await expect(page.getByRole("group", { name: "Group icon" }).getByRole("button")).toHaveCount(12);
  await expect(page.getByRole("button", { name: "Trip", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator("body").innerText()).not.toMatch(EMOJI);
  expect(errors).toEqual([]);
});

test("search finds expenses by words, people and amounts", async ({ page }) => {
  const errors = await start(page);
  await page.getByRole("button", { name: "Search Goa trip" }).click();
  const box = page.getByRole("searchbox", { name: "Search expenses" });
  const hits = page.locator(".search-results .ex-row");
  await box.fill("nights");
  await expect(hits).toHaveCount(1);
  await box.fill("4,793");
  await expect(hits).toHaveCount(1);
  await box.fill("rohan");
  await expect(hits).toHaveCount(1);
  await expect(hits.first()).toContainText("Beach shack dinner");
  await box.fill("nothing like this");
  await expect(page.getByText(/Nothing matches/)).toBeVisible();
  await box.fill("dinner");
  await hits.first().click();
  await expect(page.getByRole("heading", { name: "Beach shack dinner" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("comments stay with the expense and show in the activity", async ({ page }) => {
  const errors = await start(page);
  await page.getByRole("button", { name: /Beach shack dinner/ }).click();
  await page.getByLabel("Add a comment").fill("Was the tip included?");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect(page.locator(".comment")).toContainText("Was the tip included?");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: /Beach shack dinner/ }).locator(".proof-dot")).toContainText("1");
  await page.getByRole("button", { name: "Back to groups" }).click();
  await page.getByRole("link", { name: "Activity" }).click();
  const row = page.getByRole("button", { name: /on Beach shack dinner: “Was the tip included\?”/ });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole("heading", { name: "Beach shack dinner" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("a deleted expense can be brought back", async ({ page }) => {
  const errors = await start(page);
  await page.getByRole("button", { name: /Fort Aguada tickets/ }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Tap again to confirm" }).click();
  await expect(page.getByRole("button", { name: /Fort Aguada tickets/ })).toHaveCount(0);
  await expect(page.locator(".money-block")).toContainText("3 expenses");
  await page.getByRole("button", { name: "Group menu" }).click();
  await page.getByRole("button", { name: /^Deleted expenses/ }).click();
  await page.getByRole("button", { name: /Fort Aguada tickets/ }).click();
  await expect(page.locator(".status-note.deleted")).toContainText("Deleted today");
  await page.getByRole("button", { name: "Bring it back" }).click();
  // Both sheets close: the list empties once its only expense is back.
  await expect(page.locator(".sheetwrap")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Fort Aguada tickets/ })).toBeVisible();
  await expect(page.locator(".money-block")).toContainText("₹7,338.60 spent across 4 expenses");
  expect(errors).toEqual([]);
});

test("a monthly expense added for an earlier date catches up, then can stop", async ({ page }) => {
  const errors = await start(page);
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  await page.getByRole("button", { name: "Add expense" }).click();
  await page.getByLabel("Amount in Indian rupee").fill("12000");
  await page.getByLabel("Expense description").fill("Flat rent");
  await expect(page.getByRole("button", { name: "Category: Rent. Change" })).toBeVisible();
  await page.locator("details.expense-more summary").click();
  await page.getByLabel("Date").fill(iso(first));
  await page.getByRole("group", { name: "Repeats" }).getByRole("button", { name: "Monthly" }).click();
  await expect(page.getByText(/Added again automatically/)).toBeVisible();
  await page.locator(".sfoot").getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByRole("button", { name: /Flat rent/ })).toHaveCount(3);
  // Only the newest carries the schedule.
  await expect(page.locator(".ex-row .proof-dot[title^='Repeats']")).toHaveCount(1);
  await page.getByRole("button", { name: /Flat rent/ }).first().click();
  await expect(page.locator(".status-note")).toContainText("Repeats monthly");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.locator(".status-note")).toHaveCount(0);
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".ex-row .proof-dot[title^='Repeats']")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("an itemised bill splits items by who had them and tax in proportion", async ({ page }) => {
  const errors = await start(page);
  await page.getByRole("button", { name: "Add expense" }).click();
  await page.getByLabel("Amount in Indian rupee").fill("1150");
  await page.getByLabel("Expense description").fill("Thali place");
  await page.locator("details.expense-more summary").click();
  await page.getByRole("tab", { name: "Items" }).click();
  const first = page.locator(".item-row").nth(0);
  await page.getByLabel("Item 1 name").fill("Thali");
  await page.getByLabel("Item 1 amount").fill("600");
  await first.getByRole("button", { name: "Rohan had this" }).click();
  await first.getByRole("button", { name: "Kabir had this" }).click();
  await page.getByRole("button", { name: "+ Add an item" }).click();
  const second = page.locator(".item-row").nth(1);
  await page.getByLabel("Item 2 name").fill("Lassi");
  await page.getByLabel("Item 2 amount").fill("400");
  for (const name of ["You", "Aisha", "Kabir"]) await second.getByRole("button", { name: `${name} had this` }).click();
  await expect(page.getByText("The other ₹150 (tax, service, tip) is shared in proportion.")).toBeVisible();
  await page.locator(".sfoot").getByRole("button", { name: "Add expense" }).click();
  await page.getByRole("button", { name: /Thali place/ }).click();
  const shares = page.locator(".x-shares .row");
  await expect(shares).toHaveCount(3);
  await expect(shares.filter({ hasText: "You" })).toContainText("₹345");
  await expect(shares.filter({ hasText: "Aisha" })).toContainText("₹345");
  await expect(shares.filter({ hasText: "Rohan" })).toContainText("₹460");
  await expect(page.getByText("Tax, service and tip")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a foreign expense is kept in rupees at the day's rate", async ({ page }) => {
  await page.route("https://open.er-api.com/**", (route) =>
    route.fulfill({ json: { result: "success", rates: { INR: 1, USD: 0.012 } } }),
  );
  const errors = await start(page);
  await page.getByRole("button", { name: "Add expense" }).click();
  await page.getByRole("button", { name: /Currency: Indian rupee/ }).click();
  await page.getByRole("button", { name: /US dollar/ }).click();
  await page.getByLabel("Amount in US dollar").fill("10");
  await expect(page.locator(".fx-line")).toContainText("₹833.33");
  await page.getByLabel("Expense description").fill("Museum");
  await page.locator(".sfoot").getByRole("button", { name: "Add expense" }).click();
  const row = page.getByRole("button", { name: /Museum/ });
  await expect(row).toContainText("₹833.33");
  await expect(row).toContainText("$10.00");
  await row.click();
  await expect(page.locator(".fx-was")).toContainText("$10.00 at ₹83.33 per USD");
  // The next expense in this group starts in the same currency.
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByRole("button", { name: /Currency: US dollar/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("a split saved from an expense starts the next one", async ({ page }) => {
  const errors = await start(page);
  await page.getByRole("button", { name: "Add expense" }).click();
  await page.getByLabel("Amount in Indian rupee").fill("1000");
  await page.getByLabel("Expense description").fill("Groceries run");
  await page.locator("details.expense-more summary").click();
  await page.getByRole("tab", { name: "Percent" }).click();
  for (const [name, value] of [["You", "40"], ["Aisha", "20"], ["Rohan", "20"], ["Kabir", "20"]]) {
    await page.getByLabel(`Percentage for ${name}`).fill(value);
  }
  await page.getByLabel("Use this split for new expenses in Goa trip").check();
  await page.locator(".sfoot").getByRole("button", { name: "Add expense" }).click();
  await expect(page.locator(".sheetwrap")).toHaveCount(0);
  await page.locator("#screen").getByRole("button", { name: "Add expense" }).click();
  await page.locator("details.expense-more summary").click();
  await expect(page.getByRole("tab", { name: "Percent", selected: true })).toBeVisible();
  await expect(page.getByLabel("Percentage for You")).toHaveValue("40");
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Group menu" }).click();
  await page.getByRole("button", { name: /^Group settings/ }).click();
  await expect(page.getByText("You 40%, Aisha 20%, Rohan 20%, Kabir 20%")).toBeVisible();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText("Equally between everyone")).toBeVisible();
  expect(errors).toEqual([]);
});

test("an expense with one person gets its own ledger and a reminder", async ({ page }) => {
  const errors = await start(page);
  await page.getByRole("button", { name: "Back to groups" }).click();
  await page.getByRole("link", { name: "Friends" }).click();
  await page.getByRole("button", { name: "Expense with one person" }).click();
  await page.getByLabel("With whom?").fill("Meera");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Amount in Indian rupee").fill("500");
  await page.getByLabel("Expense description").fill("Movie");
  await page.locator(".sfoot").getByRole("button", { name: "Add expense" }).click();
  const meera = page.locator("#screen").getByRole("button", { name: /Meera/ });
  await expect(meera).toContainText("Owes you");
  await expect(meera).toContainText("₹250");
  await meera.click();
  const remind = page.getByRole("link", { name: "Remind" });
  await expect(remind).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
  const text = decodeURIComponent((await remind.getAttribute("href")).split("text=")[1]);
  expect(text).toContain("you owe me ₹250");
  expect(text).not.toContain("for Meera");
  expect(errors).toEqual([]);
});

test("a Splitwise export comes across with its balances intact", async ({ page }) => {
  const errors = await start(page);
  await page.getByRole("button", { name: "Back to groups" }).click();
  await page.getByRole("button", { name: /Bring a group from Splitwise/ }).click();
  const csv = [
    "Date,Description,Category,Cost,Currency,Aarav,Isha,Dev",
    "",
    "2026-03-01,Hotel,Hotel,4800.00,INR,3200.00,-1600.00,-1600.00",
    '2026-03-01,"Dinner, beach shack",Dining out,1500.00,INR,-500.00,1000.00,-500.00',
    "2026-03-03,Isha paid Aarav,Payment,500.00,INR,-500.00,500.00,0.00",
    "",
    "2026-03-09,Total balance, , ,INR,2200.00,-100.00,-2100.00",
  ].join("\n");
  await page.locator(".imp-file").setInputFiles({ name: "flat-302_2026-03-09_export.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.getByRole("heading", { name: "Check the import" })).toBeVisible();
  await expect(page.getByLabel("Group name")).toHaveValue("Flat 302");
  await expect(page.getByRole("group", { name: "Which one is you" }).getByRole("button", { name: /Aarav/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Import the group" }).click();
  await expect(page.getByRole("heading", { name: "Flat 302" })).toBeVisible();
  await expect(page.locator("#toast")).toContainText("Balances match Splitwise");
  await expect(page.locator(".money-block")).toContainText("You get back");
  await expect(page.locator(".money-block")).toContainText("2,200");
  await expect(page.getByRole("button", { name: /Dinner, beach shack/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("the summary charts spend over time, by person, and your own share", async ({ page }) => {
  const errors = await start(page);
  await page.getByRole("button", { name: "Group menu" }).click();
  await page.getByRole("button", { name: /^Summary/ }).click();
  await expect(page.getByRole("img", { name: "Group spend by category" })).toBeVisible();
  await expect(page.getByText("Day by day")).toBeVisible();
  await expect(page.locator(".person-bar")).toHaveCount(4);
  await page.getByRole("tab", { name: "Your share" }).click();
  await expect(page.getByRole("img", { name: "Your share by category" })).toBeVisible();
  await expect(page.locator(".person-bar")).toHaveCount(0);
  expect(errors).toEqual([]);
});
