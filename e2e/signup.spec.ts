import { test, expect } from "@playwright/test";

test.describe("signup page", () => {
  test("renders signup form with unique title", async ({ page }) => {
    await page.goto("/auth/signup");
    await expect(page).toHaveTitle("Create a researcher account | Neurogauge");
    await expect(
      page.getByRole("heading", { name: "Create an account" })
    ).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test("does not submit an empty form", async ({ page }) => {
    await page.goto("/auth/signup");
    let apiCalled = false;
    await page.route("**/api/auth/signup", (route) => {
      apiCalled = true;
      return route.fulfill({ json: {} });
    });
    await page
      .locator("form")
      .getByRole("button", { name: /create|sign up/i })
      .click();
    // Required fields should block submission client-side
    expect(apiCalled).toBe(false);
    await expect(page).toHaveURL(/\/auth\/signup/);
  });

  test("renders exactly one logo (header only)", async ({ page }) => {
    await page.goto("/auth/signup");
    await expect(page.locator('header img[alt="Logo"]')).toHaveCount(1);
    await expect(page.locator('main img[alt="Logo"]')).toHaveCount(0);
  });
});
