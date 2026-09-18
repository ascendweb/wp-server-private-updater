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