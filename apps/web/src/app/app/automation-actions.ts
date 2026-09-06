"use server";

import { z } from "zod";
import {
  AssessmentAnswersSchema, MockRecordSchema, SystemIdSchema,
  TaskEvidenceSchema,
} from "@cfo/domain";
import {
  initializeEnvironment, saveAssessment, setSystemConnection, updateMockRecord,
  setAutomationEnabled, queueAgentWork, retryAgentRun, reviewAgentRun,
  delegateRoadmapTask, createReviewMeeting, updateReviewMeeting, askReviewQuestion,
  setSystemConnections, addTaskEvidence, requestTaskAgent,
} from "@cfo/db";
import { requireSession } from "@/lib/session";
import { runAutomationTick } from "@/lib/automation-worker";

const baseSchema = z.object({ workspaceId: z.string().min(1), workspaceSlug: z.string().min(1) });
const assessmentSchema = baseSchema.extend({ assessment: AssessmentAnswersSchema });
const runSchema = baseSchema.extend({ runId: z.string().min(1) });

export async function initializeEnvironmentAction(raw: unknown) {
  const session = await requireSession();
  const input = assessmentSchema.parse(raw);
  await initializeEnvironment(session.user.id, input.workspaceId, input.assessment);
}

export async function saveAssessmentAction(raw: unknown) {
  const session = await requireSession();
  const input = assessmentSchema.parse(raw);
  await saveAssessment(session.user.id, input.workspaceId, input.assessment);
  await runAutomationTick();
}

export async function setSystemConnectionAction(raw: unknown) {
  const session = await requireSession();
  const input = baseSchema.extend({ systemId: SystemIdSchema, connected: z.boolean() }).parse(raw);
  await setSystemConnection(session.user.id, input.workspaceId, input.systemId, input.connected);
  await runAutomationTick();
}

export async function setSystemConnectionsAction(raw: unknown) {
  const session = await requireSession();
  const input = baseSchema.extend({ systemIds: z.array(SystemIdSchema).min(1).max(8), connected: z.boolean() }).parse(raw);
  await setSystemConnections(session.user.id, input.workspaceId, input.systemIds, input.connected);
  await runAutomationTick();
}

export async function addTaskEvidenceAction(raw: unknown) {
  const session = await requireSession();
  const input = baseSchema.extend({ evidence: TaskEvidenceSchema }).parse(raw);
  await addTaskEvidence(session.user.id, input.workspaceId, input.evidence);
  await runAutomationTick();
}

export async function requestTaskAgentAction(raw: unknown) {
  const session = await requireSession();
  const input = baseSchema.extend({ taskId: z.string().min(1) }).parse(raw);
  await requestTaskAgent(session.user.id, input.workspaceId, input.taskId);
  await runAutomationTick();
}

export async function updateMockRecordAction(raw: unknown) {
  const session = await requireSession();
  const input = baseSchema.extend({
    systemId: SystemIdSchema, record: MockRecordSchema, expectedRevision: z.number().int().positive(),
  }).parse(raw);
  await updateMockRecord(session.user.id, input.workspaceId, input.systemId, input.record, input.expectedRevision);
}

export async function setAutomationEnabledAction(raw: unknown) {
  const session = await requireSession();
  const input = baseSchema.extend({ enabled: z.boolean() }).parse(raw);
  await setAutomationEnabled(session.user.id, input.workspaceId, input.enabled);
  await runAutomationTick();
}

export async function queueAgentWorkAction(raw: unknown) {
  const session = await requireSession();
  const input = baseSchema.extend({ playbookId: z.string().min(1) }).parse(raw);
  await queueAgentWork(session.user.id, input.workspaceId, input.playbookId);
  await runAutomationTick();
}

export async function delegateRoadmapTaskAction(raw: unknown) {
  const session = await requireSession();
  const input = baseSchema.extend({ taskId: z.string().min(1) }).parse(raw);
  await delegateRoadmapTask(session.user.id, input.workspaceId, input.taskId);
}

export async function retryAgentRunAction(raw: unknown) {
  const session = await requireSession();
  const input = runSchema.parse(raw);
  await retryAgentRun(session.user.id, input.workspaceId, input.runId);
  await runAutomationTick();
}

export async function reviewAgentRunAction(raw: unknown) {
  const session = await requireSession();
  const input = runSchema.extend({
    decision: z.enum(["approve", "request-changes"]), notes: z.string().max(5000),
  }).parse(raw);
  await reviewAgentRun(session.user.id, input.workspaceId, input.runId, input.decision, input.notes);
  await runAutomationTick();
}

export async function createReviewMeetingAction(raw: unknown) {
  const session = await requireSession();
  const input = runSchema.parse(raw);
  return createReviewMeeting(session.user.id, input.workspaceId, input.runId);
}

export async function updateReviewMeetingAction(raw: unknown) {
  const session = await requireSession();
  const input = baseSchema.extend({
    meetingId: z.string().min(1), status: z.enum(["scheduled", "active", "ended"]),
    slideIndex: z.number().int().nonnegative(),
  }).parse(raw);
  await updateReviewMeeting(session.user.id, input.workspaceId, input.meetingId, input.status, input.slideIndex);
}

export async function askReviewQuestionAction(raw: unknown) {
  const session = await requireSession();
  const input = baseSchema.extend({
    meetingId: z.string().min(1), question: z.string().trim().min(2).max(2000),
  }).parse(raw);
  return askReviewQuestion(session.user.id, input.workspaceId, input.meetingId, input.question);
}
