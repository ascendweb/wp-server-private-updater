-- Site-level commands (refresh, purge_cache) have no plugin.
ALTER TABLE "Command" ALTER COLUMN "pluginSlug" DROP NOT NULL;
