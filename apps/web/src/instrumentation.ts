export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.CFO_BUILD_ONLY !== "true") {
    const { startAutomationWorker } = await import("./lib/automation-worker");
    startAutomationWorker();
  }
}
