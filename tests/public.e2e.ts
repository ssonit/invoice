import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("landing page has no pricing section or Polar mentions", async ({ app, browser }) => {
  await app.open("/");
  await expect(browser.locator("body")).toBeVisible();
  await expect(browser.locator("#pricing")).toHaveCount(0);
  await expect(browser.locator("body")).not.toContainText("Polar");
});

test("terms page no longer names a payment processor", async ({ app, browser }) => {
  await app.open("/terms");
  await expect(browser.locator("body")).toBeVisible();
  await expect(browser.locator("body")).not.toContainText("Polar");
});

test("privacy page opens", async ({ app, browser }) => {
  await app.open("/privacy");
  await expect(browser.locator("body")).toBeVisible();
});
