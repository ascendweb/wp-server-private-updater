-- Command history is a queue, not an audit log. Truncate so we can reshape the envelope.
TRUNCATE TABLE "Command";

CREATE TYPE "CommandType_new" AS ENUM (
  'update',
  'install',
  'rollback',
  'activate',
  'deactivate',
  'refresh',
  'purge_cache',
  'list_tools',
  'call_ability'
);

ALTER TABLE "Command" ALTER COLUMN "type" TYPE "CommandType_new" USING ("type"::text::"CommandType_new");
DROP TYPE "CommandType";
ALTER TYPE "CommandType_new" RENAME TO "CommandType";

ALTER TABLE "Command" DROP COLUMN IF EXISTS "pluginSlug";
ALTER TABLE "Command" DROP COLUMN IF EXISTS "targetVersion";
ALTER TABLE "Command" DROP COLUMN IF EXISTS "packageUrl";

ALTER TABLE "Command" ADD COLUMN IF NOT EXISTS "payload" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Command" ADD COLUMN IF NOT EXISTS "schedule" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Command" DROP COLUMN IF EXISTS "result";
ALTER TABLE "Command" ADD COLUMN "result" JSONB;

CREATE INDEX IF NOT EXISTS "Command_siteId_schedule_status_idx" ON "Command"("siteId", "schedule", "status");
