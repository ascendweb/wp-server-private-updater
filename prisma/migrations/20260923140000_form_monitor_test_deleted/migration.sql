-- AlterTable
ALTER TABLE "FormMonitorSetting" ADD COLUMN "testQueryParams" TEXT[] NOT NULL DEFAULT ARRAY['checkview_test_id']::TEXT[];

-- AlterTable
ALTER TABLE "FormMonitorLead" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "FormMonitorLead" ADD COLUMN "fields" JSONB;
ALTER TABLE "FormMonitorLead" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FormMonitorLead" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "FormMonitorLead_siteId_entryId_idx" ON "FormMonitorLead"("siteId", "entryId");
