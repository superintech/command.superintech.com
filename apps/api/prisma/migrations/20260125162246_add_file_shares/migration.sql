-- CreateTable
CREATE TABLE "file_shares" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "password" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "maxDownloads" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_shares_code_key" ON "file_shares"("code");

-- CreateIndex
CREATE INDEX "file_shares_code_idx" ON "file_shares"("code");

-- AddForeignKey
ALTER TABLE "file_shares" ADD CONSTRAINT "file_shares_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
