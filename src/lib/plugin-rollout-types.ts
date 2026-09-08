export type PluginRolloutCommand = {
  id: string;
  siteId: string;
  type: string;
  pluginSlug: string | null;
  targetVersion: string | null;
  status: string;
  result: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type PluginRolloutSite = {
  id: string;
  siteId: string;
  siteUrl: string;
  siteLabel: string;
  installedVersion: string;
  pinnedVersion: string | null;
  autoSync: boolean;
  isActive: boolean;
  latestCommand: PluginRolloutCommand | null;
};

export type PluginRollout = {
  inflight: boolean;
  sites: PluginRolloutSite[];
};

export type PluginDetailPlugin = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  githubOwner: string;
  githubRepo: string;
};

export type PluginDetailData = {
  plugin: PluginDetailPlugin;
  latestVersion: string | null;
  rollout: PluginRollout;
};
