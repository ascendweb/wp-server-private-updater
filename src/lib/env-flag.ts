function readEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== "string") return "";
  return value.trim().replace(/^['"]+|['"]+$/g, "");
}

/** True only for explicit true-like values. Unset and "false" are off. */
export function envFlagEnabled(name: string): boolean {
  return ["1", "true", "yes", "on"].includes(readEnv(name).toLowerCase());
}
