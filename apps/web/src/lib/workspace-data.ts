import type { WorkspaceSnapshot } from "@cfo/db";

type IsoDates<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: string;
};

type TaskRow = WorkspaceSnapshot["tasks"][number];
type VendorRow = WorkspaceSnapshot["vendorEvaluations"][number];
type HiringRow = WorkspaceSnapshot["hiringPlans"][number];
type TemplateRow = WorkspaceSnapshot["templateInstances"][number];
type AuditRow = WorkspaceSnapshot["auditEvents"][number];

export type WorkspaceTaskView = IsoDates<TaskRow, "createdAt" | "updatedAt">;
export type VendorEvaluationView = IsoDates<VendorRow, "updatedAt">;
export type HiringPlanView = IsoDates<HiringRow, "updatedAt">;
export type TemplateInstanceView = IsoDates<TemplateRow, "updatedAt">;
export type AuditEventView = IsoDates<AuditRow, "createdAt">;

export type WorkspaceViewData = Omit<
  WorkspaceSnapshot,
  | "tasks"
  | "vendorEvaluations"
  | "hiringPlans"
  | "templateInstances"
  | "auditEvents"
> & {
  tasks: WorkspaceTaskView[];
  vendorEvaluations: VendorEvaluationView[];
  hiringPlans: HiringPlanView[];
  templateInstances: TemplateInstanceView[];
  auditEvents: AuditEventView[];
};

export function serializeWorkspace(
  snapshot: WorkspaceSnapshot,
): WorkspaceViewData {
  return {
    ...snapshot,
    tasks: snapshot.tasks.map((task) => ({
      ...task,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
    vendorEvaluations: snapshot.vendorEvaluations.map((evaluation) => ({
      ...evaluation,
      updatedAt: evaluation.updatedAt.toISOString(),
    })),
    hiringPlans: snapshot.hiringPlans.map((plan) => ({
      ...plan,
      updatedAt: plan.updatedAt.toISOString(),
    })),
    templateInstances: snapshot.templateInstances.map((instance) => ({
      ...instance,
      updatedAt: instance.updatedAt.toISOString(),
    })),
    auditEvents: snapshot.auditEvents.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}
