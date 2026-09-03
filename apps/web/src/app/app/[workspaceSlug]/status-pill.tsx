import type { TaskStatus } from "@cfo/domain";
import { statusLabels } from "./view-utils";

const styles: Record<TaskStatus, string> = {
  "not-started": "bg-slate-100 text-slate-600",
  "in-progress": "bg-blue-50 text-blue-700",
  blocked: "bg-red-50 text-red-700",
  complete: "bg-emerald-50 text-emerald-700",
  "not-applicable": "bg-slate-50 text-slate-400",
};

export function StatusPill({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${styles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
