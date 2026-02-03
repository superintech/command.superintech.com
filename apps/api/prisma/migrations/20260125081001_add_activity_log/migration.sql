-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED', 'STATUS_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'COMMENTED', 'FILE_UPLOADED', 'FILE_DELETED', 'MEMBER_ADDED', 'MEMBER_REMOVED', 'TAG_ADDED', 'TAG_REMOVED');

-- CreateEnum
CREATE TYPE "ActivityEntityType" AS ENUM ('PROJECT', 'TASK', 'COMMENT', 'FILE');

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "entityType" "ActivityEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "taskId" TEXT,
    "changes" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "activity_logs_projectId_idx" ON "activity_logs"("projectId");

-- CreateIndex
CREATE INDEX "activity_logs_taskId_idx" ON "activity_logs"("taskId");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
