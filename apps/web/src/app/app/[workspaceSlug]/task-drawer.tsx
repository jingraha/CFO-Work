"use client";

import type {
  EvidenceLink,
  Role,
  TaskStatus,
  Priority,
} from "@cfo/domain";
import { can } from "@cfo/domain";
import { Button } from "@cfo/ui";
import {
  CalendarDays,
  Check,
  ExternalLink,
  Link2,
  Minus,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import type {
  WorkspaceTaskView,
  WorkspaceViewData,
} from "@/lib/workspace-data";
import { formatDate, shiftDate, statusLabels } from "./view-utils";

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
  task: WorkspaceTaskView;
  role: Role;
  currentUserId: string;
  members: WorkspaceViewData["members"];
  saving: boolean;
  onClose: () => void;
  onSave: (taskId: string, patch: TaskPatch) => Promise<void>;
};

export function TaskDrawer({
  task,
  role,
  currentUserId,
  members,
  saving,
  onClose,
  onSave,
}: Props) {
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [startDate, setStartDate] = useState(task.startDate);
  const [endDate, setEndDate] = useState(task.endDate);
  const [percentComplete, setPercentComplete] = useState(task.percentComplete);
  const [ownerId, setOwnerId] = useState(task.ownerId ?? "");
  const [notes, setNotes] = useState(task.notes);
  const [evidenceLinks, setEvidenceLinks] = useState(task.evidenceLinks);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkSource, setLinkSource] =
    useState<EvidenceLink["sourceSystem"]>("sharepoint");
  const [linkError, setLinkError] = useState("");

  const editable =
    can(role, "tasks:edit") ||
    (can(role, "tasks:edit-assigned") && task.ownerId === currentUserId);
  const canReassign = can(role, "tasks:edit");

  function shift(days: number) {
    setStartDate((value) => shiftDate(value, days));
    setEndDate((value) => shiftDate(value, days));
  }

  function addEvidence() {
    setLinkError("");
    let parsed: URL;
    try {
      parsed = new URL(linkUrl);
    } catch {
      setLinkError("Enter a valid HTTPS link.");
      return;
    }
    if (parsed.protocol !== "https:") {
      setLinkError("Evidence links must use HTTPS.");
      return;
    }
    if (!linkLabel.trim()) {
      setLinkError("Add a label so the evidence is identifiable.");
      return;
    }
    setEvidenceLinks((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        label: linkLabel.trim(),
        url: parsed.toString(),
        sourceSystem: linkSource,
      },
    ]);
    setLinkLabel("");
    setLinkUrl("");
  }

  async function save() {
    await onSave(task.id, {
      status,
      priority,
      startDate,
      endDate,
      percentComplete: status === "complete" ? 100 : percentComplete,
      ownerId: ownerId || null,
      notes,
      evidenceLinks,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-slate-950/40"
        aria-label="Close task"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl"
      >
        <header className="flex items-start gap-4 border-b border-[var(--border)] px-5 py-5">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{task.workstream.replaceAll("-", " ")}</p>
            <h2
              id="task-title"
              className="mt-2 text-xl font-semibold tracking-tight"
            >
              {task.title}
            </h2>
            <p className="mt-2 text-xs text-[var(--ink-muted)]">
              {task.ownerRole} · Finance {task.financeResponsibility}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            aria-label="Close task"
          >
            <X size={19} />
          </button>
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto p-5">
          <div className="rounded-xl bg-[var(--purple-soft)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--purple)]">
              Why this is on your roadmap
            </p>
            <p className="mt-2 text-sm leading-6">{task.recommendationReason}</p>
          </div>

          <p className="mt-5 text-sm leading-6 text-[var(--ink-muted)]">
            {task.description}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label">Status</span>
              <select
                className="field"
                value={status}
                disabled={!canReassign}
                onChange={(event) => {
                  const next = event.target.value as TaskStatus;
                  setStatus(next);
                  if (next === "complete") setPercentComplete(100);
                }}
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Priority</span>
              <select
                className="field"
                value={priority}
                disabled={!editable}
                onChange={(event) =>
                  setPriority(event.target.value as Priority)
                }
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label>
              <span className="label">Start date</span>
              <input
                type="date"
                className="field"
                value={startDate}
                disabled={!editable}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label>
              <span className="label">End date</span>
              <input
                type="date"
                className="field"
                value={endDate}
                min={startDate}
                disabled={!editable}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
            <label>
              <span className="label">Owner</span>
              <select
                className="field"
                value={ownerId}
                disabled={!editable}
                onChange={(event) => setOwnerId(event.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name} · {member.role.replaceAll("-", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Percent complete</span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  className="w-full accent-[var(--purple)]"
                  value={percentComplete}
                  disabled={!editable || status === "complete"}
                  onChange={(event) =>
                    setPercentComplete(Number(event.target.value))
                  }
                />
                <span className="w-11 text-right text-sm font-semibold">
                  {percentComplete}%
                </span>
              </div>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!editable}
              onClick={() => shift(-7)}
            >
              <Minus size={13} /> 1 week
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!editable}
              onClick={() => shift(7)}
            >
              <Plus size={13} /> 1 week
            </Button>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
              <CalendarDays size={13} />
              {formatDate(startDate)} - {formatDate(endDate)}
            </span>
          </div>

          <label className="mt-6 block">
            <span className="label">Working notes</span>
            <textarea
              className="field min-h-28 resize-y"
              value={notes}
              disabled={!editable}
              placeholder="Record decisions, blockers, handoffs, and next steps."
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          <section className="mt-7">
            <div className="flex items-center gap-2">
              <Link2 size={15} className="text-[var(--purple)]" />
              <h3 className="text-sm font-semibold">Evidence links</h3>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
              Link to company-controlled storage. The app does not fetch or
              store the document.
            </p>
            <div className="mt-3 space-y-2">
              {evidenceLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border)] p-3"
                >
                  <ExternalLink
                    size={14}
                    className="shrink-0 text-slate-400"
                  />
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--purple)] hover:underline"
                  >
                    {link.label}
                  </a>
                  <span className="text-[9px] uppercase text-slate-400">
                    {link.sourceSystem.replace("-", " ")}
                  </span>
                  {editable ? (
                    <button
                      onClick={() =>
                        setEvidenceLinks((current) =>
                          current.filter((item) => item.id !== link.id),
                        )
                      }
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remove ${link.label}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {editable ? (
              <div className="mt-3 grid gap-2 rounded-xl bg-[var(--surface-muted)] p-3 sm:grid-cols-2">
                <input
                  className="field"
                  placeholder="Evidence label"
                  value={linkLabel}
                  onChange={(event) => setLinkLabel(event.target.value)}
                />
                <select
                  className="field"
                  value={linkSource}
                  onChange={(event) =>
                    setLinkSource(
                      event.target.value as EvidenceLink["sourceSystem"],
                    )
                  }
                >
                  <option value="sharepoint">SharePoint</option>
                  <option value="google-drive">Google Drive</option>
                  <option value="dropbox">Dropbox</option>
                  <option value="data-room">Data room</option>
                  <option value="other">Other</option>
                </select>
                <input
                  type="url"
                  className="field sm:col-span-2"
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                />
                {linkError ? (
                  <p className="text-xs text-red-700 sm:col-span-2">
                    {linkError}
                  </p>
                ) : null}
                <Button variant="secondary" size="sm" onClick={addEvidence}>
                  <Plus size={13} /> Add link
                </Button>
              </div>
            ) : null}
          </section>

          <section className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
                Deliverables
              </p>
              <ul className="mt-3 space-y-2">
                {task.deliverables.map((deliverable) => (
                  <li
                    key={deliverable}
                    className="flex gap-2 text-xs leading-5"
                  >
                    <Check
                      size={13}
                      className="mt-0.5 shrink-0 text-emerald-600"
                    />
                    {deliverable}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
                Evidence expected
              </p>
              <ul className="mt-3 space-y-2">
                {task.evidenceRequirements.map((requirement) => (
                  <li
                    key={requirement}
                    className="flex gap-2 text-xs leading-5"
                  >
                    <Link2
                      size={13}
                      className="mt-0.5 shrink-0 text-[var(--purple)]"
                    />
                    {requirement}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <footer className="flex items-center justify-between border-t border-[var(--border)] bg-white px-5 py-4">
          {!editable ? (
            <p className="text-xs text-[var(--ink-muted)]">
              This role has read-only access to the task.
            </p>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={!editable || saving || endDate < startDate}
            >
              <Save size={15} />
              {saving ? "Saving..." : "Save task"}
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
