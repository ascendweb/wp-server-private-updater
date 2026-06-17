-- Add columns to SitePlugin
ALTER TABLE "SitePlugin" ADD COLUMN "availableVersion" TEXT;
ALTER TABLE "SitePlugin" ADD COLUMN "autoSync" BOOLEAN NOT NULL DEFAULT false;

-- Migrate data from SitePluginVersion into SitePlugin
UPDATE "SitePlugin" sp
SET "availableVersion" = spv."availableVersion",
    "autoSync" = spv."autoSync"
FROM "SitePluginVersion" spv
WHERE sp."siteId" = spv."siteId"
  AND sp."pluginId" = spv."pluginId";

-- Drop SitePluginVersion table
DROP TABLE IF EXISTS "SitePluginVersion";
