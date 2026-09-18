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
  if (record.trackingReceivedAt) return { label: "Tracked", variant: "success" };
  if (record.ignoredAt) return { label: "Fixed", variant: "subtle" };
  return { label: "Missing tracking", variant: "warn" };
}

export function FormMonitorRecords({ records }: { records: FormMonitorLeadRecord[] }) {
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
                <TableHead>Submitted</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => {
                const status = statusOf(record);
                return (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{formLabel(record)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <RelativeTime value={record.formReceivedAt} />
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
