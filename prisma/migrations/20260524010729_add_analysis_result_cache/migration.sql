-- CreateTable
CREATE TABLE "AnalysisResult" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "analysisKey" TEXT NOT NULL,
    "paramsHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalysisResult_projectId_idx" ON "AnalysisResult"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisResult_projectId_analysisKey_paramsHash_key" ON "AnalysisResult"("projectId", "analysisKey", "paramsHash");

-- AddForeignKey
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
