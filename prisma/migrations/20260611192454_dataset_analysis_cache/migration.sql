-- AlterTable
ALTER TABLE "AnalysisResult" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "AnalysisResult" ADD COLUMN "datasetId" TEXT;

-- CreateIndex
CREATE INDEX "AnalysisResult_datasetId_idx" ON "AnalysisResult"("datasetId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisResult_datasetId_analysisKey_paramsHash_key" ON "AnalysisResult"("datasetId", "analysisKey", "paramsHash");

-- AddForeignKey
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
