"use client";

import type { HiringRole } from "@cfo/domain";
import { can } from "@cfo/domain";
import { Button, Card } from "@cfo/ui";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Target,
  Users,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { downloadCsv } from "@/lib/download";
import type {
  HiringPlanView,
  WorkspaceViewData,
} from "@/lib/workspace-data";
import { saveHiringAction } from "../../actions";

type Props = {
  data: WorkspaceViewData;
  roles: HiringRole[];
  currentUserId: string;
};

export function HiringView({ data, roles }: Props) {
  const [plans, setPlans] = useState(data.hiringPlans);
  const [expanded, setExpanded] = useState<string | null>(roles[0]?.id ?? null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState("");
  const editable = can(data.workspace.role, "hiring:edit");
  const recommendedIds = useMemo(
    () => new Set(plans.map((plan) => plan.roleId)),
    [plans],
  );
  const sorted = [...roles].sort((left, right) => left.sequence - right.sequence);

  function saveRole(
    role: HiringRole,
    patch: Partial<Pick<HiringPlanView, "status" | "targetDate" | "notes">>,
  ) {
    const previousPlans = plans;
    const existing = plans.find((plan) => plan.roleId === role.id);
    const next = {
      id: existing?.id ?? `local-${role.id}`,
      workspaceId: data.workspace.id,
      roleId: role.id,
      status: patch.status ?? existing?.status ?? "recommended",
      targetDate:
        patch.targetDate === undefined
          ? (existing?.targetDate ?? null)
          : patch.targetDate,
      ownerId: existing?.ownerId ?? null,
      notes: patch.notes ?? existing?.notes ?? "",
      updatedAt: new Date().toISOString(),
    };
    setPlans((current) => [
      ...current.filter((plan) => plan.roleId !== role.id),
      next,
    ]);
    setPendingId(role.id);
    startTransition(async () => {
      setError("");
      try {
        await saveHiringAction({
          workspaceSlug: data.workspace.slug,
          workspaceId: data.workspace.id,
          roleId: role.id,
          status: next.status,
          targetDate: next.targetDate,
          notes: next.notes,
        });
      } catch (cause) {
        setPlans(previousPlans);
        setError(
          cause instanceof Error
            ? cause.message
            : "The hiring plan could not be saved.",
        );
      } finally {
        setPendingId(null);
      }
    });
  }

  const activeRecommendations = sorted.filter((role) =>
    recommendedIds.has(role.id),
  );

  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <div className="bg-[var(--ink)] p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--orange)]">
              Default sequence
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              Controller first. Planning capacity second.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Hiring recommendations are driven by close quality, audit timing,
              transaction load, board demands, and international complexity.
              Specialist tax, audit, 409A, and treasury work stays fractional
              until its trigger is reached.
            </p>
          </div>
          <div className="scrollbar-thin overflow-x-auto p-5">
            <div className="flex min-w-[780px] items-center">
              {activeRecommendations.slice(0, 6).map((role, index) => (
                <div key={role.id} className="flex flex-1 items-center">
                  <button
                    onClick={() => setExpanded(role.id)}
                    className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-white p-3 text-left hover:border-[var(--purple)]"
                  >
                    <span className="text-[9px] font-bold uppercase text-[var(--purple)]">
                      Step {index + 1}
                    </span>
                    <strong className="mt-1 block truncate text-xs">
                      {role.title}
                    </strong>
                    <span className="mt-1 block text-[9px] uppercase text-[var(--ink-muted)]">
                      {role.defaultEmploymentModel.replace("-", " ")}
                    </span>
                  </button>
                  {index < activeRecommendations.slice(0, 6).length - 1 ? (
                    <ArrowRight
                      size={15}
                      className="mx-2 shrink-0 text-slate-300"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--orange-soft)] text-orange-700">
            <Users size={18} />
          </span>
          <p className="mt-4 text-xs font-semibold text-[var(--ink-muted)]">
            Recommended now
          </p>
          <strong className="mt-1 block text-3xl">
            {activeRecommendations.length}
          </strong>
          <p className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
            {plans.filter((plan) => plan.status === "filled").length} filled ·{" "}
            {plans.filter((plan) => plan.status === "interviewing").length} in
            interview
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-5 w-full"
            onClick={() =>
              downloadCsv(
                `${data.workspace.slug}-finance-hiring-plan.csv`,
                [
                  "Sequence",
                  "Role",
                  "Employment model",
                  "Status",
                  "Target date",
                  "Trigger",
                ],
                sorted.map((role) => {
                  const plan = plans.find((item) => item.roleId === role.id);
                  return [
                    role.sequence,
                    role.title,
                    role.defaultEmploymentModel,
                    plan?.status ?? "not-triggered",
                    plan?.targetDate ?? "",
                    role.triggerSummary,
                  ];
                }),
              )
            }
          >
            <Download size={14} /> Export hiring plan
          </Button>
        </Card>
      </section>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <p className="eyebrow">Role library</p>
            <h3 className="mt-1 font-semibold">Trigger-based finance org</h3>
          </div>
          <span className="text-xs text-[var(--ink-muted)]">
            {roles.length} capabilities
          </span>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {sorted.map((role) => {
            const plan = plans.find((item) => item.roleId === role.id);
            const isRecommended = recommendedIds.has(role.id);
            const isExpanded = expanded === role.id;
            return (
              <section key={role.id}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : role.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50"
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      isRecommended
                        ? "bg-[var(--purple-soft)] text-[var(--purple)]"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <BriefcaseBusiness size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm">
                        {role.sequence}. {role.title}
                      </strong>
                      <span
                        className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${
                          isRecommended
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {isRecommended ? "Recommended" : "Later trigger"}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--ink-muted)]">
                      {role.triggerSummary}
                    </p>
                  </div>
                  <span className="hidden rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold uppercase text-slate-500 sm:block">
                    {role.defaultEmploymentModel.replace("-", " ")}
                  </span>
                  {isExpanded ? (
                    <ChevronUp size={16} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={16} className="text-slate-400" />
                  )}
                </button>

                {isExpanded ? (
                  <div className="border-t border-[var(--border)] bg-[var(--surface-muted)] p-5">
                    <div className="grid gap-5 xl:grid-cols-[1fr_1fr_280px]">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
                          Outcomes
                        </p>
                        <ul className="mt-3 space-y-2">
                          {role.outcomes.map((outcome) => (
                            <li
                              key={outcome}
                              className="flex gap-2 text-xs leading-5"
                            >
                              <Check
                                size={13}
                                className="mt-0.5 shrink-0 text-emerald-600"
                              />
                              {outcome}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
                          Success scorecard
                        </p>
                        <ul className="mt-3 space-y-2">
                          {role.scorecard.map((item) => (
                            <li
                              key={item}
                              className="flex gap-2 text-xs leading-5"
                            >
                              <Target
                                size={13}
                                className="mt-0.5 shrink-0 text-[var(--purple)]"
                              />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
                          Interview prompts
                        </p>
                        <ol className="mt-3 space-y-3">
                          {role.interviewQuestions.map((question, index) => (
                            <li
                              key={question}
                              className="flex gap-3 text-xs leading-5"
                            >
                              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[9px] font-bold text-[var(--purple)]">
                                {index + 1}
                              </span>
                              {question}
                            </li>
                          ))}
                        </ol>
                      </div>
                      <div className="rounded-xl border border-[var(--border)] bg-white p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">
                          Workspace plan
                        </p>
                        <label className="mt-3 block">
                          <span className="label">Status</span>
                          <select
                            className="field"
                            value={plan?.status ?? "not-triggered"}
                            disabled={!editable}
                            onChange={(event) =>
                              saveRole(role, { status: event.target.value })
                            }
                          >
                            <option value="not-triggered">Not triggered</option>
                            <option value="recommended">Recommended</option>
                            <option value="approved">Approved</option>
                            <option value="search-open">Search open</option>
                            <option value="interviewing">Interviewing</option>
                            <option value="offer">Offer</option>
                            <option value="filled">Filled</option>
                            <option value="outsourced">Outsourced</option>
                            <option value="not-needed">Not needed</option>
                          </select>
                        </label>
                        <label className="mt-3 block">
                          <span className="label">Target date</span>
                          <input
                            type="date"
                            className="field"
                            value={plan?.targetDate ?? ""}
                            disabled={!editable}
                            onChange={(event) =>
                              saveRole(role, {
                                targetDate: event.target.value || null,
                              })
                            }
                          />
                        </label>
                        <label className="mt-3 block">
                          <span className="label">Notes</span>
                          <textarea
                            className="field min-h-24 resize-y"
                            defaultValue={plan?.notes ?? ""}
                            disabled={!editable}
                            onBlur={(event) =>
                              saveRole(role, { notes: event.target.value })
                            }
                          />
                        </label>
                        {pendingId === role.id ? (
                          <p className="mt-2 text-[10px] text-[var(--purple)]">
                            Saving...
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
