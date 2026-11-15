import { test, expect } from "@playwright/test";

test("readable typography and persistent workspace settings", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "30 days", exact: true }).click();
  await expect(page.locator(".signal-card").first()).toBeVisible();
  expect(
    await page
      .locator(".signal-card > p")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(15);
  expect(
    await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).not.toBe("rgb(255, 255, 255)");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("guest workspace");
  await page
    .getByLabel("Workspace name", { exact: true })
    .fill("My investment desk");
  await page.getByRole("button", { name: "Save workspace name" }).click();
  await expect(page.getByRole("status")).toContainText("saved on this device");
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.reload();
  if (info.project.name === "desktop")
    await page.getByRole("button", { name: "Open workspace settings" }).click();
  else await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByLabel("Workspace name", { exact: true })).toHaveValue(
    "My investment desk",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("configured sign-in and sign-out UI handles provider responses", async ({
  page,
}) => {
  // Mock account responses only; these are synthetic users, never real auth sessions.
  let signedIn = false;
  const user = {
    id: "fixture-user",
    name: "Test Analyst",
    email: "analyst@example.test",
  };
  await page.route("**/api/auth", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: { configured: true, user: signedIn ? user : null },
      });
    const body = route.request().postDataJSON();
    if (body.action === "logout") {
      signedIn = false;
      return route.fulfill({ json: { user: null } });
    }
    if (body.password !== "test-only-password")
      return route.fulfill({
        status: 401,
        json: { error: "Check your email and password." },
      });
    signedIn = true;
    return route.fulfill({ json: { user } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email address").fill(user.email);
  await dialog
    .locator('input[autocomplete="current-password"]')
    .fill("incorrect-password");
  await dialog.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Check your email and password",
  );
  await dialog
    .locator('input[autocomplete="current-password"]')
    .fill("test-only-password");
  await dialog.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(dialog).toContainText("Your email account is authenticated");
  await expect(dialog).toContainText(user.email);
  await dialog.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(dialog.getByLabel("Email address")).toBeVisible();
  await expect(dialog.getByRole("status")).toContainText("signed out");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
