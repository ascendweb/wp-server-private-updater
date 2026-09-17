"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mcpIssuer, mcpResourceUrl } from "@/lib/mcp/origin";
import {
  AUTH_CODE_TTL_MS,
  fetchCimdMetadata,
  isCimdClientId,
  parseScopeString,
  randomToken,
  redirectUriAllowed,
  upsertPublicClient,
} from "@/lib/mcp/tokens";

export type AuthorizeInput = {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope: string;
  resource: string;
};

async function resolveClient(clientId: string, redirectUri: string) {
  let client = await prisma.mcpOAuthClient.findUnique({ where: { clientId } });
  if (!client && isCimdClientId(clientId)) {
    const metadata = await fetchCimdMetadata(clientId);
    if (!metadata?.redirect_uris?.length) {
      return { error: "Could not load the application's client metadata." };
    }
    client = await upsertPublicClient({
      clientId,
      name: metadata.client_name || "AI client",
      redirectUris: metadata.redirect_uris,
      tokenEndpointAuthMethod: "none",
    });
  }
  if (!client) {
    return { error: "Unknown OAuth client." };
  }
  if (!redirectUriAllowed(client.redirectUris, redirectUri)) {
    return { error: "This redirect URI is not registered for the client." };
  }
  return { client };
}

export async function approveMcpAuthorization(input: AuthorizeInput) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const resolved = await resolveClient(input.clientId, input.redirectUri);
  if ("error" in resolved) {
    return { error: resolved.error };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, status: true },
  });
  if (!user || user.status === "disabled") {
    return { error: "Your account cannot authorize applications." };
  }

  const code = randomToken(32);
  await prisma.mcpAuthorizationCode.create({
    data: {
      code,
      clientId: resolved.client.clientId,
      userId: user.id,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      resource: input.resource || mcpResourceUrl(),
      scopes: parseScopeString(input.scope),
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
    },
  });

  const dest = new URL(input.redirectUri);
  dest.searchParams.set("code", code);
  if (input.state) dest.searchParams.set("state", input.state);
  dest.searchParams.set("iss", mcpIssuer());
  return { redirectTo: dest.toString() };
}

export { resolveClient };
