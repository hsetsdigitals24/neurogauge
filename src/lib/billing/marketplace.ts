// Consulting-marketplace economics. The platform takes a fee on each paid
// booking; the rest is the consultant's earnings (tracked as a payout ledger and
// disbursed off-platform for now).

// Basis points (1500 = 15%). Tune here.
export const PLATFORM_FEE_BPS = 1500;

export interface FeeSplit {
  platformFeeKobo: number;
  consultantEarningsKobo: number;
}

/** Split a gross booking amount (kobo) into platform fee + consultant earnings. */
export function splitFee(amountKobo: number): FeeSplit {
  const platformFeeKobo = Math.round((amountKobo * PLATFORM_FEE_BPS) / 10000);
  return {
    platformFeeKobo,
    consultantEarningsKobo: amountKobo - platformFeeKobo,
  };
}
