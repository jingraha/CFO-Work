"use client";

import type {
  HiringRole,
  MasterTask,
  TemplateDefinition,
  Vendor,
  WorkstreamDefinition,
} from "@cfo/domain";
import { Button } from "@cfo/ui";
import {
  BriefcaseBusiness,
  Building2,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  PlugZap,
  Settings,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";
import type {
  WorkspaceTaskView,
  WorkspaceViewData,
} from "@/lib/workspace-data";
import { updateTaskAction } from "../actions";
import { DashboardView } from "./views/dashboard";
import { HiringView } from "./views/hiring";
import { ModelsView } from "./views/models";
import { SettingsView } from "./views/settings";
import { TemplatesView } from "./views/templates";
import { VendorsView } from "./views/vendors";
import { ConnectorsSkills } from "./automation/connectors-skills";
import { useAutomation } from "./automation/use-automation";
import { WorkstreamsHub } from "./views/workstreams-hub";
import { WorkstreamsView } from "./views/workstreams";

export type CatalogData = {
  workstreams: WorkstreamDefinition[];
  masterTasks: MasterTask[];
  hiringRoles: HiringRole[];
  vendors: Vendor[];
  templates: TemplateDefinition[];
};

export type WorkspaceAppProps = {
  initialData: WorkspaceViewData;
  currentUser: { id: string; name: string; email: string };
  catalog: CatalogData;
};

export type ViewKey =
  | "dashboard"
  | "connectors"
  | "workstreams"
  | "vendors"
  | "resources"
  | "settings";

const navigation: Array<{
  id: ViewKey;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "dashboard", label: "Command center", icon: LayoutDashboard },
  { id: "connectors", label: "Connectors & skills", icon: PlugZap },
  { id: "workstreams", label: "Workstreams", icon: Library },
  { id: "vendors", label: "Vendor decisions", icon: Store },
];

const viewTitles: Record<ViewKey, { eyebrow: string; title: string }> = {
  connectors: { eyebrow: "Set up", title: "Connectors & skills" },
  dashboard: { eyebrow: "Today", title: "Command center" },
  workstreams: { eyebrow: "Get work done", title: "Workstreams" },
  vendors: { eyebrow: "Choose your stack", title: "Vendor decisions" },
  resources: { eyebrow: "Reference", title: "Resources" },
  settings: { eyebrow: "Governance", title: "Workspace & access" },
};

export function WorkspaceApp({
  initialData,
  currentUser,
  catalog,
}: WorkspaceAppProps) {
  const router = useRouter();
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [resourceTab, setResourceTab] = useState<"models" | "templates" | "hiring" | "playbook">("models");
  const [workEntry, setWorkEntry] = useState<{ taskId?: string; tab: "tasks" | "outputs" }>({ tab: "tasks" });
  const [tasks, setTasks] = useState(initialData.tasks);
  const [serverTasks, setServerTasks] = useState(initialData.tasks);
  const [saveError, setSaveError] = useState("");
  const [savingTaskIds, setSavingTaskIds] = useState<Set<string>>(new Set());
  if (serverTasks !== initialData.tasks) {
    setServerTasks(initialData.tasks);
    setTasks(initialData.tasks);
  }
  const refreshTasks = useCallback(() => router.refresh(), [router]);

  const data = useMemo(
    () => ({ ...initialData, tasks }),
    [initialData, tasks],
  );
  const automation = useAutomation(data, refreshTasks);

  async function saveTask(
    taskId: string,
    patch: Partial<
      Pick<
        WorkspaceTaskView,
        | "status"
        | "priority"
        | "startDate"
        | "endDate"
        | "percentComplete"
        | "ownerId"
        | "notes"
        | "evidenceLinks"
      >
    >,
  ) {
    const previous = tasks;
    setSaveError("");
    setSavingTaskIds((current) => new Set(current).add(taskId));
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              ...patch,
              ...(patch.status === "complete" ? { percentComplete: 100 } : {}),
            }
          : task,
      ),
    );
    try {
      const updated = await updateTaskAction(
        initialData.workspace.slug,
        initialData.workspace.id,
        taskId,
        patch,
      );
      setTasks((current) =>
        current.map((task) =>
          task.id === taskId
            ? {
                ...task,
                ...updated,
                createdAt: updated.createdAt.toISOString(),
                updatedAt: updated.updatedAt.toISOString(),
              }
            : task,
        ),
      );
      await automation.refresh();
    } catch (cause) {
      setTasks(previous);
      setSaveError(
        cause instanceof Error ? cause.message : "The task could not be saved.",
      );
    } finally {
      setSavingTaskIds((current) => {
        const next = new Set(current);
        next.delete(taskId);
        return next;
      });
    }
  }

  const view = (() => {
    switch (activeView) {
      case "connectors":
        return <ConnectorsSkills data={data} automation={automation} onOpenWork={() => { setWorkEntry({ tab: "tasks" }); setActiveView("workstreams"); }} />;
      case "dashboard":
        return (
          <DashboardView
            data={data}
            workstreams={catalog.workstreams}
            onNavigate={(view) => { if (view === "workstreams") setWorkEntry({ tab: "tasks" }); setActiveView(view); }}
            onSaveTask={saveTask}
            automation={automation.snapshot}
            onTask={(id) => { setWorkEntry({ taskId: id, tab: "tasks" }); setActiveView("workstreams"); }}
            onReview={() => { setWorkEntry({ tab: "outputs" }); setActiveView("workstreams"); }}
          />
        );
      case "workstreams":
        return (
          <WorkstreamsHub
            key={`${workEntry.taskId ?? ""}-${workEntry.tab}`}
            data={data}
            workstreams={catalog.workstreams}
            currentUserId={currentUser.id}
            savingTaskIds={savingTaskIds}
            onSaveTask={saveTask}
            automation={automation}
            onConnectors={() => setActiveView("connectors")}
            initialTaskId={workEntry.taskId}
            initialTab={workEntry.tab}
          />
        );
      case "resources":
        return <div className="space-y-4">
          <nav className="flex flex-wrap gap-2" aria-label="Resource sections">
            {([{ id: "models", label: "Financial models" }, { id: "templates", label: "Templates" }, { id: "hiring", label: "Finance team" }, { id: "playbook", label: "Master playbook" }] as const).map((item) =>
              <Button key={item.id} variant={resourceTab === item.id ? "primary" : "secondary"} onClick={() => setResourceTab(item.id)}>{item.label}</Button>)}
          </nav>
          {resourceTab === "models" ? <ModelsView /> : resourceTab === "templates" ? <TemplatesView data={data} templates={catalog.templates} />
            : resourceTab === "hiring" ? <HiringView data={data} roles={catalog.hiringRoles} currentUserId={currentUser.id} />
              : <WorkstreamsView tasks={tasks} workstreams={catalog.workstreams} masterTasks={catalog.masterTasks} onSaveTask={saveTask} />}
        </div>;
      case "vendors":
        return <VendorsView data={data} vendors={catalog.vendors} />;
      case "settings":
        return (
          <SettingsView
            data={data}
            currentUser={currentUser}
            workstreamCount={catalog.workstreams.length}
            masterTaskCount={catalog.masterTasks.length}
          />
        );
    }
  })();

  const title = viewTitles[activeView];

  return (
    <div className="min-h-screen bg-[var(--surface)] lg:grid lg:grid-cols-[248px_1fr]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-[var(--ink)] text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileNav ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--purple)]">
            <Sparkles size={17} />
          </span>
          <div>
            <p className="text-sm font-semibold">Startup CFO OS</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-slate-400">
              Local private workspace
            </p>
          </div>
          <button
            className="ml-auto rounded-lg p-2 text-slate-400 lg:hidden"
            onClick={() => setMobileNav(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pb-3 pt-5">
          <div className="rounded-xl bg-white/7 p-3">
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-[var(--teal)]" />
              <span className="truncate text-sm font-semibold">
                {initialData.workspace.name}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400">
              <span>{initialData.profile?.stage.replace("-", " ")}</span>
              <span>{initialData.workspace.role.replaceAll("-", " ")}</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3" aria-label="Workspace">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  if (item.id === "workstreams") setWorkEntry({ tab: "tasks" });
                  setActiveView(item.id);
                  setMobileNav(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                  active
                    ? "bg-white/12 font-semibold text-white"
                    : "text-slate-300 hover:bg-white/7 hover:text-white"
                }`}
              >
                <Icon
                  size={16}
                  className={active ? "text-[var(--blue)]" : ""}
                />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-4 space-y-1">
            <button className={`flex w-full items-center gap-2 rounded-lg p-2 text-xs ${activeView === "resources" ? "bg-white/10 text-white" : "text-slate-300"}`} onClick={() => { setActiveView("resources"); setMobileNav(false); }}><Library size={15} />Resources</button>
            <button className={`flex w-full items-center gap-2 rounded-lg p-2 text-xs ${activeView === "settings" ? "bg-white/10 text-white" : "text-slate-300"}`} onClick={() => { setActiveView("settings"); setMobileNav(false); }}><Settings size={15} />Workspace settings</button>
          </div>
          <div className="mb-3 flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--purple-soft)] text-xs font-bold text-[var(--purple)]">
              {currentUser.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">
                {currentUser.name}
              </p>
              <p className="truncate text-[10px] text-slate-400">
                {currentUser.email}
              </p>
            </div>
            <button
              onClick={() =>
                authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      router.push("/sign-in");
                      router.refresh();
                    },
                  },
                })
              }
              className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
          <Link
            href="/app/new"
            className="flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/8"
          >
            <BriefcaseBusiness size={14} />
            New company workspace
          </Link>
        </div>
      </aside>

      <main className="min-w-0">
        <header className="sticky top-0 z-30 flex h-20 items-center border-b border-[var(--border)] bg-white/95 px-4 backdrop-blur sm:px-7">
          <button
            className="mr-3 rounded-lg border border-[var(--border)] p-2 lg:hidden"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
          <div>
            <p className="eyebrow">{title.eyebrow}</p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">
              {title.title}
            </h1>
          </div>
          <div className="ml-auto hidden items-center gap-3 sm:flex">
            <div className="rounded-lg bg-[var(--teal-soft)] px-3 py-2 text-xs font-semibold text-emerald-800">
              $0 local mode
            </div>
          </div>
        </header>

        {saveError ? (
          <div
            role="alert"
            className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-7"
          >
            {saveError}
          </div>
        ) : null}

        <div className="p-4 sm:p-7">{view}</div>
      </main>

      {mobileNav ? (
        <button
          className="fixed inset-0 z-30 bg-slate-950/45 lg:hidden"
          aria-label="Close navigation overlay"
          onClick={() => setMobileNav(false)}
        />
      ) : null}
    </div>
  );
}
