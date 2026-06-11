-- AlterTable
ALTER TABLE "Dataset" ALTER COLUMN "rows" DROP NOT NULL;
ALTER TABLE "Dataset" ADD COLUMN "rowsBlobUrl" TEXT;
