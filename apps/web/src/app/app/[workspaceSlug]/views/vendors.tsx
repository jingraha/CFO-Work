"use client";

import type { Vendor } from "@cfo/domain";
import { Button, Card } from "@cfo/ui";
import {
  ArrowUpRight,
  Check,
  Download,
  ExternalLink,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  X,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { downloadCsv } from "@/lib/download";
import type {
  VendorEvaluationView,
  WorkspaceViewData,
} from "@/lib/workspace-data";
import { saveVendorAction } from "../../actions";

const scoreCriteria = [
  ["workflowFit", "Workflow fit"],
  ["integration", "Integration"],
  ["security", "Security"],
  ["implementation", "Implementation"],
  ["economics", "Economics"],
] as const;

type Props = {
  data: WorkspaceViewData;
  vendors: Vendor[];
};

export function VendorsView({ data, vendors }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [evaluations, setEvaluations] = useState(data.vendorEvaluations);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const categories = useMemo(
    () => [...new Set(vendors.map((vendor) => vendor.category))].sort(),
    [vendors],
  );
  const visible = useMemo(
    () =>
      vendors.filter(
        (vendor) =>
          (category === "all" || vendor.category === category) &&
          `${vendor.name} ${vendor.category} ${vendor.description} ${vendor.strengths.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [category, query, vendors],
  );
  const compareVendors = vendors.filter((vendor) => compareIds.has(vendor.id));
  const editingVendor = vendors.find((vendor) => vendor.id === editingId);

  function evaluationFor(vendorId: string) {
    return evaluations.find((evaluation) => evaluation.vendorId === vendorId);
  }

  function updateEvaluation(next: VendorEvaluationView) {
    setEvaluations((current) => [
      ...current.filter(
        (evaluation) => evaluation.vendorId !== next.vendorId,
      ),
      next,
    ]);
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--blue-soft)] text-sky-700">
              <Store size={19} />
            </span>
            <div>
              <p className="eyebrow">Selection discipline</p>
              <h2 className="mt-2 text-xl font-semibold">
                Choose systems from requirements, not logos.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
                Score workflow fit, integration, security, implementation, and
                economics. Confirm current pricing, contract terms, data export,
                and offboarding directly before signing.
              </p>
            </div>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--teal-soft)] text-emerald-700">
            <ShieldCheck size={18} />
          </span>
          <div>
            <p className="text-xs font-semibold text-[var(--ink-muted)]">
              Catalog freshness
            </p>
            <strong className="mt-1 block text-lg">Source dated</strong>
            <p className="mt-0.5 text-[10px] text-[var(--ink-muted)]">
              Every record includes an official source and as-of date.
            </p>
          </div>
        </Card>
      </section>

      <Card className="p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-3 text-slate-400"
            />
            <input
              className="field h-10 min-h-10 pl-9"
              placeholder="Search vendors, strengths, and categories"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select
            className="field h-10 min-h-10 w-auto min-w-60 text-xs"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">All {categories.length} categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              downloadCsv(
                `${data.workspace.slug}-vendor-decisions.csv`,
                [
                  "Category",
                  "Vendor",
                  "Status",
                  "Decision",
                  "Notes",
                  "As of",
                  "Official URL",
                ],
                vendors.map((vendor) => {
                  const evaluation = evaluationFor(vendor.id);
                  return [
                    vendor.category,
                    vendor.name,
                    evaluation?.status ?? "not-reviewed",
                    evaluation?.decision ?? "",
                    evaluation?.notes ?? "",
                    vendor.asOfDate,
                    vendor.officialUrl,
                  ];
                }),
              )
            }
          >
            <Download size={14} /> Export
          </Button>
        </div>
      </Card>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {compareVendors.length > 0 ? (
        <Card className="overflow-hidden border-[var(--purple)]">
          <div className="flex items-center justify-between bg-[var(--purple-soft)] px-5 py-3">
            <div>
              <p className="text-xs font-semibold">
                Compare {compareVendors.length} vendors
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--ink-muted)]">
                Add up to four options from the same or adjacent category.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCompareIds(new Set())}
            >
              Clear
            </Button>
          </div>
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="w-40 p-3 text-[10px] uppercase text-[var(--ink-muted)]">
                    Criterion
                  </th>
                  {compareVendors.map((vendor) => (
                    <th key={vendor.id} className="p-3">
                      {vendor.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {scoreCriteria.map(([key, label]) => (
                  <tr key={key}>
                    <th className="p-3 font-semibold">{label}</th>
                    {compareVendors.map((vendor) => (
                      <td key={vendor.id} className="p-3">
                        <span className="font-bold text-[var(--purple)]">
                          {evaluationFor(vendor.id)?.scores[key] ?? "-"}
                        </span>
                        <span className="text-[var(--ink-muted)]"> / 5</span>
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th className="p-3 font-semibold">Implementation</th>
                  {compareVendors.map((vendor) => (
                    <td key={vendor.id} className="p-3 capitalize">
                      {vendor.implementation}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th className="p-3 font-semibold">Pricing model</th>
                  {compareVendors.map((vendor) => (
                    <td key={vendor.id} className="p-3">
                      {vendor.pricingModel}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {visible.map((vendor) => {
          const evaluation = evaluationFor(vendor.id);
          const comparing = compareIds.has(vendor.id);
          const scoreValues = Object.values(evaluation?.scores ?? {});
          const average =
            scoreValues.length > 0
              ? (
                  scoreValues.reduce((sum, score) => sum + score, 0) /
                  scoreValues.length
                ).toFixed(1)
              : null;
          return (
            <Card key={vendor.id} className="flex flex-col overflow-hidden">
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--purple)]">
                      {vendor.category}
                    </span>
                    <h3 className="mt-1 text-lg font-semibold">{vendor.name}</h3>
                  </div>
                  {average ? (
                    <span className="rounded-lg bg-[var(--purple-soft)] px-2 py-1 text-xs font-bold text-[var(--purple)]">
                      {average}/5
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 line-clamp-3 text-xs leading-5 text-[var(--ink-muted)]">
                  {vendor.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {vendor.stages.map((stage) => (
                    <span
                      key={stage}
                      className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase text-slate-500"
                    >
                      {stage.replace("-", " ")}
                    </span>
                  ))}
                  <span className="rounded-md bg-[var(--orange-soft)] px-2 py-1 text-[9px] font-bold uppercase text-orange-700">
                    {vendor.implementation} implementation
                  </span>
                </div>
                <div className="mt-4 rounded-lg bg-[var(--surface-muted)] p-3">
                  <p className="text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                    Best reasons to evaluate
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {vendor.strengths.slice(0, 2).map((strength) => (
                      <li key={strength} className="flex gap-2 text-[11px]">
                        <Check
                          size={12}
                          className="mt-0.5 shrink-0 text-emerald-600"
                        />
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-[var(--border)] p-3">
                <button
                  onClick={() =>
                    setCompareIds((current) => {
                      const next = new Set(current);
                      if (next.has(vendor.id)) next.delete(vendor.id);
                      else if (next.size < 4) next.add(vendor.id);
                      return next;
                    })
                  }
                  className={`rounded-lg border px-3 py-2 text-[10px] font-bold ${
                    comparing
                      ? "border-[var(--purple)] bg-[var(--purple-soft)] text-[var(--purple)]"
                      : "border-[var(--border)] text-slate-600"
                  }`}
                >
                  {comparing ? "Comparing" : "Compare"}
                </button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setEditingId(vendor.id)}
                >
                  <SlidersHorizontal size={13} />
                  {evaluation ? "Edit score" : "Evaluate"}
                </Button>
                <a
                  href={vendor.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-[var(--border)] p-2 text-slate-500 hover:bg-slate-50"
                  aria-label={`Open ${vendor.name} official website`}
                >
                  <ArrowUpRight size={15} />
                </a>
              </div>
              <p className="border-t border-[var(--border)] px-4 py-2 text-[9px] text-slate-400">
                As of {vendor.asOfDate} · Verify current terms directly.
              </p>
            </Card>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <Card className="p-12 text-center">
          <Store size={25} className="mx-auto text-[var(--purple)]" />
          <h3 className="mt-3 text-sm font-semibold">No vendors found</h3>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Change the category or search query.
          </p>
        </Card>
      ) : null}

      {editingVendor ? (
        <VendorEditor
          key={editingVendor.id}
          vendor={editingVendor}
          evaluation={evaluationFor(editingVendor.id)}
          workspace={data.workspace}
          onClose={() => setEditingId(null)}
          onError={setError}
          onSaved={(evaluation) => {
            updateEvaluation(evaluation);
            setEditingId(null);
          }}
        />
      ) : null}
    </div>
  );
}

function VendorEditor({
  vendor,
  evaluation,
  workspace,
  onClose,
  onError,
  onSaved,
}: {
  vendor: Vendor;
  evaluation: VendorEvaluationView | undefined;
  workspace: WorkspaceViewData["workspace"];
  onClose: () => void;
  onError: (message: string) => void;
  onSaved: (evaluation: VendorEvaluationView) => void;
}) {
  const [status, setStatus] = useState(evaluation?.status ?? "evaluating");
  const [scores, setScores] = useState<Record<string, number>>(
    evaluation?.scores ?? {
      workflowFit: 3,
      integration: 3,
      security: 3,
      implementation: 3,
      economics: 3,
    },
  );
  const [notes, setNotes] = useState(evaluation?.notes ?? "");
  const [decision, setDecision] = useState(evaluation?.decision ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    onError("");
    startTransition(async () => {
      try {
        await saveVendorAction({
          workspaceSlug: workspace.slug,
          workspaceId: workspace.id,
          vendorId: vendor.id,
          status,
          scores,
          notes,
          decision,
        });
        onSaved({
          id: evaluation?.id ?? `local-${vendor.id}`,
          workspaceId: workspace.id,
          vendorId: vendor.id,
          status,
          ownerId: evaluation?.ownerId ?? null,
          scores,
          notes,
          evidenceLink: evaluation?.evidenceLink ?? null,
          decision,
          updatedAt: new Date().toISOString(),
        });
      } catch (cause) {
        onError(
          cause instanceof Error
            ? cause.message
            : "The vendor evaluation could not be saved.",
        );
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        className="absolute inset-0 bg-slate-950/45"
        onClick={onClose}
        aria-label="Close vendor evaluation"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="vendor-editor-title"
        className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start gap-4 border-b border-[var(--border)] p-5">
          <div className="flex-1">
            <p className="eyebrow">{vendor.category}</p>
            <h2
              id="vendor-editor-title"
              className="mt-2 text-xl font-semibold"
            >
              Evaluate {vendor.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </header>

        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-[var(--teal-soft)] p-4">
              <p className="text-[10px] font-bold uppercase text-emerald-800">
                Strengths
              </p>
              <ul className="mt-2 space-y-2">
                {vendor.strengths.map((item) => (
                  <li key={item} className="text-xs leading-5">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-[var(--orange-soft)] p-4">
              <p className="text-[10px] font-bold uppercase text-orange-800">
                Watchouts
              </p>
              <ul className="mt-2 space-y-2">
                {vendor.watchouts.map((item) => (
                  <li key={item} className="text-xs leading-5">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <label className="mt-5 block">
            <span className="label">Decision status</span>
            <select
              className="field"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="researching">Researching</option>
              <option value="evaluating">Evaluating</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="selected">Selected</option>
              <option value="rejected">Rejected</option>
              <option value="incumbent">Incumbent</option>
            </select>
          </label>

          <div className="mt-5 space-y-4">
            {scoreCriteria.map(([key, label]) => (
              <label key={key} className="block">
                <span className="mb-2 flex items-center justify-between text-xs font-semibold">
                  {label}
                  <strong className="text-[var(--purple)]">
                    {scores[key] ?? 3}/5
                  </strong>
                </span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  className="w-full accent-[var(--purple)]"
                  value={scores[key] ?? 3}
                  onChange={(event) =>
                    setScores({
                      ...scores,
                      [key]: Number(event.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>

          <label className="mt-5 block">
            <span className="label">Decision and rationale</span>
            <textarea
              className="field min-h-24 resize-y"
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
              placeholder="Record the recommendation, decision owner, and tradeoffs."
            />
          </label>
          <label className="mt-4 block">
            <span className="label">Diligence notes</span>
            <textarea
              className="field min-h-24 resize-y"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Security, implementation, integration, contract, and offboarding notes."
            />
          </label>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] p-4">
              <p className="text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                Security diligence
              </p>
              <ul className="mt-2 space-y-2 text-xs leading-5">
                {vendor.securityDiligence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4">
              <p className="text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                Export and offboarding
              </p>
              <ul className="mt-2 space-y-2 text-xs leading-5">
                {vendor.exportOffboarding.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <a
            href={vendor.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[var(--purple)] hover:underline"
          >
            <ExternalLink size={13} /> Official source used for this record
          </a>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--border)] p-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving..." : "Save evaluation"}
          </Button>
        </footer>
      </section>
    </div>
  );
}
