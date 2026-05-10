-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCollaborator" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaboratorInvite" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollaboratorInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "takerEmail" TEXT NOT NULL,
    "takerAge" TEXT NOT NULL,
    "takerHandedness" TEXT NOT NULL,
    "takerEducation" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "demographics" JSONB,
    "globalTLX" JSONB,
    "customAnswers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestBlock" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "blockIndex" INTEGER NOT NULL,
    "stimulusType" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "perLevelTLX" JSONB,

    CONSTRAINT "TestBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestTrial" (
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

    CONSTRAINT "TestTrial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
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
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_shareToken_key" ON "Project"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCollaborator_projectId_userId_key" ON "ProjectCollaborator"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CollaboratorInvite_token_key" ON "CollaboratorInvite"("token");

-- CreateIndex
CREATE INDEX "TestSession_takerEmail_idx" ON "TestSession"("takerEmail");

-- CreateIndex
CREATE INDEX "TestSession_projectId_idx" ON "TestSession"("projectId");

-- CreateIndex
CREATE INDEX "TestBlock_sessionId_idx" ON "TestBlock"("sessionId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCollaborator" ADD CONSTRAINT "ProjectCollaborator_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCollaborator" ADD CONSTRAINT "ProjectCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaboratorInvite" ADD CONSTRAINT "CollaboratorInvite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaboratorInvite" ADD CONSTRAINT "CollaboratorInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSession" ADD CONSTRAINT "TestSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestBlock" ADD CONSTRAINT "TestBlock_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TestSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestTrial" ADD CONSTRAINT "TestTrial_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "TestBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trial" ADD CONSTRAINT "Trial_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;
