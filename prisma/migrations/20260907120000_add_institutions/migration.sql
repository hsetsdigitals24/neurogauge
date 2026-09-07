-- Collaborating institutions for multicenter studies.
--
-- Adds a first-class Institution org layer (with member logins) that a project
-- lead can link to a project and assign a collection Site. Institution members
-- sign in and see the co-worked projects scoped to their own site's data.
--
-- Idempotent-friendly (IF NOT EXISTS / guarded enum create) so it is safe to
-- re-run against a partially-applied database.

-- 1. InstitutionRole enum -------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "InstitutionRole" AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Institution ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Institution" (
  "id"        TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "code"      TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Institution_code_key" ON "Institution"("code");

-- 3. InstitutionMember ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "InstitutionMember" (
  "id"            TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "role"          "InstitutionRole" NOT NULL DEFAULT 'member',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstitutionMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InstitutionMember_institutionId_userId_key" ON "InstitutionMember"("institutionId", "userId");
CREATE INDEX IF NOT EXISTS "InstitutionMember_userId_idx" ON "InstitutionMember"("userId");
CREATE INDEX IF NOT EXISTS "InstitutionMember_institutionId_idx" ON "InstitutionMember"("institutionId");

-- 4. InstitutionInvite ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "InstitutionInvite" (
  "id"            TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "inviteeEmail"  TEXT NOT NULL,
  "role"          "InstitutionRole" NOT NULL DEFAULT 'member',
  "token"         TEXT NOT NULL,
  "invitedById"   TEXT NOT NULL,
  "accepted"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstitutionInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InstitutionInvite_token_key" ON "InstitutionInvite"("token");
CREATE INDEX IF NOT EXISTS "InstitutionInvite_institutionId_idx" ON "InstitutionInvite"("institutionId");

-- 5. ProjectInstitution ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ProjectInstitution" (
  "id"            TEXT NOT NULL,
  "projectId"     TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "siteId"        TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectInstitution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectInstitution_projectId_institutionId_key" ON "ProjectInstitution"("projectId", "institutionId");
CREATE INDEX IF NOT EXISTS "ProjectInstitution_institutionId_idx" ON "ProjectInstitution"("institutionId");
CREATE INDEX IF NOT EXISTS "ProjectInstitution_siteId_idx" ON "ProjectInstitution"("siteId");
CREATE INDEX IF NOT EXISTS "ProjectInstitution_projectId_idx" ON "ProjectInstitution"("projectId");

-- 6. Foreign keys ---------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE "InstitutionMember" ADD CONSTRAINT "InstitutionMember_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "InstitutionMember" ADD CONSTRAINT "InstitutionMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "InstitutionInvite" ADD CONSTRAINT "InstitutionInvite_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "InstitutionInvite" ADD CONSTRAINT "InstitutionInvite_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectInstitution" ADD CONSTRAINT "ProjectInstitution_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectInstitution" ADD CONSTRAINT "ProjectInstitution_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ProjectInstitution" ADD CONSTRAINT "ProjectInstitution_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
