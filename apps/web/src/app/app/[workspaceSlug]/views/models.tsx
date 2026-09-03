import { Card } from "@cfo/ui";
import {
  ArrowDownToLine,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  CloudCog,
  FileSpreadsheet,
  Users,
} from "lucide-react";

const models = [
  {
    id: "b2b-saas-usage",
    name: "B2B SaaS + Usage",
    description:
      "Subscription ARR bridge plus usage overages, GTM capacity, hosting and support COGS, and SaaS unit economics.",
    icon: BriefcaseBusiness,
    color: "var(--purple)",
    surface: "var(--purple-soft)",
    file: "/downloads/b2b-saas-usage-model.xlsx",
    metrics: ["ARR / NRR", "CAC payback", "Rule of 40", "Burn multiple"],
  },
  {
    id: "ai-infrastructure",
    name: "AI API / Infrastructure",
    description:
      "Token and request volume, pricing, provider mix, cache behavior, compute capacity, inference economics, and concentration.",
    icon: CloudCog,
    color: "#087ca7",
    surface: "var(--blue-soft)",
    file: "/downloads/ai-api-infrastructure-model.xlsx",
    metrics: ["Revenue / unit", "COGS / unit", "Utilization", "Inference GM"],
  },
  {
    id: "consumer-subscription",
    name: "Consumer Subscription",
    description:
      "Acquisition channels, signup cohorts, free-to-paid conversion, retention, plan mix, fees, and consumer unit economics.",
    icon: Users,
    color: "#c93776",
    surface: "var(--pink-soft)",
    file: "/downloads/consumer-subscription-model.xlsx",
    metrics: ["Cohort retention", "ARPU", "LTV:CAC", "Contribution"],
  },
  {
    id: "ai-enabled-services",
    name: "AI-Enabled Services",
    description:
      "Pipeline, bookings, backlog, billable capacity, delivery utilization, AI-assisted hours, tools, and project margin.",
    icon: Bot,
    color: "#a45517",
    surface: "var(--orange-soft)",
    file: "/downloads/ai-enabled-services-model.xlsx",
    metrics: [
      "Backlog coverage",
      "Utilization",
      "Revenue / FTE",
      "Project GM",
    ],
  },
];

const commonTabs = [
  "Simple Assumptions",
  "Headcount",
  "Revenue",
  "COGS & Gross Margin",
  "Opex",
  "Working Capital",
  "P&L",
  "Balance Sheet",
  "Cash Flow",
  "Cash & Runway",
  "Scenarios",
  "Visuals",
  "Checks",
];

export function ModelsView() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-[var(--ink)] p-6 text-white sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--blue)]">
              Native Excel planning tools
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Four operating models. One financial architecture.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Every workbook starts with simple assumptions and links headcount,
              revenue, COGS, Opex, working capital, three statements, cash,
              scenarios, and board-ready visuals.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/8 p-4">
              <strong className="block text-xl text-[var(--teal)]">36</strong>
              <span className="text-xs text-slate-300">monthly periods</span>
            </div>
            <div className="rounded-xl bg-white/8 p-4">
              <strong className="block text-xl text-[var(--pink)]">3</strong>
              <span className="text-xs text-slate-300">live scenarios</span>
            </div>
            <div className="rounded-xl bg-white/8 p-4">
              <strong className="block text-xl text-[var(--blue)]">3</strong>
              <span className="text-xs text-slate-300">linked statements</span>
            </div>
            <div className="rounded-xl bg-white/8 p-4">
              <strong className="block text-xl text-[var(--orange)]">0</strong>
              <span className="text-xs text-slate-300">cloud dependency</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {models.map((model) => {
          const Icon = model.icon;
          return (
            <Card key={model.id} className="flex flex-col overflow-hidden">
              <div className="flex-1 p-6">
                <div className="flex items-start justify-between">
                  <span
                    className="grid h-11 w-11 place-items-center rounded-xl"
                    style={{ background: model.surface, color: model.color }}
                  >
                    <Icon size={19} />
                  </span>
                  <FileSpreadsheet size={21} className="text-emerald-600" />
                </div>
                <h3 className="mt-5 text-xl font-semibold">{model.name}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                  {model.description}
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {model.metrics.map((metric) => (
                    <span
                      key={metric}
                      className="flex items-center gap-2 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-[10px] font-semibold"
                    >
                      <BarChart3 size={12} style={{ color: model.color }} />
                      {metric}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)] bg-slate-50 px-5 py-4">
                <span className="flex items-center gap-2 text-[10px] font-semibold text-emerald-700">
                  <CheckCircle2 size={13} /> Formula and tie-out checks
                </span>
                <a
                  href={model.file}
                  download
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--purple)] px-3 text-xs font-semibold text-white hover:bg-[var(--purple-dark)]"
                >
                  <ArrowDownToLine size={14} /> Download .xlsx
                </a>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-6">
        <p className="eyebrow">Common workbook contract</p>
        <h3 className="mt-2 text-lg font-semibold">
          Familiar tabs across every business model
        </h3>
        <div className="mt-5 flex flex-wrap gap-2">
          {commonTabs.map((tab, index) => (
            <span
              key={tab}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold"
            >
              <span className="mr-2 text-[var(--purple)]">{index + 1}</span>
              {tab}
            </span>
          ))}
        </div>
        <p className="mt-5 text-xs leading-5 text-[var(--ink-muted)]">
          Planning models are not systems of record and do not replace GAAP
          accounting, tax, legal, audit, or investment advice.
        </p>
      </Card>
    </div>
  );
}
