import crypto from "crypto";

// Thin server-side Paystack REST wrapper. No SDK — plain fetch against
// https://api.paystack.co with the secret key. Mirrors the AI client's
// convention: when PAYSTACK_SECRET_KEY is unset the app degrades to 503 rather
// than crashing, so `isPaystackConfigured()` is checked before every call.

const PAYSTACK_BASE = "https://api.paystack.co";

function secretKey(): string | null {
  return process.env.PAYSTACK_SECRET_KEY || null;
}

export function isPaystackConfigured(): boolean {
  return Boolean(secretKey());
}

async function paystackFetch<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; message?: string }> {
  const key = secretKey();
  if (!key) return { ok: false, status: 503, data: null, message: "Paystack not configured" };
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    // Paystack is a third-party API; never cache.
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as
    | { status?: boolean; message?: string; data?: T }
    | null;
  return {
    ok: res.ok && Boolean(json?.status),
    status: res.status,
    data: (json?.data ?? null) as T | null,
    message: json?.message,
  };
}

export interface InitializeArgs {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  planCode?: string | null; // Paystack plan code → creates a subscription on charge
  metadata?: Record<string, unknown>;
}

export interface InitializeResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export function initializeTransaction(args: InitializeArgs) {
  const body: Record<string, unknown> = {
    email: args.email,
    amount: args.amountKobo,
    reference: args.reference,
    callback_url: args.callbackUrl,
    metadata: args.metadata ?? {},
  };
  if (args.planCode) body.plan = args.planCode;
  return paystackFetch<InitializeResult>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface VerifyResult {
  status: string; // "success" | ...
  reference: string;
  amount: number;
  currency: string;
  customer?: { customer_code?: string; email?: string };
  plan?: string | null;
  plan_object?: { plan_code?: string } | null;
  subscription_code?: string | null;
  metadata?: Record<string, unknown> | null;
  paidAt?: string | null;
}

export function verifyTransaction(reference: string) {
  return paystackFetch<VerifyResult>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

export interface SubscriptionResult {
  subscription_code: string;
  email_token: string;
  status: string;
  next_payment_date?: string | null;
  customer?: { customer_code?: string };
}

export function fetchSubscription(code: string) {
  return paystackFetch<SubscriptionResult>(`/subscription/${encodeURIComponent(code)}`);
}

export function disableSubscription(code: string, emailToken: string) {
  return paystackFetch("/subscription/disable", {
    method: "POST",
    body: JSON.stringify({ code, token: emailToken }),
  });
}

// Paystack signs webhook bodies with HMAC-SHA512 of the raw body using the
// secret key. Compare against the `x-paystack-signature` header.
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const key = secretKey();
  if (!key || !signature) return false;
  const hash = crypto.createHmac("sha512", key).update(rawBody, "utf8").digest("hex");
  // Both are hex of equal length; timingSafeEqual guards against timing attacks.
  const a = Buffer.from(hash);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
