import "server-only";
import { processEnabledEnvironments } from "@cfo/db";

const worker = globalThis as typeof globalThis & {
  cfoAutomationTimer?: ReturnType<typeof setInterval>;
  cfoAutomationTick?: Promise<void>;
};

export async function runAutomationTick() {
  worker.cfoAutomationTick ??= processEnabledEnvironments().finally(() => {
    delete worker.cfoAutomationTick;
  });
  return worker.cfoAutomationTick;
}

export function startAutomationWorker() {
  if (worker.cfoAutomationTimer) return;
  const tick = () => {
    void runAutomationTick().catch((error: unknown) => {
      console.error("CFO automation heartbeat failed:", error);
    });
  };
  worker.cfoAutomationTimer = setInterval(tick, 3_000);
  worker.cfoAutomationTimer.unref();
  tick();
}
