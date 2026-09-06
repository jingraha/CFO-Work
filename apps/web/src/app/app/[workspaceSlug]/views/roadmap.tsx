"use client";

import type {
  Role,
  TaskReadiness,
  WorkstreamDefinition,
} from "@cfo/domain";
import { Card } from "@cfo/ui";
import {
  CalendarRange,
  Bot,
  Check,
  ChevronRight,
  Filter,
  ListChecks,
  Network,
  RefreshCw,
  Search,
  ZoomIn,
  ZoomOut,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DragEvent, Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  WorkspaceTaskView,
  WorkspaceViewData,
} from "@/lib/workspace-data";
import { DependencyFocus } from "../dependency-focus";
import { GanttLegend } from "../gantt-legend";
import { StatusPill } from "../status-pill";
import { TaskDrawer } from "../task-drawer";
import {
  daysBetween,
  formatCompactDate,
  getDirectTaskRelations,
  phaseLabels,
  priorityOrder,
  shiftDate,
  taskLeaderKey,
  filterTaskLeaders,
} from "../view-utils";

type TaskPatch = Partial<
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
>;

type Props = {
  data: WorkspaceViewData;
  workstreams: WorkstreamDefinition[];
  currentUserId: string;
  savingTaskIds: Set<string>;
  onSaveTask: (taskId: string, patch: TaskPatch) => Promise<void>;
  readiness?: TaskReadiness[];
  onAgentTask?: (task: WorkspaceTaskView) => void;
  onRunAgent?: ((task: WorkspaceTaskView) => void) | undefined;
  agentBusy?: boolean;
  renderAgentPanel?: (task: WorkspaceTaskView) => ReactNode;
};

const rowHeight = 48;
const labelWidth = 330;
const roadmapModes: Array<{
  value: "timeline" | "list" | "leaders" | "cadence";
  label: string;
  icon: LucideIcon;
}> = [
  { value: "list", label: "List", icon: ListChecks },
  { value: "timeline", label: "Gantt", icon: CalendarRange },
  { value: "leaders", label: "By leader", icon: Users },
  { value: "cadence", label: "Recurring", icon: RefreshCw },
];

export function RoadmapView({
  data,
  workstreams,
  currentUserId,
  savingTaskIds,
  onSaveTask,
  readiness = [],
  onAgentTask,
  onRunAgent,
  agentBusy = false,
  renderAgentPanel,
}: Props) {
  const [mode, setMode] = useState<"timeline" | "list" | "leaders" | "cadence">(
    "list",
  );
  const [query, setQuery] = useState("");
  const [workstreamFilter, setWorkstreamFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLeaders, setSelectedLeaders] = useState<string[]>([]);
  const [agentFilter, setAgentFilter] = useState("all");
  const [visibleLimit, setVisibleLimit] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [showAllConnections, setShowAllConnections] = useState(false);
  const [selectedTask, setSelectedTask] =
    useState<WorkspaceTaskView | null>(null);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const dragStart = useRef<{
    x: number;
    startDate: string;
    endDate: string;
  } | null>(null);

  const horizonStart =
    data.profile?.startDate ??
    data.tasks.map((task) => task.startDate).sort()[0] ??
    new Date().toISOString().slice(0, 10);
  const horizonDays = 365;
  const timelineWidth = Math.round(1_420 * zoom);
  const readinessByTask = useMemo(() => new Map(readiness.map((item) => [item.taskId, item])), [readiness]);
  const leaderName = (task: WorkspaceTaskView) => task.ownerId
    ? data.members.find((member) => member.userId === task.ownerId)?.name ?? "Assigned member"
    : `${task.ownerRole} (unassigned)`;
  const leaderOptions = [...new Map(data.tasks.map((task) => [taskLeaderKey(task), leaderName(task)])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  const satisfiedIds = useMemo(
    () =>
      new Set(
        data.tasks
          .filter(
            (task) =>
              task.status === "complete" ||
              task.status === "not-applicable",
          )
          .map((task) => task.masterTaskId),
      ),
    [data.tasks],
  );
  const presentTaskIds = useMemo(
    () => new Set(data.tasks.map((task) => task.masterTaskId)),
    [data.tasks],
  );
  const focusTask =
    data.tasks.find((task) => task.id === focusTaskId) ?? null;
  const focusRelations = useMemo(
    () => getDirectTaskRelations(data.tasks, focusTaskId),
    [data.tasks, focusTaskId],
  );

  const filtered = useMemo(
    () =>
      filterTaskLeaders(data.tasks, selectedLeaders)
        .filter((task) =>
          mode === "cadence" ? task.phase === "recurring" : task.phase !== "recurring",
        )
        .filter(
          (task) =>
            workstreamFilter === "all" ||
            task.workstream === workstreamFilter,
        )
        .filter(
          (task) => phaseFilter === "all" || task.phase === phaseFilter,
        )
        .filter(
          (task) => statusFilter === "all" || task.status === statusFilter,
        )
        .filter((task) => agentFilter === "all" ||
          (agentFilter === "supported" ? readinessByTask.get(task.id)?.skillId : readinessByTask.get(task.id)?.state === agentFilter))
        .filter((task) =>
          `${task.title} ${task.description} ${task.tags.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .filter(
          (task) =>
            !focusTaskId ||
            mode === "cadence" ||
            focusRelations.relatedTaskIds.has(task.id),
        )
        .sort((left, right) => {
          if (mode === "leaders") {
            const group = taskLeaderKey(left).localeCompare(taskLeaderKey(right));
            if (group) return group;
          }
          const date = left.startDate.localeCompare(right.startDate);
          return date !== 0
            ? date
            : priorityOrder[left.priority] - priorityOrder[right.priority];
        }),
    [
      data.tasks,
      focusRelations,
      focusTaskId,
      mode,
      phaseFilter,
      query,
      statusFilter,
      workstreamFilter,
      selectedLeaders,
      readinessByTask,
      agentFilter,
    ],
  );
  const visibleTasks = mode === "list" || mode === "leaders" ? filtered.slice(0, visibleLimit) : filtered;

  function isDependencyBlocked(task: WorkspaceTaskView): boolean {
    return task.dependencies.some(
      (dependencyId) =>
        presentTaskIds.has(dependencyId) && !satisfiedIds.has(dependencyId),
    );
  }

  function focusOnTask(task: WorkspaceTaskView) {
    if (task.phase === "recurring") {
      setSelectedTask(task);
      return;
    }
    setQuery("");
    setWorkstreamFilter("all");
    setPhaseFilter("all");
    setStatusFilter("all");
    setSelectedLeaders([]);
    setAgentFilter("all");
    if (mode === "cadence") setMode("timeline");
    setFocusTaskId(task.id);
  }

  function openTaskDetails(task: WorkspaceTaskView) {
    focusOnTask(task);
    setSelectedTask(task);
  }

  function clearFocus() {
    setFocusTaskId(null);
  }

  function relationTone(task: WorkspaceTaskView) {
    if (!focusTask) return "none";
    if (task.id === focusTask.id) return "focus";
    if (focusRelations.prerequisites.some((item) => item.id === task.id)) {
      return "prerequisite";
    }
    if (focusRelations.dependents.some((item) => item.id === task.id)) {
      return "dependent";
    }
    return "none";
  }

  function startDrag(event: DragEvent, task: WorkspaceTaskView) {
    dragStart.current = {
      x: event.clientX,
      startDate: task.startDate,
      endDate: task.endDate,
    };
    event.dataTransfer.effectAllowed = "move";
  }

  function endDrag(event: DragEvent, task: WorkspaceTaskView) {
    if (!dragStart.current) return;
    const pixelsPerDay = timelineWidth / horizonDays;
    const deltaDays = Math.round((event.clientX - dragStart.current.x) / pixelsPerDay);
    if (deltaDays !== 0) {
      void onSaveTask(task.id, {
        startDate: shiftDate(dragStart.current.startDate, deltaDays),
        endDate: shiftDate(dragStart.current.endDate, deltaDays),
      });
    }
    dragStart.current = null;
  }

  const months = Array.from({ length: 13 }, (_, index) => {
    const date = new Date(`${horizonStart}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + index);
    const start = date.toISOString().slice(0, 10);
    return {
      label: date.toLocaleString("en-US", {
        month: "short",
        year: index === 0 || date.getUTCMonth() === 0 ? "numeric" : undefined,
        timeZone: "UTC",
      }),
      left: Math.max(0, (daysBetween(horizonStart, start) / horizonDays) * 100),
    };
  });

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex w-fit rounded-lg bg-slate-100 p-1 text-xs">
            {roadmapModes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => {
                  setMode(value);
                  if (value === "cadence") clearFocus();
                }}
                aria-pressed={mode === value}
                className={`flex items-center gap-2 rounded-md px-3 py-2 font-semibold ${
                  mode === value
                    ? "bg-white text-[var(--ink)] shadow-sm"
                    : "text-slate-500"
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
          <label className="relative min-w-56 flex-1">
            <Search
              size={14}
              className="absolute left-3 top-3 text-slate-400"
            />
            <input
              className="field h-10 min-h-10 pl-9"
              style={{ paddingLeft: 36 }}
              placeholder="Search work"
              aria-label="Search work"
              value={query}
              onChange={(event) => {
                clearFocus();
                setVisibleLimit(50);
                setQuery(event.target.value);
              }}
            />
          </label>
          <div className="flex w-full flex-wrap gap-2">
            <details className="relative">
              <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 text-xs">
                <Users size={14} />Leaders {selectedLeaders.length ? `(${selectedLeaders.length})` : "(all)"}
              </summary>
              <div className="absolute left-0 top-12 z-30 max-h-80 w-72 overflow-y-auto rounded-xl border bg-white p-3 shadow-lg">
                <button className="mb-2 text-xs text-purple-700" onClick={() => { clearFocus(); setSelectedLeaders([]); }}>All leaders</button>
                {leaderOptions.map(([key, name]) => <label key={key} className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-slate-50">
                  <input type="checkbox" className="accent-[var(--purple)]" checked={selectedLeaders.includes(key)} onChange={() => {
                    clearFocus();
                    setSelectedLeaders((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
                  }} />{name}
                </label>)}
              </div>
            </details>
            <select className="field h-10 min-h-10 text-xs" style={{ width: "auto", maxWidth: "100%" }} value={agentFilter} aria-label="Filter agent readiness" onChange={(event) => { clearFocus(); setAgentFilter(event.target.value); }}>
              <option value="all">All work</option>
              <option value="supported">Has an agent skill</option>
              <option value="ready">Ready for agent</option>
              <option value="blocked">Needs input first</option>
              <option value="review">Needs my review</option>
              <option value="working">Agent working</option>
            </select>
            <select
              className="field h-10 min-h-10 w-auto text-xs"
              value={workstreamFilter}
              style={{ width: "auto", maxWidth: "100%" }}
              onChange={(event) => {
                clearFocus();
                setWorkstreamFilter(event.target.value);
              }}
              aria-label="Filter by workstream"
            >
              <option value="all">All workstreams</option>
              {workstreams.map((stream) => (
                <option key={stream.id} value={stream.id}>
                  {stream.shortName}
                </option>
              ))}
            </select>
            <details className="relative">
              <summary className="flex h-10 cursor-pointer list-none items-center rounded-lg border border-[var(--border)] px-3 text-xs">More filters</summary>
              <div className="absolute right-0 top-12 z-30 grid w-60 gap-2 rounded-xl border bg-white p-3 shadow-lg">
            <select
              className="field h-10 min-h-10 w-auto text-xs"
              value={phaseFilter}
              style={{ width: "100%" }}
              onChange={(event) => {
                clearFocus();
                setPhaseFilter(event.target.value);
              }}
              aria-label="Filter by phase"
            >
              <option value="all">All phases</option>
              {Object.entries(phaseLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="field h-10 min-h-10 w-auto text-xs"
              value={statusFilter}
              style={{ width: "100%" }}
              onChange={(event) => {
                clearFocus();
                setStatusFilter(event.target.value);
              }}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="not-started">Not started</option>
              <option value="in-progress">In progress</option>
              <option value="blocked">Blocked</option>
              <option value="complete">Complete</option>
              <option value="not-applicable">N/A</option>
            </select>
              </div>
            </details>
            {(selectedLeaders.length > 0 || query || workstreamFilter !== "all" || phaseFilter !== "all" || statusFilter !== "all" || agentFilter !== "all") && <button className="px-2 text-xs text-purple-700" onClick={() => {
              clearFocus(); setSelectedLeaders([]); setQuery(""); setWorkstreamFilter("all"); setPhaseFilter("all"); setStatusFilter("all"); setAgentFilter("all");
            }}>Clear filters</button>}
          </div>
        </div>
      </Card>

      {mode === "timeline" && <GanttLegend workstreams={workstreams} />}

      {focusTask && mode !== "cadence" ? (
        <DependencyFocus
          task={focusTask}
          relations={focusRelations}
          workstreams={workstreams}
          onFocus={focusOnTask}
          onOpen={openTaskDetails}
          onClear={clearFocus}
        />
      ) : null}

      <div className="flex items-center gap-3 text-xs text-[var(--ink-muted)]">
        <Filter size={13} />
        <span>
          {focusTask
            ? `${filtered.length} tasks in the direct dependency neighborhood`
            : `${filtered.length} tasks`}
          {" · "}dates and completion persist locally
        </span>
        {mode === "timeline" ? (
          <div className="ml-auto flex items-center gap-1">
            {!focusTask ? (
              <button
                onClick={() => setShowAllConnections((value) => !value)}
                className={`mr-1 flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[10px] font-semibold ${
                  showAllConnections
                    ? "border-[var(--purple)] bg-[var(--purple-soft)] text-[var(--purple)]"
                    : "border-[var(--border)] bg-white text-[var(--ink-muted)]"
                }`}
              >
                <Network size={13} />
                {showAllConnections ? "Hide all arrows" : "Show all arrows"}
              </button>
            ) : null}
            <button
              onClick={() => setZoom((value) => Math.max(0.7, value - 0.15))}
              className="rounded-lg border border-[var(--border)] bg-white p-2"
              aria-label="Zoom out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={() => setZoom((value) => Math.min(1.8, value + 0.15))}
              className="rounded-lg border border-[var(--border)] bg-white p-2"
              aria-label="Zoom in"
            >
              <ZoomIn size={14} />
            </button>
          </div>
        ) : null}
      </div>

      {mode === "timeline" ? (
        <Card className="overflow-hidden">
          <div className="scrollbar-thin overflow-x-auto">
            <div
              className="relative"
              style={{ width: labelWidth + timelineWidth }}
            >
              <div
                className="sticky top-0 z-20 grid h-14 border-b border-[var(--border)] bg-white"
                style={{
                  gridTemplateColumns: `${labelWidth}px ${timelineWidth}px`,
                }}
              >
                <div className="flex items-center px-4 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
                  Task / owner
                </div>
                <div className="relative border-l border-[var(--border)]">
                  {months.map((month) => (
                    <span
                      key={`${month.label}-${month.left}`}
                      className="absolute bottom-0 top-0 border-l border-slate-100 pl-2 pt-5 text-[10px] font-semibold text-slate-500"
                      style={{ left: `${month.left}%` }}
                    >
                      {month.label}
                    </span>
                  ))}
                </div>
              </div>

              <svg
                data-testid="gantt-dependency-lines"
                className="pointer-events-none absolute z-[15]"
                style={{
                  left: labelWidth,
                  top: 56,
                  width: timelineWidth,
                  height: filtered.length * rowHeight,
                }}
                viewBox={`0 0 ${timelineWidth} ${filtered.length * rowHeight}`}
                aria-hidden="true"
              >
                <defs>
                  {[
                    ["gantt-arrow", "#94a3b8"],
                    ["gantt-arrow-prerequisite", "#2563eb"],
                    ["gantt-arrow-dependent", "#f97316"],
                  ].map(([id, color]) => (
                    <marker
                      key={id}
                      id={id}
                      viewBox="0 0 10 10"
                      refX="9"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
                    </marker>
                  ))}
                </defs>
                {focusTask || showAllConnections
                  ? filtered.flatMap((task, rowIndex) =>
                      task.dependencies.map((dependencyId) => {
                    const dependencyIndex = filtered.findIndex(
                      (candidate) =>
                        candidate.masterTaskId === dependencyId,
                    );
                    if (dependencyIndex < 0) return null;
                    const dependency = filtered[dependencyIndex];
                    if (!dependency) return null;
                    const x1 = Math.max(
                      0,
                      (daysBetween(horizonStart, dependency.endDate) /
                        horizonDays) *
                        timelineWidth,
                    );
                    const x2 = Math.max(
                      0,
                      (daysBetween(horizonStart, task.startDate) /
                        horizonDays) *
                        timelineWidth,
                    );
                    const y1 = dependencyIndex * rowHeight + rowHeight / 2;
                    const y2 = rowIndex * rowHeight + rowHeight / 2;
                    const middle = Math.max(x1 + 8, (x1 + x2) / 2);
                    const intoFocus = task.id === focusTaskId;
                    const outOfFocus = dependency.id === focusTaskId;
                    const stroke = intoFocus
                      ? "#2563eb"
                      : outOfFocus
                        ? "#f97316"
                        : "#94a3b8";
                    const marker = intoFocus
                      ? "gantt-arrow-prerequisite"
                      : outOfFocus
                        ? "gantt-arrow-dependent"
                        : "gantt-arrow";
                    return (
                      <polyline
                        key={`${task.id}-${dependencyId}`}
                        points={`${x1},${y1} ${middle},${y1} ${middle},${y2} ${x2},${y2}`}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={intoFocus || outOfFocus ? "2" : "1.25"}
                        markerEnd={`url(#${marker})`}
                      />
                    );
                      }),
                    )
                  : null}
              </svg>

              {filtered.map((task) => {
                const stream = workstreams.find(
                  (item) => item.id === task.workstream,
                );
                const left = Math.max(
                  0,
                  (daysBetween(horizonStart, task.startDate) / horizonDays) *
                    timelineWidth,
                );
                const width = Math.max(
                  10,
                  ((daysBetween(task.startDate, task.endDate) + 1) /
                    horizonDays) *
                    timelineWidth,
                );
                const dependencyBlocked = isDependencyBlocked(task);
                const tone = relationTone(task);
                const relationLabel =
                  tone === "focus"
                    ? "selected"
                    : tone === "prerequisite"
                      ? "needs first"
                      : tone === "dependent"
                        ? "unblocks next"
                        : "";
                const outlineColor =
                  tone === "focus"
                    ? "#172033"
                    : tone === "prerequisite"
                      ? "#2563eb"
                      : tone === "dependent"
                        ? "#f97316"
                        : "transparent";
                return (
                  <div
                    key={task.id}
                    className={`relative z-10 grid border-b border-slate-100 hover:bg-slate-50/80 ${
                      tone === "focus"
                        ? "bg-slate-100"
                        : tone === "prerequisite"
                          ? "bg-blue-50/40"
                          : tone === "dependent"
                            ? "bg-orange-50/40"
                            : "bg-white/75"
                    }`}
                    style={{
                      gridTemplateColumns: `${labelWidth}px ${timelineWidth}px`,
                      height: rowHeight,
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-3 px-4">
                      <button
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                          task.status === "complete"
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                        onClick={() =>
                          void onSaveTask(task.id, {
                            status:
                              task.status === "complete"
                                ? "not-started"
                                : "complete",
                          })
                        }
                        aria-label={`Toggle ${task.title}`}
                      >
                        {task.status === "complete" ? <Check size={13} /> : null}
                      </button>
                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() => focusOnTask(task)}
                        onDoubleClick={() => openTaskDetails(task)}
                        aria-pressed={tone === "focus"}
                        title="Click to focus dependencies. Double-click for full details."
                      >
                        <span className="block truncate text-xs font-semibold">
                          {task.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-[var(--ink-muted)]">
                          {task.ownerRole}
                          {relationLabel ? ` · ${relationLabel}` : ""}
                          {dependencyBlocked && task.status !== "complete"
                            ? " · waiting on dependency"
                            : ""}
                        </span>
                      </button>
                      <button
                        onClick={() => openTaskDetails(task)}
                        className="rounded p-1 text-slate-400 hover:bg-white hover:text-[var(--ink)]"
                        aria-label={`Open full details for ${task.title}`}
                        title="Open full task details"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                    <div className="relative border-l border-[var(--border)]">
                      {months.map((month) => (
                        <span
                          key={`${task.id}-${month.left}`}
                          className="absolute inset-y-0 border-l border-slate-100"
                          style={{ left: `${month.left}%` }}
                        />
                      ))}
                      <button
                        draggable
                        onDragStart={(event) => startDrag(event, task)}
                        onDragEnd={(event) => endDrag(event, task)}
                        onClick={() => focusOnTask(task)}
                        onDoubleClick={() => openTaskDetails(task)}
                        aria-pressed={tone === "focus"}
                        className={`absolute top-2.5 h-7 overflow-hidden rounded-md text-left text-[9px] font-bold text-slate-900 shadow-sm transition hover:brightness-95 ${
                          (task.status === "blocked" || dependencyBlocked) &&
                          task.status !== "complete"
                            ? "border-2 border-dashed border-red-600"
                            : ""
                        }`}
                        style={{
                          left,
                          width,
                          zIndex: tone === "focus" ? 3 : tone === "none" ? 1 : 2,
                          outline:
                            tone === "none"
                              ? undefined
                              : `${tone === "focus" ? 3 : 2}px solid ${outlineColor}`,
                          outlineOffset: 1,
                          backgroundColor:
                            task.status === "complete"
                              ? "#79D9B9"
                              : stream?.color ?? "#7B68EE",
                        }}
                        title={`${task.title}: ${formatCompactDate(task.startDate)} - ${formatCompactDate(task.endDate)}. Click to focus, double-click for details, or drag to reschedule.`}
                      >
                        <span
                          className="block h-full bg-slate-950/20"
                          style={{ width: `${task.percentComplete}%` }}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      ) : null}

      {mode === "list" || mode === "leaders" ? (
        <Card className="overflow-hidden">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">
                <tr>
                  <th className="px-4 py-3">Task</th>
                  {focusTask && <th className="px-4 py-3">Relationship</th>}
                  <th className="px-4 py-3">Leader</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {visibleTasks.map((task, index) => {
                  const tone = relationTone(task);
                  const taskReadiness = readinessByTask.get(task.id);
                  const groupStart = mode === "leaders" && (index === 0 || taskLeaderKey(filtered[index - 1]!) !== taskLeaderKey(task));
                  return (
                    <Fragment key={task.id}>
                    {groupStart && <tr className="bg-purple-50"><th scope="rowgroup" colSpan={focusTask ? 6 : 5} className="px-4 py-3 text-sm font-semibold text-purple-900">{leaderName(task)} <span className="ml-2 text-xs font-normal">{filtered.filter((item) => taskLeaderKey(item) === taskLeaderKey(task)).length} tasks</span></th></tr>}
                    <tr
                      data-testid={`work-item-${task.masterTaskId}`}
                      className={`cursor-pointer hover:bg-slate-50 ${
                        tone === "focus"
                          ? "bg-slate-100"
                          : tone === "prerequisite"
                            ? "bg-blue-50/40"
                            : tone === "dependent"
                              ? "bg-orange-50/40"
                              : ""
                      }`}
                    >
                    <td className="max-w-md px-4 py-3">
                      <div className="flex items-start gap-3">
                        <button
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                            task.status === "complete"
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            void onSaveTask(task.id, {
                              status:
                                task.status === "complete"
                                  ? "not-started"
                                  : "complete",
                            });
                          }}
                          aria-label={`Toggle ${task.title}`}
                        >
                          {task.status === "complete" ? (
                            <Check size={13} />
                          ) : null}
                        </button>
                        <button className="text-left" onClick={() => openTaskDetails(task)}>
                          <p className="text-sm font-semibold">{task.title}</p>
                          <p className="mt-1 line-clamp-1 text-[10px] text-[var(--ink-muted)]">
                            {workstreams.find((stream) => stream.id === task.workstream)?.shortName} · {phaseLabels[task.phase]}
                          </p>
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            openTaskDetails(task);
                          }}
                          className="ml-auto rounded p-1 text-slate-400 hover:bg-white hover:text-[var(--ink)]"
                          aria-label={`Open full details for ${task.title}`}
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </td>
                    {focusTask && <td className="px-4 py-3">
                      {tone === "focus" ? (
                        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[9px] font-bold uppercase text-white">
                          Selected
                        </span>
                      ) : tone === "prerequisite" ? (
                        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[9px] font-bold uppercase text-blue-800">
                          Needs first
                        </span>
                      ) : tone === "dependent" ? (
                        <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[9px] font-bold uppercase text-orange-800">
                          Unblocks next
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">-</span>
                      )}
                    </td>}
                    <td className="px-4 py-3 text-xs">{leaderName(task)}</td>
                    <td className="px-4 py-3 text-xs text-[var(--ink-muted)]">
                      {formatCompactDate(task.startDate)} -{" "}
                      {formatCompactDate(task.endDate)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={task.status} />
                    </td>
                    <td className="px-4 py-3">
                      {onAgentTask && <div className="max-w-56 space-y-1">
                        <button disabled={agentBusy} onClick={() => taskReadiness?.state === "ready" && onRunAgent ? onRunAgent(task) : onAgentTask(task)} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium disabled:opacity-50 ${
                          taskReadiness?.state === "ready" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : taskReadiness?.state === "blocked" ? "border-amber-200 bg-amber-50 text-amber-900"
                              : "border-slate-200 bg-white text-slate-700"
                        }`}><Bot size={13} />{taskReadiness?.state === "ready" ? onRunAgent ? "Run with agent" : "Agent details"
                          : taskReadiness?.state === "blocked" ? "View blockers"
                            : taskReadiness?.state === "review" ? "Review output"
                              : taskReadiness?.state === "working" ? "Agent working"
                                : taskReadiness?.state === "completed" ? "Agent / output" : "See requirements"}</button>
                        {taskReadiness?.blockers[0] && <p className="truncate text-[10px] text-slate-500" title={taskReadiness.blockers[0].label}>{taskReadiness.blockers[0].label}</p>}
                      </div>}
                    </td>
                  </tr>
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {visibleTasks.length < filtered.length && <div className="flex justify-center border-t border-[var(--border)] p-4">
            <button className="rounded-lg border px-4 py-2 text-sm font-medium text-purple-700" onClick={() => setVisibleLimit((limit) => limit + 50)}>Show more work ({visibleTasks.length} of {filtered.length})</button>
          </div>}
        </Card>
      ) : null}

      {mode === "cadence" ? (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {[
            "daily",
            "weekly",
            "monthly",
            "quarterly",
            "annual",
            "event-driven",
          ].map((cadence) => {
            const cadenceTasks = filtered.filter(
              (task) => task.cadence === cadence,
            );
            return (
              <Card key={cadence} className="overflow-hidden">
                <div className="border-b border-[var(--border)] bg-slate-50 px-4 py-3">
                  <h3 className="text-sm font-semibold capitalize">
                    {cadence.replace("-", " ")}
                  </h3>
                  <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
                    {cadenceTasks.length} recurring controls and routines
                  </p>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {cadenceTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => openTaskDetails(task)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: workstreams.find(
                            (stream) => stream.id === task.workstream,
                          )?.color,
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                        {task.title}
                      </span>
                      <StatusPill status={task.status} />
                    </button>
                  ))}
                  {cadenceTasks.length === 0 ? (
                    <p className="px-4 py-7 text-center text-xs text-[var(--ink-muted)]">
                      No items match the filters.
                    </p>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      {filtered.length === 0 && mode !== "cadence" ? (
        <Card className="p-12 text-center">
          <CalendarRange
            size={26}
            className="mx-auto text-[var(--purple)]"
          />
          <h3 className="mt-3 text-sm font-semibold">No roadmap tasks found</h3>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Change the filters to widen the view.
          </p>
        </Card>
      ) : null}

      {selectedTask ? (
        <TaskDrawer
          key={`${selectedTask.id}-${selectedTask.updatedAt}`}
          task={
            data.tasks.find((task) => task.id === selectedTask.id) ??
            selectedTask
          }
          role={data.workspace.role as Role}
          currentUserId={currentUserId}
          members={data.members}
          allTasks={data.tasks}
          saving={savingTaskIds.has(selectedTask.id)}
          onClose={() => setSelectedTask(null)}
          onSave={onSaveTask}
          onSelectRelated={openTaskDetails}
          agentPanel={renderAgentPanel?.(data.tasks.find((task) => task.id === selectedTask.id) ?? selectedTask)}
        />
      ) : null}
    </div>
  );
}
