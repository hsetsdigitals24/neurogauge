import { test, expect } from "@playwright/test";

test.describe("login page", () => {
  test("renders sign-in form with unique title", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page).toHaveTitle("Sign in | Neurogauge");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("links to signup and forgot password", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("link", { name: "Create one" })).toHaveAttribute(
      "href",
      "/auth/signup"
    );
    await expect(
      page.getByRole("link", { name: "Forgot password?" })
    ).toHaveAttribute("href", "/auth/forgot-password");
  });

  test("renders exactly one logo (header only)", async ({ page }) => {
    await page.goto("/auth/login");
    // Regression: the page used to render its own logo in addition to the header's
    await expect(page.locator('header img[alt="Logo"]')).toHaveCount(1);
    await expect(page.locator('main img[alt="Logo"]')).toHaveCount(0);
  });
});
