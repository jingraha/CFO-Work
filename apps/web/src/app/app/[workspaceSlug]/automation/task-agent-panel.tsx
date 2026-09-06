"use client";

import { useState } from "react";
import { Button } from "@cfo/ui";
import { Bot, FileText, Link2, Plus } from "lucide-react";
import { addTaskEvidenceAction, requestTaskAgentAction } from "@/app/app/automation-actions";
import type { WorkspaceTaskView } from "@/lib/workspace-data";
import type { AutomationController } from "./use-automation";
import { ErrorNotice, fieldClass } from "./environment-ui";

export function TaskAgentPanel({ task, automation, onConnectors, onInspect, onTask }: {
  task: WorkspaceTaskView; automation: AutomationController;
  onConnectors: () => void; onInspect: (runId: string) => void; onTask: (task: string) => void;
}) {
  const [addingEvidence, setAddingEvidence] = useState(false);
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  const [kind, setKind] = useState<"meeting-transcript" | "assessment-note">("meeting-transcript");
  const readiness = automation.snapshot?.taskReadiness.find((item) => item.taskId === task.id);
  const run = automation.snapshot?.runs.find((item) => item.taskId === task.id);
  const working = run?.status === "running" || (run?.status === "queued" && run.requested !== false);
  const hasSkill = !!readiness?.skillId;
  return (
    <section className="space-y-3 rounded-xl border border-purple-100 bg-purple-50/30 p-4" aria-label="Agent readiness">
      <div className="flex items-center gap-2"><Bot size={17} className="text-violet-600" /><h3 className="font-semibold">Let an agent help</h3></div>
      <p className="text-sm text-slate-600">{readiness?.skillTitle ?? "Output planning"}{readiness?.inputHint ? ` · ${readiness.inputHint}` : ""}</p>
      {!!readiness?.blockers.length && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
        <p className="mb-2 text-xs font-semibold text-amber-900">What is needed</p>
        <ul className="space-y-2 text-xs text-amber-900">{readiness.blockers.map((blocker, index) => (
          <li key={index}>
            {blocker.kind === "connector" || blocker.kind === "setup"
              ? <button className="text-left underline underline-offset-2" onClick={onConnectors}>{blocker.label}</button>
              : blocker.taskId ? <button className="text-left underline underline-offset-2" onClick={() => onTask(blocker.taskId!)}>{blocker.label}</button>
                : blocker.label}
          </li>
        ))}</ul>
      </div>}
      {run?.error && <ErrorNotice>{run.error}</ErrorNotice>}
      <div className="flex flex-wrap gap-2">
        {run?.artifact && <Button size="sm" onClick={() => onInspect(run.id)}><FileText size={14} />{run.status === "needs-review" ? "Review output" : "View output"}</Button>}
        {automation.editable && <Button size="sm" variant={run?.artifact ? "secondary" : "primary"} disabled={automation.busy || working || !readiness} onClick={() =>
          automation.execute(`run-${task.id}`, () => requestTaskAgentAction({ ...automation.base, taskId: task.id }))}>
          <Bot size={14} />{working ? "Agent queued / running" : run?.artifact && hasSkill ? "Rebuild output" : hasSkill ? readiness?.blockers.length ? "Queue when ready" : "Run with agent" : "Outline required output"}
        </Button>}
        {automation.editable && readiness?.requiresEvidence && <Button size="sm" variant="secondary" disabled={automation.busy} onClick={() => setAddingEvidence((value) => !value)}><Plus size={14} />Add transcript or notes</Button>}
      </div>
      {hasSkill && !run?.artifact && <p className="text-[11px] text-slate-500">Only this task and its agent-ready prerequisites are requested. Human blockers remain in place.</p>}
      {addingEvidence && <form className="space-y-3 border-t border-purple-100 pt-3" onSubmit={async (event) => {
        event.preventDefault();
        const saved = await automation.execute("add-evidence", () => addTaskEvidenceAction({
          ...automation.base, evidence: { taskId: task.id, title: evidenceTitle, text: evidenceText, kind },
        }));
        if (saved) { setAddingEvidence(false); setEvidenceTitle(""); setEvidenceText(""); }
      }}>
        <p className="text-xs text-slate-600">Paste meeting text or assessment notes. This stays in local evidence storage; no document or live account is required.</p>
        <label className="block text-xs font-medium">Evidence name<input className={`${fieldClass} mt-1`} required minLength={3} maxLength={200} value={evidenceTitle} onChange={(event) => setEvidenceTitle(event.target.value)} /></label>
        <label className="block text-xs font-medium">Evidence type<select className={`${fieldClass} mt-1`} value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="meeting-transcript">Meeting transcript</option><option value="assessment-note">Assessment notes</option></select></label>
        <label className="block text-xs font-medium">Transcript or notes<textarea className={`${fieldClass} mt-1`} rows={6} required minLength={40} maxLength={30000} value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} /></label>
        <p className="flex gap-1 text-[11px] text-slate-500"><Link2 size={12} />Stored with the Gmail / evidence connector. Grant read access there before running the skill.</p>
        <Button type="submit" size="sm" disabled={automation.busy || evidenceText.trim().length < 40 || evidenceTitle.trim().length < 3}>Save evidence</Button>
      </form>}
    </section>
  );
}
