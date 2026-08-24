"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Crown, Sparkles, CreditCard } from "lucide-react";
import { notify } from "@/lib/toast";

interface Plan {
  code: string;
  accountType: string;
  name: string;
  tier: "free" | "paid";
  priceKobo: number;
  tagline: string;
  features: string[];
}
interface PlansResponse {
  accountType: string;
  plans: Plan[];
  currentPlanCode: string;
  paystackConfigured: boolean;
}

interface Product {
  code: string;
  kind: "project" | "ai_credits";
  name: string;
  priceKobo: number;
  quantity: number;
  tagline: string;
}
interface ProductsResponse {
  products: Product[];
  aiCredits: number;
  projectCredits: number;
  paystackConfigured: boolean;
}

function formatNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(kobo / 100);
}

function BillingInner() {
  const params = useSearchParams();
  const reference = params.get("reference");
  const [data, setData] = useState<PlansResponse | null>(null);
  const [products, setProducts] = useState<ProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // Reference present ⇒ we're returning from Paystack and should show "verifying".
  const [verifying, setVerifying] = useState<boolean>(Boolean(reference));

  // Load the plan catalog. setState happens only inside promise callbacks so we
  // don't trip the react-hooks "no synchronous setState in effect" rule.
  function load() {
    const plans = fetch("/api/billing/plans")
      .then((res) => (res.status === 401 ? Promise.reject(new Error("unauth")) : res.json()))
      .then((d) => {
        setData(d);
        if (!d.paystackConfigured) setUnavailable(true);
      })
      .catch(() => setUnavailable(true));
    // Balances refresh here too so a completed purchase reflects immediately.
    const prods = fetch("/api/billing/products")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => { if (d) setProducts(d); })
      .catch(() => {});
    return Promise.all([plans, prods]).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  // Post-checkout callback: Paystack redirects back with ?reference=… → verify.
  useEffect(() => {
    if (!reference) return;
    fetch(`/api/billing/verify?reference=${encodeURIComponent(reference)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "success") { notify.success("Payment confirmed — plan upgraded"); load(); }
        else notify.error("Payment not completed");
      })
      .catch(() => notify.error("Could not verify payment"))
      .finally(() => setVerifying(false));
  }, [reference]);

  async function upgrade(planCode: string) {
    setBusy(planCode);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode }),
      });
      const d = await res.json();
      if (!res.ok) { notify.error(d.error ?? "Could not start checkout"); return; }
      window.location.assign(d.authorizationUrl);
    } catch {
      notify.error("Network error");
      setBusy(null);
    }
  }

  async function buyProduct(productCode: string) {
    setBusy(productCode);
    try {
      const res = await fetch("/api/billing/checkout/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productCode }),
      });
      const d = await res.json();
      if (!res.ok) { notify.error(d.error ?? "Could not start checkout"); return; }
      window.location.assign(d.authorizationUrl);
    } catch {
      notify.error("Network error");
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-4xl mx-auto w-full">
        <div className="mt-8">
          <Link href="/dashboard" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </Link>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wide font-bold text-[color:var(--muted)]">Billing</span>
            <h1 className="text-2xl md:text-3xl font-extrabold">Plans &amp; subscription</h1>
          </div>
        </div>

        {verifying && (
          <div className="mt-6 card p-4 text-sm text-[color:var(--muted)]">Verifying your payment…</div>
        )}

        {loading ? (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading plans…</div>
        ) : unavailable && !data ? (
          <div className="mt-6 card p-10 text-center">
            <h2 className="text-lg font-bold">Billing isn&apos;t available yet</h2>
            <p className="text-sm text-[color:var(--muted)] mt-1">
              Paid plans will be enabled soon. You can keep using your current plan in the meantime.
            </p>
          </div>
        ) : data ? (
          <>
            {unavailable && (
              <div className="mt-6 card p-4 text-sm text-amber-700 bg-amber-50 border border-amber-200">
                Payments aren&apos;t fully configured yet — upgrading is temporarily disabled.
              </div>
            )}
            <div className="mt-6 grid sm:grid-cols-2 gap-4">
              {data.plans.map((plan) => {
                const isCurrent = plan.code === data.currentPlanCode;
                const isPaid = plan.tier === "paid";
                return (
                  <motion.div
                    key={plan.code}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`card p-6 flex flex-col ${isPaid ? "border-indigo-200 ring-1 ring-indigo-100" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      {isPaid ? <Crown className="w-5 h-5 text-amber-500" /> : <Sparkles className="w-5 h-5 text-indigo-500" />}
                      <h3 className="text-lg font-bold">{plan.name}</h3>
                    </div>
                    <p className="text-sm text-[color:var(--muted)] mt-1">{plan.tagline}</p>
                    <div className="mt-4">
                      <span className="text-3xl font-extrabold">{plan.priceKobo === 0 ? "Free" : formatNaira(plan.priceKobo)}</span>
                      {plan.priceKobo > 0 && <span className="text-sm text-[color:var(--muted)]">/month</span>}
                    </div>
                    <ul className="mt-4 space-y-2 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6">
                      {isCurrent ? (
                        <span className="btn btn-ghost w-full justify-center cursor-default border border-[color:var(--border)]">
                          Current plan
                        </span>
                      ) : isPaid ? (
                        <button
                          className="btn btn-primary w-full"
                          disabled={busy === plan.code || unavailable}
                          onClick={() => upgrade(plan.code)}
                        >
                          {busy === plan.code ? "Redirecting…" : `Upgrade to ${plan.name}`}
                        </button>
                      ) : (
                        <span className="btn btn-ghost w-full justify-center cursor-default text-[color:var(--muted)]">
                          Free plan
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
            {products && (
              <div className="mt-12">
                <h2 className="text-xl font-extrabold">Buy as you go</h2>
                <p className="text-sm text-[color:var(--muted)] mt-1">
                  One-off purchases — no subscription required. Balances update automatically after payment.
                </p>

                <div className="mt-6 grid sm:grid-cols-2 gap-4">
                  {/* AI analysis credits */}
                  <div className="card p-6 flex flex-col">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-500" />
                      <h3 className="text-lg font-bold">AI analysis credits</h3>
                    </div>
                    <p className="text-sm text-[color:var(--muted)] mt-1">
                      Spent one per AI Statistician analysis (recommend a test / interpret results).
                    </p>
                    <div className="mt-3 text-sm">
                      Balance: <span className="font-bold">{products.aiCredits}</span> credit{products.aiCredits === 1 ? "" : "s"}
                    </div>
                    <div className="mt-4 space-y-2">
                      {products.products.filter((p) => p.kind === "ai_credits").map((p) => (
                        <div key={p.code} className="flex items-center justify-between gap-3 border border-[color:var(--border)] rounded-lg px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">{p.name}</div>
                            <div className="text-xs text-[color:var(--muted)] truncate">{formatNaira(p.priceKobo)}</div>
                          </div>
                          <button
                            className="btn btn-primary btn-sm shrink-0"
                            disabled={busy === p.code || unavailable}
                            onClick={() => buyProduct(p.code)}
                          >
                            {busy === p.code ? "Redirecting…" : "Buy"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pay per project */}
                  <div className="card p-6 flex flex-col">
                    <div className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-amber-500" />
                      <h3 className="text-lg font-bold">Pay per project</h3>
                    </div>
                    <p className="text-sm text-[color:var(--muted)] mt-1">
                      Unlock an extra project beyond your plan&apos;s limit — no monthly commitment.
                    </p>
                    <div className="mt-3 text-sm">
                      Project passes: <span className="font-bold">{products.projectCredits}</span> available
                    </div>
                    <div className="mt-4 space-y-2">
                      {products.products.filter((p) => p.kind === "project").map((p) => (
                        <div key={p.code} className="flex items-center justify-between gap-3 border border-[color:var(--border)] rounded-lg px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold">{p.name}</div>
                            <div className="text-xs text-[color:var(--muted)] truncate">{formatNaira(p.priceKobo)}</div>
                          </div>
                          <button
                            className="btn btn-primary btn-sm shrink-0"
                            disabled={busy === p.code || unavailable}
                            onClick={() => buyProduct(p.code)}
                          >
                            {busy === p.code ? "Redirecting…" : "Buy"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <p className="mt-6 text-xs text-[color:var(--muted)] text-center">
              Payments are processed securely by Paystack. You can cancel a paid plan any time.
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingInner />
    </Suspense>
  );
}
