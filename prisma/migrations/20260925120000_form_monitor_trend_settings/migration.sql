-- AlterTable
ALTER TABLE "FormMonitorSetting" ADD COLUMN "trendBandPercent" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "FormMonitorSetting" ADD COLUMN "trendAbsDelta" INTEGER NOT NULL DEFAULT 2;
