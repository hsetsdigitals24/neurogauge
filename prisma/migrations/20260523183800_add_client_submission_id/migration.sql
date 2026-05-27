/*
  Warnings:

  - A unique constraint covering the columns `[clientSubmissionId]` on the table `Session` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[clientSubmissionId]` on the table `TestSession` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "clientSubmissionId" TEXT;

-- AlterTable
ALTER TABLE "TestSession" ADD COLUMN     "clientSubmissionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Session_clientSubmissionId_key" ON "Session"("clientSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "TestSession_clientSubmissionId_key" ON "TestSession"("clientSubmissionId");
