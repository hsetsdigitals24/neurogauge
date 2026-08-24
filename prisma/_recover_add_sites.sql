-- One-off drift repair for 20260824000000_add_sites.
-- The live DB had a vestigial orgId-based "Site" table (0 rows) that collided
-- with the migration. Drop it and rebuild the workspace-scoped Site to match
-- prisma/migrations/20260824000000_add_sites/migration.sql exactly.
-- Dropping Site CASCADE also removes TestSession_siteId_fkey, which we recreate.
-- TestSession.siteId column and TestSession_siteId_idx already exist and are kept.

DROP TABLE IF EXISTS "Site" CASCADE;

CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT,
    "principalInvestigator" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Site_workspaceId_idx" ON "Site"("workspaceId");
CREATE UNIQUE INDEX "Site_workspaceId_code_key" ON "Site"("workspaceId", "code");

ALTER TABLE "Site" ADD CONSTRAINT "Site_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TestSession" ADD CONSTRAINT "TestSession_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
