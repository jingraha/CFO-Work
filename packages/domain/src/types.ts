import { z } from "zod";

export const WORKSTREAMS = [
  "leadership",
  "controllership",
  "strategic-finance",
  "commercial-finance",
  "finance-operations",
  "treasury-capital",
  "tax",
  "risk-controls",
  "people-equity",
  "governance-legal",
] as const;

export const PHASES = [
  "days-1-30",
  "days-31-60",
  "days-61-90",
  "months-4-6",
  "months-7-12",
  "recurring",
] as const;

export const ROLES = [
  "cfo-admin",
  "finance-editor",
  "task-contributor",
  "viewer",
] as const;

export const TASK_STATUSES = [
  "not-started",
  "in-progress",
  "blocked",
  "complete",
  "not-applicable",
] as const;

export const PRIORITIES = ["critical", "high", "medium", "low"] as const;

export const BUSINESS_MODELS = [
  "b2b-saas-usage",
  "ai-infrastructure",
  "consumer-subscription",
  "ai-enabled-services",
] as const;

export const WorkstreamKeySchema = z.enum(WORKSTREAMS);
export const PhaseSchema = z.enum(PHASES);
export const RoleSchema = z.enum(ROLES);
export const TaskStatusSchema = z.enum(TASK_STATUSES);
export const PrioritySchema = z.enum(PRIORITIES);
export const BusinessModelSchema = z.enum(BUSINESS_MODELS);

export type WorkstreamKey = z.infer<typeof WorkstreamKeySchema>;
export type Phase = z.infer<typeof PhaseSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type Priority = z.infer<typeof PrioritySchema>;
export type BusinessModel = z.infer<typeof BusinessModelSchema>;

export const CoverageSchema = z.enum([
  "none",
  "fractional",
  "full-time",
  "outsourced",
]);

export const CompanyProfileSchema = z.object({
  name: z.string().min(1).max(120),
  stage: z.enum(["series-b", "series-c"]),
  startDate: z.iso.date(),
  fiscalYearEndMonth: z.number().int().min(1).max(12).default(12),
  businessModels: z.array(BusinessModelSchema).min(1),
  annualRevenueMillions: z.number().min(0),
  arrMillions: z.number().min(0),
  cashRunwayMonths: z.number().min(0).max(120),
  employeeCount: z.number().int().min(1),
  entityCount: z.number().int().min(1),
  countries: z.array(z.string().min(2)).min(1),
  internationalEmployees: z.boolean(),
  closeDays: z.number().int().min(1).max(90),
  auditStatus: z.enum(["none", "planning", "in-progress", "complete"]),
  auditDueDate: z.iso.date().nullable(),
  fundraiseDate: z.iso.date().nullable(),
  nextBoardDate: z.iso.date().nullable(),
  accountingSystem: z.enum([
    "spreadsheets",
    "quickbooks",
    "xero",
    "sage-intacct",
    "netsuite",
    "other",
  ]),
  billingModel: z.enum([
    "subscription",
    "usage",
    "hybrid",
    "consumer",
    "services",
  ]),
  salesTaxNexusStates: z.number().int().min(0).max(51),
  financeTeam: z.object({
    controller: CoverageSchema,
    strategicFinance: CoverageSchema,
    financeOperations: CoverageSchema,
    tax: CoverageSchema,
    treasury: CoverageSchema,
    staffAccountants: z.number().int().min(0),
  }),
});

export type CompanyProfile = z.infer<typeof CompanyProfileSchema>;

export const ConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum([
    "equals",
    "not-equals",
    "in",
    "not-in",
    "gte",
    "lte",
    "gt",
    "lt",
    "truthy",
    "falsy",
    "contains",
  ]),
  value: z.unknown().optional(),
});

export type Condition = z.infer<typeof ConditionSchema>;

export const WorkstreamDefinitionSchema = z.object({
  id: WorkstreamKeySchema,
  name: z.string().min(1),
  shortName: z.string().min(1),
  description: z.string().min(1),
  outcome: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string().min(1),
});

export type WorkstreamDefinition = z.infer<
  typeof WorkstreamDefinitionSchema
>;

export const MasterTaskSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  workstream: WorkstreamKeySchema,
  phase: PhaseSchema,
  title: z.string().min(5),
  description: z.string().min(12),
  outcome: z.string().min(5),
  priority: PrioritySchema,
  startOffsetDays: z.number().int().min(0).max(365),
  durationDays: z.number().int().min(1).max(365),
  ownerRole: z.string().min(2),
  financeResponsibility: z.enum(["owns", "partners", "advises"]),
  dependencies: z.array(z.string()).default([]),
  conditions: z.array(ConditionSchema).default([]),
  recommendationReason: z.string().min(8),
  evidence: z.array(z.string().min(2)).default([]),
  deliverables: z.array(z.string().min(2)).min(1),
  tags: z.array(z.string()).default([]),
  cadence: z
    .enum(["daily", "weekly", "monthly", "quarterly", "annual", "event-driven"])
    .nullable()
    .default(null),
  sourceUrls: z.array(z.url()).default([]),
});

export type MasterTask = z.infer<typeof MasterTaskSchema>;

export const HiringRoleSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(2),
  sequence: z.number().int().min(1),
  defaultEmploymentModel: z.enum([
    "full-time",
    "fractional",
    "outsourced",
    "either",
  ]),
  triggerSummary: z.string().min(10),
  conditions: z.array(ConditionSchema),
  outcomes: z.array(z.string()).min(2),
  scorecard: z.array(z.string()).min(3),
  interviewQuestions: z.array(z.string()).min(3),
  dependencies: z.array(z.string()).default([]),
});

export type HiringRole = z.infer<typeof HiringRoleSchema>;

export const VendorSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(2),
  category: z.string().min(2),
  description: z.string().min(10),
  officialUrl: z.url(),
  sourceUrl: z.url(),
  asOfDate: z.iso.date(),
  stages: z.array(z.enum(["series-b", "series-c"])).min(1),
  businessModels: z.array(BusinessModelSchema).default([]),
  strengths: z.array(z.string()).min(1),
  watchouts: z.array(z.string()).min(1),
  integrations: z.array(z.string()).default([]),
  implementation: z.enum(["light", "moderate", "heavy"]),
  pricingModel: z.string().min(2),
  pricingNote: z.string().min(8),
  securityDiligence: z.array(z.string()).min(1),
  exportOffboarding: z.array(z.string()).min(1),
});

export type Vendor = z.infer<typeof VendorSchema>;

export const TemplateDefinitionSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  workstream: WorkstreamKeySchema,
  name: z.string().min(3),
  description: z.string().min(10),
  format: z.enum(["interactive", "csv", "xlsx", "markdown"]),
  fields: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(2),
      type: z.enum([
        "text",
        "long-text",
        "number",
        "date",
        "select",
        "checkbox",
        "url",
      ]),
      required: z.boolean().default(false),
      options: z.array(z.string()).default([]),
      help: z.string().default(""),
    }),
  ),
});

export type TemplateDefinition = z.infer<typeof TemplateDefinitionSchema>;

export const EvidenceLinkSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  url: z.url().refine((url) => url.startsWith("https://"), {
    message: "Evidence links must use HTTPS.",
  }),
  sourceSystem: z.enum([
    "sharepoint",
    "google-drive",
    "dropbox",
    "data-room",
    "other",
  ]),
});

export type EvidenceLink = z.infer<typeof EvidenceLinkSchema>;

export const WorkspaceTaskSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  masterTaskId: z.string(),
  title: z.string().min(1),
  status: TaskStatusSchema,
  priority: PrioritySchema,
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  percentComplete: z.number().int().min(0).max(100),
  ownerId: z.string().nullable(),
  notes: z.string(),
  evidenceLinks: z.array(EvidenceLinkSchema),
  recommendationReason: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type WorkspaceTask = z.infer<typeof WorkspaceTaskSchema>;

export type RoadmapTask = MasterTask & {
  startDate: string;
  endDate: string;
  includedBecause: string;
};
