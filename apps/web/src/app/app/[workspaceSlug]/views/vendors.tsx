"use client";

import type { Vendor } from "@cfo/domain";
import { Button, Card, cn } from "@cfo/ui";
import {
  ArrowUpRight,
  Check,
  Download,
  ExternalLink,
  RotateCcw,
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
import {
  AI_NATIVE_DEFINITION,
  buildVendorShortlist,
  getAiNativeVendorMetadata,
  getImplementationStyle,
  isVendorAiNative,
} from "./vendor-fit";

const scoreCriteria = [
  ["workflowFit", "Workflow fit"],
  ["integration", "Integration"],
  ["security", "Security"],
  ["implementation", "Implementation"],
  ["economics", "Economics"],
] as const;

const evaluationStatusStyles = {
  researching: {
    className: "border-slate-200 bg-slate-50 text-slate-600",
    label: "Researching",
  },
  evaluating: {
    className: "border-blue-200 bg-blue-50 text-blue-700",
    label: "Evaluating",
  },
  shortlisted: {
    className:
      "border-purple-200 bg-[var(--purple-soft)] text-[var(--purple)]",
    label: "Shortlisted",
  },
  selected: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    label: "Selected",
  },
  rejected: {
    className: "border-red-200 bg-red-50 text-red-700",
    label: "Rejected",
  },
  incumbent: {
    className: "border-amber-200 bg-amber-50 text-amber-700",
    label: "Incumbent",
  },
} satisfies Record<
  VendorEvaluationView["status"],
  { className: string; label: string }
>;

type Props = {
  data: WorkspaceViewData;
  vendors: Vendor[];
};

export function VendorsView({ data, vendors }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [aiNativeOnly, setAiNativeOnly] = useState(false);
  const [evaluations, setEvaluations] = useState(data.vendorEvaluations);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const categories = useMemo(
    () => [...new Set(vendors.map((vendor) => vendor.category))].sort(),
    [vendors],
  );
  const evaluationsByVendorId = useMemo(
    () =>
      new Map(
        evaluations.map((evaluation) => [evaluation.vendorId, evaluation]),
      ),
    [evaluations],
  );
  const categoryScopedVendors = useMemo(
    () =>
      vendors.filter(
        (vendor) => category === "all" || vendor.category === category,
      ),
    [category, vendors],
  );
  const scopedVendors = useMemo(
    () =>
      categoryScopedVendors.filter(
        (vendor) => !aiNativeOnly || isVendorAiNative(vendor.id),
      ),
    [aiNativeOnly, categoryScopedVendors],
  );
  const shortlist = useMemo(
    () =>
      buildVendorShortlist({
        profile: data.profile ?? null,
        selectedCategory: category,
        vendors: scopedVendors,
      }),
    [category, data.profile, scopedVendors],
  );
  const recommendationsByVendorId = useMemo(
    () =>
      new Map(
        shortlist.recommendations.map((item, index) => [
          item.vendorId,
          { ...item, order: index },
        ]),
      ),
    [shortlist.recommendations],
  );
  const visible = useMemo(() => {
    const loweredQuery = query.trim().toLowerCase();

    return [...scopedVendors]
      .filter((vendor) => {
        if (!loweredQuery) return true;
        return `${vendor.name} ${vendor.category} ${vendor.description} ${vendor.strengths.join(" ")} ${vendor.watchouts.join(" ")} ${vendor.integrations.join(" ")}`
          .toLowerCase()
          .includes(loweredQuery);
      })
      .sort((left, right) => {
        const leftOrder =
          recommendationsByVendorId.get(left.id)?.order ??
          Number.MAX_SAFE_INTEGER;
        const rightOrder =
          recommendationsByVendorId.get(right.id)?.order ??
          Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;

        const leftEvaluated = evaluationsByVendorId.has(left.id);
        const rightEvaluated = evaluationsByVendorId.has(right.id);
        if (leftEvaluated !== rightEvaluated) return leftEvaluated ? -1 : 1;

        return left.name.localeCompare(right.name);
      });
  }, [evaluationsByVendorId, query, recommendationsByVendorId, scopedVendors]);
  const compareVendors = vendors.filter((vendor) => compareIds.has(vendor.id));
  const editingVendor = vendors.find((vendor) => vendor.id === editingId);
  const hasActiveFilters =
    category !== "all" || aiNativeOnly || query.trim().length > 0;
  const aiNativeCount = categoryScopedVendors.filter((vendor) =>
    isVendorAiNative(vendor.id),
  ).length;

  function evaluationFor(vendorId: string) {
    return evaluationsByVendorId.get(vendorId);
  }

  function updateEvaluation(next: VendorEvaluationView) {
    setEvaluations((current) => [
      ...current.filter((evaluation) => evaluation.vendorId !== next.vendorId),
      next,
    ]);
  }

  function resetFilters() {
    setQuery("");
    setCategory("all");
    setAiNativeOnly(false);
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <Card className="p-5">
          <p className="eyebrow">Tailored shortlist</p>
          <h2 className="mt-2 text-lg font-semibold">{shortlist.title}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
            {shortlist.summary}
          </p>

          {shortlist.recommendations.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {shortlist.recommendations.map((item) => (
                <article
                  key={`${item.category}-${item.vendorId}`}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--purple)]">
                        {item.category}
                      </p>
                      <h3 className="mt-1 text-sm font-semibold">
                        {item.vendorName}
                      </h3>
                    </div>
                    <span className="rounded-full bg-[var(--purple-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--purple)]">
                      {item.label}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {item.reasons.slice(0, 1).map((reason) => (
                      <li key={reason} className="flex gap-2 text-xs leading-5">
                        <Check
                          size={12}
                          className="mt-1 shrink-0 text-emerald-600"
                        />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                  <details className="mt-3 text-[11px] leading-5 text-[var(--ink-muted)]">
                    <summary className="cursor-pointer font-semibold text-purple-700">Why this fit?</summary>
                    {item.reasons.slice(1).map((reason) => <p key={reason} className="mt-2">{reason}</p>)}
                    <p className="mt-2">
                    <span className="font-semibold text-slate-700">
                      Tradeoff:
                    </span>{" "}
                    {item.tradeoff}
                    </p>
                  </details>
                </article>
              ))}
            </div>
          ) : data.profile ? (
            <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <p className="text-sm font-semibold">No suitable fit</p>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                {shortlist.emptyMessage}
              </p>
            </div>
          ) : null}
        </Card>

        <details className="rounded-xl border border-[var(--border)] bg-white p-4">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--ink-muted)]">How recommendations are made</summary>
          {shortlist.criteria.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {shortlist.criteria.map((criterion) => (
                <span
                  key={criterion}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600"
                >
                  {criterion}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">
              Add stage, entity count, current ledger, close days, and finance
              coverage in Settings to unlock company-specific recommendations.
            </p>
          )}

          <p className="mt-4 text-xs leading-5 text-[var(--ink-muted)]">
            Suggestions are directional only. They do not override your saved
            evaluation, compare table, or final selection.
          </p>
          <div className="mt-4 rounded-xl bg-[var(--surface-muted)] p-3">
            <div className="flex gap-2">
              <ShieldCheck
                size={14}
                className="mt-0.5 shrink-0 text-emerald-700"
              />
              <div className="space-y-1 text-[11px] leading-5 text-[var(--ink-muted)]">
                <p>
                  Catalog entries stay source-dated against official vendor
                  pages.
                </p>
                <p>
                  AI-native pills only appear when official product pages
                  clearly position the core product around AI. AI-enabled
                  incumbents are not marked by default.
                </p>
              </div>
            </div>
          </div>
        </details>
      </section>

      <Card className="p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_auto_auto_auto] xl:items-end">
          <label>
            <span className="mb-1 block text-xs font-semibold text-[var(--ink-muted)]">
              Search
            </span>
            <span className="relative block">
              <Search
                size={14}
                className="absolute left-3 top-3 text-slate-400"
              />
              <input
                aria-label="Search vendors"
                className="field h-10 min-h-10 pl-9"
                style={{ paddingLeft: 36 }}
                placeholder="Search vendors, strengths, and categories"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </span>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold text-[var(--ink-muted)]">
              Category
            </span>
            <select
              aria-label="Filter vendors by category"
              className="field h-10 min-h-10 w-full text-xs"
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
          </label>

          <label className="flex h-10 min-w-44 items-center gap-2 rounded-xl border border-[var(--border)] px-3">
            <input
              aria-describedby="vendor-ai-native-note"
              checked={aiNativeOnly}
              className="accent-[var(--purple)]"
              type="checkbox"
              onChange={(event) => setAiNativeOnly(event.target.checked)}
            />
            <span className="text-xs font-semibold">AI-native only</span>
            <span className="text-[10px] text-[var(--ink-muted)]">
              ({aiNativeCount})
            </span>
          </label>

          <Button
            disabled={!hasActiveFilters}
            size="sm"
            variant="ghost"
            onClick={resetFilters}
          >
            <RotateCcw size={14} /> Reset filters
          </Button>

          <Button
            size="sm"
            variant="secondary"
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

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-muted)]">
          <strong className="text-slate-700">
            Showing {visible.length} of {scopedVendors.length} vendors
          </strong>
          <span aria-hidden="true">·</span>
          <span>{aiNativeCount} AI-native in this category scope</span>
        </div>
        <p
          id="vendor-ai-native-note"
          className="mt-2 text-[10px] leading-5 text-[var(--ink-muted)]"
        >
          {AI_NATIVE_DEFINITION}
        </p>
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
                Compare {compareVendors.length} vendor{compareVendors.length === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--ink-muted)]">
                Add up to four options from the same or adjacent category.
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
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
                    <td key={vendor.id} className="p-3">
                      <ImplementationPill implementation={vendor.implementation} />
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

      <section aria-labelledby="vendor-results-title" className="space-y-3">
        <div>
          <h2 id="vendor-results-title" className="text-sm font-semibold">
            Vendor catalog
          </h2>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Recommendations help with scanning. Your evaluation remains the
            source of truth.
          </p>
        </div>

        {visible.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {visible.map((vendor) => {
              const aiNativeMetadata = getAiNativeVendorMetadata(vendor.id);
              const evaluation = evaluationFor(vendor.id);
              const recommendation = recommendationsByVendorId.get(vendor.id);
              const comparing = compareIds.has(vendor.id);
              const compareDisabled = !comparing && compareIds.size >= 4;

              return (
                <Card key={vendor.id} className="flex flex-col overflow-hidden" data-testid={`vendor-${vendor.id}`}>
                  <div className="flex-1 p-4">
                    <div className="flex flex-wrap gap-1.5">
                      {recommendation ? (
                        <span className="rounded-full bg-[var(--purple-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--purple)]">
                          {recommendation.label}
                        </span>
                      ) : null}
                      {aiNativeMetadata ? (
                        <a
                          aria-label={`${vendor.name} is marked AI-native. ${AI_NATIVE_DEFINITION} Source: ${aiNativeMetadata.evidence}`}
                          className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold text-sky-700 hover:bg-sky-100"
                          href={aiNativeMetadata.sourceUrl}
                          rel="noreferrer"
                          target="_blank"
                          title={`${AI_NATIVE_DEFINITION} Source: ${aiNativeMetadata.evidence}`}
                        >
                          AI-native
                        </a>
                      ) : null}
                      {evaluation ? (
                        <EvaluationStatusPill status={evaluation.status} />
                      ) : null}
                    </div>

                    <div className="mt-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--purple)]">
                        {vendor.category}
                      </p>
                      <h3 className="mt-1 text-base font-semibold">
                        {vendor.name}
                      </h3>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[var(--ink-muted)]">
                      {vendor.description}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      <ImplementationPill implementation={vendor.implementation} />
                      {vendor.stages.map((stage) => (
                        <span
                          key={stage}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600"
                        >
                          {formatStage(stage)}
                        </span>
                      ))}
                    </div>

                    <details className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                        View reasons, watchouts, and pricing
                      </summary>
                      <div className="mt-3 space-y-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                            Reasons to evaluate
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {vendor.strengths.slice(0, 2).map((strength) => (
                              <li
                                key={strength}
                                className="flex gap-2 text-xs leading-5"
                              >
                                <Check
                                  size={12}
                                  className="mt-1 shrink-0 text-emerald-600"
                                />
                                <span>{strength}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                            Primary tradeoff
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                            {vendor.watchouts[0]}
                          </p>
                        </div>

                        {vendor.integrations.length > 0 ? (
                          <div>
                            <p className="text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                              Integrations
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {vendor.integrations.slice(0, 4).map((integration) => (
                                <span
                                  key={integration}
                                  className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600"
                                >
                                  {integration}
                                </span>
                              ))}
                              {vendor.integrations.length > 4 ? (
                                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                                  +{vendor.integrations.length - 4} more
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        <div>
                          <p className="text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                            Pricing model
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-700">
                            {vendor.pricingModel}
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-[var(--ink-muted)]">
                            {vendor.pricingNote}
                          </p>
                        </div>

                        <a
                          className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--purple)] hover:underline"
                          href={vendor.sourceUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <ExternalLink size={13} /> Official source for this
                          record
                        </a>
                      </div>
                    </details>
                  </div>

                  <div className="flex items-center gap-2 border-t border-[var(--border)] p-3">
                    <button
                      aria-label={
                        comparing
                          ? `Remove ${vendor.name} from compare`
                          : `Add ${vendor.name} to compare`
                      }
                      aria-pressed={comparing}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50",
                        comparing
                          ? "border-[var(--purple)] bg-[var(--purple-soft)] text-[var(--purple)]"
                          : "border-[var(--border)] text-slate-600",
                      )}
                      disabled={compareDisabled}
                      type="button"
                      onClick={() =>
                        setCompareIds((current) => {
                          const next = new Set(current);
                          if (next.has(vendor.id)) next.delete(vendor.id);
                          else if (next.size < 4) next.add(vendor.id);
                          return next;
                        })
                      }
                    >
                      {comparing
                        ? "Comparing"
                        : compareDisabled
                          ? "Compare (max 4)"
                          : "Compare"}
                    </button>
                    <Button
                      className="flex-1"
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditingId(vendor.id)}
                    >
                      <SlidersHorizontal size={13} />
                      {evaluation ? "Edit evaluation" : "Evaluate"}
                    </Button>
                    <a
                      aria-label={`Open ${vendor.name} official website`}
                      className="rounded-lg border border-[var(--border)] p-2 text-slate-500 hover:bg-slate-50"
                      href={vendor.officialUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ArrowUpRight size={15} />
                    </a>
                  </div>
                  <p className="border-t border-[var(--border)] px-4 py-2 text-[10px] text-slate-400">
                    As of {vendor.asOfDate} · Verify current terms directly.
                  </p>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Store size={25} className="mx-auto text-[var(--purple)]" />
            <h3 className="mt-3 text-sm font-semibold">No vendors found</h3>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              Try a different search, category, or filter.
            </p>
            {hasActiveFilters ? (
              <div className="mt-4">
                <Button size="sm" variant="ghost" onClick={resetFilters}>
                  <RotateCcw size={14} /> Reset filters
                </Button>
              </div>
            ) : null}
          </Card>
        )}
      </section>

      {editingVendor ? (
        <VendorEditor
          key={editingVendor.id}
          evaluation={evaluationFor(editingVendor.id)}
          onClose={() => setEditingId(null)}
          onError={setError}
          onSaved={(evaluation) => {
            updateEvaluation(evaluation);
            setEditingId(null);
          }}
          vendor={editingVendor}
          workspace={data.workspace}
        />
      ) : null}
    </div>
  );
}

function EvaluationStatusPill({
  status,
}: {
  status: VendorEvaluationView["status"];
}) {
  const style = evaluationStatusStyles[
    status as keyof typeof evaluationStatusStyles
  ];

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold",
        style.className,
      )}
    >
      Saved: {style.label}
    </span>
  );
}

function ImplementationPill({
  implementation,
}: {
  implementation: Vendor["implementation"];
}) {
  const style = getImplementationStyle(implementation);

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold",
        style.className,
      )}
    >
      {style.label}
    </span>
  );
}

function formatStage(stage: Vendor["stages"][number]) {
  return stage === "series-b" ? "Series B" : "Series C";
}

function VendorEditor({
  vendor,
  evaluation,
  workspace,
  onClose,
  onError,
  onSaved,
}: {
  evaluation: VendorEvaluationView | undefined;
  onClose: () => void;
  onError: (message: string) => void;
  onSaved: (evaluation: VendorEvaluationView) => void;
  vendor: Vendor;
  workspace: WorkspaceViewData["workspace"];
}) {
  const [status, setStatus] = useState(evaluation?.status ?? "evaluating");
  const [scores, setScores] = useState<Record<string, number>>(
    evaluation?.scores ?? {
      economics: 3,
      implementation: 3,
      integration: 3,
      security: 3,
      workflowFit: 3,
    },
  );
  const [notes, setNotes] = useState(evaluation?.notes ?? "");
  const [decision, setDecision] = useState(evaluation?.decision ?? "");
  const [pending, startTransition] = useTransition();
  const aiNativeMetadata = getAiNativeVendorMetadata(vendor.id);

  function save() {
    onError("");
    startTransition(async () => {
      try {
        await saveVendorAction({
          decision,
          notes,
          scores,
          status,
          vendorId: vendor.id,
          workspaceId: workspace.id,
          workspaceSlug: workspace.slug,
        });
        onSaved({
          decision,
          evidenceLink: evaluation?.evidenceLink ?? null,
          id: evaluation?.id ?? `local-${vendor.id}`,
          notes,
          ownerId: evaluation?.ownerId ?? null,
          scores,
          status,
          updatedAt: new Date().toISOString(),
          vendorId: vendor.id,
          workspaceId: workspace.id,
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
        aria-label="Close vendor evaluation"
        className="absolute inset-0 bg-slate-950/45"
        type="button"
        onClick={onClose}
      />
      <section
        aria-labelledby="vendor-editor-title"
        aria-modal="true"
        className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        role="dialog"
      >
        <header className="flex items-start gap-4 border-b border-[var(--border)] p-5">
          <div className="flex-1">
            <p className="eyebrow">{vendor.category}</p>
            <h2 id="vendor-editor-title" className="mt-2 text-xl font-semibold">
              Evaluate {vendor.name}
            </h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <ImplementationPill implementation={vendor.implementation} />
              {aiNativeMetadata ? (
                <a
                  className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold text-sky-700 hover:bg-sky-100"
                  href={aiNativeMetadata.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                  title={`${AI_NATIVE_DEFINITION} Source: ${aiNativeMetadata.evidence}`}
                >
                  AI-native
                </a>
              ) : null}
            </div>
          </div>
          <button
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
            type="button"
            onClick={onClose}
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
                  className="w-full accent-[var(--purple)]"
                  max="5"
                  min="1"
                  step="1"
                  type="range"
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
              placeholder="Record the recommendation, owner, and tradeoffs."
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
            />
          </label>
          <label className="mt-4 block">
            <span className="label">Diligence notes</span>
            <textarea
              className="field min-h-24 resize-y"
              placeholder="Security, implementation, integration, contract, and offboarding notes."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
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
            className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[var(--purple)] hover:underline"
            href={vendor.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink size={13} /> Official source used for this record
          </a>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--border)] p-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={save}>
            {pending ? "Saving..." : "Save evaluation"}
          </Button>
        </footer>
      </section>
    </div>
  );
}
