export const REFERENCE_FIELD = "tacowp_reference_id";
export const CHECK_TRACKING_QUEUE = "form-monitor-check-tracking";
export const DEFAULT_CHECK_DELAY_MINUTES = 60;
export const DEFAULT_TEST_QUERY_PARAMS = ["checkview_test_id"];
export const DEFAULT_TREND_BAND_PERCENT = 15;
export const DEFAULT_TREND_ABS_DELTA = 2;
export const FORM_MONITOR_EVENT_LIMIT = 15;
export const TRACKING_PLATFORM_WHATCONVERTS = "whatconverts";

export type TrackingMeta = {
  profile_id?: string;
  account_id?: string;
};

export function parseOptionalInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parseSubmittedAt(value: unknown): Date {
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeFieldKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function extractReferenceId(payload: unknown): string | null {
  const body = asRecord(payload);
  if (!body) return null;

  const direct = stringValue(body[REFERENCE_FIELD]);
  if (direct) return direct;

  const additional = asRecord(body.additional_fields) ?? asRecord(body.additionalFields);
  if (additional) {
    const named = stringValue(additional[REFERENCE_FIELD]);
    if (named) return named;

    const expected = normalizeFieldKey(REFERENCE_FIELD);
    for (const [key, value] of Object.entries(additional)) {
      if (normalizeFieldKey(key) === expected) {
        const found = stringValue(value);
        if (found) return found;
      }
    }
  }

  return null;
}

export function extractTrackingId(payload: unknown): string | null {
  const body = asRecord(payload);
  if (!body) return null;
  return stringValue(body.lead_id) ?? stringValue(body.leadId) ?? stringValue(body.id);
}

export function extractTrackingMeta(payload: unknown): TrackingMeta {
  const body = asRecord(payload);
  if (!body) return {};
  const meta: TrackingMeta = {};
  const profileId = stringValue(body.profile_id) ?? stringValue(body.profileId);
  const accountId = stringValue(body.account_id) ?? stringValue(body.accountId);
  if (profileId) meta.profile_id = profileId;
  if (accountId) meta.account_id = accountId;
  return meta;
}

export function extractTrackingSpam(payload: unknown): boolean | null {
  const body = asRecord(payload);
  if (!body) return null;
  if (!("spam" in body) && !("is_spam" in body) && !("isSpam" in body)) return null;
  const value = body.spam ?? body.is_spam ?? body.isSpam;
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

export function parseTrackingMeta(value: unknown): TrackingMeta {
  const record = asRecord(value);
  if (!record) return {};
  const meta: TrackingMeta = {};
  const profileId = stringValue(record.profile_id) ?? stringValue(record.profileId);
  const accountId = stringValue(record.account_id) ?? stringValue(record.accountId);
  if (profileId) meta.profile_id = profileId;
  if (accountId) meta.account_id = accountId;
  return meta;
}

export function mergeTrackingMeta(existing: unknown, incoming: TrackingMeta): TrackingMeta {
  return { ...parseTrackingMeta(existing), ...incoming };
}

export function normalizeTrackingOrigin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function trackingLeadUrl(input: {
  platform: string | null | undefined;
  trackingId: string | null | undefined;
  meta: unknown;
  whatConvertsUrl: string | null | undefined;
}): string | null {
  if (input.platform !== TRACKING_PLATFORM_WHATCONVERTS) return null;
  const origin = normalizeTrackingOrigin(input.whatConvertsUrl);
  const profileId = parseTrackingMeta(input.meta).profile_id;
  if (!origin || !profileId || !input.trackingId) return null;
  return `${origin}/profile/${encodeURIComponent(profileId)}/leads?lid=${encodeURIComponent(input.trackingId)}`;
}

export type FormMonitorFieldValue = {
  id: string;
  label: string;
  type: string;
  value: string | null;
};

export function parseFormMonitorFields(value: unknown): FormMonitorFieldValue[] | null {
  if (!Array.isArray(value)) return null;
  const fields: FormMonitorFieldValue[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    const id = stringValue(record.id);
    if (!id) continue;
    fields.push({
      id,
      label: stringValue(record.label) ?? "",
      type: stringValue(record.type) ?? "",
      value: stringValue(record.value),
    });
  }
  return fields;
}

export function parseSourceUrl(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}