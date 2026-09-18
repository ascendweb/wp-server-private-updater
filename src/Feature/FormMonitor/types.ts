export type FormMonitorSiteSummary = {
  id: string;
  url: string;
  label: string | null;
  lastFormAt: string | null;
  lastTrackingAt: string | null;
  missingLast7Days: number;
};

export type FormMonitorDayBucket = {
  date: string;
  submissions: number;
  missing: number;
};

export type FormMonitorLeadRecord = {
  id: string;
  referenceId: string;
  formTitle: string | null;
  formId: number | null;
  entryId: number | null;
  formReceivedAt: string | null;
  trackingReceivedAt: string | null;
  ignoredAt: string | null;
};