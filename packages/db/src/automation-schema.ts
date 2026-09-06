import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type {
  AgentArtifact, AgentRunStatus, AssessmentAnswers, MockRecord, ReviewMessage, SystemId,
} from "@cfo/domain";

// Foreign keys are defined in the migration to avoid circular schema imports.
export const environments = pgTable("company_environment", {
  workspaceId: text("workspace_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  assessment: jsonb("assessment").$type<AssessmentAnswers>().notNull(),
  authorizedBy: text("authorized_by").notNull(),
  heartbeat: timestamp("heartbeat", { withTimezone: true }),
  workerError: text("worker_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const systemConnections = pgTable("system_connection", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  systemId: text("system_id").$type<SystemId>().notNull(),
  connected: boolean("connected").notNull().default(false),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  revision: integer("revision").notNull().default(1),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  records: jsonb("records").$type<MockRecord[]>().notNull(),
}, (table) => [uniqueIndex("connection_workspace_system_idx").on(table.workspaceId, table.systemId)]);

export const agentRuns = pgTable("agent_run", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  taskId: text("task_id").notNull(),
  playbookId: text("playbook_id").notNull(),
  status: text("status").$type<AgentRunStatus>().notNull().default("queued"),
  requestedBy: text("requested_by").notNull(),
  requested: boolean("requested").notNull().default(true),
  attempts: integer("attempts").notNull().default(0),
  blockers: jsonb("blockers").$type<string[]>().notNull().default([]),
  error: text("error"),
  log: jsonb("log").$type<Array<{ at: string; message: string }>>().notNull().default([]),
  artifact: jsonb("artifact").$type<AgentArtifact | null>(),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("agent_workspace_task_idx").on(table.workspaceId, table.taskId)]);

export const reviewMeetings = pgTable("review_meeting", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  runId: text("run_id").notNull(),
  title: text("title").notNull(),
  status: text("status").$type<"scheduled" | "active" | "ended">().notNull().default("scheduled"),
  slideIndex: integer("slide_index").notNull().default(0),
  messages: jsonb("messages").$type<ReviewMessage[]>().notNull().default([]),
  artifact: jsonb("artifact").$type<AgentArtifact>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
