"use client";

import type { AutomationSnapshot, WorkstreamDefinition } from "@cfo/domain";
import { Button, Card } from "@cfo/ui";
import { ArrowRight, Bot, CheckCircle2, Link2 } from "lucide-react";
import type { WorkspaceViewData } from "@/lib/workspace-data";
import type { ViewKey } from "../workspace-app";
import { formatCompactDate, priorityOrder } from "../view-utils";

export function DashboardView({ data, workstreams, onNavigate, automation, onTask, onReview }: {
  data: WorkspaceViewData; workstreams: WorkstreamDefinition[];
  onNavigate: (view: ViewKey) => void;
  onSaveTask: (id: string, patch: { status: "complete" | "not-started" }) => Promise<void>;
  automation: AutomationSnapshot | null;
  onTask: (id: string) => void;
  onReview: () => void;
}) {
  const tasks = data.tasks.filter((task) => !["complete", "not-applicable"].includes(task.status));
  const next = [...tasks].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.endDate.localeCompare(b.endDate)).slice(0, 5);
  const connected = automation?.systems.filter((system) => system.connected).length ?? 0;
  const ready = automation?.taskReadiness.filter((task) => task.state === "ready").length ?? 0;
  const reviews = automation?.runs.filter((run) => run.status === "needs-review").length ?? 0;
  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[var(--ink)] p-6 text-white">
        <div><p className="text-xs text-slate-300">{data.workspace.name}</p><h2 className="mt-1 text-2xl font-semibold">What needs your attention?</h2><p className="mt-2 text-sm text-slate-300">Connect your systems, assign the work, review the results.</p></div>
        <Button onClick={() => onNavigate(connected < 8 ? "connectors" : "workstreams")}>{connected < 8 ? "Connect work areas" : "Open workstreams"}<ArrowRight size={15} /></Button>
      </section>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Connected work areas", value: `${connected}/8`, hint: "Manage access", icon: Link2, view: "connectors" as const },
          { label: "Ready for an agent", value: ready, hint: "Start from Workstreams", icon: Bot, view: "workstreams" as const },
          { label: "Outputs to review", value: reviews, hint: "Review work and next steps", icon: CheckCircle2, view: "workstreams" as const },
        ].map((item) => <button key={item.label} className="rounded-xl border border-[var(--border)] bg-white p-5 text-left hover:border-purple-300" onClick={() => item.label === "Outputs to review" ? onReview() : onNavigate(item.view)}>
          <div className="flex items-center justify-between"><span className="text-xs text-slate-500">{item.label}</span><item.icon size={17} className="text-purple-500" /></div>
          <strong className="mt-2 block text-3xl">{item.value}</strong><span className="mt-2 block text-xs text-slate-500">{item.hint}</span>
        </button>)}
      </div>
      <Card className="overflow-hidden">
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><h3 className="font-semibold">Next priorities</h3><Button size="sm" variant="ghost" onClick={() => onNavigate("workstreams")}>See all work <ArrowRight size={14} /></Button></header>
        <div className="divide-y divide-[var(--border)]">{next.map((task) => <button key={task.id} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50" onClick={() => onTask(task.id)}>
          <div><strong className="block text-sm">{task.title}</strong><span className="mt-1 block text-xs text-slate-500">{workstreams.find((stream) => stream.id === task.workstream)?.shortName} · {task.ownerRole}</span></div>
          <span className="shrink-0 text-xs text-slate-500">{formatCompactDate(task.endDate)}</span>
        </button>)}</div>
        {!next.length && <p className="p-8 text-center text-sm text-slate-500">No open work. Your current plan is complete.</p>}
      </Card>
      <p className="text-xs text-slate-500">Local demo. Your work stays on this computer. Templates, models, and the finance team plan are in Resources.</p>
    </div>
  );
}
