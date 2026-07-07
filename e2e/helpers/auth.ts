import { expect, type APIRequestContext, type Browser, type BrowserContext } from "@playwright/test";

// Logs in via the API inside a fresh browser context; the httpOnly ng_token
// cookie lands in the context's shared cookie jar, so both page navigation and
// context.request calls are authenticated afterwards.
export async function loginContext(
  browser: Browser,
  creds: { email: string; password: string }
): Promise<{ context: BrowserContext; api: APIRequestContext }> {
  const context = await browser.newContext();
  const res = await context.request.post("/api/auth/login", {
    data: { email: creds.email, password: creds.password },
  });
  expect(res.status(), `login as ${creds.email}`).toBe(200);
  return { context, api: context.request };
}
