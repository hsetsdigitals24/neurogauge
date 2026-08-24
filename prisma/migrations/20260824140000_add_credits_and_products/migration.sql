-- One-off revenue products: pay-per-project unlocks + AI-analysis credits.
--
-- Adds two spendable balances to User (source of truth) and tags each
-- PaymentTransaction with its purpose + granted quantity so the shared
-- idempotent fulfilment path can credit the right balance exactly once.
-- Idempotent (IF NOT EXISTS) so it is safe to re-apply.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "aiCredits" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "projectCredits" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "purpose" TEXT NOT NULL DEFAULT 'subscription';
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;
