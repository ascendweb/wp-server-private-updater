export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.DATABASE_URL) return;

  const { startFormMonitorWorker } = await import("@/Feature/FormMonitor/jobs");
  await startFormMonitorWorker();
}