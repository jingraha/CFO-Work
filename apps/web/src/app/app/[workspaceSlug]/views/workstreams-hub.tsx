"use client";

import { useState } from "react";
import { Button } from "@cfo/ui";
import { Pause, Play } from "lucide-react";
import { AssessmentAnswersSchema, type AssessmentAnswers, type WorkstreamDefinition } from "@cfo/domain";
import type { WorkspaceTaskView, WorkspaceViewData } from "@/lib/workspace-data";
import type { AutomationController } from "../automation/use-automation";
import { ArtifactInspector, OutputsCenter } from "../automation/artifact-inspector";
import { EnvironmentDialog, ErrorNotice, fieldClass } from "../automation/environment-ui";
import { LocalReviewRoom } from "../automation/review-room";
import { SystemBrowser } from "../automation/systems-browser";
import { TaskAgentPanel } from "../automation/task-agent-panel";
import { createReviewMeetingAction, requestTaskAgentAction, saveAssessmentAction, setAutomationEnabledAction } from "../../automation-actions";
import { RoadmapView } from "./roadmap";

type TaskPatch = Partial<Pick<WorkspaceTaskView, "status" | "priority" | "startDate" | "endDate" | "percentComplete" | "ownerId" | "notes" | "evidenceLinks">>;
type Panel = { kind: "task"; id: string } | { kind: "output"; id: string } | { kind: "meeting"; id: string }
  | { kind: "source"; systemId: string; recordId: string; runId: string } | { kind: "options" };

export function WorkstreamsHub({ data, workstreams, currentUserId, savingTaskIds, onSaveTask, automation, onConnectors, initialTaskId, initialTab = "tasks" }: {
  data: WorkspaceViewData; workstreams: WorkstreamDefinition[]; currentUserId: string;
  savingTaskIds: Set<string>; onSaveTask: (taskId: string, patch: TaskPatch) => Promise<void>;
  automation: AutomationController; onConnectors: () => void;
  initialTaskId?: string | undefined; initialTab?: "tasks" | "outputs";
}) {
  const [tab, setTab] = useState<"tasks" | "outputs">(initialTab);
  const [panel, setPanel] = useState<Panel | null>(initialTaskId ? { kind: "task", id: initialTaskId } : null);
  const snapshot = automation.snapshot;
  const task = panel?.kind === "task" ? data.tasks.find((item) => item.id === panel.id) : null;
  const run = panel?.kind === "output" ? snapshot?.runs.find((item) => item.id === panel.id) : null;
  const meeting = panel?.kind === "meeting" ? snapshot?.meetings.find((item) => item.id === panel.id) : null;
  const source = panel?.kind === "source" ? snapshot?.systems.find((item) => item.id === panel.systemId) : null;
  const connect = () => { setPanel(null); onConnectors(); };
  const openTask = (id: string) => setPanel({ kind: "task", id });
  const openOutput = (id: string) => setPanel({ kind: "output", id });
  async function review(runId: string) {
    await automation.execute("create-review", async () => {
      const next = await createReviewMeetingAction({ ...automation.base, runId });
      setPanel({ kind: "meeting", id: next.id });
    }, false);
  }
  const agentPanel = (current: WorkspaceTaskView) => <TaskAgentPanel key={current.id}
    task={current} automation={automation} onConnectors={connect} onInspect={openOutput} onTask={openTask} />;
  const outputCount = snapshot?.runs.filter((item) => item.artifact).length ?? 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="inline-flex rounded-lg bg-slate-100 p-1" aria-label="Workstream sections">
          <button className={`rounded-md px-4 py-2 text-sm font-medium ${tab === "tasks" ? "bg-white shadow-sm" : "text-slate-500"}`} aria-current={tab === "tasks" ? "page" : undefined} onClick={() => setTab("tasks")}>All work</button>
          <button className={`rounded-md px-4 py-2 text-sm font-medium ${tab === "outputs" ? "bg-white shadow-sm" : "text-slate-500"}`} aria-current={tab === "outputs" ? "page" : undefined} onClick={() => setTab("outputs")}>Outputs & reviews ({outputCount})</button>
        </nav>
        {automation.editable && snapshot?.initialized && <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setPanel({ kind: "options" })}>Agent options</Button><Button size="sm" variant="secondary" disabled={automation.busy} onClick={() =>
          automation.execute("handoffs", () => setAutomationEnabledAction({ ...automation.base, enabled: !snapshot.enabled }))}>
          {snapshot.enabled ? <Pause size={14} /> : <Play size={14} />}
          {snapshot.enabled ? "Pause agent handoffs" : "Resume queued agents"}
        </Button></div>}
      </div>
      <ErrorNotice>{automation.error}</ErrorNotice>
      {tab === "tasks" ? <RoadmapView data={data} workstreams={workstreams} currentUserId={currentUserId} savingTaskIds={savingTaskIds}
        onSaveTask={onSaveTask} readiness={snapshot?.taskReadiness ?? []} agentBusy={automation.busy}
        onRunAgent={automation.editable ? (item) => { void automation.execute(`run-${item.id}`, () => requestTaskAgentAction({ ...automation.base, taskId: item.id })); } : undefined}
        onAgentTask={(item) => {
          const result = snapshot?.runs.find((job) => job.taskId === item.id && job.artifact);
          if (result) openOutput(result.id); else openTask(item.id);
        }} renderAgentPanel={agentPanel} />
        : snapshot ? <OutputsCenter snapshot={snapshot} editable={automation.editable} busy={automation.busy} onInspect={openOutput}
          onCreateMeeting={(id) => void review(id)} onOpenMeeting={(id) => setPanel({ kind: "meeting", id })} onAssessment={() => setPanel({ kind: "options" })} />
          : <p className="p-6 text-sm text-slate-500">Loading outputs...</p>}
      {panel && <EnvironmentDialog title={panel.kind === "options" ? "Agent options" : task?.title ?? run?.artifact?.title ?? meeting?.title ?? "Source evidence"} error={automation.error} onClose={() => setPanel(null)}>
        {panel.kind === "options" && snapshot && <AgentOptions assessment={snapshot.assessment} automation={automation} onSaved={() => setPanel(null)} />}
        {task && agentPanel(task)}
        {run && snapshot && <ArtifactInspector run={run} systems={snapshot.systems} base={automation.base} editable={automation.editable} busy={automation.busy}
          execute={automation.execute} presentationsEnabled={snapshot.assessment.presentationsEnabled} onCreateMeeting={() => void review(run.id)}
          onSource={(systemId, recordId) => setPanel({ kind: "source", systemId, recordId, runId: run.id })} />}
        {meeting && snapshot && <LocalReviewRoom meeting={meeting} systems={snapshot.systems} base={automation.base} editable={automation.editable} busy={automation.busy} execute={automation.execute} />}
        {source && panel.kind === "source" && <><Button size="sm" variant="ghost" onClick={() => openOutput(panel.runId)}>Back to output</Button><SystemBrowser
          system={source} initialRecordId={panel.recordId} base={automation.base} editable={automation.editable} busy={automation.busy} execute={automation.execute} /></>}
      </EnvironmentDialog>}
    </div>
  );
}

function AgentOptions({ assessment, automation, onSaved }: { assessment: AssessmentAnswers; automation: AutomationController; onSaved: () => void }) {
  const [draft, setDraft] = useState(assessment);
  const [error, setError] = useState("");
  return <form className="space-y-4" onSubmit={async (event) => {
    event.preventDefault();
    const parsed = AssessmentAnswersSchema.safeParse(draft);
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => issue.message).join(" ")); return; }
    if (await automation.execute("agent-options", () => saveAssessmentAction({ ...automation.base, assessment: parsed.data }))) onSaved();
  }}>
    <label className="block text-sm font-medium">CFO objective<textarea className={`${fieldClass} mt-1`} rows={3} minLength={5} value={draft.objective} onChange={(event) => setDraft({ ...draft, objective: event.target.value })} /></label>
    <label className="block text-sm font-medium">Close target (days)<input className={`${fieldClass} mt-1 max-w-24`} type="number" min={1} max={30} value={draft.closeTargetDays} onChange={(event) => setDraft({ ...draft, closeTargetDays: Number(event.target.value) })} /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.reviewBeforeComplete} onChange={(event) => setDraft({ ...draft, reviewBeforeComplete: event.target.checked })} />Review every output before completion</label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.presentationsEnabled} onChange={(event) => setDraft({ ...draft, presentationsEnabled: event.target.checked })} />Enable presentations and local reviews</label>
    <ErrorNotice>{error}</ErrorNotice>
    <Button type="submit" disabled={automation.busy}>Save agent options</Button>
  </form>;
}
