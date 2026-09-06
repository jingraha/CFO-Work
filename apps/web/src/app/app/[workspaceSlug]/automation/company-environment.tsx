"use client";

import {
  AssessmentAnswersSchema, DEFAULT_ASSESSMENT, SYSTEM_IDS, can,
  type AssessmentAnswers, type AutomationSnapshot, type ReviewMeetingView, type SystemId,
} from "@cfo/domain";
import { Button, Card, cn } from "@cfo/ui";
import { ArrowRight, Bot, CheckCircle2, ClipboardList, FileText, Link2, LoaderCircle, RefreshCw, Settings2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createReviewMeetingAction, initializeEnvironmentAction, saveAssessmentAction,
} from "@/app/app/automation-actions";
import type { WorkspaceViewData } from "@/lib/workspace-data";
import { AgentWork } from "./agent-work";
import { ArtifactInspector, OutputsCenter } from "./artifact-inspector";
import {
  EnvironmentDialog, ErrorNotice, fieldClass, mutedClass, systemInfo,
  type ExecuteAction,
} from "./environment-ui";
import { LocalReviewRoom } from "./review-room";
import { SystemBrowser, SystemConsent, SystemsCenter } from "./systems-browser";

type Props = { data: WorkspaceViewData; currentUserId: string; onTasksChanged: () => void };
type Tab = "systems" | "work" | "outputs";
type Panel =
  | { kind: "assessment" }
  | { kind: "system"; systemId: SystemId; recordId?: string; returnRunId?: string }
  | { kind: "consent"; systemId: SystemId }
  | { kind: "artifact"; runId: string }
  | { kind: "meeting"; meetingId: string; initial?: ReviewMeetingView };

export function CompanyEnvironment(props: Props) {
  return <EnvironmentContent key={props.data.workspace.id} {...props} />;
}

function EnvironmentContent({ data, currentUserId, onTasksChanged }: Props) {
  const [snapshot, setSnapshot] = useState<AutomationSnapshot | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [actionError, setActionError] = useState("");
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<Tab>("systems");
  const [panel, setPanel] = useState<Panel | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  const mutationRef = useRef(false);
  const runVersionRef = useRef<string | null>(null);
  const tasksChangedRef = useRef(onTasksChanged);
  const role = data.members.find((member) => member.userId === currentUserId)?.role ?? "viewer";
  const editable = can(role, "workspace:edit");
  const base = { workspaceId: data.workspace.id, workspaceSlug: data.workspace.slug };

  useEffect(() => { tasksChangedRef.current = onTasksChanged; }, [onTasksChanged]);

  const refresh = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(data.workspace.slug)}/automation`, {
        cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) {
        let message = `Could not load the company environment (HTTP ${response.status}).`;
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const error = await response.json() as { error?: string };
          if (error.error) message = error.error;
        }
        if (response.status === 401) message = "Your session expired. Sign in again to view the company environment.";
        throw new Error(message);
      }
      const next = await response.json() as AutomationSnapshot;
      if (!mountedRef.current || controller.signal.aborted) return null;
      setSnapshot(next);
      setFetchError("");
      const version = JSON.stringify(next.runs.map((run) => [run.id, run.status, run.updatedAt]));
      if (runVersionRef.current !== null && runVersionRef.current !== version) tasksChangedRef.current();
      runVersionRef.current = version;
      return next;
    } catch (cause) {
      // Replaced requests and unmounted views are intentionally cancelled.
      if (controller.signal.aborted || !mountedRef.current) return null;
      setFetchError(cause instanceof Error ? cause.message : "The environment could not be refreshed.");
      return null;
    }
  }, [data.workspace.slug]);

  useEffect(() => {
    mountedRef.current = true;
    const initialLoad = setTimeout(() => void refresh(), 0);
    return () => {
      mountedRef.current = false;
      clearTimeout(initialLoad);
      requestRef.current?.abort();
    };
  }, [refresh]);

  useEffect(() => {
    if (!snapshot?.enabled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      await refresh();
      if (!stopped) timer = setTimeout(poll, 3000);
    }
    timer = setTimeout(poll, 3000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [snapshot?.enabled, refresh]);

  const execute: ExecuteAction = async (key, operation, affectsTasks = true) => {
    if (mutationRef.current) return false;
    if (!editable) { setActionError("An administrator or finance editor must make this change."); return false; }
    mutationRef.current = true;
    setPending(key);
    setActionError("");
    setNotice("");
    try {
      await operation();
      if (!mountedRef.current) return true;
      if (affectsTasks) tasksChangedRef.current();
      const next = await refresh();
      if (mountedRef.current) setNotice(next ? "Change saved." : "Change saved, but the latest status could not be loaded. Refresh to try again.");
      return true;
    } catch (cause) {
      if (mountedRef.current) setActionError(cause instanceof Error ? cause.message : "The change could not be saved. Try again.");
      return false;
    } finally {
      mutationRef.current = false;
      if (mountedRef.current) setPending("");
    }
  };

  function openPanel(next: Panel) {
    setActionError("");
    setNotice("");
    setPanel(next);
  }

  async function createMeeting(runId: string) {
    await execute(`create-review-${runId}`, async () => {
      const meeting = await createReviewMeetingAction({ ...base, runId });
      if (mountedRef.current) setPanel({ kind: "meeting", meetingId: meeting.id, initial: meeting });
    }, false);
  }

  const busy = !!pending;
  const systemsConnected = snapshot?.systems.filter((system) => system.connected).length ?? 0;
  const completed = snapshot?.runs.filter((run) => run.status === "completed").length ?? 0;
  const awaitingReview = snapshot?.runs.filter((run) => run.status === "needs-review").length ?? 0;
  const dialogError = [actionError, fetchError].filter(Boolean).join("\n");
  const system = panel && (panel.kind === "system" || panel.kind === "consent") ? snapshot?.systems.find((item) => item.id === panel.systemId) : null;
  const run = panel?.kind === "artifact" ? snapshot?.runs.find((item) => item.id === panel.runId) : null;
  const meeting = panel?.kind === "meeting" ? snapshot?.meetings.find((item) => item.id === panel.meetingId) ?? panel.initial : null;
  const dialogTitle = panel?.kind === "assessment" ? "Company assessment"
    : panel?.kind === "consent" ? `Mock access · ${system?.name ?? "System"}`
      : panel?.kind === "system" ? `${system?.name ?? "System"} · mock record browser`
        : panel?.kind === "artifact" ? run?.artifact?.title ?? "Output inspector"
          : meeting?.title ?? "Local review room";

  return (
    <div className="space-y-6" data-testid="company-environment">
      <section className="relative overflow-hidden rounded-2xl border border-purple-100 bg-gradient-to-br from-white via-violet-50/70 to-cyan-50/60 p-6 sm:p-8">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--purple)]"><ShieldCheck className="size-4" />Local-first CFO lab</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Company environment</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">Meet your company, connect its mock systems, and turn finance questions into evaluated work. Review the evidence, then rehearse the presentation.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {snapshot?.initialized && editable && <Button variant="secondary" size="sm" disabled={busy} onClick={() => openPanel({ kind: "assessment" })}><Settings2 className="size-3.5" />Assessment</Button>}
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void refresh()}><RefreshCw className="size-3.5" />Refresh status</Button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span>No subscriptions</span><span>Synthetic company data</span><span>Deterministic demo, not a live LLM</span><span>No real OAuth or conferencing</span></div>
        {snapshot?.initialized && <div className="mt-6 grid grid-cols-2 gap-3 border-t border-purple-100 pt-5 sm:grid-cols-4">
          {[{ value: `${systemsConnected}/8`, label: "Systems connected" }, { value: completed, label: "Completed outputs" }, { value: awaitingReview, label: "Awaiting review" }, { value: snapshot.enabled ? "Enabled" : "Paused", label: "Server execution" }].map((metric) => <div key={metric.label}><p className="text-xl font-semibold text-slate-900">{metric.value}</p><p className="mt-1 text-xs text-slate-500">{metric.label}</p></div>)}
        </div>}
      </section>

      <ErrorNotice>{fetchError}</ErrorNotice>
      {!panel && <ErrorNotice>{actionError}</ErrorNotice>}
      {notice && !panel && <p role="status" className="flex items-center gap-2 text-sm text-emerald-800"><CheckCircle2 className="size-4" />{notice}</p>}
      {busy && <p role="status" className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Saving your change…</p>}
      {!editable && <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">Read-only access. You can inspect available records, artifacts, and saved reviews. An administrator or finance editor must initialize, connect, or run the demo.</p>}

      {!snapshot && !fetchError && <Card className="flex items-center justify-center gap-3 p-12 text-sm text-slate-500"><LoaderCircle className="size-5 animate-spin" />Loading company environment…</Card>}
      {snapshot && !snapshot.initialized && (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <Card className="p-5 sm:p-6">
            <div className="mb-5"><ClipboardList className="mb-3 size-6 text-purple-500" /><h2 className="text-xl font-semibold">Start with your CFO brief</h2><p className={cn(mutedClass, "mt-2")}>Initialization explicitly adds a synthetic company environment and demo workflow. It does not reset your existing workspace records or complete existing tasks.</p></div>
            <AssessmentForm initial={DEFAULT_ASSESSMENT} editable={editable} busy={busy} submitLabel="Initialize demo company" onSubmit={(assessment) => execute("initialize", () => initializeEnvironmentAction({ ...base, assessment }))} />
          </Card>
          <section className="space-y-4">
            <div><h2 className="text-lg font-semibold">Eight systems, ready to explore</h2><p className={mutedClass}>Prepare by choosing an objective. After initialization, inspect records and consent to each mock system&apos;s read scopes.</p></div>
            <div className="grid gap-3 sm:grid-cols-2">{SYSTEM_IDS.map((id) => {
              const info = systemInfo[id]; const Icon = info.icon;
              return <Card className="p-4" key={id}><div className="mb-2 flex items-center gap-2"><span className={cn("rounded-lg p-2", info.color)}><Icon className="size-4" /></span><h3 className="text-sm font-semibold">{info.name}</h3><span className="ml-auto text-[9px] font-bold tracking-wide text-slate-400">MOCK</span></div><p className="text-xs leading-6 text-slate-500">{info.description}</p></Card>;
            })}</div>
          </section>
        </div>
      )}

      {snapshot?.initialized && (
        <>
          <nav aria-label="Company environment sections" className="flex gap-1 overflow-x-auto border-b border-[var(--border)]">
            {([{ id: "systems", title: "Systems", icon: Link2 }, { id: "work", title: "Agent work", icon: Bot }, { id: "outputs", title: "Outputs & reviews", icon: FileText }] as const).map((item) => <button key={item.id} aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)} className={cn("flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition", tab === item.id ? "border-[var(--purple)] text-[var(--purple)]" : "border-transparent text-slate-500 hover:text-slate-800")}><item.icon className="size-4" />{item.title}{item.id === "outputs" && awaitingReview > 0 && <span className="rounded-full bg-purple-100 px-1.5 text-xs text-purple-800">{awaitingReview}</span>}</button>)}
          </nav>
          {tab === "systems" && <SystemsCenter systems={snapshot.systems} editable={editable} busy={busy} onBrowse={(systemId) => openPanel({ kind: "system", systemId })} onConnect={(systemId) => openPanel({ kind: "consent", systemId })} />}
          {tab === "work" && <AgentWork snapshot={snapshot} data={data} base={base} editable={editable} busy={busy} execute={execute} onInspect={(runId) => openPanel({ kind: "artifact", runId })} />}
          {tab === "outputs" && <OutputsCenter snapshot={snapshot} editable={editable} busy={busy} onInspect={(runId) => openPanel({ kind: "artifact", runId })} onCreateMeeting={(runId) => void createMeeting(runId)} onOpenMeeting={(meetingId) => openPanel({ kind: "meeting", meetingId })} onAssessment={() => openPanel({ kind: "assessment" })} />}
        </>
      )}

      {panel && snapshot && <EnvironmentDialog key={`${panel.kind}-${panel.kind === "meeting" ? panel.meetingId : panel.kind === "artifact" ? panel.runId : panel.kind === "system" || panel.kind === "consent" ? panel.systemId : ""}`} title={dialogTitle} error={dialogError} onClose={() => setPanel(null)}>
        {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
        {panel.kind === "assessment" && <AssessmentForm initial={snapshot.assessment} editable={editable} busy={busy} submitLabel="Save assessment" onSubmit={(assessment) => execute("assessment", () => saveAssessmentAction({ ...base, assessment }))} />}
        {panel.kind === "consent" && system && editable && <SystemConsent key={system.id} system={system} base={base} busy={busy} execute={execute} onDone={() => setPanel(null)} />}
        {panel.kind === "system" && system && <>
          {panel.returnRunId && <Button variant="ghost" size="sm" onClick={() => openPanel({ kind: "artifact", runId: panel.returnRunId! })}><ArrowRight className="size-3.5 rotate-180" />Back to output</Button>}
          <SystemBrowser key={`${system.id}-${panel.recordId ?? ""}`} system={system} initialRecordId={panel.recordId} base={base} editable={editable} busy={busy} execute={execute} />
        </>}
        {panel.kind === "artifact" && run && <ArtifactInspector key={run.id} run={run} systems={snapshot.systems} base={base} editable={editable} busy={busy} execute={execute} presentationsEnabled={snapshot.assessment.presentationsEnabled} onCreateMeeting={() => void createMeeting(run.id)} onSource={(systemId, recordId) => openPanel({ kind: "system", systemId, recordId, returnRunId: run.id })} />}
        {panel.kind === "meeting" && meeting && <LocalReviewRoom key={meeting.id} meeting={meeting} systems={snapshot.systems} base={base} editable={editable} busy={busy} execute={execute} />}
        {((panel.kind === "system" || panel.kind === "consent") && !system || panel.kind === "artifact" && !run || panel.kind === "meeting" && !meeting) && <p className={mutedClass}>This item is no longer available. Close this dialog and refresh the environment.</p>}
      </EnvironmentDialog>}
    </div>
  );
}

function AssessmentForm({ initial, editable, busy, submitLabel, onSubmit }: {
  initial: AssessmentAnswers; editable: boolean; busy: boolean; submitLabel: string;
  onSubmit: (assessment: AssessmentAnswers) => Promise<boolean>;
}) {
  const [assessment, setAssessment] = useState(initial);
  const [closeDays, setCloseDays] = useState(String(initial.closeTargetDays));
  const [error, setError] = useState("");
  return (
    <form className="space-y-5" onSubmit={async (event) => {
      event.preventDefault();
      setError("");
      const parsed = AssessmentAnswersSchema.safeParse({ ...assessment, closeTargetDays: Number(closeDays) });
      if (!parsed.success) { setError(parsed.error.issues.map((issue) => issue.message).join(" ")); return; }
      await onSubmit(parsed.data);
    }}>
      <fieldset disabled={!editable || busy} className="space-y-5 disabled:opacity-70">
        <div><label htmlFor="cfo-objective" className="mb-2 block text-sm font-semibold">Your CFO objective</label><textarea id="cfo-objective" className={fieldClass} rows={4} minLength={5} maxLength={2000} required value={assessment.objective} onChange={(event) => setAssessment({ ...assessment, objective: event.target.value })} /></div>
        <div><label htmlFor="close-target" className="mb-2 block text-sm font-semibold">Target close duration (days)</label><input id="close-target" type="number" min={1} max={30} step={1} required className={cn(fieldClass, "max-w-32")} value={closeDays} onChange={(event) => setCloseDays(event.target.value)} /><p className="mt-2 text-xs text-slate-500">An assessment target, not a scheduling gate. Choose 1–30 days.</p></div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4"><input type="checkbox" className="mt-1 accent-[var(--purple)]" checked={assessment.reviewBeforeComplete} onChange={(event) => setAssessment({ ...assessment, reviewBeforeComplete: event.target.checked })} /><span><span className="block text-sm font-semibold">Review every output before completion</span><span className="mt-1 block text-xs leading-5 text-slate-500">Required approvals and failed validation checks always stop automatic completion.</span></span></label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4"><input type="checkbox" className="mt-1 accent-[var(--purple)]" checked={assessment.presentationsEnabled} onChange={(event) => setAssessment({ ...assessment, presentationsEnabled: event.target.checked })} /><span><span className="block text-sm font-semibold">Enable presentations and local video reviews</span><span className="mt-1 block text-xs leading-5 text-slate-500">Saved slides and facilitator questions, with optional local camera preview. No remote call or recording.</span></span></label>
      </fieldset>
      <ErrorNotice>{error}</ErrorNotice>
      {editable && <Button type="submit" disabled={busy}><CheckCircle2 className="size-4" />{submitLabel}</Button>}
    </form>
  );
}
