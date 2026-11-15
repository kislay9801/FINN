import { test, expect } from "@playwright/test";

test("login is the entry page; demo has no personal notifications", async ({
  page,
}, info) => {
  let dataRequests = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/data") dataRequests++;
  });
  await page.route("**/api/auth", (route) =>
    route.fulfill({ json: { configured: true, user: null } }),
  );
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.locator(".notification-bell")).toHaveCount(0);
  await expect(page.locator(".signal-card")).toHaveCount(0);
  expect(dataRequests).toBe(0);
  await page.goto("/workspace?view=alerts");
  await expect(page).toHaveURL(/\/login/);
  expect(dataRequests).toBe(0);
  await page.getByRole("link", { name: "Explore source-backed demo" }).click();
  await expect(page).toHaveURL(/\/demo/);
  await expect(
    page.getByRole("button", { name: "0 unread alerts" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "30 days", exact: true }).click();
  await expect(page.locator(".signal-card").first()).toBeVisible();
  expect(
    await page
      .locator(".signal-card > p")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(15);
  await page
    .getByRole("button", {
      name:
        info.project.name === "desktop"
          ? "Open workspace settings"
          : "Open demo settings",
    })
    .click();
  await page
    .getByLabel("Workspace name", { exact: true })
    .fill("My investment desk");
  await page.getByRole("button", { name: "Save workspace name" }).click();
  await expect(page.getByRole("status")).toContainText("saved on this device");
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.reload();
  await page
    .getByRole("button", {
      name:
        info.project.name === "desktop"
          ? "Open workspace settings"
          : "Open demo settings",
    })
    .click();
  await expect(page.getByLabel("Workspace name", { exact: true })).toHaveValue(
    "My investment desk",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("sign-in verifies a session; first visit is quiet; sign-out protects the workspace", async ({
  page,
}) => {
  // Synthetic provider responses; no real account is created or email sent.
  let user: null | { id: string; name: string; email: string } = null;
  await page.route("**/api/auth", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { configured: true, user } });
    const body = route.request().postDataJSON();
    if (body.action === "logout") {
      user = null;
      return route.fulfill({ json: { user: null } });
    }
    if (body.action === "signup")
      return route.fulfill({
        json: {
          confirmationRequired: true,
          message: "Check your email to confirm your account.",
        },
      });
    if (body.password !== "test-only-password")
      return route.fulfill({
        status: 401,
        json: { error: "Check your email and password." },
      });
    user = {
      id:
        body.email === "second@example.test"
          ? "fixture-second"
          : "fixture-first",
      name: "Test Analyst",
      email: body.email,
    };
    return route.fulfill({ json: { user } });
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill("analyst@example.test");
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Check your email and password" })).toContainText(
    "Check your email and password",
  );
  await expect(page.locator(".notification-bell")).toHaveCount(0);
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace/);
  await expect(page.locator(".mover").first()).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("finn.fixture-first.seen-signals.v1"),
      ),
    )
    .not.toBeNull();
  await expect(
    page.getByRole("button", { name: "0 unread alerts" }),
  ).toBeVisible();
  await page.goto("/workspace?view=portfolio");
  await page
    .getByRole("button", { name: "Remove RELIANCE", exact: true })
    .click();
  await expect(page.locator(".portfolio-table tbody tr")).toHaveCount(17);
  await page.goto("/workspace?view=alerts");
  await expect(page.locator(".notice")).toHaveCount(0);
  await page.locator("input[type=range]").first().fill("1");
  await expect(page.locator(".notice").first()).toBeVisible();
  await page.getByRole("button", { name: "Open account", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator(".notification-bell")).toHaveCount(0);
  await page.goto("/workspace");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email address").fill("second@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace/);
  await page.goto("/workspace?view=portfolio");
  await expect(page.locator(".portfolio-table tbody tr")).toHaveCount(18);
  await expect(
    page.getByRole("button", { name: "0 unread alerts" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("signup confirmation does not grant workspace access", async ({
  page,
}) => {
  await page.route("**/api/auth", (route) =>
    route.fulfill({
      json:
        route.request().method() === "GET"
          ? { configured: true, user: null }
          : {
              confirmationRequired: true,
              message: "Check your email to confirm your account.",
            },
    }),
  );
  await page.goto("/login");
  await page.getByRole("tab", { name: "Create account", exact: true }).click();
  await page.getByLabel("Your name").fill("Test Analyst");
  await page.getByLabel("Email address").fill("analyst@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator(".notification-bell")).toHaveCount(0);
});
