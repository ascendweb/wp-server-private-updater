-- CreateTable
CREATE TABLE "FormMonitorSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "trackingWebhookToken" TEXT NOT NULL,
    "missingWebhookUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormMonitorSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormMonitorLead" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "siteId" TEXT,
    "formId" INTEGER,
    "entryId" INTEGER,
    "formTitle" TEXT,
    "formReceivedAt" TIMESTAMP(3),
    "trackingReceivedAt" TIMESTAMP(3),
    "trackingId" TEXT,
    "missingNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormMonitorLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormMonitorSetting_trackingWebhookToken_key" ON "FormMonitorSetting"("trackingWebhookToken");

-- CreateIndex
CREATE UNIQUE INDEX "FormMonitorLead_referenceId_key" ON "FormMonitorLead"("referenceId");

-- CreateIndex
CREATE INDEX "FormMonitorLead_siteId_formReceivedAt_idx" ON "FormMonitorLead"("siteId", "formReceivedAt");

-- CreateIndex
CREATE INDEX "FormMonitorLead_siteId_trackingReceivedAt_idx" ON "FormMonitorLead"("siteId", "trackingReceivedAt");

-- AddForeignKey
ALTER TABLE "FormMonitorLead" ADD CONSTRAINT "FormMonitorLead_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
