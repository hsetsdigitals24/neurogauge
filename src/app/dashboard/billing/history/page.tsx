"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Receipt, Download, CheckCircle2, XCircle, Clock } from "lucide-react";

interface Transaction {
  id: string;
  reference: string;
  purpose: string;
  description: string;
  quantity: number;
  amount: number; // kobo
  currency: string;
  status: string; // success | failed | pending
  createdAt: string;
}

function formatMoney(kobo: number, currency: string): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Build a minimal, single-page PDF (Helvetica) from styled text rows.
// Rows are [text, fontSize, isBold]; returns a downloadable Blob.
function buildReceiptPdf(rows: Array<[string, number, boolean]>): Blob {
  const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  // Content stream: draw each row top-down, advancing the cursor by its size.
  let y = 800;
  let content = "BT\n";
  for (const [text, size, bold] of rows) {
    y -= size + 8;
    content += `/${bold ? "F2" : "F1"} ${size} Tf\n1 0 0 1 60 ${y} Tm\n(${escape(text)}) Tj\n`;
  }
  content += "ET";

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

const STATUS_STYLE: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  success: { label: "Paid", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  failed: { label: "Failed", className: "bg-rose-50 text-rose-700 border-rose-200", icon: XCircle },
  pending: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.className}`}>
      <Icon className="w-3 h-3" /> {s.label}
    </span>
  );
}

export default function BillingHistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/billing/transactions")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((d) => setTransactions(d.transactions ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Build + download a PDF receipt for one transaction, client-side (no deps).
  function downloadReceipt(t: Transaction) {
    // Each entry: [text, fontSize, isBold]. ASCII-only for the PDF fonts.
    const rows: Array<[string, number, boolean]> = [
      ["NEUROGAUGE - PAYMENT RECEIPT", 18, true],
      ["", 8, false],
      [`Description:  ${t.description}`, 12, false],
      [`Reference:    ${t.reference}`, 12, false],
      [`Date:         ${formatDate(t.createdAt)}`, 12, false],
      [`Quantity:     ${t.quantity}`, 12, false],
      [`Amount:       ${formatMoney(t.amount, t.currency).replace(/₦/g, "NGN ")}`, 12, false],
      [`Status:       ${(STATUS_STYLE[t.status] ?? STATUS_STYLE.pending).label}`, 12, false],
      ["", 8, false],
      ["Processed securely by Paystack.", 11, false],
      ["Thank you for using Neurogauge.", 11, false],
    ];

    const blob = buildReceiptPdf(rows);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `neurogauge-receipt-${t.reference}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen">
      <main className="px-6 md:px-10 pb-20 max-w-4xl mx-auto w-full">
        <div className="mt-8">
          <Link href="/dashboard/billing" className="text-sm text-[color:var(--muted)] hover:text-[color:var(--fg)] inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to billing
          </Link>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wide font-bold text-[color:var(--muted)]">Billing</span>
            <h1 className="text-2xl md:text-3xl font-extrabold">Payments &amp; receipts</h1>
          </div>
        </div>

        {loading ? (
          <div className="mt-10 text-center text-[color:var(--muted)] text-sm">Loading your payments…</div>
        ) : error ? (
          <div className="mt-6 card p-6 text-sm text-rose-700 bg-rose-50 border border-rose-200">
            Could not load your payment history. Please try again later.
          </div>
        ) : transactions && transactions.length === 0 ? (
          <div className="mt-6 card p-10 text-center">
            <Receipt className="w-8 h-8 text-[color:var(--muted)] mx-auto" />
            <h2 className="mt-3 text-lg font-bold">No payments yet</h2>
            <p className="text-sm text-[color:var(--muted)] mt-1">
              Your subscription payments and one-off purchases will appear here.
            </p>
            <Link href="/dashboard/billing" className="btn btn-primary mt-4 inline-flex">View plans</Link>
          </div>
        ) : transactions ? (
          <>
            {/* Desktop table */}
            <div className="mt-6 card p-0 overflow-hidden hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[color:var(--muted)] border-b border-[color:var(--border)]">
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                    <th className="px-4 py-3 font-semibold">Reference</th>
                    <th className="px-4 py-3 font-semibold text-right">Amount</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-b border-[color:var(--border)] last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.createdAt)}</td>
                      <td className="px-4 py-3">{t.description}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[color:var(--muted)]">{t.reference}</td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{formatMoney(t.amount, t.currency)}</td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-3 text-right">
                        {t.status === "success" && (
                          <button
                            className="btn btn-ghost btn-sm inline-flex items-center gap-1"
                            onClick={() => downloadReceipt(t)}
                            title="Download receipt"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mt-6 space-y-3 md:hidden">
              {transactions.map((t) => (
                <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{t.description}</div>
                      <div className="text-xs text-[color:var(--muted)] mt-0.5">{formatDate(t.createdAt)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold">{formatMoney(t.amount, t.currency)}</div>
                      <div className="mt-1"><StatusBadge status={t.status} /></div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="font-mono text-[11px] text-[color:var(--muted)] truncate">{t.reference}</span>
                    {t.status === "success" && (
                      <button className="btn btn-ghost btn-sm inline-flex items-center gap-1 shrink-0" onClick={() => downloadReceipt(t)}>
                        <Download className="w-4 h-4" /> Receipt
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            <p className="mt-6 text-xs text-[color:var(--muted)] text-center">
              Payments are processed securely by Paystack. Contact support if a charge looks wrong.
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
