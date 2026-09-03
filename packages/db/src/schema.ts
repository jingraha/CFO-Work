import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  CompanyProfile,
  EvidenceLink,
  Phase,
  Priority,
  Role,
  TaskStatus,
  WorkstreamKey,
} from "@cfo/domain";

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("user_email_idx").on(table.email)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("session_token_idx").on(table.token),
    index("session_user_idx").on(table.userId),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    issuer: text("issuer").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("account_user_idx").on(table.userId),
    uniqueIndex("account_issuer_account_idx").on(
      table.issuer,
      table.accountId,
    ),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const workspaces = pgTable(
  "workspace",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("workspace_slug_idx").on(table.slug)],
);

export const memberships = pgTable(
  "membership",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<Role>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("membership_workspace_user_idx").on(
      table.workspaceId,
      table.userId,
    ),
    index("membership_user_idx").on(table.userId),
  ],
);

export const companyProfiles = pgTable("company_profile", {
  workspaceId: text("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  profile: jsonb("profile").$type<CompanyProfile>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workspaceTasks = pgTable(
  "workspace_task",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    masterTaskId: text("master_task_id").notNull(),
    workstream: text("workstream").$type<WorkstreamKey>().notNull(),
    phase: text("phase").$type<Phase>().notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    outcome: text("outcome").notNull(),
    status: text("status").$type<TaskStatus>().notNull().default("not-started"),
    priority: text("priority").$type<Priority>().notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    percentComplete: integer("percent_complete").notNull().default(0),
    ownerId: text("owner_id").references(() => user.id, {
      onDelete: "set null",
    }),
    ownerRole: text("owner_role").notNull(),
    financeResponsibility: text("finance_responsibility")
      .$type<"owns" | "partners" | "advises">()
      .notNull(),
    notes: text("notes").notNull().default(""),
    recommendationReason: text("recommendation_reason").notNull(),
    dependencies: jsonb("dependencies").$type<string[]>().notNull().default([]),
    evidenceLinks: jsonb("evidence_links")
      .$type<EvidenceLink[]>()
      .notNull()
      .default([]),
    evidenceRequirements: jsonb("evidence_requirements")
      .$type<string[]>()
      .notNull()
      .default([]),
    deliverables: jsonb("deliverables").$type<string[]>().notNull().default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    cadence: text("cadence").$type<
      | "daily"
      | "weekly"
      | "monthly"
      | "quarterly"
      | "annual"
      | "event-driven"
      | null
    >(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("task_workspace_master_idx").on(
      table.workspaceId,
      table.masterTaskId,
    ),
    index("task_workspace_status_idx").on(table.workspaceId, table.status),
    index("task_workspace_dates_idx").on(
      table.workspaceId,
      table.startDate,
      table.endDate,
    ),
  ],
);

export const vendorEvaluations = pgTable(
  "vendor_evaluation",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    vendorId: text("vendor_id").notNull(),
    status: text("status").notNull().default("researching"),
    ownerId: text("owner_id").references(() => user.id, {
      onDelete: "set null",
    }),
    scores: jsonb("scores")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    notes: text("notes").notNull().default(""),
    evidenceLink: jsonb("evidence_link").$type<EvidenceLink | null>(),
    decision: text("decision").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("vendor_workspace_vendor_idx").on(
      table.workspaceId,
      table.vendorId,
    ),
  ],
);

export const hiringPlans = pgTable(
  "hiring_plan",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    roleId: text("role_id").notNull(),
    status: text("status").notNull().default("recommended"),
    targetDate: date("target_date"),
    ownerId: text("owner_id").references(() => user.id, {
      onDelete: "set null",
    }),
    notes: text("notes").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("hiring_workspace_role_idx").on(
      table.workspaceId,
      table.roleId,
    ),
  ],
);

export const templateInstances = pgTable(
  "template_instance",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    templateId: text("template_id").notNull(),
    values: jsonb("values")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    updatedBy: text("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("template_workspace_template_idx").on(
      table.workspaceId,
      table.templateId,
    ),
  ],
);

export const auditEvents = pgTable(
  "audit_event",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);

export const schema = {
  user,
  session,
  account,
  verification,
  workspaces,
  memberships,
  companyProfiles,
  workspaceTasks,
  vendorEvaluations,
  hiringPlans,
  templateInstances,
  auditEvents,
};
