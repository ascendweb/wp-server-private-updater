import { SitesListClient } from "../sites-list-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Archived Sites" };

export default function ArchivedSitesPage() {
  return <SitesListClient archived />;
}
