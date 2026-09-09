ALTER TABLE "Plugin" ADD COLUMN "latestVersion" TEXT;
ALTER TABLE "Plugin" ADD COLUMN "latestChangelog" TEXT;
ALTER TABLE "Plugin" ADD COLUMN "latestPublishedAt" TIMESTAMP(3);
ALTER TABLE "Plugin" ADD COLUMN "latestSyncedAt" TIMESTAMP(3);
