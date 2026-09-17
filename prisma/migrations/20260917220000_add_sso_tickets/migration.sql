-- AlterTable
ALTER TABLE "User" ADD COLUMN "wpLoginEmail" TEXT;

-- CreateTable
CREATE TABLE "SsoTicket" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "SsoTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsoEvent" (
    "id" TEXT NOT NULL,
    "siteId" TEXT,
    "userId" TEXT,
    "email" TEXT,
    "result" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SsoTicket_tokenHash_key" ON "SsoTicket"("tokenHash");

-- CreateIndex
CREATE INDEX "SsoTicket_userId_createdAt_idx" ON "SsoTicket"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SsoTicket_siteId_idx" ON "SsoTicket"("siteId");

-- CreateIndex
CREATE INDEX "SsoTicket_expiresAt_idx" ON "SsoTicket"("expiresAt");

-- CreateIndex
CREATE INDEX "SsoEvent_createdAt_idx" ON "SsoEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SsoEvent_siteId_idx" ON "SsoEvent"("siteId");

-- CreateIndex
CREATE INDEX "SsoEvent_userId_idx" ON "SsoEvent"("userId");

-- AddForeignKey
ALTER TABLE "SsoTicket" ADD CONSTRAINT "SsoTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoTicket" ADD CONSTRAINT "SsoTicket_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
