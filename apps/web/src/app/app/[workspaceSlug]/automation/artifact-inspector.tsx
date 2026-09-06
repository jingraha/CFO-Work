"use client";

import type { AgentArtifact, AgentRunView, AutomationSnapshot, SystemConnection, SystemId } from "@cfo/domain";
import { Button, Card } from "@cfo/ui";
import { CheckCircle2, CircleAlert, Download, FileText, Presentation, Video } from "lucide-react";
import { RunReview } from "./agent-work";
import {
  mutedClass, OutputRequirements, readableTime, RunStatus, sourceEvidenceWarning, SourceRevisionNotice, systemInfo,
  type ActionBase, type ExecuteAction,
} from "./environment-ui";

export function OutputsCenter({ snapshot, editable, busy, onInspect, onCreateMeeting, onOpenMeeting, onAssessment }: {
  snapshot: AutomationSnapshot; editable: boolean; busy: boolean;
  onInspect: (runId: string) => void; onCreateMeeting: (runId: string) => void;
  onOpenMeeting: (meetingId: string) => void; onAssessment: () => void;
}) {
  const outputs = snapshot.runs.filter((run) => run.artifact);
  return (
    <div className="space-y-6">
      <div><h2 className="text-xl font-semibold">Evaluated outputs</h2><p className={mutedClass}>Inspect the calculations, source revisions, and checks before you use a result. Everything here is based on synthetic company data.</p></div>
      {!snapshot.assessment.presentationsEnabled && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p>Presentation reviews are disabled in the assessment.</p>{editable && <Button variant="secondary" size="sm" onClick={onAssessment}>Edit assessment</Button>}</div>}
      {!outputs.length && <Card className="flex flex-col items-center p-10 text-center"><FileText className="mb-3 size-8 text-slate-300" /><h3 className="font-semibold">Your first output will appear here</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Connect the required mock systems and enable execution in Agent work. Blocked runs explain what they need.</p></Card>}
      <div className="grid gap-4 lg:grid-cols-2">
        {outputs.map((run) => (
          <Card className="flex flex-col p-5" key={run.id}>
            <div className="flex items-center justify-between gap-3"><FileText className="size-5 text-[var(--purple)]" /><RunStatus status={run.status} /></div>
            <h3 className="mt-4 font-semibold">{run.artifact!.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{run.artifact!.summary}</p>
            <p className="mt-3 text-xs text-slate-500">{run.artifact!.sources.length} citations · {run.artifact!.checks.filter((check) => check.passed).length}/{run.artifact!.checks.length} checks passed · {run.artifact!.slides.length} slides</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => onInspect(run.id)}>Inspect output</Button>
              {editable && <Button size="sm" disabled={busy || !snapshot.assessment.presentationsEnabled || !run.artifact!.slides.length} onClick={() => onCreateMeeting(run.id)}><Presentation className="size-4" />Start review</Button>}
            </div>
          </Card>
        ))}
      </div>
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Saved presentation reviews</h3>
        <p className={mutedClass}>Local rehearsal rooms, not multi-party calls. Slides and conversation history are saved; camera video is not.</p>
        {!snapshot.meetings.length && <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">No review rooms yet. Start a review from an output.</p>}
        {snapshot.meetings.map((meeting) => (
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4" key={meeting.id}>
            <div className="flex items-start gap-3"><Video className="mt-1 size-5 text-purple-500" /><div><h4 className="text-sm font-semibold">{meeting.title}</h4><p className="mt-1 text-xs text-slate-500"><span className="capitalize">{meeting.status}</span> · {readableTime(meeting.createdAt)} · {meeting.messages.length} messages</p></div></div>
            <Button size="sm" variant="secondary" onClick={() => onOpenMeeting(meeting.id)}>{editable && meeting.status !== "ended" ? "Open review room" : "View saved review"}</Button>
          </Card>
        ))}
      </section>
    </div>
  );
}

export function ArtifactInspector({ run, systems, base, editable, busy, execute, presentationsEnabled, onCreateMeeting, onSource }: {
  run: AgentRunView; systems: SystemConnection[]; base: ActionBase; editable: boolean; busy: boolean; execute: ExecuteAction;
  presentationsEnabled: boolean; onCreateMeeting: () => void;
  onSource: (systemId: SystemId, recordId: string) => void;
}) {
  const artifact = run.artifact;
  if (!artifact) return <p className={mutedClass}>This output was invalidated by a retry. Wait for the new run to finish.</p>;
  const downloadRoot = `/api/workspaces/${encodeURIComponent(base.workspaceSlug)}/automation/artifacts/${encodeURIComponent(run.id)}`;
  return (
    <div className="space-y-6">
      <div className="space-y-3"><RunStatus status={run.status} /><p className="text-base leading-7 text-slate-600">{artifact.summary}</p><p className="text-xs font-semibold text-slate-500">DETERMINISTIC DEMO · SYNTHETIC SOURCES · NOT FINANCIAL ADVICE</p></div>
      <SourceRevisionNotice sources={artifact.sources} systems={systems} />
      <div className="flex flex-wrap gap-2">
        {(["md", "csv", "pptx"] as const).filter((format) => format !== "pptx" || artifact.slides.length > 0).map((format) => <a className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold hover:bg-slate-50" key={format} href={`${downloadRoot}?format=${format}`} download><Download className="size-3.5" />{format === "md" ? "Markdown" : format === "pptx" ? "PowerPoint (.pptx)" : "CSV tables"}</a>)}
        {editable && <Button size="sm" disabled={busy || !presentationsEnabled || !artifact.slides.length} onClick={onCreateMeeting}><Presentation className="size-4" />Generate presentation / Start review</Button>}
      </div>
      {!presentationsEnabled && <p className="text-sm text-amber-800">Enable presentations in the assessment to create a local review room.</p>}
      <section className="space-y-3"><h3 className="font-semibold">Output requirements · {artifact.contract.title}</h3><OutputRequirements contract={artifact.contract} /></section>
      <ArtifactBody artifact={artifact} systems={systems} onSource={onSource} />
      {editable && <RunReview run={run} base={base} busy={busy} execute={execute} evidenceCurrent={artifact.sources.every((source) => !sourceEvidenceWarning(source, systems))} />}
    </div>
  );
}

export function ArtifactBody({ artifact, systems, onSource }: {
  artifact: AgentArtifact; systems: SystemConnection[]; onSource: (systemId: SystemId, recordId: string) => void;
}) {
  return (
    <>
      {artifact.sections.map((section, i) => (
        <section className="space-y-3" key={i}>
          <h3 className="text-lg font-semibold">{section.title}</h3>
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{section.body}</p>
          {!!section.columns.length && <div className="overflow-x-auto rounded-xl border border-[var(--border)]"><table className="w-full text-left text-sm"><caption className="sr-only">{section.title}</caption><thead className="bg-slate-50 text-xs text-slate-500"><tr>{section.columns.map((column, j) => <th className="whitespace-nowrap px-4 py-3 font-semibold" scope="col" key={j}>{column}</th>)}</tr></thead><tbody className="divide-y divide-[var(--border)]">{section.rows.map((row, j) => <tr key={j}>{row.map((cell, k) => <td key={k} className="px-4 py-3 align-top">{cell}</td>)}</tr>)}</tbody></table></div>}
        </section>
      ))}
      <section className="space-y-3">
        <h3 className="font-semibold">Validation checks</h3>
        <div className="grid gap-2 sm:grid-cols-2">{artifact.checks.map((check, i) => <div key={i} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${check.passed ? "border-emerald-100 bg-emerald-50/60 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>{check.passed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}<div><p className="font-semibold">{check.passed ? "Passed" : "Failed"} · {check.name}</p><p className="mt-1 leading-6">{check.detail}</p></div></div>)}</div>
        {!artifact.checks.length && <p className={mutedClass}>No validation checks are available. Do not treat this as verified work.</p>}
      </section>
      <section className="space-y-3">
        <h3 className="font-semibold">Source citations</h3>
        <p className="text-xs leading-5 text-slate-500">Open the internal mock record browser. Each citation records the revision used for this output; current records may have changed.</p>
        <div className="grid gap-2 sm:grid-cols-2">{artifact.sources.map((source, i) => {
          const warning = sourceEvidenceWarning(source, systems);
          return <button className="rounded-xl border border-[var(--border)] p-3 text-left hover:border-purple-200 hover:bg-purple-50/50" key={`${source.systemId}-${source.recordId}-${i}`} onClick={() => onSource(source.systemId, source.recordId)}><span className="block text-xs text-slate-500">{systemInfo[source.systemId].name} · source revision {source.revision}</span><span className="mt-1 block text-sm font-medium text-[var(--purple)]">{source.title}</span>{warning ? <span className="mt-2 flex items-start gap-1.5 text-xs font-medium leading-5 text-amber-800"><CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{warning}</span> : <span className="mt-2 block text-xs text-slate-500">Matches current source revision</span>}</button>;
        })}</div>
        {!artifact.sources.length && <p className={mutedClass}>No source records were cited.</p>}
      </section>
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl bg-purple-50 p-4"><h3 className="font-semibold text-purple-950">Recommended next actions</h3><ul className="mt-2 list-disc space-y-2 pl-4 text-sm leading-6 text-purple-950">{artifact.recommendations.map((item, i) => <li key={i}>{item}</li>)}</ul></section>
        <section className="rounded-xl bg-slate-100 p-4"><h3 className="font-semibold">Limitations</h3><ul className="mt-2 list-disc space-y-2 pl-4 text-sm leading-6 text-slate-600">{artifact.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul></section>
      </div>
    </>
  );
}
