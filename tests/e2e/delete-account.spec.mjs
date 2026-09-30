// Deleting an account, end to end against the Firebase emulators:
//   firebase emulators:exec --only auth,firestore --project settld-in "npx playwright test delete-account"
// Skipped in a plain `npx playwright test` run, which has no emulators.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";

test.skip(!process.env.FIRESTORE_EMULATOR_HOST, "needs the Firebase emulators");

const OTHER = "other-member-uid";

test("deleting an account leaves shared groups for the others and removes the login", async ({ page }) => {
  const env = await initializeTestEnvironment({
    projectId: "settld-in",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });

  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("settld.emulators", "1"));
  await page.reload();

  // The emulator's stand-in Google sign-in.
  const email = `delete${Date.now()}@example.com`;
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "Continue with Google" }).click(),
  ]);
  await popup.getByText("Add new account").click();
  await popup.locator("#email-input").fill(email);
  await popup.locator("#display-name-input").fill("Deleted Person");
  await popup.getByRole("button", { name: "Sign in with Google.com" }).click();

  // A new account gets the "Make it yours" sheet, prefilled from Google.
  await expect(page.getByLabel("Your name")).toHaveValue("Deleted Person", { timeout: 15_000 });
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Explore a sample trip" }).click();
  await expect(page.getByRole("heading", { name: "Goa trip" })).toBeVisible();
  const gid = await page.evaluate(() => location.hash.replace("#/group/", ""));

  // Share it, then have somebody else join (seeded with the rules off).
  await page.getByRole("button", { name: "Group menu" }).click();
  await page.getByRole("button", { name: /Share this group/ }).click();
  await page.getByRole("button", { name: "Turn on sharing" }).click();
  await expect(page.locator(".invite-code")).toBeVisible({ timeout: 15_000 });
  let uid;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const ref = doc(ctx.firestore(), "groups", gid);
    const group = (await getDoc(ref)).data();
    uid = group.ownerUid;
    await updateDoc(ref, {
      memberUids: [...group.memberUids, OTHER],
      members: [...group.members, { id: "m-other", name: "Aisha", upi: "", uid: OTHER }],
    });
  });
  await page.keyboard.press("Escape");

  await page.goto("/#/settings");
  const del = page.locator("#st-delete");
  await expect(del).toContainText("Delete account");
  await del.click();
  await expect(del).toContainText("Tap again");
  await del.click();
  await expect(page.getByRole("heading", { name: "Split. Prove. Settle." })).toBeVisible({ timeout: 20_000 });

  // The login is gone.
  const res = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/settld-in/accounts:batchGet?maxResults=500", {
    headers: { Authorization: "Bearer owner" },
  });
  expect(JSON.stringify(await res.json())).not.toContain(email);

  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // The personal backup is empty.
    for (const name of ["groups", "expenses", "settlements", "events", "attachments"]) {
      expect((await getDocs(collection(db, "users", uid, name))).size).toBe(0);
    }
    expect((await getDoc(doc(db, "users", uid, "meta", "profile"))).exists()).toBe(false);
    // The shared group carries on for the other member, with the leaver unlinked.
    const group = (await getDoc(doc(db, "groups", gid))).data();
    expect(group.memberUids).toEqual([OTHER]);
    expect(group.members.some((m) => m.uid === uid)).toBe(false);
    expect((await getDocs(collection(db, "groups", gid, "expenses"))).size).toBeGreaterThan(0);
  });
  await env.cleanup();
});
