-- CreateEnum
CREATE TYPE "CommandType" AS ENUM ('update', 'install', 'rollback');

-- CreateEnum
CREATE TYPE "CommandStatus" AS ENUM ('pending', 'delivered', 'in_progress', 'completed', 'failed');

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "siteToken" TEXT,
    "pushUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Site_url_key" ON "Site"("url");

-- Backfill: create Site records from existing License siteUrl values
INSERT INTO "Site" ("id", "url", "label", "pushUrl", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    "siteUrl",
    "siteUrl",
    "siteUrl" || '/wp-json/wppu/v1',
    MIN("createdAt"),
    CURRENT_TIMESTAMP
FROM "License"
GROUP BY "siteUrl";

-- Add siteId column to License
ALTER TABLE "License" ADD COLUMN "siteId" TEXT;

-- Backfill: link existing licenses to their Site records
UPDATE "License" l
SET "siteId" = s."id"
FROM "Site" s
WHERE s."url" = l."siteUrl";

-- CreateIndex
CREATE INDEX "License_siteId_idx" ON "License"("siteId");

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SitePlugin" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pluginSlug" TEXT NOT NULL,
    "pluginId" TEXT,
    "pluginBasename" TEXT,
    "pluginName" TEXT,
    "installedVersion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lastReportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SitePlugin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SitePlugin_siteId_pluginSlug_key" ON "SitePlugin"("siteId", "pluginSlug");

-- CreateIndex
CREATE INDEX "SitePlugin_pluginSlug_idx" ON "SitePlugin"("pluginSlug");

-- CreateIndex
CREATE INDEX "SitePlugin_pluginId_idx" ON "SitePlugin"("pluginId");

-- AddForeignKey
ALTER TABLE "SitePlugin" ADD CONSTRAINT "SitePlugin_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePlugin" ADD CONSTRAINT "SitePlugin_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "Plugin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Command" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "type" "CommandType" NOT NULL,
    "pluginSlug" TEXT NOT NULL,
    "targetVersion" TEXT,
    "packageUrl" TEXT,
    "status" "CommandStatus" NOT NULL DEFAULT 'pending',
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Command_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Command_siteId_status_idx" ON "Command"("siteId", "status");

-- CreateIndex
CREATE INDEX "Command_status_idx" ON "Command"("status");

-- AddForeignKey
ALTER TABLE "Command" ADD CONSTRAINT "Command_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
