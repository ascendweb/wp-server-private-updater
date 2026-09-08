"use client";

import { useCallback, useEffect, useState } from "react";
import type { PluginRollout, PluginRolloutCommand, PluginRolloutSite } from "@/lib/plugin-rollout-types";

const POLL_MS = 2000;
const RETRY_MS = 8000;

export function usePluginRollout(pluginId: string, initial: PluginRollout) {
  const [rollout, setRollout] = useState(initial);
  const [watchNonce, setWatchNonce] = useState(initial.inflight ? 1 : 0);

  useEffect(() => {
    setRollout(initial);
    if (initial.inflight) {
      setWatchNonce((n) => (n === 0 ? 1 : n));
    }
  }, [initial]);

  useEffect(() => {
    if (watchNonce === 0) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/v1/plugins/${pluginId}/rollout`);
        if (!res.ok) throw new Error("Failed to load rollout");
        const data = (await res.json()) as PluginRollout;
        if (cancelled || !Array.isArray(data.sites)) return;
        setRollout(data);
        if (data.inflight) {
          timer = setTimeout(poll, POLL_MS);
        }
      } catch {
        if (!cancelled) {
          timer = setTimeout(poll, RETRY_MS);
        }
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pluginId, watchNonce]);

  const mergeCommands = useCallback((commands: PluginRolloutCommand[]) => {
    if (commands.length === 0) return;
    const bySite = new Map(commands.map((command) => [command.siteId, command]));
    setRollout((prev) => ({
      inflight: true,
      sites: prev.sites.map((site) => {
        const command = bySite.get(site.siteId);
        return command ? { ...site, latestCommand: command } : site;
      }),
    }));
    setWatchNonce((n) => n + 1);
  }, []);

  const updateSites = useCallback((siteIds: string[], patch: Partial<PluginRolloutSite>) => {
    const ids = new Set(siteIds);
    setRollout((prev) => ({
      ...prev,
      sites: prev.sites.map((site) => (ids.has(site.siteId) ? { ...site, ...patch } : site)),
    }));
  }, []);

  const updateSitePlugin = useCallback((id: string, patch: Partial<PluginRolloutSite>) => {
    setRollout((prev) => ({
      ...prev,
      sites: prev.sites.map((site) => (site.id === id ? { ...site, ...patch } : site)),
    }));
  }, []);

  return { rollout, mergeCommands, updateSites, updateSitePlugin };
}
