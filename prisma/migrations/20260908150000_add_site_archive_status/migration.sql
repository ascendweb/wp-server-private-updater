ALTER TABLE "Site" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Site" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Site_status_idx" ON "Site"("status");
