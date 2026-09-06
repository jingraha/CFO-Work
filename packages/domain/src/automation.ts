import { z } from "zod";
import type { CompanyProfile, WorkstreamKey } from "./types";

export const SYSTEM_IDS = ["gmail", "slack", "erp", "ar", "ap", "planning", "payroll", "banking"] as const;
export const SystemIdSchema = z.enum(SYSTEM_IDS);
export type SystemId = z.infer<typeof SystemIdSchema>;
export const RecordValueSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
export const MockRecordSchema = z.object({
  id: z.string().min(1).max(100),
  kind: z.string().min(1),
  title: z.string().min(1).max(300),
  data: z.record(z.string(), RecordValueSchema),
});
export type MockRecord = z.infer<typeof MockRecordSchema>;
export type MockSystem = {
  id: SystemId;
  name: string;
  category: string;
  description: string;
  scopes: string[];
  records: MockRecord[];
};
export type SystemConnection = MockSystem & {
  connected: boolean;
  connectedAt: string | null;
  revision: number;
  lastSyncAt: string | null;
};
export type OutputContract = {
  title: string;
  deliverables: string[];
  requiredSystems: SystemId[];
  acceptanceCriteria: string[];
  requiresHumanApproval: boolean;
};
export type Playbook = {
  id: string;
  title: string;
  workstream: WorkstreamKey;
  description: string;
  dependsOn: string[];
  contract: OutputContract;
};
export type ArtifactSection = {
  title: string;
  body: string;
  columns: string[];
  rows: Array<Array<string | number>>;
};
export type ArtifactSource = {
  systemId: SystemId;
  recordId: string;
  title: string;
  revision: number;
};
export type ArtifactCheck = {
  name: string;
  passed: boolean;
  detail: string;
};
export type ReviewSlide = {
  title: string;
  bullets: string[];
  speakerNotes: string;
};
export type AgentArtifact = {
  title: string;
  summary: string;
  contract: OutputContract;
  sections: ArtifactSection[];
  sources: ArtifactSource[];
  checks: ArtifactCheck[];
  recommendations: string[];
  limitations: string[];
  slides: ReviewSlide[];
};
export const AgentRunStatusSchema = z.enum([
  "blocked", "queued", "running", "needs-review", "completed", "failed",
]);
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;
export type AgentRunView = {
  id: string;
  taskId: string;
  taskTitle: string;
  playbookId: string;
  status: AgentRunStatus;
  attempts: number;
  requested?: boolean;
  blockers: string[];
  error: string | null;
  log: Array<{ at: string; message: string }>;
  artifact: AgentArtifact | null;
  createdAt: string;
  updatedAt: string;
};
export type AssessmentAnswers = {
  objective: string;
  closeTargetDays: number;
  reviewBeforeComplete: boolean;
  presentationsEnabled: boolean;
};
export const AssessmentAnswersSchema = z.object({
  objective: z.string().trim().min(5).max(2000),
  closeTargetDays: z.number().int().min(1).max(30),
  reviewBeforeComplete: z.boolean(),
  presentationsEnabled: z.boolean(),
});
export const DEFAULT_ASSESSMENT: AssessmentAnswers = {
  objective: "Understand the finance baseline, protect cash, and establish a repeatable close and forecast.",
  closeTargetDays: 7,
  reviewBeforeComplete: false,
  presentationsEnabled: true,
};
export type ReviewMessage = { role: "user" | "agent"; text: string; at: string };
export const MAX_REVIEW_MESSAGES = 101;
export type ReviewMeetingView = {
  id: string;
  runId: string;
  title: string;
  status: "scheduled" | "active" | "ended";
  slideIndex: number;
  messages: ReviewMessage[];
  createdAt: string;
  artifact: AgentArtifact;
};
export type AutomationSnapshot = {
  initialized: boolean;
  enabled: boolean;
  assessment: AssessmentAnswers;
  systems: SystemConnection[];
  runs: AgentRunView[];
  meetings: ReviewMeetingView[];
  playbooks: Playbook[];
  worker: { lastHeartbeat: string | null; error: string | null };
  taskReadiness: TaskReadiness[];
};
export type AgentExecutionInput = {
  profile: CompanyProfile;
  assessment: AssessmentAnswers;
  systems: SystemConnection[];
  previousArtifacts: AgentArtifact[];
  taskId?: string;
};
export type TaskReadiness = {
  taskId: string;
  skillId: string | null;
  skillTitle: string | null;
  state: "ready" | "blocked" | "unavailable" | "working" | "review" | "completed";
  blockers: Array<{
    kind: "setup" | "connector" | "dependency" | "evidence" | "skill";
    label: string;
    systemId?: SystemId;
    taskId?: string;
  }>;
  inputHint: string;
  requiresEvidence: boolean;
};
export const TaskEvidenceSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  kind: z.enum(["meeting-transcript", "assessment-note"]),
  text: z.string().trim().min(40).max(30000),
});
export type TaskEvidence = z.infer<typeof TaskEvidenceSchema>;
export function isSatisfiedTask(status: string): boolean {
  return status === "complete" || status === "not-applicable";
}

const outputContractSchema = z.object({
  title: z.string(), deliverables: z.array(z.string()).max(100),
  requiredSystems: z.array(SystemIdSchema).max(8),
  acceptanceCriteria: z.array(z.string()).max(100), requiresHumanApproval: z.boolean(),
});
export const AgentArtifactSchema: z.ZodType<AgentArtifact> = z.object({
  title: z.string().max(1000), summary: z.string().max(20000), contract: outputContractSchema,
  sections: z.array(z.object({
    title: z.string(), body: z.string(), columns: z.array(z.string()).max(100),
    rows: z.array(z.array(z.union([z.string(), z.number().finite()])).max(100)).max(2000),
  })).max(100),
  sources: z.array(z.object({
    systemId: SystemIdSchema, recordId: z.string(), title: z.string(), revision: z.number().int().positive(),
  })).max(2000),
  checks: z.array(z.object({ name: z.string(), passed: z.boolean(), detail: z.string() })).max(100),
  recommendations: z.array(z.string()).max(100), limitations: z.array(z.string()).max(100),
  slides: z.array(z.object({ title: z.string(), bullets: z.array(z.string()).max(50), speakerNotes: z.string() })).max(100),
});
const logSchema = z.array(z.object({ at: z.iso.datetime(), message: z.string().max(10000) })).max(500);
const messageSchema = z.array(z.object({
  role: z.enum(["user", "agent"]), text: z.string().max(20000), at: z.iso.datetime(),
})).max(MAX_REVIEW_MESSAGES);
export const EnvironmentTransferSchema = z.object({
  version: z.literal(1),
  taskReferences: z.record(z.string(), z.string()).default({}),
  assessment: AssessmentAnswersSchema,
  systems: z.array(z.object({
    systemId: SystemIdSchema, records: z.array(MockRecordSchema).max(2000), revision: z.number().int().positive(),
  })).length(8),
  runs: z.array(z.object({
    masterTaskId: z.string(), playbookId: z.string(), status: AgentRunStatusSchema,
    attempts: z.number().int().nonnegative(), artifact: AgentArtifactSchema.nullable(),
    requested: z.boolean().default(true),
    error: z.string().nullable(), log: logSchema,
  })).max(2000),
  meetings: z.array(z.object({
    runMasterTaskId: z.string(), title: z.string(), status: z.enum(["scheduled", "active", "ended"]),
    slideIndex: z.number().int().nonnegative(), messages: messageSchema, artifact: AgentArtifactSchema,
  })).max(500),
});
export type EnvironmentTransfer = z.infer<typeof EnvironmentTransferSchema>;
