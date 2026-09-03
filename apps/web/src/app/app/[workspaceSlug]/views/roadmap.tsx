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
import { StatusPill } from "../status-pill";
import { TaskDrawer } from "../task-drawer";
import {
  daysBetween,
  formatCompactDate,
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
  const [selectedTask, setSelectedTask] =
    useState<WorkspaceTaskView | null>(null);
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
  const completedIds = useMemo(
    () =>
      new Set(
        data.tasks
          .filter((task) => task.status === "complete")
          .map((task) => task.masterTaskId),
      ),
    [data.tasks],
  );
  const presentTaskIds = useMemo(
    () => new Set(data.tasks.map((task) => task.masterTaskId)),
    [data.tasks],
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
        .sort((left, right) => {
          const date = left.startDate.localeCompare(right.startDate);
          return date !== 0
            ? date
            : priorityOrder[left.priority] - priorityOrder[right.priority];
        }),
    [
      data.tasks,
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
        presentTaskIds.has(dependencyId) && !completedIds.has(dependencyId),
    );
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
                onClick={() => setMode(value)}
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
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              className="field h-10 min-h-10 w-auto text-xs"
              value={workstreamFilter}
              onChange={(event) => setWorkstreamFilter(event.target.value)}
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
              onChange={(event) => setPhaseFilter(event.target.value)}
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
              onChange={(event) => setStatusFilter(event.target.value)}
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

      <div className="flex items-center gap-3 text-xs text-[var(--ink-muted)]">
        <Filter size={13} />
        <span>
          {filtered.length} tasks · dates and completion persist locally
        </span>
        {mode === "timeline" ? (
          <div className="ml-auto flex items-center gap-1">
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
                className="pointer-events-none absolute z-0"
                style={{
                  left: labelWidth,
                  top: 56,
                  width: timelineWidth,
                  height: filtered.length * rowHeight,
                }}
                viewBox={`0 0 ${timelineWidth} ${filtered.length * rowHeight}`}
                aria-hidden="true"
              >
                {filtered.flatMap((task, rowIndex) =>
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
                    return (
                      <polyline
                        key={`${task.id}-${dependencyId}`}
                        points={`${x1},${y1} ${middle},${y1} ${middle},${y2} ${x2},${y2}`}
                        fill="none"
                        stroke="#cbd5e1"
                        strokeWidth="1"
                      />
                    );
                  }),
                )}
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
                return (
                  <div
                    key={task.id}
                    className="relative z-10 grid border-b border-slate-100 bg-white/75 hover:bg-slate-50/80"
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
                        onClick={() => setSelectedTask(task)}
                      >
                        <span className="block truncate text-xs font-semibold">
                          {task.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-[var(--ink-muted)]">
                          {task.ownerRole}
                          {dependencyBlocked && task.status !== "complete"
                            ? " · waiting on dependency"
                            : ""}
                        </span>
                      </button>
                      <ChevronRight size={13} className="text-slate-300" />
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
                        onClick={() => setSelectedTask(task)}
                        className={`absolute top-2.5 h-7 overflow-hidden rounded-md text-left text-[9px] font-bold text-slate-900 shadow-sm transition hover:brightness-95 ${
                          dependencyBlocked && task.status !== "complete"
                            ? "border border-dashed border-red-400"
                            : ""
                        }`}
                        style={{
                          left,
                          width,
                          backgroundColor:
                            task.status === "complete"
                              ? "#79D9B9"
                              : task.status === "blocked" || dependencyBlocked
                                ? "#FFD6DE"
                                : stream?.color ?? "#7B68EE",
                        }}
                        title={`${task.title}: ${formatCompactDate(task.startDate)} - ${formatCompactDate(task.endDate)}. Drag to reschedule.`}
                      >
                        <span
                          className="block h-full bg-white/25"
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
                  <th className="px-4 py-3">Phase</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((task) => (
                  <tr
                    key={task.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setSelectedTask(task)}
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
                      </div>
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
                ))}
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
                      onClick={() => setSelectedTask(task)}
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
          saving={savingTaskIds.has(selectedTask.id)}
          onClose={() => setSelectedTask(null)}
          onSave={onSaveTask}
        />
      ) : null}
    </div>
  );
}
