import { test, expect } from "@playwright/test";

test.describe("results lookup page", () => {
  test("renders lookup form with unique title", async ({ page }) => {
    await page.goto("/results");
    await expect(page).toHaveTitle("Look up my results | Neurogauge");
    await expect(page.getByRole("heading", { name: /my results/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /find results/i })).toBeVisible();
  });

  test("shows empty state when no sessions match", async ({ page }) => {
    // Stub the API so the test needs no seeded database
    await page.route("**/api/results?*", (route) => route.fulfill({ json: [] }));

    await page.goto("/results");
    await page.locator('input[type="email"]').fill("nobody@example.com");
    // Retry the click: in dev the handler may not be attached until hydration completes
    await expect(async () => {
      await page.getByRole("button", { name: /find results/i }).click();
      await expect(
        page.getByRole("heading", { name: "No sessions found" })
      ).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page.getByText("nobody@example.com")).toBeVisible();
  });

  test("does not call the API for an invalid email", async ({ page }) => {
    let apiCalled = false;
    await page.route("**/api/results?*", (route) => {
      apiCalled = true;
      return route.fulfill({ json: [] });
    });

    await page.goto("/results");
    await page.locator('input[type="email"]').fill("not-an-email");
    await page.getByRole("button", { name: /find results/i }).click();
    await page.waitForTimeout(500);
    expect(apiCalled).toBe(false);
  });
});
