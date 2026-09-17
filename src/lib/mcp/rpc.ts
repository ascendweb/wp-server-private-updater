import { createAndDispatchRpc, RpcDispatchError } from "@/lib/commands";
import { resolveSite } from "./queries";

export { RpcDispatchError };

export async function listSiteTools(siteRef: string) {
  const site = await resolveSite(siteRef);
  const { output } = await createAndDispatchRpc(site.id, "list_tools", {});
  return output;
}

export async function callSiteTool(
  siteRef: string,
  ability: string,
  args: Record<string, unknown> = {}
) {
  const site = await resolveSite(siteRef);
  const { output } = await createAndDispatchRpc(site.id, "call_ability", {
    ability,
    arguments: args,
  });
  return output;
}
