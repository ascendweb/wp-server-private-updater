/** True only for explicit true-like values. Unset and "false" are off. */
export function envFlagEnabled(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}
