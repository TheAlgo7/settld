import { expect, test } from "@playwright/test";

async function continueLocally(page) {
  const deviceButton = page.getByRole("button", { name: "Continue on this device" });
  const nameInput = page.getByLabel("Your name");
  await expect(deviceButton.or(nameInput)).toBeVisible();
  if (await deviceButton.isVisible()) await deviceButton.click();
}

test("local trip flows stay fast, traceable, responsive, and theme-safe", async ({ page, context }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Split. Prove. Settle." })).toBeVisible();
  const googleButton = page.getByRole("button", { name: "Continue with Google" });
  await expect(googleButton).toBeFocused();
  await expect(page.getByRole("button", { name: /phone number/i })).toHaveCount(0);
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Continue on this device" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(googleButton).toBeFocused();

  await page.getByRole("button", { name: "Continue on this device" }).click();
  await page.getByLabel("Your name").fill("Gaurav");
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByRole("heading", { name: "Groups" })).toBeVisible();

  await page.getByRole("button", { name: "Explore a sample trip" }).click();
  await expect(page.getByRole("heading", { name: "Ahmedabad trip" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Overview", selected: true })).toBeVisible();
  await page.getByRole("tab", { name: "Overview" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Expenses", selected: true })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "Overview", selected: true })).toBeFocused();
  await expect(page.locator(".ledger-hero")).toContainText("₹7,338.60");
  await expect(page.getByRole("button", { name: /Smart settle.*3 transfers clear the group/ })).toBeVisible();

  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByLabel("Amount in rupees")).toBeFocused();
  await expect(page.locator("details.expense-more")).not.toHaveAttribute("open", "");
  await page.locator("details.expense-more summary").click();
  await expect(page.getByRole("tab", { name: "Equally", selected: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Attach proof" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("tab", { name: "Expenses" }).click();
  await expect(page.getByText("Proof 1", { exact: true })).toBeVisible();
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
  await expect.poll(() => page.evaluate(async () => {
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
  })).toBe(0);

  await page.getByRole("tab", { name: "Balances" }).click();
  await expect(page.getByText("You get back", { exact: true })).toBeVisible();
  await expect(page.getByText("Gets ₹2,078.95", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "3 transfers clear every balance" })).toBeVisible();
  await page.getByRole("button", { name: "Record" }).first().click();
  await expect(page.getByRole("heading", { name: "Record payment" })).toBeVisible();
  await expect(page.getByText(/Record this only after .* confirms the payment/)).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Trip summary" }).click();
  await expect(page.getByRole("img", { name: "Group spend by category" })).toBeVisible();
  await expect(page.getByText("Category spend, contribution, and balance are shown separately so the numbers stay truthful.")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("tab", { name: "Trail" }).click();
  await expect(page.getByText("Nothing is silently overwritten", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();

  await page.getByRole("link", { name: "Settlements" }).click();
  await expect(page.getByRole("heading", { name: "Settlements" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Record" })).toHaveCount(3);

  await page.getByRole("link", { name: "You" }).click();
  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
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
  await page.getByRole("button", { name: /Ahmedabad trip/ }).click();
  await page.getByRole("tab", { name: "Expenses" }).click();
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
  await page.goto("/");
  await continueLocally(page);
  await page.getByLabel("Your name").fill("Ledger tester");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Explore a sample trip" }).click();
  await page.getByRole("tab", { name: "Balances" }).click();

  await page.getByRole("button", { name: "Record" }).first().click();
  await page.getByRole("button", { name: "Mark as paid" }).click();
  const paymentRow = page.locator(".balances-tab").getByRole("button", { name: / paid / }).last();
  await expect(paymentRow).toBeVisible();
  await paymentRow.click();
  await expect(page.getByRole("heading", { name: "Payment record" })).toBeVisible();
  await page.getByRole("button", { name: "Reverse this payment" }).click();
  await page.getByRole("button", { name: "Tap again to confirm" }).click();
  await expect(page.getByText("Reversed", { exact: true })).toBeVisible();
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
  expect(profile).toMatchObject({ name: "Legacy user", upi: "legacy@upi", theme: "dark" });
  expect(Number.isInteger(profile.updatedAt)).toBe(true);
});

test("signed-out hard deletes leave a durable local tombstone", async ({ page }) => {
  await page.route("https://www.gstatic.com/**", (route) => route.abort());
  await page.goto("/");
  await continueLocally(page);
  await page.getByLabel("Your name").fill("Delete tester");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Explore a sample trip" }).click();
  await page.getByRole("button", { name: "Group settings" }).click();
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
