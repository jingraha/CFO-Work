"use client";

import type { WorkstreamDefinition } from "@cfo/domain";
import { Button, Card } from "@cfo/ui";
import {
  ArrowDownRight,
  CheckCircle2,
  CircleAlert,
  Focus,
  MousePointer2,
  X,
} from "lucide-react";
import type { WorkspaceTaskView } from "@/lib/workspace-data";
import { StatusPill } from "./status-pill";
import type { DirectTaskRelations } from "./view-utils";
import { formatCompactDate } from "./view-utils";

type Props = {
  task: WorkspaceTaskView;
  relations: DirectTaskRelations;
  workstreams: WorkstreamDefinition[];
  onFocus: (task: WorkspaceTaskView) => void;
  onOpen: (task: WorkspaceTaskView) => void;
  onClear: () => void;
};

export function DependencyFocus({
  task,
  relations,
  workstreams,
  onFocus,
  onOpen,
  onClear,
}: Props) {
  const stream = workstreams.find((item) => item.id === task.workstream);
  const blocked = relations.openPrerequisites.length > 0;

  return (
    <Card className="overflow-hidden border-slate-300">
      <div className="flex flex-col gap-4 bg-[var(--ink)] px-5 py-4 text-white lg:flex-row lg:items-center">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[var(--blue)]">
          <Focus size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--blue)]">
              Dependency focus
            </span>
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: stream?.color }}
            />
            <span className="text-[10px] text-slate-300">
              {stream?.shortName}
            </span>
          </div>
          <h2 className="mt-1 truncate text-base font-semibold">{task.title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => onOpen(task)}
            className="bg-white text-[var(--ink)] hover:bg-slate-100"
          >
            Open full details
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClear}
            className="border border-white/15 text-white hover:bg-white/10"
          >
            <X size={13} /> Show full roadmap
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2">
        <RelationColumn
          tone="prerequisite"
          title="Needs to happen first"
          description={
            blocked
              ? `${relations.openPrerequisites.length} incomplete prerequisite${
                  relations.openPrerequisites.length === 1 ? "" : "s"
                } currently block this task.`
              : "All direct prerequisites are complete or not applicable."
          }
          tasks={relations.prerequisites}
          emptyText="No prerequisite tasks. This item can start independently."
          onFocus={onFocus}
          onOpen={onOpen}
        />
        <RelationColumn
          tone="dependent"
          title="This task directly unblocks"
          description={`${relations.dependents.length} downstream task${
            relations.dependents.length === 1 ? "" : "s"
          } directly depend on this item.`}
          tasks={relations.dependents}
          emptyText="No tasks directly depend on this item."
          onFocus={onFocus}
          onOpen={onOpen}
        />
      </div>

      <div
        className={`flex items-start gap-2 border-t px-5 py-3 text-xs ${
          blocked
            ? "border-red-100 bg-red-50 text-red-800"
            : "border-emerald-100 bg-emerald-50 text-emerald-800"
        }`}
      >
        {blocked ? (
          <CircleAlert size={14} className="mt-0.5 shrink-0" />
        ) : (
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
        )}
        <span>
          {blocked
            ? `Blocked until: ${relations.openPrerequisites
                .map((item) => item.title)
                .join("; ")}.`
            : task.status === "blocked"
              ? "No dependency is holding this task. It was marked blocked manually; check its notes for the reason."
              : "No open dependency is holding this task."}
        </span>
      </div>
    </Card>
  );
}

function RelationColumn({
  tone,
  title,
  description,
  tasks,
  emptyText,
  onFocus,
  onOpen,
}: {
  tone: "prerequisite" | "dependent";
  title: string;
  description: string;
  tasks: WorkspaceTaskView[];
  emptyText: string;
  onFocus: (task: WorkspaceTaskView) => void;
  onOpen: (task: WorkspaceTaskView) => void;
}) {
  const prerequisite = tone === "prerequisite";
  return (
    <section
      className={`p-5 ${prerequisite ? "border-b lg:border-b-0 lg:border-r" : ""} border-[var(--border)]`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
            prerequisite
              ? "bg-blue-50 text-blue-700"
              : "bg-orange-50 text-orange-700"
          }`}
        >
          <ArrowDownRight
            size={15}
            className={prerequisite ? "rotate-90" : ""}
          />
        </span>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-[11px] leading-5 text-[var(--ink-muted)]">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {tasks.map((relatedTask) => (
          <button
            key={relatedTask.id}
            onClick={() => onFocus(relatedTask)}
            onDoubleClick={() => onOpen(relatedTask)}
            className={`flex w-full items-center gap-3 rounded-lg border bg-white p-3 text-left transition hover:shadow-sm ${
              prerequisite
                ? "border-blue-200 hover:border-blue-400"
                : "border-orange-200 hover:border-orange-400"
            }`}
            title="Click to focus. Double-click to open full details."
          >
            <span
              className={`h-7 w-1 shrink-0 rounded-full ${
                prerequisite ? "bg-blue-500" : "bg-orange-500"
              }`}
            />
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-xs">
                {relatedTask.title}
              </strong>
              <span className="mt-1 block text-[10px] text-[var(--ink-muted)]">
                {formatCompactDate(relatedTask.startDate)} -{" "}
                {formatCompactDate(relatedTask.endDate)}
              </span>
            </span>
            <StatusPill status={relatedTask.status} />
          </button>
        ))}
        {tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] text-[var(--ink-muted)]">
            {emptyText}
          </p>
        ) : null}
      </div>

      {tasks.length > 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-[var(--ink-muted)]">
          <MousePointer2 size={11} />
          Click to refocus; double-click for details.
        </p>
      ) : null}
    </section>
  );
}
