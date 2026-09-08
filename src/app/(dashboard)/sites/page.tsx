import { SitesListClient } from "./sites-list-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sites" };

export default function SitesPage() {
  return <SitesListClient archived={false} />;
}
