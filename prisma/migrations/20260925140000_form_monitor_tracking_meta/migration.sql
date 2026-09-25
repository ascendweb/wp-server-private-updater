-- AlterTable
ALTER TABLE "FormMonitorSetting" ADD COLUMN "whatConvertsUrl" TEXT;

-- AlterTable
ALTER TABLE "FormMonitorLead" ADD COLUMN "isTrackingSpam" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FormMonitorLead" ADD COLUMN "trackingPlatform" TEXT;
ALTER TABLE "FormMonitorLead" ADD COLUMN "trackingMeta" JSONB;
