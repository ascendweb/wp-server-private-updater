import { z } from "zod";
import { createMcpHandler } from "mcp-handler";
import { V1_ABILITIES, toMcpToolName } from "./abilities";
import {
  McpQueryError,
  getCommand,
  getPluginInstalls,
  getSite,
  getSiteCommands,
  getSitePlugins,
  listCatalogPlugins,
  listFormMonitor,
  listFormMonitorEvents,
  listSites,
} from "./queries";
import { callSiteTool, listSiteTools } from "./rpc";

function jsonResult(data: unknown) {
  const structured =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : { result: data };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: structured,
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

export const mcpHandler = createMcpHandler(
  (server) => {
    const byId = Object.fromEntries(V1_ABILITIES.map((ability) => [ability.id, ability]));

    server.registerTool(
      toMcpToolName("sites/list"),
      {
        title: byId["sites/list"].title,
        description: byId["sites/list"].description,
        inputSchema: z.object({
          query: z.string().optional().describe("Filter by URL or label"),
          status: z.enum(["active", "archived"]).optional().describe("Defaults to active"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async ({ query, status }) => {
        try {
          return jsonResult(await listSites({ query, status }));
        } catch (error) {
          return errorResult(error);
        }
      }
    );

    server.registerTool(
      toMcpToolName("site/get"),
      {
        title: byId["site/get"].title,
        description: byId["site/get"].description,
        inputSchema: z.object({
          site: z.string().describe("Site id or URL"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async ({ site }) => {
        try {
          return jsonResult(await getSite(site));
        } catch (error) {
          return errorResult(error);
        }
      }
    );

    server.registerTool(
      toMcpToolName("site/get-plugins"),
      {
        title: byId["site/get-plugins"].title,
        description: byId["site/get-plugins"].description,
        inputSchema: z.object({
          site: z.string().describe("Site id or URL"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async ({ site }) => {
        try {
          return jsonResult(await getSitePlugins(site));
        } catch (error) {
          return errorResult(error);
        }
      }
    );

    server.registerTool(
      toMcpToolName("site/get-commands"),
      {
        title: byId["site/get-commands"].title,
        description: byId["site/get-commands"].description,
        inputSchema: z.object({
          site: z.string().describe("Site id or URL"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async ({ site }) => {
        try {
          return jsonResult(await getSiteCommands(site));
        } catch (error) {
          return errorResult(error);
        }
      }
    );

    server.registerTool(
      toMcpToolName("platform/list-plugins"),
      {
        title: byId["platform/list-plugins"].title,
        description: byId["platform/list-plugins"].description,
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async () => {
        try {
          return jsonResult(await listCatalogPlugins());
        } catch (error) {
          return errorResult(error);
        }
      }
    );

    server.registerTool(
      toMcpToolName("platform/get-plugin-installs"),
      {
        title: byId["platform/get-plugin-installs"].title,
        description: byId["platform/get-plugin-installs"].description,
        inputSchema: z.object({
          plugin: z.string().describe("Catalog plugin slug"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async ({ plugin }) => {
        try {
          return jsonResult(await getPluginInstalls(plugin));
        } catch (error) {
          return errorResult(error);
        }
      }
    );

    server.registerTool(
      toMcpToolName("platform/get-command"),
      {
        title: byId["platform/get-command"].title,
        description: byId["platform/get-command"].description,
        inputSchema: z.object({
          command_id: z.string().describe("Command id"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async ({ command_id }) => {
        try {
          return jsonResult(await getCommand(command_id));
        } catch (error) {
          return errorResult(error);
        }
      }
    );

    const formMonitorSiteInput = z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe("Site id or URL. Pass a list or comma-separated values for several sites.");

    server.registerTool(
      toMcpToolName("platform/form-monitor/list-sites"),
      {
        title: byId["platform/form-monitor/list-sites"].title,
        description: byId["platform/form-monitor/list-sites"].description,
        inputSchema: z.object({
          site: formMonitorSiteInput,
          since: z.string().optional().describe("ISO start datetime. Defaults to 7 days before until."),
          until: z.string().optional().describe("ISO end datetime. Defaults to now."),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async ({ site, since, until }) => {
        try {
          return jsonResult(await listFormMonitor({ site, since, until }));
        } catch (error) {
          return errorResult(error);
        }
      }
    );

    server.registerTool(
      toMcpToolName("platform/form-monitor/list-events"),
      {
        title: byId["platform/form-monitor/list-events"].title,
        description: byId["platform/form-monitor/list-events"].description,
        inputSchema: z.object({
          site: formMonitorSiteInput,
          since: z.string().optional().describe("ISO start datetime. Defaults to 7 days before until."),
          until: z.string().optional().describe("ISO end datetime. Defaults to now."),
          missing_only: z
            .boolean()
            .optional()
            .describe("If true, only unmatched submissions that are not marked fixed. Defaults to true."),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async ({ site, since, until, missing_only }) => {
        try {
          return jsonResult(await listFormMonitorEvents({ site, since, until, missing_only }));
        } catch (error) {
          return errorResult(error);
        }
      }
    );

    server.registerTool(
      toMcpToolName("site/list-tools"),
      {
        title: byId["site/list-tools"].title,
        description: byId["site/list-tools"].description,
        inputSchema: z.object({
          site: z.string().describe("Site id or URL"),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
      },
      async ({ site }) => {
        try {
          return jsonResult(await listSiteTools(site));
        } catch (error) {
          return errorResult(error);
        }
      }
    );

    server.registerTool(
      toMcpToolName("site/call-tool"),
      {
        title: byId["site/call-tool"].title,
        description: byId["site/call-tool"].description,
        inputSchema: z.object({
          site: z.string().describe("Site id or URL"),
          ability: z.string().describe("Original WordPress ability name, e.g. rank-math/get-redirections"),
          arguments: z.record(z.string(), z.unknown()).optional().describe("Arguments for the ability"),
        }),
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
      },
      async ({ site, ability, arguments: args }) => {
        try {
          return jsonResult(await callSiteTool(site, ability, args || {}));
        } catch (error) {
          return errorResult(error);
        }
      }
    );
  },
  {
    serverInfo: { name: "tacowp", version: "0.1.0" },
    instructions:
      "This is the TacoWP fleet registry. Use sites-list, site-get, and site-get-plugins for inventory. Use platform-form-monitor-list-sites and platform-form-monitor-list-events for form vs tracking. Discover WordPress plugin tools (Rank Math, core, etc.) with site-list-tools, then run them with site-call-tool.",
  }
);

export { McpQueryError };
