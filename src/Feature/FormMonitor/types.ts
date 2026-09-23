export type FormMonitorTrend = {
  direction: "up" | "down" | "flat";
  percent: number | null;
};

export type FormMonitorTotals = {
  submitted: number;
  missing: number;
  spam: number;
  deleted: number;
  test: number;
  trackedRate: number | null;
};

export type FormMonitorSiteSummary = {
  id: string;
  url: string;
  label: string | null;
  lastFormAt: string | null;
  lastTrackingAt: string | null;
  submitted: number;
  missing: number;
  trackedRate: number | null;
  trend: FormMonitorTrend;
};

export type FormMonitorDayBucket = {
  date: string;
  submissions: number;
  missing: number;
  spam: number;
  deleted: number;
  test: number;
};

export type FormMonitorLeadRecord = {
  id: string;
  referenceId: string;
  formTitle: string | null;
  isSpam: boolean;
  isTest: boolean;
  formId: number | null;
  entryId: number | null;
  formReceivedAt: string | null;
  trackingReceivedAt: string | null;
  ignoredAt: string | null;
  deletedAt: string | null;
};
