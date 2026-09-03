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

export type DirectTaskRelations = {
  prerequisites: WorkspaceTaskView[];
  openPrerequisites: WorkspaceTaskView[];
  dependents: WorkspaceTaskView[];
  relatedTaskIds: Set<string>;
};

function relationSort(
  left: WorkspaceTaskView,
  right: WorkspaceTaskView,
): number {
  const dateOrder = left.startDate.localeCompare(right.startDate);
  return dateOrder !== 0
    ? dateOrder
    : priorityOrder[left.priority] - priorityOrder[right.priority];
}

export function getDirectTaskRelations(
  tasks: WorkspaceTaskView[],
  taskId: string | null,
): DirectTaskRelations {
  const focusTask = tasks.find((task) => task.id === taskId);
  if (!focusTask) {
    return {
      prerequisites: [],
      openPrerequisites: [],
      dependents: [],
      relatedTaskIds: new Set(),
    };
  }

  const byMasterTaskId = new Map(
    tasks.map((task) => [task.masterTaskId, task]),
  );
  const prerequisites = focusTask.dependencies
    .map((dependencyId) => byMasterTaskId.get(dependencyId))
    .filter((task): task is WorkspaceTaskView => Boolean(task))
    .sort(relationSort);
  const dependents = tasks
    .filter((task) => task.dependencies.includes(focusTask.masterTaskId))
    .sort(relationSort);
  const openPrerequisites = prerequisites.filter(
    (task) =>
      task.status !== "complete" && task.status !== "not-applicable",
  );

  return {
    prerequisites,
    openPrerequisites,
    dependents,
    relatedTaskIds: new Set([
      focusTask.id,
      ...prerequisites.map((task) => task.id),
      ...dependents.map((task) => task.id),
    ]),
  };
}
