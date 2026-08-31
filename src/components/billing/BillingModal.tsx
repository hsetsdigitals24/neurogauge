"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Crown, Sparkles, Loader2, Grid3x3 } from "lucide-react";
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

/** Which section of the modal to surface first. */
export type BillingFocus = "plans" | "ai_credits" | "project";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Section to highlight/scroll to on open. */
  focus?: BillingFocus;
  /** Optional contextual banner shown at the top (e.g. "You're out of project credits"). */
  message?: string;
}

function formatNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(kobo / 100);
}

/**
 * In-page billing popup. Lets a user buy AI credits, a project pass, or upgrade
 * their plan without leaving the current page. Checkout still redirects to
 * Paystack's hosted page (and returns to /dashboard/billing to verify), but the
 * plan/credit selection happens right here in context.
 */
export function BillingModal({ open, onClose, focus = "ai_credits", message }: Props) {
  const [plans, setPlans] = useState<PlansResponse | null>(null);
  const [products, setProducts] = useState<ProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const loadedRef = useRef(false);

  // Load catalogs the first time the modal is opened. State is only mutated
  // inside promise callbacks (never synchronously in the effect body) so we
  // don't trip the react-hooks "no synchronous setState in effect" rule.
  useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;
    const p1 = fetch("/api/billing/plans")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setPlans(d); if (!d.paystackConfigured) setUnavailable(true); } })
      .catch(() => setUnavailable(true));
    const p2 = fetch("/api/billing/products")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setProducts(d); })
      .catch(() => {});
    Promise.all([p1, p2]).finally(() => setLoading(false));
  }, [open]);

  async function checkout(url: string, body: object, key: string) {
    setBusy(key);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) { notify.error(d.error ?? "Could not start checkout"); setBusy(null); return; }
      window.location.assign(d.authorizationUrl);
    } catch {
      notify.error("Network error");
      setBusy(null);
    }
  }

  const buyProduct = (code: string) => checkout("/api/billing/checkout/product", { productCode: code }, code);
  const upgrade = (code: string) => checkout("/api/billing/checkout", { planCode: code }, code);

  const aiPacks = products?.products.filter((p) => p.kind === "ai_credits") ?? [];
  const projectPasses = products?.products.filter((p) => p.kind === "project") ?? [];
  const paidPlan = plans?.plans.find((p) => p.tier === "paid" && p.code !== plans.currentPlanCode);

  // Order the sections so the focused one renders first.
  const order: BillingFocus[] =
    focus === "project" ? ["project", "ai_credits", "plans"]
    : focus === "plans" ? ["plans", "ai_credits", "project"]
    : ["ai_credits", "project", "plans"];

  function renderSection(kind: BillingFocus) {
    if (kind === "ai_credits") {
      return (
        <div key="ai_credits" className="card p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h3 className="text-base font-bold">AI analysis credits</h3>
            {products && (
              <span className="ml-auto text-xs text-[color:var(--muted)]">
                Balance: <span className="font-bold text-[color:var(--fg)]">{products.aiCredits}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-[color:var(--muted)] mt-1">
            One credit per AI Statistician run (recommend a test / interpret results).
          </p>
          <div className="mt-3 space-y-2">
            {aiPacks.map((p) => (
              <div key={p.code} className="flex items-center justify-between gap-3 border border-[color:var(--border)] rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-[color:var(--muted)] truncate">{formatNaira(p.priceKobo)}</div>
                </div>
                <button className="btn btn-primary btn-sm shrink-0" disabled={busy === p.code || unavailable} onClick={() => buyProduct(p.code)}>
                  {busy === p.code ? "Redirecting…" : "Buy"}
                </button>
              </div>
            ))}
            {aiPacks.length === 0 && <p className="text-xs text-[color:var(--muted)]">No packs available.</p>}
          </div>
        </div>
      );
    }
    if (kind === "project") {
      return (
        <div key="project" className="card p-5">
          <div className="flex items-center gap-2">
            <Grid3x3 className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold">Project passes</h3>
            {products && (
              <span className="ml-auto text-xs text-[color:var(--muted)]">
                Available: <span className="font-bold text-[color:var(--fg)]">{products.projectCredits}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-[color:var(--muted)] mt-1">
            Each new project uses one pass — no subscription required.
          </p>
          <div className="mt-3 space-y-2">
            {projectPasses.map((p) => (
              <div key={p.code} className="flex items-center justify-between gap-3 border border-[color:var(--border)] rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-[color:var(--muted)] truncate">{formatNaira(p.priceKobo)}</div>
                </div>
                <button className="btn btn-primary btn-sm shrink-0" disabled={busy === p.code || unavailable} onClick={() => buyProduct(p.code)}>
                  {busy === p.code ? "Redirecting…" : "Buy"}
                </button>
              </div>
            ))}
            {projectPasses.length === 0 && <p className="text-xs text-[color:var(--muted)]">No passes available.</p>}
          </div>
        </div>
      );
    }
    // plans
    if (!paidPlan) return null;
    return (
      <div key="plans" className="card p-5 border-indigo-200 ring-1 ring-indigo-100">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-bold">{paidPlan.name}</h3>
          <span className="ml-auto text-sm font-extrabold">{formatNaira(paidPlan.priceKobo)}<span className="text-xs font-normal text-[color:var(--muted)]">/mo</span></span>
        </div>
        <p className="text-xs text-[color:var(--muted)] mt-1">{paidPlan.tagline}</p>
        <ul className="mt-3 space-y-1.5">
          {paidPlan.features.slice(0, 4).map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs">
              <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" /> {f}
            </li>
          ))}
        </ul>
        <button className="btn btn-primary w-full mt-4" disabled={busy === paidPlan.code || unavailable} onClick={() => upgrade(paidPlan.code)}>
          {busy === paidPlan.code ? "Redirecting…" : `Upgrade to ${paidPlan.name}`}
        </button>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl my-auto"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-5 py-4 border-b border-[color:var(--border)]">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-base font-extrabold">Buy credits &amp; upgrade</h2>
              <button onClick={onClose} className="ml-auto btn btn-ghost p-1"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 space-y-4">
              {message && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{message}</div>
              )}
              {unavailable && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Payments aren&apos;t fully configured yet — purchases are temporarily disabled.
                </div>
              )}

              {loading ? (
                <div className="py-10 text-center text-sm text-[color:var(--muted)] flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : (
                order.map(renderSection)
              )}

              <p className="text-[11px] text-[color:var(--muted)] text-center">
                Payments are processed securely by Paystack. You&apos;ll return to Billing to confirm.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
