"use client";

import type { AgentRunStatus, ArtifactSource, OutputContract, SystemConnection, SystemId } from "@cfo/domain";
import { Button, cn } from "@cfo/ui";
import {
  Building2, ChartNoAxesCombined, CircleAlert, CreditCard, Database,
  Landmark, Mail, MessagesSquare, Users, X,
} from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

export const fieldClass = "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--purple)] focus:ring-2 focus:ring-[var(--purple)]/15 disabled:bg-slate-50";
export const mutedClass = "text-sm leading-6 text-[var(--ink-muted)]";
export type ExecuteAction = (key: string, action: () => Promise<unknown>, affectsTasks?: boolean) => Promise<boolean>;
export type ActionBase = { workspaceId: string; workspaceSlug: string };

export const systemInfo = {
  gmail: { name: "Gmail", icon: Mail, color: "bg-rose-50 text-rose-700", description: "Synthetic email threads with board requests, close questions, and finance context." },
  slack: { name: "Slack", icon: MessagesSquare, color: "bg-purple-50 text-purple-700", description: "Mock team conversations about the close, collections, and operating priorities." },
  erp: { name: "ERP / general ledger", icon: Database, color: "bg-blue-50 text-blue-700", description: "A synthetic ledger with accounts, balances, and close preparation records." },
  ar: { name: "Accounts receivable", icon: CreditCard, color: "bg-teal-50 text-teal-700", description: "Mock customer invoices, outstanding balances, and collection dates." },
  ap: { name: "Accounts payable", icon: Building2, color: "bg-orange-50 text-orange-700", description: "Synthetic vendor bills and payment obligations for cash planning." },
  planning: { name: "Planning", icon: ChartNoAxesCombined, color: "bg-indigo-50 text-indigo-700", description: "Mock budgets and forecast assumptions for performance analysis." },
  payroll: { name: "Payroll", icon: Users, color: "bg-pink-50 text-pink-700", description: "Synthetic headcount and payroll costs. No real employee records." },
  banking: { name: "Banking", icon: Landmark, color: "bg-cyan-50 text-cyan-700", description: "Mock account balances and cash activity. No funds move." },
} satisfies Record<SystemId, { name: string; icon: typeof Mail; color: string; description: string }>;

export function readableTime(value: string | null) {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Unavailable" : date.toLocaleString();
}

export function ErrorNotice({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 whitespace-pre-wrap break-words">{children}</div>
    </div>
  );
}

export function sourceEvidenceWarning(source: ArtifactSource, systems: SystemConnection[]): string | null {
  const system = systems.find((item) => item.id === source.systemId);
  if (!system) return "Source system is no longer available.";
  const warnings: string[] = [];
  if (system.revision !== source.revision) warnings.push(`Stale source: cited revision ${source.revision}; current revision ${system.revision}.`);
  if (!system.connected) warnings.push("Source system is disconnected.");
  if (!system.records.some((record) => record.id === source.recordId)) warnings.push(`Cited record "${source.title}" is no longer available.`);
  return warnings.length ? warnings.join(" ") : null;
}

export function SourceRevisionNotice({ sources, systems, savedReview = false }: {
  sources: ArtifactSource[]; systems: SystemConnection[]; savedReview?: boolean;
}) {
  const warnings = [...new Set(sources.flatMap((source) => {
    const warning = sourceEvidenceWarning(source, systems);
    return warning ? [`${systemInfo[source.systemId].name}: ${warning}`] : [];
  }))];
  if (!warnings.length) return null;
  return (
    <section role="status" aria-label="Source revision warning" className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      <h3 className="flex items-center gap-2 font-semibold"><CircleAlert className="size-4 shrink-0" aria-hidden="true" />Source evidence has changed</h3>
      <ul className="list-disc space-y-1 pl-5">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      <p>This report is an immutable snapshot. Source edits do not update its numbers or validation checks. Only an explicit agent rerun produces an output with current evidence.</p>
      {savedReview && <p>These slides and facilitator answers use the saved artifact, not current records. After a rerun, create a new review from the new output.</p>}
    </section>
  );
}

const statusClasses: Record<AgentRunStatus, string> = {
  blocked: "border-amber-200 bg-amber-50 text-amber-800",
  queued: "border-slate-200 bg-slate-50 text-slate-700",
  running: "border-blue-200 bg-blue-50 text-blue-800",
  "needs-review": "border-purple-200 bg-purple-50 text-purple-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  failed: "border-red-200 bg-red-50 text-red-800",
};
export function RunStatus({ status }: { status: AgentRunStatus }) {
  const label = `${status[0]!.toUpperCase()}${status.slice(1).replace("-", " ")}`;
  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", statusClasses[status])}>{label}</span>;
}

export function OutputRequirements({ contract }: { contract: OutputContract }) {
  return (
    <div className="grid gap-4 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
      <div>
        <h4 className="font-semibold">Expected deliverables</h4>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[var(--ink-muted)]">
          {contract.deliverables.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
        <p className="mt-3 text-xs text-[var(--ink-muted)]">
          Required sources: {contract.requiredSystems.map((id) => systemInfo[id].name).join(", ") || "None"}
        </p>
      </div>
      <div>
        <h4 className="font-semibold">Acceptance checks</h4>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[var(--ink-muted)]">
          {contract.acceptanceCriteria.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
        <p className="mt-3 text-xs font-medium">{contract.requiresHumanApproval ? "Human approval required." : "Can complete after checks pass, unless assessment requires review."}</p>
      </div>
    </div>
  );
}

export function EnvironmentDialog({ title, children, onClose, error }: {
  title: string; children: ReactNode; onClose: () => void; error?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="fixed inset-0 m-auto max-h-[92dvh] w-[min(1120px,96vw)] max-w-none overflow-y-auto rounded-2xl border border-[var(--border)] bg-white p-0 text-[var(--ink)] shadow-2xl backdrop:bg-slate-950/50"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--border)] bg-white px-5 py-4">
        <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog"><X className="size-5" /></Button>
      </header>
      <div className="space-y-5 p-5 sm:p-6">
        <ErrorNotice>{error}</ErrorNotice>
        {children}
      </div>
    </dialog>
  );
}
