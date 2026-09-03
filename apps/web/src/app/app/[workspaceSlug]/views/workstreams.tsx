"use client";

import type {
  MasterTask,
  TaskStatus,
  WorkstreamDefinition,
} from "@cfo/domain";
import { Button, Card } from "@cfo/ui";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { WorkspaceTaskView } from "@/lib/workspace-data";
import { StatusPill } from "../status-pill";
import { phaseLabels, taskProgress } from "../view-utils";

type Props = {
  tasks: WorkspaceTaskView[];
  workstreams: WorkstreamDefinition[];
  masterTasks: MasterTask[];
  onSaveTask: (
    taskId: string,
    patch: { status: TaskStatus },
  ) => Promise<void>;
};

export function WorkstreamsView({
  tasks,
  workstreams,
  masterTasks,
  onSaveTask,
}: Props) {
  const [selected, setSelected] = useState(workstreams[0]?.id);
  const [showMaster, setShowMaster] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const tailoredIds = useMemo(
    () => new Set(tasks.map((task) => task.masterTaskId)),
    [tasks],
  );
  const stream = workstreams.find((item) => item.id === selected);
  const workspaceTasks = tasks.filter((task) => task.workstream === selected);
  const visibleMaster = masterTasks.filter(
    (task) =>
      task.workstream === selected &&
      (showMaster || tailoredIds.has(task.id)) &&
      `${task.title} ${task.description} ${task.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
      <section className="space-y-3">
        <div className="mb-5">
          <p className="text-sm leading-6 text-[var(--ink-muted)]">
            Ten distinct areas cover the CFO remit without counting close,
            forecasting, or systems work twice.
          </p>
        </div>
        {workstreams.map((item) => {
          const streamTasks = tasks.filter(
            (task) => task.workstream === item.id,
          );
          const progress = taskProgress(streamTasks);
          const active = selected === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSelected(item.id)}
              className={`w-full rounded-xl border p-4 text-left transition ${
                active
                  ? "border-[var(--purple)] bg-white shadow-sm"
                  : "border-[var(--border)] bg-white/60 hover:bg-white"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 h-9 w-1.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm">{item.name}</strong>
                    <span className="text-xs font-semibold text-[var(--ink-muted)]">
                      {progress}%
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--ink-muted)]">
                    {item.description}
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </section>

      <section className="min-w-0">
        <Card className="overflow-hidden">
          <div
            className="border-b border-[var(--border)] p-6"
            style={{
              background: `linear-gradient(120deg, ${stream?.color}18, white 48%)`,
            }}
          >
            <p className="eyebrow">Workstream</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              {stream?.name}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
              {stream?.description}
            </p>
            <div className="mt-5 rounded-xl border border-white bg-white/80 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
                Intended outcome
              </p>
              <p className="mt-1 text-sm font-semibold">{stream?.outcome}</p>
            </div>
          </div>

          <div className="border-b border-[var(--border)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-3 text-slate-400"
                />
                <input
                  className="field pl-9"
                  placeholder="Search tasks and tags"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs">
                <button
                  onClick={() => setShowMaster(false)}
                  className={`rounded-md px-3 py-2 font-semibold ${
                    !showMaster ? "bg-white shadow-sm" : "text-slate-500"
                  }`}
                >
                  Tailored ({workspaceTasks.length})
                </button>
                <button
                  onClick={() => setShowMaster(true)}
                  className={`rounded-md px-3 py-2 font-semibold ${
                    showMaster ? "bg-white shadow-sm" : "text-slate-500"
                  }`}
                >
                  Master catalog
                </button>
              </div>
            </div>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {visibleMaster.map((masterTask) => {
              const task = tasks.find(
                (item) => item.masterTaskId === masterTask.id,
              );
              const expanded = expandedTask === masterTask.id;
              return (
                <div key={masterTask.id} className="p-4 sm:px-5">
                  <div className="flex items-start gap-3">
                    {task ? (
                      <button
                        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                          task.status === "complete"
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300"
                        }`}
                        onClick={() =>
                          onSaveTask(task.id, {
                            status:
                              task.status === "complete"
                                ? "not-started"
                                : "complete",
                          })
                        }
                        aria-label={`Toggle ${task.title}`}
                      >
                        {task.status === "complete" ? (
                          <Check size={13} />
                        ) : null}
                      </button>
                    ) : (
                      <span
                        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-dashed border-slate-300 text-[9px] text-slate-400"
                        title="Not included by the current company profile"
                      >
                        -
                      </span>
                    )}
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() =>
                        setExpandedTask(expanded ? null : masterTask.id)
                      }
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm">{masterTask.title}</strong>
                        {task ? (
                          <StatusPill status={task.status} />
                        ) : (
                          <span className="rounded-full bg-slate-50 px-2 py-1 text-[9px] font-bold uppercase text-slate-400">
                            Not tailored
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs text-[var(--ink-muted)]">
                        {phaseLabels[masterTask.phase]} · {masterTask.ownerRole} ·{" "}
                        {masterTask.financeResponsibility}
                      </span>
                    </button>
                    <button
                      onClick={() =>
                        setExpandedTask(expanded ? null : masterTask.id)
                      }
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"
                      aria-label={expanded ? "Collapse task" : "Expand task"}
                    >
                      {expanded ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </button>
                  </div>
                  {expanded ? (
                    <div className="ml-8 mt-4 rounded-xl bg-[var(--surface-muted)] p-4 text-xs leading-5 text-[var(--ink-muted)]">
                      <p>{masterTask.description}</p>
                      <p className="mt-3">
                        <strong className="text-[var(--ink)]">Outcome:</strong>{" "}
                        {masterTask.outcome}
                      </p>
                      <p className="mt-2">
                        <strong className="text-[var(--ink)]">
                          Why included:
                        </strong>{" "}
                        {task
                          ? task.recommendationReason
                          : "The current company profile does not trigger this item. It remains available in the master catalog."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {masterTask.deliverables.map((deliverable) => (
                          <span
                            key={deliverable}
                            className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-slate-600"
                          >
                            {deliverable}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {visibleMaster.length === 0 ? (
            <div className="p-10 text-center text-sm text-[var(--ink-muted)]">
              No tasks match this filter.
            </div>
          ) : null}

          <div className="border-t border-[var(--border)] p-4 text-right">
            <Button variant="ghost" size="sm">
              Export workstream <ArrowRight size={13} />
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
