// Shared NGN formatting. Amounts are stored in kobo (₦1 = 100 kobo).
export function formatNaira(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format((kobo ?? 0) / 100);
}
