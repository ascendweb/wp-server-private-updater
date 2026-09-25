export type FormMonitorTrend = {
  direction: "up" | "down" | "flat";
  percent: number | null;
};

export type FormMonitorTotals = {
  submitted: number;
  missing: number;
  spam: number;
  potentialSpam: number;
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
  spamDisagreeCount: number;
  trend: FormMonitorTrend;
};

export type FormMonitorDayBucket = {
  date: string;
  submissions: number;
  missing: number;
  spam: number;
  potentialSpam: number;
  deleted: number;
  test: number;
};

export type FormMonitorLeadRecord = {
  id: string;
  referenceId: string;
  formTitle: string | null;
  isSpam: boolean;
  isTrackingSpam: boolean;
  isTest: boolean;
  formId: number | null;
  entryId: number | null;
  formReceivedAt: string | null;
  trackingReceivedAt: string | null;
  trackingId: string | null;
  trackingUrl: string | null;
  trackingPlatform: string | null;
  ignoredAt: string | null;
  deletedAt: string | null;
};

export type FormMonitorFormSummary = {
  formId: number | null;
  formTitle: string | null;
  lastFormAt: string | null;
  lastTrackingAt: string | null;
  submitted: number;
  missing: number;
  trackedRate: number | null;
};
