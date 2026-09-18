export const REFERENCE_FIELD = "tacowp_reference_id";
export const CHECK_TRACKING_QUEUE = "form-monitor-check-tracking";

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

export function isTrackingUpdate(payload: unknown): boolean {
  const body = asRecord(payload);
  const trigger = stringValue(body?.trigger);
  return trigger?.toLowerCase() === "update";
}