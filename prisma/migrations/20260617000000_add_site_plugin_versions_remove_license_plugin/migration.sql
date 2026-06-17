-- CreateTable
CREATE TABLE "SitePluginVersion" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "availableVersion" TEXT,
    "autoSync" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePluginVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SitePluginVersion_pluginId_idx" ON "SitePluginVersion"("pluginId");

-- CreateIndex
CREATE INDEX "SitePluginVersion_siteId_idx" ON "SitePluginVersion"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SitePluginVersion_siteId_pluginId_key" ON "SitePluginVersion"("siteId", "pluginId");

-- AddForeignKey
ALTER TABLE "SitePluginVersion" ADD CONSTRAINT "SitePluginVersion_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SitePluginVersion" ADD CONSTRAINT "SitePluginVersion_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "Plugin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "License" DROP CONSTRAINT IF EXISTS "License_pluginId_fkey";

-- DropColumn
ALTER TABLE "License" DROP COLUMN IF EXISTS "pluginId";
