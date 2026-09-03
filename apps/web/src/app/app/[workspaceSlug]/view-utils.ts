import type { Phase, Priority, TaskStatus } from "@cfo/domain";
import type { WorkspaceTaskView } from "@/lib/workspace-data";

export const phaseLabels: Record<Phase, string> = {
  "days-1-30": "Days 1-30",
  "days-31-60": "Days 31-60",
  "days-61-90": "Days 61-90",
  "months-4-6": "Months 4-6",
  "months-7-12": "Months 7-12",
  recurring: "Recurring",
};

export const statusLabels: Record<TaskStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  blocked: "Blocked",
  complete: "Complete",
  "not-applicable": "N/A",
};

export const priorityOrder: Record<Priority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function taskProgress(tasks: WorkspaceTaskView[]): number {
  const applicable = tasks.filter((task) => task.status !== "not-applicable");
  if (applicable.length === 0) return 0;
  return Math.round(
    applicable.reduce((sum, task) => sum + task.percentComplete, 0) /
      applicable.length,
  );
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function formatCompactDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function daysBetween(left: string, right: string): number {
  const milliseconds =
    Date.parse(`${right}T00:00:00Z`) - Date.parse(`${left}T00:00:00Z`);
  return Math.round(milliseconds / 86_400_000);
}

export function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
