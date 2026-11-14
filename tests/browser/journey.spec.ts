import { test, expect } from "@playwright/test";
test("source-backed digest, evidence and review workflow", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Your portfolio/ }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /(?:Cached real observations|Refreshed sources) · EOD, not live prices/,
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "30 days", exact: true }).click();
  await expect(page.locator(".signal-card").first()).toBeVisible();
  await page.getByRole("button", { name: "Toggle signal filters" }).click();
  await page.getByLabel("Category", { exact: true }).selectOption("results");
  await expect(page.locator(".signal-card").first()).toContainText("Results");
  await page
    .locator(".signal-card")
    .first()
    .getByRole("button", { name: "View evidence" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Open original source/ }),
  ).toHaveAttribute("href", /^https:\/\/nsearchives.nseindia.com\//);
  await page
    .getByRole("button", { name: "Mark reviewed", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reviewed", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save signal", exact: true }).click();
  await page.getByRole("button", { name: "Close panel" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("watchlist search, alert settings persistence and source research", async ({
  page,
}, testInfo) => {
  await page.goto("/?view=portfolio");
  await expect(page.locator(".portfolio-table tbody tr")).toHaveCount(18);
  await page.getByRole("button", { name: "Add company", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Company name or NSE ticker" })
    .fill("WIPRO");
  await expect(
    page.getByRole("button", { name: "Add WIPRO to watchlist" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add WIPRO to watchlist" }).click();
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.locator(".portfolio-table tbody tr")).toHaveCount(19);
  await page.goto("/?view=alerts");
  await page.locator("input[type=range]").first().fill("1");
  await page.reload();
  await expect(page.locator("input[type=range]").first()).toHaveValue("1");
  await expect(page.locator(".notice").first()).toBeVisible();
  await page.goto("/?view=research&ticker=INFY");
  await expect(
    page.getByRole("heading", { name: "Q2 FY27 financial snapshot" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Promises vs performance/ }),
  ).toBeVisible();
  await expect(page.locator(".promise-card")).toHaveCount(5);
  await expect(page.locator(".promise-card .verdict.met")).toHaveCount(2);
  await page.locator(".financial-panel .source-button").click();
  await expect(page.getByRole("dialog")).toContainText("PDF page 4");
  await page.getByRole("button", { name: "Close panel" }).click();
  await page
    .getByRole("textbox", { name: "Ask a company research question" })
    .fill("Is cash generation keeping up with profits?");
  await page.getByRole("button", { name: "Ask FINN", exact: true }).click();
  await expect(page.locator(".answer")).toBeVisible();
  await expect(page.locator(".answer")).toContainText("Relevant passages");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-research.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Change company" }).click();
  await page
    .getByRole("textbox", { name: "Company name or NSE ticker" })
    .fill("WIPRO");
  await page
    .locator(".search-results")
    .getByRole("button")
    .filter({ hasText: "Wipro" })
    .click();
  await expect(page.locator(".research-company h2")).toContainText("Wipro");
  await expect(page.locator(".document-row")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("invalid inputs and cron protection", async ({ request }) => {
  expect((await request.get("/api/cron")).status()).toBe(401);
  expect(
    (
      await request.post("/api/research", {
        data: { ticker: "https://evil.test" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/research", {
        data: { ticker: "NOTAREALCOMPANY" },
      })
    ).status(),
  ).toBe(404);
});
