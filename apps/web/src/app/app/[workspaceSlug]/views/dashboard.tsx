"use client";

import type { WorkstreamDefinition } from "@cfo/domain";
import { Button, Card } from "@cfo/ui";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Users,
} from "lucide-react";
import type { WorkspaceViewData } from "@/lib/workspace-data";
import type { ViewKey } from "../workspace-app";
import {
  formatCompactDate,
  priorityOrder,
  taskProgress,
} from "../view-utils";

type DashboardProps = {
  data: WorkspaceViewData;
  workstreams: WorkstreamDefinition[];
  onNavigate: (view: ViewKey) => void;
  onSaveTask: (
    taskId: string,
    patch: { status: "complete" | "not-started" },
  ) => Promise<void>;
};

export function DashboardView({
  data,
  workstreams,
  onNavigate,
  onSaveTask,
}: DashboardProps) {
  const applicable = data.tasks.filter(
    (task) => task.status !== "not-applicable",
  );
  const completed = applicable.filter((task) => task.status === "complete");
  const blocked = applicable.filter((task) => task.status === "blocked");
  const first90 = applicable.filter((task) =>
    ["days-1-30", "days-31-60", "days-61-90"].includes(task.phase),
  );
  const hiringCount = data.hiringPlans.filter(
    (plan) => !["filled", "not-needed"].includes(plan.status),
  ).length;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = applicable
    .filter((task) => task.status !== "complete")
    .sort((left, right) => {
      const priority = priorityOrder[left.priority] - priorityOrder[right.priority];
      return priority !== 0
        ? priority
        : left.endDate.localeCompare(right.endDate);
    })
    .slice(0, 8);
  const overdue = applicable.filter(
    (task) => task.status !== "complete" && task.endDate < today,
  ).length;

  const cards = [
    {
      label: "Overall progress",
      value: `${taskProgress(applicable)}%`,
      detail: `${completed.length} of ${applicable.length} tasks complete`,
      icon: CheckCircle2,
      color: "var(--teal)",
      surface: "var(--teal-soft)",
    },
    {
      label: "First 90 days",
      value: `${taskProgress(first90)}%`,
      detail: `${first90.filter((task) => task.status !== "complete").length} open priorities`,
      icon: CalendarClock,
      color: "var(--purple)",
      surface: "var(--purple-soft)",
    },
    {
      label: "At risk",
      value: String(blocked.length + overdue),
      detail: `${blocked.length} blocked, ${overdue} overdue`,
      icon: AlertTriangle,
      color: "var(--pink)",
      surface: "var(--pink-soft)",
    },
    {
      label: "Hiring actions",
      value: String(hiringCount),
      detail: "Trigger-based finance roles",
      icon: Users,
      color: "#c56a1b",
      surface: "var(--orange-soft)",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-[var(--ink)] p-6 text-white sm:p-8">
        <div className="flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
              {data.profile?.stage.replace("-", " ")} operating plan
            </p>
            <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
              Stabilize the finance foundation, then create the capacity to
              scale.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Your roadmap is tailored to {data.profile?.employeeCount}{" "}
              employees, a {data.profile?.closeDays}-day close, and{" "}
              {data.profile?.cashRunwayMonths} months of runway.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => onNavigate("roadmap")}
              className="bg-white text-[var(--ink)] hover:bg-slate-100"
            >
              Open roadmap <ArrowRight size={14} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onNavigate("models")}
              className="border border-white/15 text-white hover:bg-white/10"
            >
              <CircleDollarSign size={14} /> Open models
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-[var(--ink-muted)]">
                    {card.label}
                  </p>
                  <strong className="mt-2 block text-3xl tracking-tight">
                    {card.value}
                  </strong>
                </div>
                <span
                  className="grid h-10 w-10 place-items-center rounded-xl"
                  style={{ background: card.surface, color: card.color }}
                >
                  <Icon size={18} />
                </span>
              </div>
              <p className="mt-3 text-xs text-[var(--ink-muted)]">
                {card.detail}
              </p>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div>
              <p className="eyebrow">Now</p>
              <h3 className="mt-1 font-semibold">Highest-priority work</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("roadmap")}
            >
              View all <ArrowRight size={13} />
            </Button>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {upcoming.map((task) => {
              const stream = workstreams.find(
                (item) => item.id === task.workstream,
              );
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 px-5 py-3.5"
                >
                  <button
                    onClick={() =>
                      onSaveTask(task.id, {
                        status:
                          task.status === "complete"
                            ? "not-started"
                            : "complete",
                      })
                    }
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                      task.status === "complete"
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 bg-white"
                    }`}
                    aria-label={`Mark ${task.title} ${
                      task.status === "complete" ? "not started" : "complete"
                    }`}
                  >
                    {task.status === "complete" ? (
                      <CheckCircle2 size={13} />
                    ) : null}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{task.title}</p>
                    <p className="mt-1 flex items-center gap-2 text-[11px] text-[var(--ink-muted)]">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: stream?.color }}
                      />
                      {stream?.shortName} · due{" "}
                      {formatCompactDate(task.endDate)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${
                      task.priority === "critical"
                        ? "bg-red-50 text-red-700"
                        : task.priority === "high"
                          ? "bg-orange-50 text-orange-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {task.priority}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Coverage</p>
              <h3 className="mt-1 font-semibold">Workstream health</h3>
            </div>
            <Banknote size={18} className="text-[var(--purple)]" />
          </div>
          <div className="mt-5 space-y-4">
            {workstreams.map((stream) => {
              const streamTasks = applicable.filter(
                (task) => task.workstream === stream.id,
              );
              const progress = taskProgress(streamTasks);
              return (
                <div key={stream.id}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-semibold">{stream.shortName}</span>
                    <span className="text-[var(--ink-muted)]">{progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: stream.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--blue-soft)] text-sky-700">
          <Clock3 size={19} />
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Recurring finance cadence</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
            Daily cash, weekly collections and GTM, monthly close and forecast,
            quarterly board and treasury, annual audit/tax/equity cycles.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onNavigate("roadmap")}
        >
          View cadence
        </Button>
      </Card>
    </div>
  );
}
