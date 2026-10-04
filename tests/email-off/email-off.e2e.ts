import { test } from "@e2e-dev/web";
import { expect } from "e2e";

test("signs in with email intake unconfigured; Automation is hidden", { session: "admin" }, async ({ app, browser }) => {
  await app.open("/dashboard");
  await expect(browser.locator("body")).toContainText("Invoices");
  await expect(browser.locator("body")).not.toContainText("Automation");
});

test("/dashboard/automation is 404 when email intake is unconfigured", { session: "admin" }, async ({ app, browser }) => {
  await app.open("/dashboard/automation");
  await expect(browser.locator("body")).toContainText(/not found|404/i);
});

test("settings has no forwarding card", { session: "admin" }, async ({ app, browser }) => {
  await app.open("/dashboard/settings");
  await expect(browser.locator("body")).toContainText("Password");
  await expect(browser.locator("body")).not.toContainText("Forwarding address");
});

test("AgentMail webhook returns 404 when unconfigured", async ({ app, browser }) => {
  await app.open("/");
  const status = await browser.evaluate(
    async () => (await fetch("/api/webhooks/agentmail", { method: "POST", body: "{}" })).status,
  );
  expect(status).toBe(404);
});
