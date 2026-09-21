import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RelativeTime } from "@/components/relative-time";
import type { FormMonitorLeadRecord } from "@/Feature/FormMonitor/types";

function formLabel(record: FormMonitorLeadRecord) {
  if (record.formTitle) return record.formTitle;
  if (record.formId) return `Form ${record.formId}`;
  return "Untitled form";
}

function statusOf(record: FormMonitorLeadRecord): { label: string; variant: "success" | "warn" | "subtle" } {
  if (record.isSpam) return { label: "Spam", variant: "subtle" };
  if (record.trackingReceivedAt) return { label: "Tracked", variant: "success" };
  if (record.ignoredAt) return { label: "Fixed", variant: "subtle" };
  return { label: "Missing", variant: "warn" };
}

function gfAdminUrl(siteUrl: string, formId: number, entryId?: number) {
  const base = siteUrl.replace(/\/$/, "");
  const params = new URLSearchParams({
    page: "gf_entries",
    id: String(formId),
  });
  if (entryId) {
    params.set("view", "entry");
    params.set("lid", String(entryId));
  }
  return `${base}/wp-admin/admin.php?${params.toString()}`;
}

function ViewLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-muted-foreground underline-offset-2 opacity-0 hover:underline group-hover:opacity-100"
    >
      {label}
    </a>
  );
}

export function FormMonitorRecords({ records, siteUrl }: { records: FormMonitorLeadRecord[]; siteUrl: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent submissions</CardTitle>
        <CardDescription>Last 15 form monitor records for this site.</CardDescription>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No form submissions recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Form</TableHead>
                <TableHead>GF ID</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => {
                const status = statusOf(record);
                return (
                  <TableRow key={record.id} className="group">
                    <TableCell className="font-medium">{formLabel(record)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        {record.formId ?? "—"}
                        {record.formId ? (
                          <ViewLink href={gfAdminUrl(siteUrl, record.formId)} label="(View)" />
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <RelativeTime value={record.formReceivedAt} />
                        {record.formId && record.entryId ? (
                          <ViewLink href={gfAdminUrl(siteUrl, record.formId, record.entryId)} label="(View)" />
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <RelativeTime value={record.trackingReceivedAt} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
