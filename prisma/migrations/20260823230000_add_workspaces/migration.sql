-- CreateEnum
CREATE TYPE "WorkspaceType" AS ENUM ('personal', 'institution', 'research_group');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkspaceType" NOT NULL DEFAULT 'personal',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: scope projects to a workspace
ALTER TABLE "Project" ADD COLUMN "workspaceId" TEXT;

-- Backfill: give every existing user a default, non-deletable personal workspace
INSERT INTO "Workspace" ("id", "name", "type", "ownerId", "createdAt", "updatedAt")
SELECT 'ws_' || "id", 'My Personal Workspace', 'personal', "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User";

-- Backfill: link every existing project to its owner's personal workspace
UPDATE "Project" SET "workspaceId" = 'ws_' || "ownerId" WHERE "workspaceId" IS NULL;

-- CreateIndex
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
