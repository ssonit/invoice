import { test } from "@e2e-dev/web";
import { expect } from "e2e";

// Calls the real LLM provider from .env.local (a few cents). Skip with --exclude-tag llm.
test("uploading a PDF extracts it with no quota or plan limit", { session: "admin", tags: ["llm"] }, async ({ app, browser, screen }) => {
  await app.open("/dashboard/invoices");
  await browser.locator('input[type="file"]').setInputFiles("tests/fixtures/invoice-sample.pdf");
  await screen.getByRole("button", /Upload & extract/).tap();

  await expect(browser.locator("body")).toContainText("Acme Test Supplies", { timeout: 90_000 });
  await expect(browser.locator("body")).not.toContainText("monthly invoice limit");
});
