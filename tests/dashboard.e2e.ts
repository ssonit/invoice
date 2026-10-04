import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("sidebar shows Automation when email intake is configured", { session: "admin" }, async ({ app, screen }) => {
  await app.open("/dashboard");
  await expect(screen.getByRole("link", "Automation")).toBeVisible();
});

test("settings has no billing card and shows the forwarding card", { session: "admin" }, async ({ app, browser }) => {
  await app.open("/dashboard/settings");
  await expect(browser.locator("body")).toContainText("Forwarding address");
  await expect(browser.locator("body")).not.toContainText("Billing");
  await expect(browser.locator("body")).not.toContainText("Team plan");
  await expect(browser.locator("body")).not.toContainText("Upgrade");
});

test("exports page is open to everyone (no upgrade gate)", { session: "admin" }, async ({ app, browser, screen }) => {
  await app.open("/dashboard/exports");
  await expect(browser.locator("body")).not.toContainText("Team plan");
  await expect(screen.getByRole("link", "Download CSV")).toBeVisible();
});

test("CSV export downloads", { session: "admin" }, async ({ app, screen, browser }) => {
  await app.open("/dashboard/exports");
  const file = await browser.waitForDownload(() => screen.getByRole("link", "Download CSV").tap());
  expect(file.path).toMatch(/invoices-\d{4}-\d{2}-\d{2}\.csv$/);
});

test("automation page offers a forwarding address and no upgrade CTA", { session: "admin" }, async ({ app, browser }) => {
  await app.open("/dashboard/automation");
  await expect(browser.locator("body")).not.toContainText("Upgrade");
  // Visible only — never click the create button: with real AgentMail keys it creates a real inbox.
  await expect(browser.locator("body")).toContainText("forwarding address");
});
