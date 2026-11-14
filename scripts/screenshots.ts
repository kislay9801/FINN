import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
await mkdir("docs/screenshots", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
for (const [name, width, height] of [
  ["mobile", 390, 844],
  ["desktop", 1440, 1000],
] as const) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto("http://localhost:3000");
  await page.locator(".mover").first().waitFor();
  await page.getByRole("button", { name: "30 days", exact: true }).click();
  await page.locator(".signal-card").first().waitFor();
  await page
    .getByRole("heading", { name: /Your portfolio/ })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: `docs/screenshots/${name}-today.png` });
  await page.goto("http://localhost:3000/?view=research&ticker=INFY");
  await page
    .getByRole("heading", { name: "Q2 FY27 financial snapshot" })
    .waitFor();
  await page.locator(".promise-section").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `docs/screenshots/${name}-promises.png` });
  await page.close();
}
await browser.close();
console.log("Saved mobile/desktop screenshots to docs/screenshots");
