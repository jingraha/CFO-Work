import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_ASSESSMENT, SystemIdSchema, TaskEvidenceSchema, type SystemId, type TaskEvidence } from "@cfo/domain";
import { DEMO_AS_OF_DATE, taskSkill } from "@cfo/automation";
import { getDatabase } from "./client";
import { agentRuns, environments, systemConnections } from "./automation-schema";
import { auditEvents, workspaceTasks } from "./schema";
import { requirePermission } from "./repository";
import { delegateRoadmapTask, initializeEnvironment, retryAgentRun } from "./automation-repository";

export async function setSystemConnections(userId: string, workspaceId: string, input: SystemId[], connected: boolean) {
  await requirePermission(userId, workspaceId, "workspace:edit");
  const ids = z.array(SystemIdSchema).min(1).max(8).refine((values) => new Set(values).size === values.length, "Choose each connector once.").parse(input);
  await initializeEnvironment(userId, workspaceId, DEFAULT_ASSESSMENT, false);
  const db = await getDatabase();
  await db.transaction(async (tx) => {
    const rows = await tx.select().from(systemConnections).where(eq(systemConnections.workspaceId, workspaceId)).for("update");
    if (ids.some((id) => !rows.some((row) => row.systemId === id))) throw new Error("A selected connector is unavailable. Nothing was connected.");
    for (const id of ids) {
      const row = rows.find((item) => item.systemId === id)!;
      if (row.connected === connected) continue;
      await tx.update(systemConnections).set({
        connected, connectedAt: connected ? new Date() : null, lastSyncAt: connected ? new Date() : null,
        revision: row.revision + 1,
      }).where(eq(systemConnections.id, row.id));
    }
    await tx.insert(auditEvents).values({
      id: randomUUID(), workspaceId, actorId: userId, entityType: "connectors",
      entityId: workspaceId, action: connected ? "bulk-access-granted" : "bulk-access-revoked",
      after: { systemIds: ids, mode: "local-mock-read" },
    });
  });
}

export async function addTaskEvidence(userId: string, workspaceId: string, raw: TaskEvidence) {
  await requirePermission(userId, workspaceId, "workspace:edit");
  const input = TaskEvidenceSchema.parse(raw);
  const db = await getDatabase();
  const [task] = await db.select().from(workspaceTasks).where(and(eq(workspaceTasks.id, input.taskId), eq(workspaceTasks.workspaceId, workspaceId)));
  if (!task) throw new Error("Task not found.");
  await initializeEnvironment(userId, workspaceId, DEFAULT_ASSESSMENT, false);
  await db.transaction(async (tx) => {
    const [connection] = await tx.select().from(systemConnections)
      .where(and(eq(systemConnections.workspaceId, workspaceId), eq(systemConnections.systemId, "gmail"))).for("update");
    if (!connection) throw new Error("Assessment evidence storage is unavailable.");
    if (connection.records.length >= 2000) throw new Error("Evidence storage has reached its record limit.");
    const id = `evidence-${randomUUID()}`;
    await tx.update(systemConnections).set({
      records: [...connection.records, {
        id, title: input.title, kind: input.kind,
        data: { asOfDate: DEMO_AS_OF_DATE, taskId: input.taskId, text: input.text },
      }],
      revision: sql`${systemConnections.revision} + 1`, lastSyncAt: new Date(),
    }).where(eq(systemConnections.id, connection.id));
    await tx.insert(auditEvents).values({
      id: randomUUID(), workspaceId, actorId: userId, entityType: "task-evidence",
      entityId: id, action: "evidence-added", after: { taskId: task.id, kind: input.kind, title: input.title },
    });
  });
}

export async function requestTaskAgent(userId: string, workspaceId: string, taskId: string) {
  await requirePermission(userId, workspaceId, "workspace:edit");
  const db = await getDatabase();
  const [task] = await db.select().from(workspaceTasks)
    .where(and(eq(workspaceTasks.workspaceId, workspaceId), eq(workspaceTasks.id, taskId)));
  if (!task) throw new Error("Task not found.");
  await initializeEnvironment(userId, workspaceId, DEFAULT_ASSESSMENT, false);
  let [run] = await db.select().from(agentRuns)
    .where(and(eq(agentRuns.workspaceId, workspaceId), eq(agentRuns.taskId, taskId)));
  if (!run || (run.playbookId === "output-specification" && taskSkill(task))) {
    await delegateRoadmapTask(userId, workspaceId, taskId);
    [run] = await db.select().from(agentRuns).where(and(eq(agentRuns.workspaceId, workspaceId), eq(agentRuns.taskId, taskId)));
  }
  if (!run) throw new Error("The agent request could not be created.");
  if (run.playbookId === "output-specification") return;
  if (run.status === "running") throw new Error("This task is already running.");
  if (["completed", "failed", "needs-review"].includes(run.status)) await retryAgentRun(userId, workspaceId, run.id);
  await db.transaction(async (tx) => {
    const [environment] = await tx.select().from(environments).where(eq(environments.workspaceId, workspaceId)).for("update");
    const tasks = await tx.select().from(workspaceTasks).where(eq(workspaceTasks.workspaceId, workspaceId));
    const selected = tasks.find((item) => item.id === taskId);
    if (!selected) throw new Error("Task no longer exists.");
    const needed = new Set([selected.masterTaskId]);
    const visited = new Set<string>();
    const requestDependencies = (masterId: string) => {
      if (visited.has(masterId)) return;
      visited.add(masterId);
      const parent = tasks.find((item) => item.masterTaskId === masterId);
      for (const dependency of parent?.dependencies ?? []) {
        needed.add(dependency);
        requestDependencies(dependency);
      }
    };
    requestDependencies(selected.masterTaskId);
    const runs = await tx.select().from(agentRuns).where(eq(agentRuns.workspaceId, workspaceId));
    for (const job of runs) {
      const current = tasks.find((item) => item.id === job.taskId);
      if (current && needed.has(current.masterTaskId) && job.playbookId !== "output-specification") {
        await tx.update(agentRuns).set({ requested: true, requestedBy: userId }).where(eq(agentRuns.id, job.id));
      } else if (!environment?.enabled && job.attempts === 0 && ["queued", "blocked"].includes(job.status)) {
        // A selected start from a paused workspace must not launch untouched default jobs.
        await tx.update(agentRuns).set({ requested: false }).where(eq(agentRuns.id, job.id));
      }
    }
    await tx.update(environments).set({ enabled: true, authorizedBy: userId }).where(eq(environments.workspaceId, workspaceId));
    await tx.insert(auditEvents).values({
      id: randomUUID(), workspaceId, actorId: userId, entityType: "agent-work", entityId: taskId,
      action: "task-and-prerequisites-requested", after: { taskId, prerequisiteCount: needed.size - 1 },
    });
  });
}
