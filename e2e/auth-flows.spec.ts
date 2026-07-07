import { test, expect } from "@playwright/test";
import crypto from "crypto";
import { qaDb, disconnectQaDb, QA_USERS, QA_EMAIL_DOMAIN } from "./helpers/db";

test.afterAll(async () => {
  await disconnectQaDb();
});

test.describe("signup", () => {
  test("creates an account via the UI and lands on the dashboard", async ({ page, context }) => {
    const email = `qa+signup-${Date.now()}@${QA_EMAIL_DOMAIN}`;
    await page.goto("/auth/signup");
    await page.locator('input[autocomplete="name"]').fill("QA Signup");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill("QaSignupPass1!");
    await page.getByRole("button", { name: "Create account" }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    const cookies = await context.cookies();
    expect(cookies.some((c) => c.name === "ng_token")).toBe(true);

    const user = await qaDb().user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user.passwordHash).not.toContain("QaSignupPass1!"); // stored hashed
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt
  });

  test("rejects a duplicate email with 409", async ({ request }) => {
    const res = await request.post("/api/auth/signup", {
      data: { name: "Dup", email: QA_USERS.owner.email, password: "SomePass123!" },
    });
    expect(res.status()).toBe(409);
  });

  test("rejects a short password", async ({ request }) => {
    const res = await request.post("/api/auth/signup", {
      data: { name: "Weak", email: `qa+weak@${QA_EMAIL_DOMAIN}`, password: "short" },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("login", () => {
  test("rejects a wrong password and accepts the right one", async ({ page, context }) => {
    await page.goto("/auth/login");
    await page.locator('input[type="email"]').fill(QA_USERS.owner.email);
    await page.locator('input[type="password"]').fill("WrongPassword1!");
    await page.getByRole("button", { name: /^sign in/i }).click();
    // Stays on the login page, no auth cookie
    await page.waitForTimeout(1500);
    expect(page.url()).toContain("/auth/login");
    expect((await context.cookies()).some((c) => c.name === "ng_token")).toBe(false);

    await page.locator('input[type="password"]').fill(QA_USERS.owner.password);
    await page.getByRole("button", { name: /^sign in/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    expect((await context.cookies()).some((c) => c.name === "ng_token")).toBe(true);
  });
});

test.describe("password reset", () => {
  test("forgot-password creates a hashed, unused, 1h-expiry token", async ({ request }) => {
    const db = qaDb();
    const user = await db.user.findUnique({ where: { email: QA_USERS.stranger.email } });
    const before = await db.passwordResetToken.count({ where: { userId: user.id } });

    const res = await request.post("/api/auth/forgot-password", {
      data: { email: QA_USERS.stranger.email },
    });
    expect(res.ok()).toBe(true);

    const tokens = await db.passwordResetToken.findMany({
      where: { userId: user.id },
      orderBy: { expiresAt: "desc" },
    });
    expect(tokens.length).toBe(before + 1);
    const t = tokens[0];
    expect(t.usedAt).toBeNull();
    const ttlMs = new Date(t.expiresAt).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(50 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(60 * 60 * 1000);
    expect(t.token).toMatch(/^[0-9a-f]{64}$/); // sha256 hex, not the raw token
  });

  test("does not reveal whether an email exists", async ({ request }) => {
    const res = await request.post("/api/auth/forgot-password", {
      data: { email: `qa+no-such-user@${QA_EMAIL_DOMAIN}` },
    });
    expect(res.ok()).toBe(true); // same success response as a real account
  });

  test("reset with a seeded token works end-to-end and is single-use", async ({ page, request, browser }) => {
    test.setTimeout(120_000); // dev-server compiles under parallel load are slow
    const db = qaDb();
    const rawToken = `qa-e2e-reset-${Date.now()}`;
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const user = await db.user.findUnique({ where: { email: QA_USERS.resetter.email } });
    await db.passwordResetToken.create({
      data: { userId: user.id, token: tokenHash, expiresAt: new Date(Date.now() + 3600_000) },
    });

    const newPassword = "QaResetterNewPass1!";

    // UI check: the reset page renders its form for a tokened link.
    // (Submission is exercised via the API below: a click that lands before
    // hydration triggers a native GET form submission that reloads the page and
    // drops ?token= — reported as a low-severity finding — which makes UI
    // submission unverifiable under parallel test load.)
    await page.goto(`/auth/reset-password?token=${rawToken}`);
    const pwFields = page.locator('input[type="password"]');
    await expect(pwFields.first()).toBeVisible({ timeout: 30_000 });
    await expect(pwFields.nth(1)).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset password" })).toBeVisible();

    const resetRes = await request.post("/api/auth/reset-password", {
      data: { token: rawToken, password: newPassword },
    });
    expect(resetRes.status()).toBe(200);

    // Old password rejected, new one accepted
    const oldLogin = await request.post("/api/auth/login", {
      data: { email: QA_USERS.resetter.email, password: QA_USERS.resetter.password },
    });
    expect(oldLogin.status()).toBe(401);
    const ctx = await browser.newContext();
    const newLogin = await ctx.request.post("/api/auth/login", {
      data: { email: QA_USERS.resetter.email, password: newPassword },
    });
    expect(newLogin.status()).toBe(200);
    await ctx.close();

    // Token consumed and single-use
    const rec = await db.passwordResetToken.findUnique({ where: { token: tokenHash } });
    expect(rec.usedAt).not.toBeNull();
    const reuse = await request.post("/api/auth/reset-password", {
      data: { token: rawToken, password: "AnotherPass1!" },
    });
    expect(reuse.status()).toBe(400);
  });
});
