"use client";

import { localDateString } from "@cfo/domain";
import type { BusinessModel, CompanyProfile } from "@cfo/domain";
import { Button, Card } from "@cfo/ui";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createWorkspaceAction } from "../actions";

const modelOptions: Array<{
  id: BusinessModel;
  title: string;
  description: string;
}> = [
  {
    id: "b2b-saas-usage",
    title: "B2B SaaS + usage",
    description: "Subscription ARR with usage or overage revenue.",
  },
  {
    id: "ai-infrastructure",
    title: "AI API / infrastructure",
    description: "Token, request, compute, storage, or platform volume.",
  },
  {
    id: "consumer-subscription",
    title: "Consumer subscription",
    description: "Free-to-paid funnels, cohorts, retention, and ARPU.",
  },
  {
    id: "ai-enabled-services",
    title: "AI-enabled services",
    description: "People-led delivery with AI productivity and tooling.",
  },
];

const initialProfile: CompanyProfile = {
  name: "",
  stage: "series-b",
  startDate: localDateString(new Date()),
  fiscalYearEndMonth: 12,
  businessModels: ["b2b-saas-usage"] as BusinessModel[],
  annualRevenueMillions: 10,
  arrMillions: 12,
  cashRunwayMonths: 18,
  employeeCount: 80,
  entityCount: 1,
  countries: ["US"],
  internationalEmployees: false,
  closeDays: 15,
  auditStatus: "planning",
  auditDueDate: null,
  fundraiseDate: null,
  nextBoardDate: null,
  accountingSystem: "quickbooks",
  billingModel: "hybrid",
  salesTaxNexusStates: 5,
  financeTeam: {
    controller: "none",
    strategicFinance: "none",
    financeOperations: "fractional",
    tax: "outsourced",
    treasury: "none",
    staffAccountants: 1,
  },
};

const scaleFields: Array<
  [
    string,
    | "arrMillions"
    | "annualRevenueMillions"
    | "cashRunwayMonths"
    | "employeeCount"
    | "entityCount"
    | "closeDays"
    | "salesTaxNexusStates",
  ]
> = [
  ["ARR ($M)", "arrMillions"],
  ["Annual revenue ($M)", "annualRevenueMillions"],
  ["Cash runway (months)", "cashRunwayMonths"],
  ["Employees", "employeeCount"],
  ["Legal entities", "entityCount"],
  ["Current close (days)", "closeDays"],
  ["US nexus states", "salesTaxNexusStates"],
];

const coverageFields: Array<
  [
    string,
    "controller" | "strategicFinance" | "financeOperations" | "tax" | "treasury",
  ]
> = [
  ["Controller", "controller"],
  ["Strategic Finance / FP&A", "strategicFinance"],
  ["Finance Operations / Systems", "financeOperations"],
  ["Tax", "tax"],
  ["Treasury", "treasury"],
];

const steps = ["Company", "Business model", "Scale & risk", "Finance team"];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<CompanyProfile>(initialProfile);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggleModel(model: BusinessModel) {
    setProfile((current) => ({
      ...current,
      businessModels: current.businessModels.includes(model)
        ? current.businessModels.filter((item) => item !== model)
        : [...current.businessModels, model],
    }));
  }

  function finish() {
    setError("");
    startTransition(async () => {
      try {
        const result = await createWorkspaceAction(profile);
        router.push(`/app/${result.slug}`);
        router.refresh();
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Workspace creation failed.",
        );
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-7 flex items-center gap-4">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--purple)] text-white">
          <Sparkles size={20} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">New company workspace</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Build your incoming-CFO roadmap
          </h1>
        </div>
      </header>

      <div className="mb-5 grid grid-cols-4 gap-2" aria-label="Setup progress">
        {steps.map((label, index) => (
          <div key={label}>
            <div
              className={`h-1.5 rounded-full ${
                index <= step ? "bg-[var(--purple)]" : "bg-slate-200"
              }`}
            />
            <span
              className={`mt-2 block text-xs ${
                index === step
                  ? "font-semibold text-[var(--ink)]"
                  : "text-[var(--ink-muted)]"
              }`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      <Card className="min-h-[510px] p-6 sm:p-9">
        {step === 0 ? (
          <section>
            <p className="eyebrow">Step 1</p>
            <h2 className="mt-2 text-xl font-semibold">Company basics</h2>
            <p className="mt-2 text-sm text-[var(--ink-muted)]">
              These facts anchor the roadmap and reporting cadence.
            </p>
            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="label">Company name</span>
                <input
                  className="field"
                  value={profile.name}
                  onChange={(event) =>
                    setProfile({ ...profile, name: event.target.value })
                  }
                  placeholder="Aperture AI"
                  autoFocus
                />
              </label>
              <label>
                <span className="label">Stage</span>
                <select
                  className="field"
                  value={profile.stage}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      stage: event.target.value as "series-b" | "series-c",
                    })
                  }
                >
                  <option value="series-b">Series B</option>
                  <option value="series-c">Series C</option>
                </select>
              </label>
              <label>
                <span className="label">Your start date</span>
                <input
                  type="date"
                  className="field"
                  value={profile.startDate}
                  onChange={(event) =>
                    setProfile({ ...profile, startDate: event.target.value })
                  }
                />
              </label>
              <label>
                <span className="label">Fiscal year-end month</span>
                <select
                  className="field"
                  value={profile.fiscalYearEndMonth}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      fiscalYearEndMonth: Number(event.target.value),
                    })
                  }
                >
                  {Array.from({ length: 12 }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      {new Date(2026, index, 1).toLocaleString("en-US", {
                        month: "long",
                      })}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Current accounting system</span>
                <select
                  className="field"
                  value={profile.accountingSystem}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      accountingSystem: event.target
                        .value as typeof profile.accountingSystem,
                    })
                  }
                >
                  <option value="spreadsheets">Spreadsheets / no ERP</option>
                  <option value="quickbooks">QuickBooks</option>
                  <option value="xero">Xero</option>
                  <option value="sage-intacct">Sage Intacct</option>
                  <option value="netsuite">NetSuite</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section>
            <p className="eyebrow">Step 2</p>
            <h2 className="mt-2 text-xl font-semibold">How the company earns</h2>
            <p className="mt-2 text-sm text-[var(--ink-muted)]">
              Choose every model that materially affects revenue or gross
              margin.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {modelOptions.map((model) => {
                const selected = profile.businessModels.includes(model.id);
                return (
                  <button
                    type="button"
                    key={model.id}
                    onClick={() => toggleModel(model.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      selected
                        ? "border-[var(--purple)] bg-[var(--purple-soft)]"
                        : "border-[var(--border)] hover:border-slate-300"
                    }`}
                    aria-pressed={selected}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <strong className="text-sm">{model.title}</strong>
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-full ${
                          selected
                            ? "bg-[var(--purple)] text-white"
                            : "border border-slate-300"
                        }`}
                      >
                        {selected ? <Check size={13} /> : null}
                      </span>
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-[var(--ink-muted)]">
                      {model.description}
                    </span>
                  </button>
                );
              })}
            </div>
            <label className="mt-5 block max-w-sm">
              <span className="label">Primary billing model</span>
              <select
                className="field"
                value={profile.billingModel}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    billingModel: event.target
                      .value as typeof profile.billingModel,
                  })
                }
              >
                <option value="subscription">Subscription</option>
                <option value="usage">Usage</option>
                <option value="hybrid">Subscription + usage</option>
                <option value="consumer">Consumer / app store</option>
                <option value="services">Services / projects</option>
              </select>
            </label>
          </section>
        ) : null}

        {step === 2 ? (
          <section>
            <p className="eyebrow">Step 3</p>
            <h2 className="mt-2 text-xl font-semibold">Scale and risk</h2>
            <p className="mt-2 text-sm text-[var(--ink-muted)]">
              Approximate values are enough. They only drive prioritization.
            </p>
            <div className="mt-7 grid gap-5 sm:grid-cols-3">
              {scaleFields.map(([label, field]) => (
                <label key={field}>
                  <span className="label">{label}</span>
                  <input
                    type="number"
                    min="0"
                    className="field"
                    value={profile[field]}
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        [field]: Number(event.target.value),
                      })
                    }
                  />
                </label>
              ))}
              <label>
                <span className="label">Audit status</span>
                <select
                  className="field"
                  value={profile.auditStatus}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      auditStatus: event.target
                        .value as typeof profile.auditStatus,
                    })
                  }
                >
                  <option value="none">Not planned</option>
                  <option value="planning">Planning</option>
                  <option value="in-progress">In progress</option>
                  <option value="complete">Complete</option>
                </select>
              </label>
              <label>
                <span className="label">Audit target date</span>
                <input
                  type="date"
                  className="field"
                  value={profile.auditDueDate ?? ""}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      auditDueDate: event.target.value || null,
                    })
                  }
                />
              </label>
              <label>
                <span className="label">Next board meeting</span>
                <input
                  type="date"
                  className="field"
                  value={profile.nextBoardDate ?? ""}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      nextBoardDate: event.target.value || null,
                    })
                  }
                />
              </label>
              <label>
                <span className="label">Next fundraise target</span>
                <input
                  type="date"
                  className="field"
                  value={profile.fundraiseDate ?? ""}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      fundraiseDate: event.target.value || null,
                    })
                  }
                />
              </label>
              <label className="sm:col-span-2">
                <span className="label">Countries of operation</span>
                <input
                  className="field"
                  value={profile.countries.join(", ")}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      countries: event.target.value
                        .split(",")
                        .map((country) => country.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="US, UK, Germany"
                />
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-4 sm:col-span-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--purple)]"
                  checked={profile.internationalEmployees}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      internationalEmployees: event.target.checked,
                      countries: event.target.checked
                        ? profile.countries.length > 1
                          ? profile.countries
                          : ["US", "UK"]
                        : ["US"],
                    })
                  }
                />
                <span>
                  <strong className="block text-sm">
                    Employees outside the US
                  </strong>
                  <span className="text-xs text-[var(--ink-muted)]">
                    Adds EOR/entity, transfer-pricing, payroll, FX, and tax
                    branches.
                  </span>
                </span>
              </label>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section>
            <p className="eyebrow">Step 4</p>
            <h2 className="mt-2 text-xl font-semibold">
              Current finance coverage
            </h2>
            <p className="mt-2 text-sm text-[var(--ink-muted)]">
              This controls the hiring sequence. A missing Controller is treated
              as an immediate risk.
            </p>
            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              {coverageFields.map(([label, field]) => (
                <label key={field}>
                  <span className="label">{label}</span>
                  <select
                    className="field"
                    value={
                      profile.financeTeam[field]
                    }
                    onChange={(event) =>
                      setProfile({
                        ...profile,
                        financeTeam: {
                          ...profile.financeTeam,
                          [field]: event.target
                            .value as CompanyProfile["financeTeam"][typeof field],
                        },
                      })
                    }
                  >
                    <option value="none">No coverage</option>
                    <option value="fractional">Fractional</option>
                    <option value="outsourced">Outsourced</option>
                    <option value="full-time">Full-time</option>
                  </select>
                </label>
              ))}
              <label>
                <span className="label">Staff / senior accountants</span>
                <input
                  type="number"
                  min="0"
                  className="field"
                  value={profile.financeTeam.staffAccountants}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      financeTeam: {
                        ...profile.financeTeam,
                        staffAccountants: Number(event.target.value),
                      },
                    })
                  }
                />
              </label>
            </div>
            <div className="mt-7 rounded-xl bg-[var(--teal-soft)] p-4 text-sm leading-6">
              <strong>What happens next:</strong> the rules engine creates a
              dated roadmap, explains why each task appears, and inserts hiring
              milestones before the work they unblock.
            </div>
          </section>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        <footer className="mt-9 flex items-center justify-between border-t border-[var(--border)] pt-5">
          <Button
            variant="ghost"
            onClick={() => setStep((current) => current - 1)}
            disabled={step === 0 || pending}
          >
            <ArrowLeft size={16} /> Back
          </Button>
          {step < steps.length - 1 ? (
            <Button
              onClick={() => setStep((current) => current + 1)}
              disabled={
                (step === 0 && profile.name.trim().length === 0) ||
                (step === 1 && profile.businessModels.length === 0)
              }
            >
              Continue <ArrowRight size={16} />
            </Button>
          ) : (
            <Button onClick={finish} disabled={pending}>
              <Sparkles size={16} />
              {pending ? "Building roadmap..." : "Create CFO workspace"}
            </Button>
          )}
        </footer>
      </Card>
    </div>
  );
}
