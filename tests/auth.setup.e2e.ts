import { test } from "@e2e-dev/web";
import { expect, credentials } from "e2e";

test.setup("authenticate as admin", { sessions: ["admin"] }, async ({ app, screen, session, browser }) => {
  const admin = credentials.user("admin");

  await app.open("/login");
  await screen.getByLabel("Email").fill(admin.username);
  await screen.getByLabel("Password").fill(admin.password);
  await screen.getByRole("button", "Sign in").tap();

  await expect(browser).toHaveURL("/dashboard");
  await session.save("admin");
});
