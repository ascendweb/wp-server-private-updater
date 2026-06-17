import { redirect } from "next/navigation";

export default async function PluginSitesRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/plugins/${id}`);
}
