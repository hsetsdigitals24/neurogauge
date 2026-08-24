-- Corrective bridge migration.
--
-- Converges the live database (which carries a legacy Organization + RBAC stack, a
-- newer Workspace stack on top, and *org-based* billing) onto the account-type model
-- defined in schema.prisma. This one migration replaces the two never-deployed local
-- migrations (add_account_types_billing, remove_workspaces), which were authored against
-- an assumed state and do not match what is actually in the database.
--
-- Study data is preserved: User / Project / TestSession / TestBlock / TestTrial / Dataset /
-- ProjectCollaborator / AnalysisResult are untouched. Sites are re-anchored from their
-- Workspace to that workspace's owner (a User). The abandoned workspace/organization
-- membership rows and the legacy org-based billing rows are dropped — every user falls
-- back to the free plan by default (resolveEntitlements), so no study data is lost.
--
-- Ordering matters: Site re-anchoring reads Workspace.ownerId, so it runs BEFORE the
-- Workspace tables are dropped.

-- 1. Account type on User ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "AccountType" AS ENUM ('student', 'institution', 'research_group');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountType" "AccountType" NOT NULL DEFAULT 'student';

-- 2. Re-anchor Site: workspaceId -> userId (owner of the workspace) -------------------
ALTER TABLE "Site" ADD COLUMN IF NOT EXISTS "userId" TEXT;

UPDATE "Site" s
   SET "userId" = w."ownerId"
  FROM "Workspace" w
 WHERE w."id" = s."workspaceId"
   AND s."userId" IS NULL;

DELETE FROM "Site" WHERE "userId" IS NULL;                 -- orphans (no resolvable owner)

ALTER TABLE "Site" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "Site" DROP COLUMN IF EXISTS "workspaceId";    -- also drops its FK + indexes

CREATE UNIQUE INDEX IF NOT EXISTS "Site_userId_code_key" ON "Site"("userId", "code");
CREATE INDEX IF NOT EXISTS "Site_userId_idx" ON "Site"("userId");
ALTER TABLE "Site" ADD CONSTRAINT "Site_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Detach projects from the org + workspace layers (ownerId already carries owner) --
ALTER TABLE "Project" DROP COLUMN IF EXISTS "workspaceId";     -- drops FK + index
ALTER TABLE "Project" DROP COLUMN IF EXISTS "organizationId";  -- drops FK + index

-- 4. Rebuild billing on the user-based model -----------------------------------------
DROP TABLE IF EXISTS "PaymentTransaction" CASCADE;
DROP TABLE IF EXISTS "Subscription" CASCADE;
DROP TABLE IF EXISTS "CreditLedger" CASCADE;   -- legacy org-billing ledger (not in schema)
DROP TABLE IF EXISTS "WebhookEvent" CASCADE;   -- legacy webhook idempotency (not in schema)
DROP TABLE IF EXISTS "Plan" CASCADE;           -- legacy DB plan catalog (now static in code)
DROP TYPE  IF EXISTS "SubscriptionStatus";     -- drop old enum if it shared this name

CREATE TYPE "SubscriptionStatus" AS ENUM ('inactive', 'trialing', 'active', 'past_due', 'canceled');

CREATE TABLE "Subscription" (
  "id"                       TEXT NOT NULL,
  "userId"                   TEXT NOT NULL,
  "planCode"                 TEXT NOT NULL,
  "status"                   "SubscriptionStatus" NOT NULL DEFAULT 'inactive',
  "paystackCustomerCode"     TEXT,
  "paystackSubscriptionCode" TEXT,
  "paystackEmailToken"       TEXT,
  "currentPeriodEnd"         TIMESTAMP(3),
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PaymentTransaction" (
  "id"            TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "reference"     TEXT NOT NULL,
  "planCode"      TEXT,
  "amount"        INTEGER NOT NULL,
  "currency"      TEXT NOT NULL DEFAULT 'NGN',
  "status"        TEXT NOT NULL,
  "paystackEvent" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentTransaction_reference_key" ON "PaymentTransaction"("reference");
CREATE INDEX "PaymentTransaction_userId_idx" ON "PaymentTransaction"("userId");
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Drop the Workspace + Organization stacks ----------------------------------------
DROP TABLE IF EXISTS "WorkspaceInvite" CASCADE;
DROP TABLE IF EXISTS "WorkspaceMember" CASCADE;
DROP TABLE IF EXISTS "Workspace" CASCADE;
DROP TABLE IF EXISTS "OrganizationInvite" CASCADE;
DROP TABLE IF EXISTS "OrganizationMember" CASCADE;
DROP TABLE IF EXISTS "Organization" CASCADE;

-- 6. Drop now-unused enum types (no-op if the name differs or is already gone) --------
DROP TYPE IF EXISTS "WorkspaceRole";
DROP TYPE IF EXISTS "WorkspaceType";
DROP TYPE IF EXISTS "OrganizationRole";
DROP TYPE IF EXISTS "OrgRole";
DROP TYPE IF EXISTS "MemberRole";
