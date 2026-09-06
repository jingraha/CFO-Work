"use client";

import type { Playbook, SystemId } from "@cfo/domain";
import { Button, Card, cn } from "@cfo/ui";
import { ArrowRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { fieldClass, systemInfo } from "./environment-ui";

export function SkillsLibrary({
  playbooks,
  connectedIds,
  onOpenWork,
}: {
  playbooks: Playbook[];
  connectedIds: SystemId[];
  onOpenWork: () => void;
}) {
  const [query, setQuery] = useState("");
  const connected = useMemo(() => new Set(connectedIds), [connectedIds]);
  const hasTranscriptSkill = useMemo(
    () => playbooks.some((playbook) => /transcript/i.test(`${playbook.id} ${playbook.title} ${playbook.description}`)),
    [playbooks],
  );
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return playbooks;
    return playbooks.filter((playbook) => {
      const haystack = [
        playbook.title,
        playbook.description,
        ...playbook.contract.deliverables,
        ...playbook.contract.requiredSystems.map((systemId) => sourceLabel(playbook, systemId, hasTranscriptSkill)),
        additionalInputNote(playbook),
      ].join(" ").toLowerCase();
      return haystack.includes(text);
    });
  }, [hasTranscriptSkill, playbooks, query]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">Skills describe what agents can do. Start tasks from Workstreams.</p>
          <p className="mt-1 text-xs text-slate-500">{filtered.length} of {playbooks.length} skills shown</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative block min-w-[280px]">
            <span className="sr-only">Search skills</span>
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" aria-hidden="true" />
            <input
              className={cn(fieldClass, "pl-9")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search skills or deliverables"
              aria-label="Search skills"
              data-testid="skills-search"
            />
          </label>
          <Button size="sm" onClick={onOpenWork} aria-label="Go to Workstreams">
            Go to Workstreams
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {!filtered.length ? (
        <Card className="p-6 text-sm text-slate-500">No skills match this search.</Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtered.map((playbook) => {
            const required = playbook.contract.requiredSystems;
            const available = required.filter((systemId) => connected.has(systemId));
            const missing = required.filter((systemId) => !connected.has(systemId));
            const keyOutput = playbook.contract.deliverables[0] ?? "Defined in requirements";
            const moreOutputs = Math.max(0, playbook.contract.deliverables.length - 1);
            const note = additionalInputNote(playbook);
            return (
              <Card key={playbook.id} className="p-4" data-testid={`skill-card-${playbook.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{formatWorkstream(playbook.workstream)}</p>
                    <h2 className="mt-1 text-base font-semibold text-slate-900">{playbook.title}</h2>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    Available {available.length}/{required.length}
                  </div>
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-600">{playbook.description}</p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Key output</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{keyOutput}</p>
                    {moreOutputs > 0 && <p className="mt-1 text-xs text-slate-500">+{moreOutputs} more deliverable{moreOutputs === 1 ? "" : "s"}</p>}
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sources</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{missing.length ? `Connect ${missing.length} source${missing.length === 1 ? "" : "s"}` : "Sources connected"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {missing.length ? "Connect missing inputs before agents can use this skill." : "All required sources are available."}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-xs leading-6 text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-700">Connected inputs:</span>{" "}
                    {available.length
                      ? available.map((systemId) => sourceLabel(playbook, systemId, hasTranscriptSkill)).join(", ")
                      : "None"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Missing inputs:</span>{" "}
                    {missing.length
                      ? missing.map((systemId) => sourceLabel(playbook, systemId, hasTranscriptSkill)).join(", ")
                      : "None"}
                  </p>
                  {note && (
                    <p>
                      <span className="font-semibold text-slate-700">Extra input:</span> {note}
                    </p>
                  )}
                </div>

                <details className="mt-4 rounded-xl border border-[var(--border)] p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">View requirements</summary>
                  <div className="mt-3 space-y-4 text-sm text-slate-600">
                    <div>
                      <h3 className="font-semibold text-slate-900">Deliverables</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {playbook.contract.deliverables.map((deliverable) => <li key={deliverable}>{deliverable}</li>)}
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">Required inputs</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {required.map((systemId) => <li key={`${playbook.id}-${systemId}`}>{sourceLabel(playbook, systemId, hasTranscriptSkill)}</li>)}
                      </ul>
                      {note && <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p>}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">Acceptance checks</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {playbook.contract.acceptanceCriteria.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                    {playbook.contract.requiresHumanApproval && <p className="text-xs font-medium text-slate-700">Human review is required before completion.</p>}
                  </div>
                </details>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

function sourceLabel(playbook: Playbook, systemId: SystemId, hasTranscriptSkill: boolean) {
  if (systemId === "gmail" && hasTranscriptSkill && playbook.id === "team-assessment") {
    return `${systemInfo.gmail.name} task evidence`;
  }
  return systemInfo[systemId].name;
}

function additionalInputNote(playbook: Playbook) {
  if (playbook.id === "team-assessment") {
    return "Attach meeting transcripts or assessment notes to the task in Workstreams. A Gmail connection alone does not provide team evidence.";
  }
  return "";
}

function formatWorkstream(workstream: string) {
  return workstream
    .split("-")
    .map((part) => part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : part)
    .join(" ");
}
