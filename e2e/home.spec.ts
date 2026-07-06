import { test, expect } from "@playwright/test";

test.describe("homepage", () => {
  test("loads with correct title and metadata", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(
      "Neurogauge Neuroscience Lab — Cognitive Assessment Platform"
    );
    // No double space in the title (regression for template typo)
    expect(await page.title()).not.toContain("  ");
    await expect(
      page.locator('meta[property="og:site_name"]')
    ).toHaveAttribute("content", "Neurogauge Neuroscience Lab");
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  });

  test("shows header, footer, and primary CTAs", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
    // Hero CTAs (header nav links depend on the async auth check, so assert on these)
    await expect(
      page.getByRole("link", { name: "Start for free" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Check my results" })
    ).toBeVisible();
    await expect(
      page.locator("footer").getByRole("link", { name: /my results/i })
    ).toBeVisible();
  });

  // Generous timeouts: the dev server compiles each route on first visit
  test("footer links to the privacy policy", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page
      .locator("footer")
      .getByRole("link", { name: "Privacy Policy" })
      .click();
    await expect(page).toHaveURL(/\/privacy$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  });

  test("footer links to the terms of service", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page
      .locator("footer")
      .getByRole("link", { name: "Terms of Service" })
      .click();
    await expect(page).toHaveURL(/\/terms$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
  });
});
