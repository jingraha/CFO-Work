"use client";

import type { AgentRunView, AutomationSnapshot } from "@cfo/domain";
import { Button, Card } from "@cfo/ui";
import { ArrowRight, Bot, CheckCircle2, FileText, GitBranch, Pause, Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import {
  delegateRoadmapTaskAction, queueAgentWorkAction, retryAgentRunAction,
  reviewAgentRunAction, setAutomationEnabledAction,
} from "@/app/app/automation-actions";
import type { WorkspaceViewData } from "@/lib/workspace-data";
import {
  ErrorNotice, fieldClass, mutedClass, OutputRequirements, readableTime, RunStatus,
  type ActionBase, type ExecuteAction,
} from "./environment-ui";

export function AgentWork({ snapshot, data, base, editable, busy, execute, onInspect }: {
  snapshot: AutomationSnapshot; data: WorkspaceViewData; base: ActionBase;
  editable: boolean; busy: boolean; execute: ExecuteAction; onInspect: (runId: string) => void;
}) {
  const [playbookId, setPlaybookId] = useState(snapshot.playbooks[0]?.id ?? "");
  const [taskId, setTaskId] = useState("");
  const selectedPlaybook = snapshot.playbooks.find((playbook) => playbook.id === playbookId);
  const selectedRun = snapshot.runs.find((run) => run.playbookId === playbookId);
  const canQueue = selectedPlaybook && selectedRun && selectedRun.attempts === 0 && ["queued", "blocked"].includes(selectedRun.status);
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-5 bg-slate-950 p-5 text-white sm:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/10 p-3"><Bot className="size-6 text-violet-300" /></div>
            <div><h2 className="text-lg font-semibold">Deterministic demo agents</h2><p className="mt-1 max-w-xl text-sm leading-6 text-slate-300">Real local calculations on synthetic data. Not a live LLM, paid service, or external connection.</p></div>
          </div>
          {editable && <Button variant={snapshot.enabled ? "secondary" : "primary"} disabled={busy} onClick={() => execute("execution", () => setAutomationEnabledAction({ ...base, enabled: !snapshot.enabled }))}>
            {snapshot.enabled ? <Pause className="size-4" /> : <Play className="size-4" />}
            {snapshot.enabled ? "Pause automatic execution" : "Enable automatic execution"}
          </Button>}
        </div>
        <div className="space-y-3 p-5 sm:p-6">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span className="font-semibold">{snapshot.enabled ? "Execution enabled" : "Execution paused"}</span>
            <span className="text-slate-500">Server heartbeat: {readableTime(snapshot.worker.lastHeartbeat)}</span>
          </div>
          <p className={mutedClass}>The server worker runs independently while the local app server is running. This page only polls status every three seconds when enabled. Closing the page does not stop jobs. Pausing prevents new claims; an in-flight run may finish.</p>
          <ErrorNotice>{snapshot.worker.error}</ErrorNotice>
          <div className="flex items-start gap-3 rounded-xl border border-purple-100 bg-purple-50/60 p-4">
            <GitBranch className="mt-0.5 size-5 shrink-0 text-purple-700" />
            <p className="text-sm leading-6 text-purple-950"><strong>Automatic handoffs:</strong> completed or not-applicable prerequisites unlock downstream work. Missing connections wait. Dates never gate execution. Acceptance checks and required human approvals still apply.</p>
          </div>
        </div>
      </Card>

      {editable && (
        <Card className="space-y-4 p-5">
          <div><h3 className="font-semibold">Ask an agent to do demo work</h3><p className={mutedClass}>Choose a prepared playbook. Enable automatic execution to process queued work.</p></div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex-1"><span className="sr-only">Demo playbook</span><select aria-label="Demo playbook" className={fieldClass} value={playbookId} onChange={(event) => setPlaybookId(event.target.value)}>{snapshot.playbooks.map((playbook) => <option key={playbook.id} value={playbook.id}>{playbook.title}</option>)}</select></label>
            <Button disabled={busy || !canQueue} onClick={() => execute(`queue-${playbookId}`, () => queueAgentWorkAction({ ...base, playbookId }))}><Play className="size-4" />Run demo work</Button>
          </div>
          {selectedPlaybook && <><p className={mutedClass}>{selectedPlaybook.description}</p><OutputRequirements contract={selectedPlaybook.contract} /></>}
          {!canQueue && selectedRun && <p className="text-xs text-slate-500">This playbook is {selectedRun.status.replace("-", " ")}. Use its rebuild control below to rerun it and its downstream work from current sources.</p>}
        </Card>
      )}

      <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Agent run ledger</h3><span className="text-xs text-slate-500">{snapshot.runs.length} runs</span></div>
      {!snapshot.runs.length && <Card className="p-8 text-center text-sm text-slate-500">No agent work has been queued yet.</Card>}
      <div className="space-y-3">
        {snapshot.runs.map((run) => {
          const contract = run.artifact?.contract ?? snapshot.playbooks.find((playbook) => playbook.id === run.playbookId)?.contract;
          return (
            <Card key={run.id} className="p-5" data-testid={`run-${run.playbookId}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0"><h4 className="font-semibold">{run.taskTitle}</h4><p className="mt-1 text-xs text-slate-500">Attempt {run.attempts} · Updated {readableTime(run.updatedAt)}</p></div>
                <RunStatus status={run.status} />
              </div>
              {!!run.blockers.length && <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><p className="font-semibold">Waiting for</p><ul className="mt-1 list-disc space-y-1 pl-4">{run.blockers.map((blocker, i) => <li key={i}>{blocker}</li>)}</ul></div>}
              {run.error && <div className="mt-3"><ErrorNotice>{run.error}</ErrorNotice></div>}
              <div className="mt-4 flex flex-wrap gap-2">
                {run.artifact && <Button size="sm" variant="secondary" onClick={() => onInspect(run.id)}><FileText className="size-4" />Inspect output</Button>}
                {editable && ["failed", "completed", "needs-review"].includes(run.status) && run.playbookId !== "output-specification" && <Button size="sm" disabled={busy} onClick={() => execute(`retry-${run.id}`, () => retryAgentRunAction({ ...base, runId: run.id }))}><RotateCcw className="size-3.5" />{run.status === "failed" ? "Retry with current sources" : "Rebuild output + downstream"}</Button>}
              </div>
              {["failed", "completed", "needs-review"].includes(run.status) && run.playbookId !== "output-specification" && editable && <p className="mt-2 text-xs text-slate-500">Rebuilding requeues this output and its dependent demo outputs. Previous results remain in the audit history and saved reviews; manual task blockers are preserved.</p>}
              <details className="mt-4 border-t border-[var(--border)] pt-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-600">Output contract &amp; execution log</summary>
                <div className="mt-3 space-y-4">
                  {contract && <OutputRequirements contract={contract} />}
                  <ol className="max-h-60 space-y-2 overflow-y-auto rounded-xl bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-200">
                    {run.log.map((entry, i) => <li key={`${entry.at}-${i}`}><time className="mr-2 text-slate-400">{readableTime(entry.at)}</time>{entry.message}</li>)}
                    {!run.log.length && <li>No execution log entries yet.</li>}
                  </ol>
                </div>
              </details>
            </Card>
          );
        })}
      </div>
      {editable && (
        <details className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <summary className="cursor-pointer font-semibold">Delegate a roadmap task</summary>
          <p className="mt-3 text-sm leading-6 text-slate-500">Tasks without a supported playbook produce an output specification for human review, not completed real-world work. Existing task data is not automatically replaced.</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <select aria-label="Roadmap task to delegate" className={fieldClass} value={taskId} onChange={(event) => setTaskId(event.target.value)}>
              <option value="">Choose an unfinished task…</option>
              {data.tasks.filter((task) => !["complete", "not-applicable"].includes(task.status) && !snapshot.runs.some((run) => run.taskId === task.id)).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
            </select>
            <Button className="shrink-0" variant="secondary" disabled={busy || !taskId} onClick={async () => {
              if (await execute(`delegate-${taskId}`, () => delegateRoadmapTaskAction({ ...base, taskId }))) setTaskId("");
            }}>Delegate task <ArrowRight className="size-4" /></Button>
          </div>
        </details>
      )}
    </div>
  );
}

export function RunReview({ run, base, busy, execute, evidenceCurrent = true }: {
  run: AgentRunView; base: ActionBase; busy: boolean; execute: ExecuteAction; evidenceCurrent?: boolean;
}) {
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  if (run.status !== "needs-review") return null;
  const checksPass = run.playbookId !== "output-specification" && !!run.artifact?.checks.length && run.artifact.checks.every((check) => check.passed);
  async function review(decision: "approve" | "request-changes") {
    setError("");
    if (decision === "request-changes" && notes.trim().length < 5) { setError("Add at least five characters describing the changes needed."); return; }
    await execute(`review-${run.id}`, () => reviewAgentRunAction({ ...base, runId: run.id, decision, notes }));
  }
  return (
    <section className="space-y-3 rounded-xl border border-purple-200 bg-purple-50/50 p-4">
      <h3 className="font-semibold">Human review</h3>
      <p className={mutedClass}>Approval completes the linked demo task and can unlock downstream agents. Requesting changes preserves the feedback and requires an explicit retry.</p>
      {!checksPass && <p className="text-sm font-medium text-amber-900">This result cannot be approved as completed work: it has failed checks or is an output specification only.</p>}
      {!evidenceCurrent && <p className="text-sm font-medium text-amber-900">Approval is unavailable because source evidence changed or is disconnected. Request changes, resolve the source issues, then explicitly retry the run.</p>}
      <label htmlFor={`review-notes-${run.id}`} className="block text-sm font-medium">Review note</label>
      <textarea id={`review-notes-${run.id}`} className={fieldClass} rows={3} maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What is accepted, or what needs to change?" />
      <ErrorNotice>{error}</ErrorNotice>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !checksPass || !evidenceCurrent} onClick={() => review("approve")}><CheckCircle2 className="size-4" />Approve output</Button>
        <Button variant="secondary" disabled={busy} onClick={() => review("request-changes")}>Request changes</Button>
      </div>
    </section>
  );
}
