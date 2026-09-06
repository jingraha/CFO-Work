import { randomUUID } from "node:crypto";
import { and, asc, eq, lt, sql } from "drizzle-orm";
import {
  AssessmentAnswersSchema, CompanyProfileSchema, DEFAULT_ASSESSMENT,
  MockRecordSchema, SYSTEM_IDS, SystemIdSchema, can, RoleSchema, isSatisfiedTask,
  AgentArtifactSchema, EnvironmentTransferSchema, type EnvironmentTransfer,
  MAX_REVIEW_MESSAGES,
  type AgentArtifact, type AutomationSnapshot, type MockRecord, type ReviewMeetingView,
  type SystemId, type SystemConnection, type AssessmentAnswers,
} from "@cfo/domain";
import {
  createMockSystems, playbooks, skills, executePlaybook, assessTaskOutput, answerReviewQuestion,
  getTaskReadiness, taskSkill,
} from "@cfo/automation";
import { getDatabase } from "./client";
import { agentRuns, environments, reviewMeetings, systemConnections } from "./automation-schema";
import { auditEvents, companyProfiles, memberships, workspaceTasks } from "./schema";
import { requirePermission } from "./repository";

const newId = (prefix: string) => `${prefix}_${randomUUID()}`;
const nowLog = (message: string) => ({ at: new Date().toISOString(), message });
type Database = Awaited<ReturnType<typeof getDatabase>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Db = Database | Transaction;

async function audit(db: Db, workspaceId: string, actorId: string, action: string, entityId: string, after: unknown) {
  await db.insert(auditEvents).values({
    id: newId("audit"), workspaceId, actorId, entityType: "automation", entityId, action, after,
  });
}

async function environmentProfile(db: Db, workspaceId: string) {
  const [row] = await db.select().from(companyProfiles).where(eq(companyProfiles.workspaceId, workspaceId));
  if (!row) throw new Error("Complete company onboarding before setting up its environment.");
  return CompanyProfileSchema.parse(row.profile);
}

async function requireEnvironment(db: Db, workspaceId: string) {
  const [environment] = await db.select().from(environments).where(eq(environments.workspaceId, workspaceId));
  if (!environment) throw new Error("Initialize the demo company environment first.");
  return environment;
}

function mapSystems(
  profile: ReturnType<typeof CompanyProfileSchema.parse>,
  rows: Array<typeof systemConnections.$inferSelect>,
): SystemConnection[] {
  return createMockSystems(profile).map((system) => {
    const row = rows.find((connection) => connection.systemId === system.id);
    if (!row) throw new Error(`Missing mock system ${system.id}. Reinitialize the demo environment.`);
    return {
      ...system, records: row.records, connected: row.connected,
      connectedAt: row.connectedAt?.toISOString() ?? null,
      revision: row.revision, lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    };
  });
}

export async function getAutomationSnapshot(userId: string, workspaceId: string): Promise<AutomationSnapshot> {
  await requirePermission(userId, workspaceId, "workspace:view");
  const db = await getDatabase();
  const [environment] = await db.select().from(environments).where(eq(environments.workspaceId, workspaceId));
  if (!environment) {
    return {
      initialized: false, enabled: false, assessment: DEFAULT_ASSESSMENT,
      systems: [], runs: [], meetings: [], playbooks: skills, worker: { lastHeartbeat: null, error: null },
      taskReadiness: (await db.select().from(workspaceTasks).where(eq(workspaceTasks.workspaceId, workspaceId)))
        .map((task, _index, tasks) => getTaskReadiness(task, tasks, [], false, [])),
    };
  }
  const profile = await environmentProfile(db, workspaceId);
  const connections = await db.select().from(systemConnections).where(eq(systemConnections.workspaceId, workspaceId));
  const runs = await db.select({ run: agentRuns, title: workspaceTasks.title }).from(agentRuns)
    .innerJoin(workspaceTasks, and(eq(workspaceTasks.id, agentRuns.taskId), eq(workspaceTasks.workspaceId, workspaceId)))
    .where(eq(agentRuns.workspaceId, workspaceId)).orderBy(asc(agentRuns.createdAt), asc(agentRuns.id));
  const meetings = await db.select().from(reviewMeetings).where(eq(reviewMeetings.workspaceId, workspaceId))
    .orderBy(asc(reviewMeetings.createdAt));
  const taskRows = await db.select().from(workspaceTasks).where(eq(workspaceTasks.workspaceId, workspaceId));
  const mappedSystems = mapSystems(profile, connections);
  const mappedRuns = runs.map(({ run, title }) => ({
    id: run.id, taskId: run.taskId, taskTitle: title, playbookId: run.playbookId,
    status: run.status, attempts: run.attempts, requested: run.requested, blockers: run.blockers, error: run.error,
    log: run.log, artifact: run.artifact,
    createdAt: run.createdAt.toISOString(), updatedAt: run.updatedAt.toISOString(),
  }));
  return {
    initialized: true, enabled: environment.enabled,
    assessment: AssessmentAnswersSchema.parse(environment.assessment),
    systems: mappedSystems,
    runs: mappedRuns,
    meetings: meetings.map((meeting) => ({
      id: meeting.id, runId: meeting.runId, title: meeting.title,
      status: meeting.status, slideIndex: meeting.slideIndex,
      messages: meeting.messages, createdAt: meeting.createdAt.toISOString(), artifact: meeting.artifact,
    })),
    playbooks: skills, worker: { lastHeartbeat: environment.heartbeat?.toISOString() ?? null, error: environment.workerError },
    taskReadiness: taskRows.map((task) => getTaskReadiness(task, taskRows, mappedSystems, true, mappedRuns)),
  };
}

export async function initializeEnvironment(userId: string, workspaceId: string, rawAssessment: AssessmentAnswers, scheduleAll = true) {
  await requirePermission(userId, workspaceId, "workspace:edit");
  const assessment = AssessmentAnswersSchema.parse(rawAssessment);
  const db = await getDatabase();
  const profile = await environmentProfile(db, workspaceId);
  await db.transaction(async (tx) => {
    const inserted = await tx.insert(environments).values({
      workspaceId, assessment, authorizedBy: userId, enabled: false,
    }).onConflictDoNothing().returning();
    if (!inserted.length) return;
    for (const system of createMockSystems(profile)) {
      await tx.insert(systemConnections).values({
        id: newId("conn"), workspaceId, systemId: system.id, records: system.records,
      });
    }
    for (const playbook of playbooks) {
      const insertedTasks = await tx.insert(workspaceTasks).values({
        id: newId("task"), workspaceId, masterTaskId: `agent-${playbook.id}`,
        workstream: playbook.workstream, phase: "days-1-30", title: playbook.title,
        description: playbook.description, outcome: playbook.contract.deliverables.join("; "),
        status: "not-started", priority: "high", startDate: profile.startDate, endDate: profile.startDate,
        ownerRole: "Local demo agent", financeResponsibility: "owns",
        recommendationReason: "Part of the connected demo-company assessment workflow. Runs when prerequisites and systems are ready.",
        dependencies: playbook.dependsOn.map((id) => `agent-${id}`),
        evidenceRequirements: playbook.contract.acceptanceCriteria,
        deliverables: playbook.contract.deliverables, tags: ["agent-work", "demo-company"],
      }).onConflictDoNothing().returning();
      const existingTasks = insertedTasks.length ? insertedTasks : await tx.select().from(workspaceTasks)
        .where(and(eq(workspaceTasks.workspaceId, workspaceId), eq(workspaceTasks.masterTaskId, `agent-${playbook.id}`)));
      const taskId = existingTasks[0]?.id;
      if (!taskId) throw new Error(`Could not install task for playbook ${playbook.id}.`);
      await tx.insert(agentRuns).values({
        id: newId("run"), workspaceId, taskId, playbookId: playbook.id,
        requestedBy: userId, requested: scheduleAll,
        log: [nowLog(scheduleAll ? "Queued. Output contract and required source systems identified." : "Skill available. Start this work from Workstreams.")],
      });
    }
    await audit(tx, workspaceId, userId, "environment-initialized", workspaceId, {
      systemCount: SYSTEM_IDS.length, playbookCount: playbooks.length, assessment,
    });
  });
}

export async function saveAssessment(userId: string, workspaceId: string, input: AssessmentAnswers) {
  await requirePermission(userId, workspaceId, "workspace:edit");
  const assessment = AssessmentAnswersSchema.parse(input);
  const db = await getDatabase();
  await requireEnvironment(db, workspaceId);
  await db.transaction(async (tx) => {
    await tx.update(environments).set({ assessment }).where(eq(environments.workspaceId, workspaceId));
    await audit(tx, workspaceId, userId, "assessment-updated", workspaceId, assessment);
  });
}

export async function setSystemConnection(userId: string, workspaceId: string, rawSystemId: SystemId, connected: boolean) {
  await requirePermission(userId, workspaceId, "workspace:edit");
  const systemId = SystemIdSchema.parse(rawSystemId);
  const db = await getDatabase();
  await requireEnvironment(db, workspaceId);
  await db.transaction(async (tx) => {
    const [updated] = await tx.update(systemConnections).set({
      connected, connectedAt: connected ? new Date() : null,
      lastSyncAt: connected ? new Date() : null, revision: sql`${systemConnections.revision} + 1`,
    }).where(and(eq(systemConnections.workspaceId, workspaceId), eq(systemConnections.systemId, systemId))).returning();
    if (!updated) throw new Error("Mock system not found in this workspace.");
    await audit(tx, workspaceId, userId, connected ? "mock-connected" : "mock-disconnected", systemId, {
      connected, revision: updated.revision, mode: "synthetic-local",
    });
  });
}

export async function updateMockRecord(
  userId: string, workspaceId: string, systemId: SystemId, input: MockRecord, expectedRevision: number,
) {
  await requirePermission(userId, workspaceId, "workspace:edit");
  const record = MockRecordSchema.parse(input);
  const db = await getDatabase();
  await db.transaction(async (tx) => {
    const [connection] = await tx.select().from(systemConnections)
      .where(and(eq(systemConnections.workspaceId, workspaceId), eq(systemConnections.systemId, systemId))).for("update");
    if (!connection) throw new Error("Mock system not found.");
    if (connection.revision !== expectedRevision) throw new Error("This system changed. Refresh before saving your edit.");
    const current = connection.records.find((item) => item.id === record.id);
    if (!current || current.kind !== record.kind) throw new Error("Only existing mock records of the same type may be edited.");
    if (Object.keys(current.data).sort().join() !== Object.keys(record.data).sort().join()) {
      throw new Error("Keep the record's existing fields. Edit their values rather than the mock schema.");
    }
    for (const [key, value] of Object.entries(current.data)) {
      if (value !== null && typeof value !== typeof record.data[key]) {
        throw new Error(`The type of ${key} must remain ${typeof value}.`);
      }
    }
    await tx.update(systemConnections).set({
      records: connection.records.map((item) => item.id === record.id ? record : item),
      revision: connection.revision + 1, lastSyncAt: new Date(),
    }).where(eq(systemConnections.id, connection.id));
    await audit(tx, workspaceId, userId, "mock-record-updated", record.id, { systemId, revision: connection.revision + 1 });
  });
}

export async function setAutomationEnabled(userId: string, workspaceId: string, enabled: boolean) {
  await requirePermission(userId, workspaceId, "workspace:edit");
  const db = await getDatabase();
  await requireEnvironment(db, workspaceId);
  await db.transaction(async (tx) => {
    await tx.update(environments).set({ enabled, authorizedBy: userId, workerError: null })
      .where(eq(environments.workspaceId, workspaceId));
    await audit(tx, workspaceId, userId, enabled ? "automation-enabled" : "automation-paused", workspaceId, { enabled });
  });
}

export async function queueAgentWork(userId: string, workspaceId: string, playbookId: string) {
  await requirePermission(userId, workspaceId, "workspace:edit");
  if (!playbooks.some((playbook) => playbook.id === playbookId)) throw new Error("Unknown execution playbook.");
  const db = await getDatabase();
  await requireEnvironment(db, workspaceId);
  const [run] = await db.select().from(agentRuns)
    .where(and(eq(agentRuns.workspaceId, workspaceId), eq(agentRuns.playbookId, playbookId)));
  if (!run) throw new Error("Initialize the workflow before queuing this playbook.");
  await retryAgentRun(userId, workspaceId, run.id);
}

export async function retryAgentRun(userId: string, workspaceId: string, runId: string) {
  await requirePermission(userId, workspaceId, "workspace:edit");
  const db = await getDatabase();
  await db.transaction(async (tx) => {
    const [run] = await tx.select().from(agentRuns)
      .where(and(eq(agentRuns.workspaceId, workspaceId), eq(agentRuns.id, runId))).for("update");
    if (!run) throw new Error("Agent run not found.");
    if (run.status === "running") throw new Error("This agent is running. Pause or wait before retrying.");
    if (run.playbookId === "output-specification") throw new Error("This task needs an execution playbook; retrying cannot perform the real-world work.");
    const tasks = await tx.select().from(workspaceTasks).where(eq(workspaceTasks.workspaceId, workspaceId));
    const rootTask = tasks.find((task) => task.id === run.taskId);
    if (!rootTask) throw new Error("The run's task is missing.");
    const affected = new Set([rootTask.masterTaskId]);
    let added = true;
    while (added) {
      added = false;
      for (const task of tasks) {
        if (!affected.has(task.masterTaskId) && task.dependencies.some((dependency) => affected.has(dependency))) {
          affected.add(task.masterTaskId);
          added = true;
        }
      }
    }
    const runs = await tx.select().from(agentRuns).where(eq(agentRuns.workspaceId, workspaceId));
    const invalidated = runs.filter((candidate) =>
      tasks.some((task) => task.id === candidate.taskId && affected.has(task.masterTaskId)));
    if (invalidated.some((candidate) => candidate.status === "running")) throw new Error("A dependent agent is running. Wait before retrying this chain.");
    for (const candidate of invalidated) {
      const previousTask = tasks.find((task) => task.id === candidate.taskId);
      const preserveManualGate = candidate.id !== run.id &&
        (previousTask?.status === "blocked" || previousTask?.status === "not-applicable");
      await tx.update(agentRuns).set({
        status: candidate.playbookId === "output-specification" ? "needs-review" : "queued",
        requestedBy: userId, requested: candidate.id === run.id ? true : candidate.requested, blockers: [], error: null,
        artifact: candidate.playbookId === "output-specification" ? candidate.artifact : null,
        leaseUntil: null, updatedAt: new Date(),
        log: [...candidate.log, nowLog("Requeued with its dependency chain. Previous result is preserved in audit history.")].slice(-100),
      }).where(eq(agentRuns.id, candidate.id));
      if (!preserveManualGate) {
        await tx.update(workspaceTasks).set({ status: "not-started", percentComplete: 0, updatedAt: new Date() })
          .where(and(eq(workspaceTasks.workspaceId, workspaceId), eq(workspaceTasks.id, candidate.taskId)));
      }
      await audit(tx, workspaceId, userId, "agent-requeued", candidate.id, { previousArtifact: candidate.artifact, rootRunId: run.id });
    }
  });
}

export async function delegateRoadmapTask(userId: string, workspaceId: string, taskId: string) {
  await requirePermission(userId, workspaceId, "workspace:edit");
  const db = await getDatabase();
  await requireEnvironment(db, workspaceId);
  const [task] = await db.select().from(workspaceTasks)
    .where(and(eq(workspaceTasks.workspaceId, workspaceId), eq(workspaceTasks.id, taskId)));
  if (!task) throw new Error("Task not found.");
  const [existing] = await db.select().from(agentRuns).where(and(eq(agentRuns.workspaceId, workspaceId), eq(agentRuns.taskId, taskId)));
  const skill = taskSkill(task);
  if (existing && !(existing.playbookId === "output-specification" && skill)) throw new Error("This task already has an agent run. Open it in Workstreams.");
  if (skill) {
    await db.transaction(async (tx) => {
      const dependencies = [...new Set([
        ...task.dependencies,
        ...skill.dependsOn.map((id) => `agent-${id}`).filter((id) => id !== task.masterTaskId),
      ])];
      await tx.update(workspaceTasks).set({ dependencies, updatedAt: new Date() }).where(eq(workspaceTasks.id, taskId));
      const runId = existing?.id ?? newId("run");
      const delegated = await tx.insert(agentRuns).values({
        id: runId, workspaceId, taskId, playbookId: skill.id, requestedBy: userId, requested: true,
        log: [nowLog("Selected skill will produce a draft for this task. A finance reviewer must confirm the full task requirements.")],
      }).onConflictDoUpdate({
        target: [agentRuns.workspaceId, agentRuns.taskId],
        set: { playbookId: skill.id, status: "queued", requested: true, requestedBy: userId, artifact: null, error: null, blockers: [], updatedAt: new Date() },
        setWhere: eq(agentRuns.playbookId, "output-specification"),
      }).returning();
      if (!delegated.length) throw new Error("This task already has an active agent request. Refresh its status.");
      await audit(tx, workspaceId, userId, "task-delegated", runId, { skillId: skill.id, taskId, previousSpecification: existing?.artifact ?? null });
    });
    return;
  }
  const contract = assessTaskOutput(task);
  const artifact: AgentArtifact = {
    title: `Output assessment: ${task.title}`,
    summary: "The agent has assessed the required output. This is a work specification, not completed execution.",
    contract: { ...contract, requiresHumanApproval: true },
    sections: [{ title: "Execution requirements", body: task.description, columns: ["Required deliverable"], rows: task.deliverables.map((item) => [item]) }],
    sources: [], checks: [{ name: "Execution playbook available", passed: false, detail: "No task-specific execution recipe is registered for this roadmap item." }],
    recommendations: ["Assign an execution playbook and the required sources before marking this task complete."],
    limitations: ["Real-world hiring, payments, filings, audit opinions and signed agreements cannot be executed by this local simulator."],
    slides: [],
  };
  await db.transaction(async (tx) => {
    const runId = newId("run");
    await tx.insert(agentRuns).values({
      id: runId, workspaceId, taskId, playbookId: "output-specification",
      status: "needs-review", requestedBy: userId, artifact,
      blockers: ["Requires a task-specific execution playbook; output assessment only."],
      log: [nowLog("Assessed requested deliverables. Did not change task completion.")],
    });
    await audit(tx, workspaceId, userId, "output-assessed", runId, { contract: artifact.contract });
  });
}

export async function reviewAgentRun(
  userId: string, workspaceId: string, runId: string, decision: "approve" | "request-changes", notes: string,
) {
  await requirePermission(userId, workspaceId, "workspace:edit");
  const db = await getDatabase();
  await db.transaction(async (tx) => {
    const [run] = await tx.select().from(agentRuns)
      .where(and(eq(agentRuns.workspaceId, workspaceId), eq(agentRuns.id, runId))).for("update");
    if (!run || run.status !== "needs-review" || !run.artifact) throw new Error("This run is not awaiting review.");
    if (decision === "approve" && (run.playbookId === "output-specification" || !run.artifact.checks.length || run.artifact.checks.some((check) => !check.passed))) {
      throw new Error("An output specification or failed result cannot be approved as completed work.");
    }
    if (decision === "approve") {
      const connections = await tx.select().from(systemConnections).where(eq(systemConnections.workspaceId, workspaceId));
      if (run.artifact.sources.some((source) => {
        const system = connections.find((item) => item.systemId === source.systemId);
        return !system?.connected || system.revision !== source.revision;
      })) throw new Error("The evidence changed or was disconnected. Retry this run before approval.");
      const tasks = await tx.select().from(workspaceTasks).where(eq(workspaceTasks.workspaceId, workspaceId));
      const task = tasks.find((item) => item.id === run.taskId);
      if (!task || task.dependencies.some((dependency) =>
        !tasks.some((item) => item.masterTaskId === dependency && isSatisfiedTask(item.status)))) {
        throw new Error("A prerequisite is no longer complete. Resolve it before approval.");
      }
    }
    if (decision === "request-changes" && notes.trim().length < 5) throw new Error("Describe what needs to change.");
    await tx.update(agentRuns).set({
      status: decision === "approve" ? "completed" : "failed",
      error: decision === "request-changes" ? notes : null, updatedAt: new Date(),
      log: [...run.log, nowLog(`${decision}: ${notes || "Accepted by finance reviewer."}`)],
    }).where(eq(agentRuns.id, runId));
    if (decision === "approve") {
      await tx.update(workspaceTasks).set({ status: "complete", percentComplete: 100, updatedAt: new Date() })
        .where(and(eq(workspaceTasks.workspaceId, workspaceId), eq(workspaceTasks.id, run.taskId)));
    }
    await audit(tx, workspaceId, userId, `agent-${decision}`, runId, { notes });
  });
}

export async function getAgentArtifact(userId: string, workspaceId: string, runId: string) {
  await requirePermission(userId, workspaceId, "workspace:view");
  const db = await getDatabase();
  const [run] = await db.select().from(agentRuns).where(and(eq(agentRuns.workspaceId, workspaceId), eq(agentRuns.id, runId)));
  if (!run?.artifact) throw new Error("Agent output not found.");
  return run.artifact;
}

function meetingView(row: typeof reviewMeetings.$inferSelect): ReviewMeetingView {
  return {
    id: row.id, runId: row.runId, title: row.title, status: row.status,
    slideIndex: row.slideIndex, messages: row.messages, createdAt: row.createdAt.toISOString(),
    artifact: row.artifact,
  };
}

export async function createReviewMeeting(userId: string, workspaceId: string, runId: string) {
  await requirePermission(userId, workspaceId, "workspace:edit");
  const db = await getDatabase();
  const environment = await requireEnvironment(db, workspaceId);
  if (!environment.assessment.presentationsEnabled) throw new Error("Enable presentations in the introductory assessment first.");
  const artifact = await getAgentArtifact(userId, workspaceId, runId);
  if (!artifact.slides.length) throw new Error("This output does not have a review presentation.");
  return db.transaction(async (tx) => {
    const [meeting] = await tx.insert(reviewMeetings).values({
      id: newId("review"), workspaceId, runId, title: `${artifact.title} - review`,
      artifact,
      messages: [{ role: "agent", text: `${artifact.summary}\nLocal demo facilitator: ask about sources, risks, metrics or recommended actions.`, at: new Date().toISOString() }],
    }).returning();
    if (!meeting) throw new Error("Could not create the review room.");
    await audit(tx, workspaceId, userId, "review-created", meeting.id, { runId });
    return meetingView(meeting);
  });
}

export async function updateReviewMeeting(
  userId: string, workspaceId: string, meetingId: string,
  status: "scheduled" | "active" | "ended", slideIndex: number,
) {
  await requirePermission(userId, workspaceId, "workspace:edit");
  const db = await getDatabase();
  const [meeting] = await db.select().from(reviewMeetings)
    .where(and(eq(reviewMeetings.workspaceId, workspaceId), eq(reviewMeetings.id, meetingId)));
  if (!meeting) throw new Error("Review room not found.");
  const artifact = meeting.artifact;
  if (!Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex >= artifact.slides.length) throw new Error("Invalid slide index.");
  await db.transaction(async (tx) => {
    await tx.update(reviewMeetings).set({ status, slideIndex }).where(eq(reviewMeetings.id, meetingId));
    if (status !== meeting.status) {
      await audit(tx, workspaceId, userId, `review-${status}`, meetingId, { slideIndex });
    }
  });
}

export async function askReviewQuestion(userId: string, workspaceId: string, meetingId: string, question: string) {
  await requirePermission(userId, workspaceId, "workspace:edit");
  if (question.trim().length < 2 || question.length > 2000) throw new Error("Use a question between 2 and 2,000 characters.");
  const db = await getDatabase();
  return db.transaction(async (tx) => {
    const [meeting] = await tx.select().from(reviewMeetings)
      .where(and(eq(reviewMeetings.workspaceId, workspaceId), eq(reviewMeetings.id, meetingId))).for("update");
    if (!meeting || meeting.status === "ended") throw new Error("Start or reopen the review before asking a question.");
    if (meeting.messages.length + 2 > MAX_REVIEW_MESSAGES) throw new Error("This review has reached 50 questions. Start a new review.");
    const timestamp = new Date().toISOString();
    const [updated] = await tx.update(reviewMeetings).set({
      status: "active",
      messages: [...meeting.messages,
        { role: "user", text: question.trim(), at: timestamp },
        { role: "agent", text: answerReviewQuestion(meeting.artifact, question), at: timestamp },
      ],
    }).where(eq(reviewMeetings.id, meetingId)).returning();
    if (!updated) throw new Error("Review update failed.");
    return meetingView(updated);
  });
}

function blockersFor(task: typeof workspaceTasks.$inferSelect, tasks: Array<typeof workspaceTasks.$inferSelect>, required: SystemId[], systems: SystemConnection[]) {
  const blockers: string[] = [];
  for (const dependency of new Set(task.dependencies)) {
    const prerequisite = tasks.find((item) => item.masterTaskId === dependency);
    if (!prerequisite) blockers.push(`Missing prerequisite: ${dependency}.`);
    else if (!isSatisfiedTask(prerequisite.status)) blockers.push(`Needs first: ${prerequisite.title}.`);
  }
  for (const systemId of required) {
    if (!systems.some((system) => system.id === systemId && system.connected)) blockers.push(`Connect the ${systemId} mock system.`);
  }
  if (task.status === "blocked") blockers.push("The roadmap task is manually blocked. Resolve the blocker in its notes.");
  if (isSatisfiedTask(task.status)) blockers.push("Task already completed or excluded manually. Requeue explicitly to generate a new output.");
  return blockers;
}

export async function processNextAgentRun(workspaceId: string): Promise<boolean> {
  const db = await getDatabase();
  const claim = await db.transaction(async (tx) => {
    const [environment] = await tx.select().from(environments).where(eq(environments.workspaceId, workspaceId)).for("update");
    if (!environment?.enabled) return null;
    const [authorization] = await tx.select().from(memberships).where(and(
      eq(memberships.workspaceId, workspaceId), eq(memberships.userId, environment.authorizedBy),
    ));
    if (!authorization || !can(RoleSchema.parse(authorization.role), "workspace:edit")) {
      await tx.update(environments).set({ enabled: false, workerError: "Automation paused: authorizing member no longer has edit access." })
        .where(eq(environments.workspaceId, workspaceId));
      return null;
    }
    await tx.update(environments).set({ heartbeat: new Date(), workerError: null }).where(eq(environments.workspaceId, workspaceId));
    await tx.update(agentRuns).set({
      status: "queued", leaseUntil: null, updatedAt: new Date(), error: "Recovered an interrupted run after its lease expired.",
    }).where(and(eq(agentRuns.workspaceId, workspaceId), eq(agentRuns.status, "running"), lt(agentRuns.leaseUntil, new Date())));
    const active = await tx.select({ id: agentRuns.id }).from(agentRuns)
      .where(and(eq(agentRuns.workspaceId, workspaceId), eq(agentRuns.status, "running")));
    if (active.length) return null;
    const profile = await environmentProfile(tx, workspaceId);
    const connectionRows = await tx.select().from(systemConnections).where(eq(systemConnections.workspaceId, workspaceId));
    const systems = mapSystems(profile, connectionRows);
    const tasks = await tx.select().from(workspaceTasks).where(eq(workspaceTasks.workspaceId, workspaceId));
    const runs = await tx.select().from(agentRuns).where(eq(agentRuns.workspaceId, workspaceId)).orderBy(asc(agentRuns.createdAt), asc(agentRuns.id));
    for (const run of runs.filter((item) => item.requested && (item.status === "queued" || item.status === "blocked"))) {
      const task = tasks.find((item) => item.id === run.taskId);
      const recipe = skills.find((item) => item.id === run.playbookId);
      if (!task || !recipe) {
        await tx.update(agentRuns).set({ status: "failed", error: "Task or execution playbook is missing.", updatedAt: new Date() }).where(eq(agentRuns.id, run.id));
        continue;
      }
      const blockers = blockersFor(task, tasks, recipe.contract.requiredSystems, systems);
      if (recipe.id === "team-assessment" && !systems.some((system) => system.id === "gmail" &&
        system.records.some((record) => record.data.taskId === task.id && ["meeting-transcript", "assessment-note"].includes(record.kind) &&
          typeof record.data.text === "string" && record.data.text.trim().length >= 40))) {
        blockers.push("Add a meeting transcript or assessment notes to this task.");
      }
      for (const dependency of task.dependencies) {
        const prerequisite = tasks.find((item) => item.masterTaskId === dependency);
        const predecessor = runs.find((item) => item.taskId === prerequisite?.id);
        if (predecessor?.status === "completed" && predecessor.artifact?.sources.some((source) =>
          !systems.some((system) => system.id === source.systemId && system.connected && system.revision === source.revision))) {
          blockers.push(`Refresh prerequisite output: ${prerequisite?.title}. Its source snapshot changed.`);
        }
      }
      if (blockers.length) {
        if (JSON.stringify(blockers) !== JSON.stringify(run.blockers) || run.status !== "blocked") {
          await tx.update(agentRuns).set({ status: "blocked", blockers, updatedAt: new Date() }).where(eq(agentRuns.id, run.id));
        }
        continue;
      }
      const claimedAt = new Date();
      await tx.update(agentRuns).set({
        status: "running", blockers: [], error: null, attempts: run.attempts + 1,
        updatedAt: claimedAt, leaseUntil: new Date(Date.now() + 60_000),
        log: [...run.log, nowLog("Assessed output contract; reading only connected mock systems.")],
      }).where(eq(agentRuns.id, run.id));
      return {
        run, task, recipe, profile, systems, assessment: environment.assessment, actorId: environment.authorizedBy,
        previousArtifacts: runs.filter((item) => item.status === "completed" && item.artifact)
          .flatMap((item) => item.artifact ? [item.artifact] : []),
      };
    }
    return null;
  });
  if (!claim) return false;
  try {
    const artifact = AgentArtifactSchema.parse(executePlaybook(claim.recipe.id, {
      profile: claim.profile, systems: claim.systems.filter((system) => system.connected),
      assessment: claim.assessment, previousArtifacts: claim.previousArtifacts, taskId: claim.task.id,
    }));
    if (!artifact.sections.length || !artifact.sources.length || !artifact.checks.length) throw new Error("Agent output is missing sections, sources or acceptance checks.");
    if (artifact.sources.some((source) => !claim.systems.some((system) =>
      system.connected && system.id === source.systemId && system.revision === source.revision &&
      system.records.some((record) => record.id === source.recordId)))) {
      throw new Error("Agent output cited a source outside its connected input snapshot.");
    }
    if (JSON.stringify(artifact.contract) !== JSON.stringify(claim.recipe.contract)) {
      throw new Error("Agent output changed its agreed acceptance contract.");
    }
    await db.transaction(async (tx) => {
      const environment = await requireEnvironment(tx, workspaceId);
      const [authorization] = await tx.select().from(memberships).where(and(
        eq(memberships.workspaceId, workspaceId), eq(memberships.userId, environment.authorizedBy),
      ));
      const connections = await tx.select().from(systemConnections).where(eq(systemConnections.workspaceId, workspaceId));
      const tasks = await tx.select().from(workspaceTasks).where(eq(workspaceTasks.workspaceId, workspaceId));
      const task = tasks.find((item) => item.id === claim.task.id);
      const inputsChanged = claim.recipe.contract.requiredSystems.some((systemId) => {
        const initial = claim.systems.find((item) => item.id === systemId);
        const latest = connections.find((item) => item.systemId === systemId);
        return !latest?.connected || latest.revision !== initial?.revision;
      });
      if (!environment.enabled || !authorization || !can(RoleSchema.parse(authorization.role), "workspace:edit") ||
          !task || task.updatedAt.getTime() !== claim.task.updatedAt.getTime() ||
          inputsChanged || JSON.stringify(environment.assessment) !== JSON.stringify(claim.assessment) ||
          (task && blockersFor(task, tasks, claim.recipe.contract.requiredSystems, mapSystems(claim.profile, connections)).length > 0)) {
        await tx.update(agentRuns).set({
          status: "queued", leaseUntil: null, updatedAt: new Date(),
          log: [...claim.run.log, nowLog("Inputs, task state or automation permission changed during execution; result discarded and work requeued.")],
        }).where(eq(agentRuns.id, claim.run.id));
        return;
      }
      const passed = artifact.checks.every((check) => check.passed);
      const review = claim.assessment.reviewBeforeComplete || artifact.contract.requiresHumanApproval ||
        claim.task.masterTaskId !== `agent-${claim.recipe.id}` || !passed;
      const log = [...claim.run.log,
        nowLog("Generated output using source records and completed prerequisite outputs."),
        nowLog(`${artifact.checks.filter((check) => check.passed).length}/${artifact.checks.length} acceptance checks passed.`),
        nowLog(review ? "Awaiting human review; downstream tasks remain blocked." : "Accepted validated demo output. Downstream work is now eligible."),
      ];
      await tx.update(agentRuns).set({
        artifact, status: review ? "needs-review" : "completed", error: null, blockers: [],
        log, leaseUntil: null, updatedAt: new Date(),
      }).where(eq(agentRuns.id, claim.run.id));
      await tx.update(workspaceTasks).set({
        status: review ? "in-progress" : "complete", percentComplete: review ? 90 : 100, updatedAt: new Date(),
      }).where(and(eq(workspaceTasks.workspaceId, workspaceId), eq(workspaceTasks.id, claim.task.id)));
      await audit(tx, workspaceId, claim.actorId, review ? "agent-awaiting-review" : "agent-completed", claim.run.id, {
        taskId: claim.task.id, checks: artifact.checks, sources: artifact.sources,
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown agent execution error.";
    await db.transaction(async (tx) => {
      await tx.update(agentRuns).set({
        status: "failed", error: message, leaseUntil: null, updatedAt: new Date(),
        log: [...claim.run.log, nowLog(`Execution failed: ${message}`)],
      }).where(and(eq(agentRuns.id, claim.run.id), eq(agentRuns.workspaceId, workspaceId)));
      await audit(tx, workspaceId, claim.actorId, "agent-failed", claim.run.id, { message });
    });
  }
  return true;
}

export async function processEnabledEnvironments() {
  const db = await getDatabase();
  const enabled = await db.select().from(environments).where(eq(environments.enabled, true));
  for (const environment of enabled) {
    try {
      // Bounded drain: run ready successors immediately, yielding after a workspace-sized batch.
      for (let count = 0; count < 50; count++) {
        if (!await processNextAgentRun(environment.workspaceId)) break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown worker error.";
      console.error("CFO automation worker failed", environment.workspaceId, message);
      await db.update(environments).set({ workerError: message, heartbeat: new Date() })
        .where(eq(environments.workspaceId, environment.workspaceId));
    }
  }
}

export async function exportEnvironment(userId: string, workspaceId: string): Promise<EnvironmentTransfer | null> {
  await requirePermission(userId, workspaceId, "export:create");
  const snapshot = await getAutomationSnapshot(userId, workspaceId);
  if (!snapshot.initialized) return null;
  const db = await getDatabase();
  const tasks = await db.select().from(workspaceTasks).where(eq(workspaceTasks.workspaceId, workspaceId));
  const masterIdForTask = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new Error("Agent task is missing from this workspace.");
    return task.masterTaskId;
  };
  return {
    version: 1, assessment: snapshot.assessment,
    taskReferences: Object.fromEntries(tasks.map((task) => [task.id, task.masterTaskId])),
    systems: snapshot.systems.map((system) => ({ systemId: system.id, records: system.records, revision: system.revision })),
    runs: snapshot.runs.map((run) => ({
      masterTaskId: masterIdForTask(run.taskId), playbookId: run.playbookId, status: run.status,
      attempts: run.attempts, requested: run.requested ?? true, artifact: run.artifact, error: run.error, log: run.log,
    })),
    meetings: snapshot.meetings.map((meeting) => {
      const run = snapshot.runs.find((item) => item.id === meeting.runId);
      if (!run) throw new Error("Review run is missing from this workspace.");
      return { runMasterTaskId: masterIdForTask(run.taskId), title: meeting.title, status: meeting.status,
        slideIndex: meeting.slideIndex, messages: meeting.messages, artifact: meeting.artifact };
    }),
  };
}

export async function restoreEnvironment(tx: Transaction, userId: string, workspaceId: string, raw: EnvironmentTransfer) {
  const payload = EnvironmentTransferSchema.parse(raw);
  if (new Set(payload.systems.map((system) => system.systemId)).size !== SYSTEM_IDS.length) throw new Error("Imported systems must include every mock provider exactly once.");
  await tx.insert(environments).values({ workspaceId, assessment: payload.assessment, authorizedBy: userId, enabled: false });
  const tasks = await tx.select().from(workspaceTasks).where(eq(workspaceTasks.workspaceId, workspaceId));
  for (const system of payload.systems) {
    const records = system.records.map((record) => {
      if (typeof record.data.taskId !== "string") return record;
      const masterId = payload.taskReferences[record.data.taskId];
      const task = tasks.find((item) => item.masterTaskId === masterId);
      if (!task) throw new Error("Imported task evidence is missing its roadmap task reference.");
      return { ...record, data: { ...record.data, taskId: task.id } };
    });
    await tx.insert(systemConnections).values({
      id: newId("conn"), workspaceId, systemId: system.systemId,
      records, revision: system.revision,
      connected: false, connectedAt: null, lastSyncAt: null,
    });
  }
  const runIds = new Map<string, string>();
  for (const run of payload.runs) {
    const task = tasks.find((item) => item.masterTaskId === run.masterTaskId);
    if (!task) throw new Error(`Import is missing the task for ${run.masterTaskId}.`);
    if (runIds.has(run.masterTaskId)) throw new Error("An imported task has duplicate agent runs.");
    const runId = newId("run");
    runIds.set(run.masterTaskId, runId);
    await tx.insert(agentRuns).values({
      ...run, id: runId, workspaceId, taskId: task.id, requestedBy: userId,
      status: run.status === "running" ? "queued" : run.status,
    });
  }
  for (const meeting of payload.meetings) {
    const runId = runIds.get(meeting.runMasterTaskId);
    if (!runId) throw new Error("Import is missing the agent run for a review.");
    await tx.insert(reviewMeetings).values({
      id: newId("review"), workspaceId, runId, title: meeting.title,
      status: meeting.status === "active" ? "scheduled" : meeting.status,
      messages: meeting.messages, artifact: meeting.artifact, slideIndex: meeting.slideIndex,
    });
  }
}
