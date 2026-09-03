"use client";

import type {
  Role,
  WorkstreamDefinition,
} from "@cfo/domain";
import { Card } from "@cfo/ui";
import {
  CalendarRange,
  Check,
  ChevronRight,
  Filter,
  ListChecks,
  Network,
  RefreshCw,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DragEvent, useMemo, useRef, useState } from "react";
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
};

const rowHeight = 48;
const labelWidth = 330;
const roadmapModes: Array<{
  value: "timeline" | "list" | "cadence";
  label: string;
  icon: LucideIcon;
}> = [
  { value: "timeline", label: "Timeline", icon: CalendarRange },
  { value: "list", label: "Checklist", icon: ListChecks },
  { value: "cadence", label: "Recurring", icon: RefreshCw },
];

export function RoadmapView({
  data,
  workstreams,
  currentUserId,
  savingTaskIds,
  onSaveTask,
}: Props) {
  const [mode, setMode] = useState<"timeline" | "list" | "cadence">(
    "timeline",
  );
  const [query, setQuery] = useState("");
  const [workstreamFilter, setWorkstreamFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
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
      data.tasks
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
    ],
  );

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
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="inline-flex w-fit rounded-lg bg-slate-100 p-1 text-xs">
            {roadmapModes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => {
                  setMode(value);
                  if (value === "cadence") clearFocus();
                }}
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
              placeholder="Search roadmap"
              value={query}
              onChange={(event) => {
                clearFocus();
                setQuery(event.target.value);
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              className="field h-10 min-h-10 w-auto text-xs"
              value={workstreamFilter}
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
            <select
              className="field h-10 min-h-10 w-auto text-xs"
              value={phaseFilter}
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
        </div>
      </Card>

      <GanttLegend workstreams={workstreams} />

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

      {mode === "list" ? (
        <Card className="overflow-hidden">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-[var(--ink-muted)]">
                <tr>
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">Relationship</th>
                  <th className="px-4 py-3">Phase</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((task) => {
                  const tone = relationTone(task);
                  return (
                    <tr
                      key={task.id}
                      className={`cursor-pointer hover:bg-slate-50 ${
                        tone === "focus"
                          ? "bg-slate-100"
                          : tone === "prerequisite"
                            ? "bg-blue-50/40"
                            : tone === "dependent"
                              ? "bg-orange-50/40"
                              : ""
                      }`}
                      onClick={() => focusOnTask(task)}
                      onDoubleClick={() => openTaskDetails(task)}
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
                        <div>
                          <p className="text-xs font-semibold">{task.title}</p>
                          <p className="mt-1 line-clamp-1 text-[10px] text-[var(--ink-muted)]">
                            {task.recommendationReason}
                          </p>
                        </div>
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
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {phaseLabels[task.phase]}
                    </td>
                    <td className="px-4 py-3 text-xs">{task.ownerRole}</td>
                    <td className="px-4 py-3 text-xs text-[var(--ink-muted)]">
                      {formatCompactDate(task.startDate)} -{" "}
                      {formatCompactDate(task.endDate)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={task.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[var(--purple)]"
                            style={{ width: `${task.percentComplete}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-[var(--ink-muted)]">
                          {task.percentComplete}%
                        </span>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
        />
      ) : null}
    </div>
  );
}
