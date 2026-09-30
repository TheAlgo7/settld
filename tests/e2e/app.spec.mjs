import { expect, test } from "@playwright/test";

async function continueLocally(page) {
  const deviceButton = page.getByRole("button", { name: "Continue on this device" });
  const nameInput = page.getByLabel("Your name");
  await expect(deviceButton.or(nameInput)).toBeVisible();
  if (await deviceButton.isVisible()) await deviceButton.click();
}

async function startWith(page, name) {
  await page.goto("/");
  await continueLocally(page);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Explore a sample trip" }).click();
  await expect(page.getByRole("heading", { name: "Goa trip" })).toBeVisible();
}

const attachmentCount = (page) =>
  page.evaluate(async () => {
    const request = indexedDB.open("settld", 1);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("attachments", "readonly");
    const count = transaction.objectStore("attachments").count();
    return new Promise((resolve, reject) => {
      count.onsuccess = () => resolve(count.result);
      count.onerror = () => reject(count.error);
    });
  });

test("a group reads as one screen: position, who owes whom, then expenses", async ({ page, context }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Split. Prove. Settle." })).toBeVisible();
  // The dialog itself takes focus on open (focusing the first control would
  // paint a focus ring on every open); Tab enters the trap at the top.
  await expect(page.getByRole("dialog")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Continue on this device" })).toBeFocused();

  await page.getByRole("button", { name: "Continue on this device" }).click();
  await page.getByLabel("Your name").fill("Gaurav");
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByRole("heading", { name: "Groups" })).toBeVisible();

  await page.getByRole("button", { name: "Explore a sample trip" }).click();
  await expect(page.getByRole("heading", { name: "Goa trip" })).toBeVisible();

  // The old four-tab group screen is gone; everything is on one surface.
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.locator(".money-block")).toContainText("₹2,078.95");
  await expect(page.locator(".money-block")).toContainText("₹7,338.60 spent across 4 expenses");
  await expect(page.locator(".owe-row")).toHaveCount(3);
  await expect(page.locator(".owe-row").first()).toContainText("owes you");
  await expect(page.getByRole("button", { name: /Hotel, two nights/ })).toBeVisible();

  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByLabel("Amount in rupees")).toBeFocused();
  await expect(page.locator("details.expense-more")).not.toHaveAttribute("open", "");
  await page.locator("details.expense-more summary").click();
  await expect(page.getByRole("tab", { name: "Equally", selected: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Attach proof" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  // Proof survives a round trip and its blob is reclaimed when removed.
  await page.getByRole("button", { name: /Hotel, two nights/ }).click();
  await expect(page.getByText("Proof attached", { exact: true })).toBeVisible();
  await expect(page.locator(".proof-gallery img")).toHaveCount(1);
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit expense" })).toBeVisible();
  await page.getByRole("button", { name: "View proof 1" }).click();
  await expect(page.getByRole("heading", { name: "Proof" })).toBeVisible();
  await page.getByRole("button", { name: "Remove this proof" }).click();
  await page.getByRole("button", { name: "Tap again to confirm" }).click();
  await expect(page.getByRole("heading", { name: "Edit expense" })).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: /Hotel, two nights/ }).click();
  await expect(page.getByText("No proof attached", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  await expect.poll(() => attachmentCount(page)).toBe(0);

  await page.getByRole("button", { name: "Settle up" }).click();
  await expect(page.getByText("3 transfers clear every current balance", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Record" }).first().click();
  await expect(page.getByRole("heading", { name: "Record payment" })).toBeVisible();
  await expect(page.getByText(/Record this only after .* confirms the payment/)).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  // Summary and history moved behind the group menu.
  await page.getByRole("button", { name: "Group menu" }).click();
  await page.getByRole("button", { name: /Trip summary/ }).click();
  await expect(page.getByRole("img", { name: "Group spend by category" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Group menu" }).click();
  await page.getByRole("button", { name: /^History/ }).click();
  await expect(page.getByText("Nothing is silently overwritten", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Back to groups" }).click();
  await page.getByRole("link", { name: "Friends" }).click();
  await expect(page.getByRole("heading", { name: "Friends" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Aisha/ })).toBeVisible();

  await page.getByRole("link", { name: "You" }).click();
  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Azure" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-accent", "azure");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-accent", "azure");
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await context.setOffline(true);
  await page.getByRole("link", { name: "Groups" }).click();
  await expect(page.getByText("Offline", { exact: true })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Groups" })).toBeVisible();
  await expect(page.getByText("Offline", { exact: true })).toBeVisible();
  await context.setOffline(false);

  await page.setViewportSize({ width: 320, height: 720 });
  await page.getByRole("button", { name: /Goa trip/ }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: "Add expense" })).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test("first run still works when Firebase cannot load", async ({ page }) => {
  await page.route("https://www.gstatic.com/**", (route) => route.abort());
  await page.goto("/");

  await expect(page.getByLabel("Your name")).toBeVisible();
  await page.getByLabel("Your name").fill("Offline traveller");
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByRole("heading", { name: "Groups" })).toBeVisible();
});

test("recorded payments can be reversed without rewriting history", async ({ page }) => {
  await startWith(page, "Ledger tester");

  await page.getByRole("button", { name: "Settle up" }).click();
  await page.getByRole("button", { name: "Record" }).first().click();
  await page.getByRole("button", { name: "Mark as paid" }).click();

  await page.getByRole("button", { name: "Settle up" }).click();
  const paymentRow = page.getByRole("button", { name: / paid / }).last();
  await expect(paymentRow).toBeVisible();
  await paymentRow.click();
  await expect(page.getByRole("heading", { name: "Payment record" })).toBeVisible();
  await page.getByRole("button", { name: "Reverse this payment" }).click();
  await page.getByRole("button", { name: "Tap again to confirm" }).click();

  await page.getByRole("button", { name: "Settle up" }).click();
  await expect(page.getByText("Reversed", { exact: true })).toBeVisible();
});

test("sharing a group asks for an account before handing out a link", async ({ page }) => {
  await startWith(page, "Host");

  await page.getByRole("button", { name: "Group menu" }).click();
  await page.getByRole("button", { name: /Share this group/ }).click();
  // Signed out there is nothing to share into yet, so no link is offered.
  await expect(page.getByRole("button", { name: "Sign in to share" })).toBeVisible();
  await expect(page.locator(".invite-code")).toHaveCount(0);
});

test("an invite link resolves to a join screen that needs an account", async ({ page }) => {
  await startWith(page, "Guest");
  const gid = await page.evaluate(() => location.hash.replace("#/group/", ""));

  await page.goto(`/#/join/${gid}`);
  // Already a member of this local group, so it just opens.
  await expect(page.getByRole("heading", { name: "Goa trip" })).toBeVisible();

  await page.goto("/#/join/some-other-group-id");
  await expect(page.getByRole("heading", { name: "Join group" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("a local-only group never touches the shared path", async ({ page }) => {
  await startWith(page, "Local only");
  const group = await page.evaluate(async () => {
    const request = indexedDB.open("settld", 1);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("groups", "readonly");
    const all = transaction.objectStore("groups").getAll();
    return new Promise((resolve, reject) => {
      all.onsuccess = () => resolve(all.result[0]);
      all.onerror = () => reject(all.error);
    });
  });
  expect(group.shared).toBeUndefined();
  expect(group.memberUids).toBeUndefined();
  expect(group.members.some((m) => m.isYou)).toBe(true);
});

test("legacy local profiles are migrated before cloud backup", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const request = indexedDB.open("settld", 1);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("kv", "readwrite");
    transaction.objectStore("kv").put({ name: "Legacy user", upi: "legacy@upi" }, "profile");
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Groups" })).toBeVisible();
  const profile = await page.evaluate(async () => {
    const request = indexedDB.open("settld", 1);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("kv", "readonly");
    const get = transaction.objectStore("kv").get("profile");
    return new Promise((resolve, reject) => {
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    });
  });
  // accent and phone must be filled in, otherwise the deployed rules reject
  // the backup write for having the wrong key set.
  expect(profile).toMatchObject({
    name: "Legacy user",
    upi: "legacy@upi",
    phone: "",
    theme: "dark",
    accent: "coral",
  });
  expect(Number.isInteger(profile.updatedAt)).toBe(true);
});

test("signed-out hard deletes leave a durable local tombstone", async ({ page }) => {
  await page.route("https://www.gstatic.com/**", (route) => route.abort());
  await page.goto("/");
  await continueLocally(page);
  await page.getByLabel("Your name").fill("Delete tester");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Explore a sample trip" }).click();
  await page.getByRole("button", { name: "Group menu" }).click();
  await page.getByRole("button", { name: /Group settings/ }).click();
  await page.getByRole("button", { name: "Delete group" }).click();
  await page.getByRole("button", { name: "Tap again to confirm" }).click();
  await expect(page.getByRole("heading", { name: "Groups" })).toBeVisible();

  await expect.poll(() => page.evaluate(async () => {
    const request = indexedDB.open("settld", 1);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("kv", "readonly");
    const get = transaction.objectStore("kv").get("outbox");
    const outbox = await new Promise((resolve, reject) => {
      get.onsuccess = () => resolve(get.result ?? []);
      get.onerror = () => reject(get.error);
    });
    return outbox.some((item) => item.op === "del" && item.store === "groups");
  })).toBe(true);
});

test("the dock's + starts a group, then adds straight into the only one", async ({ page }) => {
  await page.goto("/");
  await continueLocally(page);
  await page.getByLabel("Your name").fill("Quick");
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByRole("heading", { name: "Groups" })).toBeVisible();

  const add = page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Add expense" });
  await add.click();
  await expect(page.getByRole("heading", { name: "New group" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Explore a sample trip" }).click();
  await expect(page.getByRole("heading", { name: "Goa trip" })).toBeVisible();
  // On a group screen the dock steps aside for the group's own buttons.
  await expect(add).toBeHidden();
  await page.goto("/#/");
  await add.click();
  await expect(page.getByRole("heading", { name: "Add expense" })).toBeVisible();
});
