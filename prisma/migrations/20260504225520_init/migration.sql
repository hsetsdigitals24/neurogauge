-- CreateTable
CREATE TABLE "Study" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Study_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "studyId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "config" JSONB NOT NULL,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentTs" TIMESTAMP(3),
    "demographics" JSONB,
    "globalTLX" JSONB,
    "customAnswers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "blockIndex" INTEGER NOT NULL,
    "stimulusType" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "perLevelTLX" JSONB,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trial" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "trialIndex" INTEGER NOT NULL,
    "stimulus" TEXT NOT NULL,
    "isPriming" BOOLEAN NOT NULL,
    "expectedMatch" BOOLEAN,
    "responded" BOOLEAN NOT NULL,
    "responseYes" BOOLEAN,
    "rtMs" DOUBLE PRECISION,
    "correct" BOOLEAN,
    "onsetTs" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Trial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_participantId_idx" ON "Session"("participantId");

-- CreateIndex
CREATE INDEX "Session_studyId_idx" ON "Session"("studyId");

-- CreateIndex
CREATE INDEX "Block_sessionId_idx" ON "Block"("sessionId");

-- CreateIndex
CREATE INDEX "Trial_blockId_idx" ON "Trial"("blockId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trial" ADD CONSTRAINT "Trial_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;
