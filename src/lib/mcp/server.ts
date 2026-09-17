import { z } from "zod";
import { createMcpHandler } from "mcp-handler";
import { V1_ABILITIES } from "./abilities";
import {
  McpQueryError,
  getCommand,
  getPluginInstalls,
  getSite,
  getSiteCommands,
  getSitePlugins,
  listCatalogPlugins,
  listSites,
} from "./queries";

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
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
      "sites/list",
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
      "site/get",
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
      "site/get-plugins",
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
      "site/get-commands",
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
      "platform/list-plugins",
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
      "platform/get-plugin-installs",
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
      "platform/get-command",
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
  },
  {
    serverInfo: { name: "tacowp", version: "0.1.0" },
    instructions:
      "This is the TacoWP fleet registry. Use sites/list, site/get, and site/get-plugins for inventory. Plugin tools on a WordPress site (Rank Math, core, etc.) are not listed here; those will be discovered later via site/list-tools.",
  }
);

export { McpQueryError };
