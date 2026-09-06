import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { CompanyProfileSchema, DEFAULT_ASSESSMENT, SYSTEM_IDS, EnvironmentTransferSchema } from "@cfo/domain";
import { playbooks } from "@cfo/automation";
import {
  addWorkspaceMember, closeDatabase, createCredentialUser, createWorkspace,
  getDatabase, getWorkspaceSnapshot, importWorkspace,
} from "./index";
import {
  askReviewQuestion, createReviewMeeting, delegateRoadmapTask, getAutomationSnapshot,
  initializeEnvironment, processNextAgentRun, retryAgentRun, reviewAgentRun,
  saveAssessment, setAutomationEnabled, setSystemConnection, updateMockRecord, updateReviewMeeting,
  exportEnvironment,
} from "./automation-repository";
import { agentRuns, reviewMeetings } from "./automation-schema";
import { workspaceTasks } from "./schema";

const profile = CompanyProfileSchema.parse({
  name: "Automation Test AI", stage: "series-b", startDate: "2026-09-05",
  fiscalYearEndMonth: 12, businessModels: ["b2b-saas-usage"],
  annualRevenueMillions: 12, arrMillions: 14, cashRunwayMonths: 18,
  employeeCount: 90, entityCount: 1, countries: ["US"],
  internationalEmployees: false, closeDays: 15, auditStatus: "planning",
  auditDueDate: null, fundraiseDate: null, nextBoardDate: null,
  accountingSystem: "quickbooks", billingModel: "hybrid", salesTaxNexusStates: 5,
  financeTeam: {
    controller: "none", strategicFinance: "none", financeOperations: "fractional",
    tax: "outsourced", treasury: "none", staffAccountants: 1,
  },
});

describe.sequential("connected company automation", () => {
  let tempDirectory: string;
  let adminId: string;
  let viewerId: string;
  let workspaceId: string;
  let firstRunId: string;

  beforeAll(async () => {
    tempDirectory = await mkdtemp(path.join(tmpdir(), "cfo-environment-"));
    process.env.CFO_DATABASE_PATH = path.join(tempDirectory, "database");
    const admin = await createCredentialUser({ name: "CFO", email: "cfo@automation.example", passwordHash: "not-a-real-login" });
    const viewer = await createCredentialUser({ name: "Viewer", email: "viewer@automation.example", passwordHash: "not-a-real-login" });
    adminId = admin.id;
    viewerId = viewer.id;
    const workspace = await createWorkspace({
      actorId: adminId, name: profile.name, slug: "automation-test",
      profile, roadmap: [], hiringRecommendations: [],
    });
    workspaceId = workspace.id;
    await addWorkspaceMember({ actorId: adminId, workspaceId, userId: viewerId, role: "viewer" });
  }, 30_000);

  afterAll(async () => {
    await closeDatabase();
    await rm(tempDirectory, { recursive: true, force: true });
    delete process.env.CFO_DATABASE_PATH;
  });

  it("requires edit access and initializes idempotently without replacing roadmap data", async () => {
    expect((await getAutomationSnapshot(adminId, workspaceId)).initialized).toBe(false);
    await expect(initializeEnvironment(viewerId, workspaceId, DEFAULT_ASSESSMENT)).rejects.toThrow("permission");
    await initializeEnvironment(adminId, workspaceId, DEFAULT_ASSESSMENT);
    await initializeEnvironment(adminId, workspaceId, DEFAULT_ASSESSMENT);
    const snapshot = await getAutomationSnapshot(adminId, workspaceId);
    expect(snapshot.systems).toHaveLength(8);
    expect(snapshot.runs).toHaveLength(playbooks.length);
    expect(snapshot.enabled).toBe(false);
    expect(snapshot.systems.every((system) => !system.connected && system.records.length > 0)).toBe(true);
    await expect(getAutomationSnapshot(viewerId, "some-other-workspace")).rejects.toThrow();
    await expect(setSystemConnection(viewerId, workspaceId, "gmail", true)).rejects.toThrow("permission");
  });

  it("waits for connector consent and does not run while paused", async () => {
    expect(await processNextAgentRun(workspaceId)).toBe(false);
    await setAutomationEnabled(adminId, workspaceId, true);
    expect(await processNextAgentRun(workspaceId)).toBe(false);
    const snapshot = await getAutomationSnapshot(adminId, workspaceId);
    expect(snapshot.runs.every((run) => run.status === "blocked")).toBe(true);
    expect(snapshot.runs.some((run) => run.blockers.some((reason) => reason.includes("Connect")))).toBe(true);
  });

  it("drains the dependency graph, but waits for required reviews before launching successors", async () => {
    for (const systemId of SYSTEM_IDS) await setSystemConnection(adminId, workspaceId, systemId, true);
    for (let iteration = 0; iteration < 80; iteration++) {
      const ran = await processNextAgentRun(workspaceId);
      const snapshot = await getAutomationSnapshot(adminId, workspaceId);
      const awaiting = snapshot.runs.filter((run) => run.status === "needs-review");
      for (const run of awaiting) {
        expect(run.artifact?.checks.every((check) => check.passed), JSON.stringify(run.artifact?.checks)).toBe(true);
        await reviewAgentRun(adminId, workspaceId, run.id, "approve", "Reviewed synthetic diagnostic.");
      }
      if (!ran && !awaiting.length) break;
    }
    const snapshot = await getAutomationSnapshot(adminId, workspaceId);
    expect(snapshot.runs.map((run) => ({ id: run.playbookId, status: run.status, error: run.error })).sort((a, b) => a.id.localeCompare(b.id)))
      .toEqual([...playbooks].sort((a, b) => a.id.localeCompare(b.id)).map((recipe) => ({ id: recipe.id, status: "completed", error: null })));
    expect(snapshot.runs.every((run) => run.artifact && run.artifact.sections.length && run.artifact.sources.length && run.attempts === 1)).toBe(true);
    expect(await processNextAgentRun(workspaceId)).toBe(false);
    const first = snapshot.runs.find((run) => playbooks.find((recipe) => recipe.id === run.playbookId)?.dependsOn.length === 0);
    if (!first) throw new Error("No root run.");
    firstRunId = first.id;
    const tasks = await getWorkspaceSnapshot(adminId, "automation-test");
    expect(tasks.tasks.every((task) => task.status === "complete")).toBe(true);
  }, 30_000);

  it("uses immutable reviewed artifacts and persists grounded discussion", async () => {
    const room = await createReviewMeeting(adminId, workspaceId, firstRunId);
    expect(room.artifact.slides.length).toBeGreaterThan(0);
    await updateReviewMeeting(adminId, workspaceId, room.id, "active", 0);
    const answered = await askReviewQuestion(adminId, workspaceId, room.id, "Which sources support this?");
    expect(answered.messages.length).toBe(3);
    expect(answered.messages.at(-1)?.role).toBe("agent");
    await retryAgentRun(adminId, workspaceId, firstRunId);
    const snapshot = await getAutomationSnapshot(adminId, workspaceId);
    expect(snapshot.runs.find((run) => run.id === firstRunId)?.artifact).toBeNull();
    expect(snapshot.meetings.find((meeting) => meeting.id === room.id)?.artifact).toEqual(room.artifact);
    await updateReviewMeeting(adminId, workspaceId, room.id, "ended", 0);
    await expect(askReviewQuestion(adminId, workspaceId, room.id, "What next?")).rejects.toThrow("reopen");
  });

  it("protects source revisions and retries with current data", async () => {
    const snapshot = await getAutomationSnapshot(adminId, workspaceId);
    const system = snapshot.systems[0];
    const record = system?.records[0];
    if (!system || !record) throw new Error("Missing source fixtures.");
    await updateMockRecord(adminId, workspaceId, system.id, { ...record, title: "Updated synthetic record" }, system.revision);
    await expect(updateMockRecord(adminId, workspaceId, system.id, record, system.revision)).rejects.toThrow("Refresh");
    await saveAssessment(adminId, workspaceId, { ...DEFAULT_ASSESSMENT, reviewBeforeComplete: true });
    expect(await processNextAgentRun(workspaceId)).toBe(true);
    const reviewed = await getAutomationSnapshot(adminId, workspaceId);
    const run = reviewed.runs.find((item) => item.id === firstRunId);
    expect(run?.status).toBe("needs-review");
    expect(run?.attempts).toBe(2);
    await reviewAgentRun(adminId, workspaceId, firstRunId, "request-changes", "Recheck source context before approval.");
    expect((await getAutomationSnapshot(adminId, workspaceId)).runs.find((item) => item.id === firstRunId)?.status).toBe("failed");
    expect(await processNextAgentRun(workspaceId)).toBe(false);
  });

  it("does not claim arbitrary real-world tasks are complete after output assessment", async () => {
    const db = await getDatabase();
    const taskId = "real-world-audit";
    await db.insert(workspaceTasks).values({
      id: taskId, workspaceId, masterTaskId: taskId, workstream: "controllership", phase: "months-4-6",
      title: "Pass an external audit", description: "Obtain an opinion from an independent qualified auditor.",
      outcome: "Signed auditor opinion", priority: "critical", startDate: profile.startDate, endDate: profile.startDate,
      ownerRole: "Controller", financeResponsibility: "partners", recommendationReason: "An external auditor must perform the actual audit.",
      deliverables: ["Signed auditor opinion"],
    });
    await delegateRoadmapTask(adminId, workspaceId, taskId);
    const snapshot = await getAutomationSnapshot(adminId, workspaceId);
    const run = snapshot.runs.find((item) => item.taskId === taskId);
    if (!run) throw new Error("Missing assessed task.");
    expect(run.status).toBe("needs-review");
    expect(run.artifact?.checks.some((check) => !check.passed)).toBe(true);
    await expect(reviewAgentRun(adminId, workspaceId, run.id, "approve", "approve")).rejects.toThrow("cannot be approved");
    const [task] = await db.select().from(workspaceTasks).where(eq(workspaceTasks.id, taskId));
    expect(task?.status).toBe("not-started");
  });

  it("recovers an expired lease without duplicating a run and preserves data across restart", async () => {
    await retryAgentRun(adminId, workspaceId, firstRunId);
    const db = await getDatabase();
    await db.update(agentRuns).set({ status: "running", leaseUntil: new Date(Date.now() - 1000) }).where(eq(agentRuns.id, firstRunId));
    await closeDatabase();
    expect(await processNextAgentRun(workspaceId)).toBe(true);
    const snapshot = await getAutomationSnapshot(adminId, workspaceId);
    expect(snapshot.runs.filter((run) => run.id === firstRunId)).toHaveLength(1);
    expect(snapshot.runs.find((run) => run.id === firstRunId)?.status).toBe("needs-review");
    await setAutomationEnabled(adminId, workspaceId, false);
  });

  it("exports and imports records, reports and reviews while requiring fresh connection consent", async () => {
    const source = await getWorkspaceSnapshot(adminId, "automation-test");
    const transfer = await exportEnvironment(adminId, workspaceId);
    if (!transfer) throw new Error("Missing environment export.");
    const imported = await importWorkspace(adminId, {
      name: "Imported demo", slug: "imported-demo", profile,
      tasks: source.tasks, vendorEvaluations: [], hiringPlans: [], templateInstances: [],
      automation: transfer,
    });
    const snapshot = await getAutomationSnapshot(adminId, imported.id);
    expect(snapshot.enabled).toBe(false);
    expect(snapshot.systems.every((system) => !system.connected)).toBe(true);
    expect(snapshot.systems.map((system) => system.records)).toEqual(
      (await getAutomationSnapshot(adminId, workspaceId)).systems.map((system) => system.records),
    );
    expect(snapshot.runs).toHaveLength(transfer.runs.length);
    expect(snapshot.meetings).toHaveLength(transfer.meetings.length);
    await expect(getAutomationSnapshot(viewerId, imported.id)).rejects.toThrow();
    expect(await processNextAgentRun(imported.id)).toBe(false);
  });

  it("keeps manual blockers and exclusions when an upstream report is retried", async () => {
    const db = await getDatabase();
    const rootRun = (await getAutomationSnapshot(adminId, workspaceId)).runs.find((run) => run.id === firstRunId);
    if (!rootRun) throw new Error("Missing root run.");
    for (const state of ["blocked", "not-applicable"] as const) {
      const id = `manually-${state}`;
      await db.insert(workspaceTasks).values({
        id, workspaceId, masterTaskId: id, workstream: "leadership", phase: "days-1-30",
        title: id, description: "Preserve the CFO's manual gate.", outcome: "Manual gate preserved.",
        status: state, priority: "high", startDate: profile.startDate, endDate: profile.startDate,
        ownerRole: "CFO", financeResponsibility: "owns", recommendationReason: "Manual gate fixture.",
        dependencies: [`agent-${rootRun.playbookId}`],
      });
      await db.insert(agentRuns).values({
        id: `run-${id}`, workspaceId, taskId: id, playbookId: rootRun.playbookId,
        requestedBy: adminId, status: "blocked",
      });
    }
    await retryAgentRun(adminId, workspaceId, firstRunId);
    for (const state of ["blocked", "not-applicable"] as const) {
      const [task] = await db.select().from(workspaceTasks).where(eq(workspaceTasks.id, `manually-${state}`));
      expect(task?.status).toBe(state);
    }
  });

  it("keeps a full review conversation within the export/import limit", async () => {
    await setAutomationEnabled(adminId, workspaceId, true);
    await processNextAgentRun(workspaceId);
    const meeting = await createReviewMeeting(adminId, workspaceId, firstRunId);
    const db = await getDatabase();
    await db.update(reviewMeetings).set({
      status: "active",
      messages: Array.from({ length: 99 }, () => ({
        role: "agent" as const, text: "Earlier review message.", at: new Date().toISOString(),
      })),
    }).where(eq(reviewMeetings.id, meeting.id));
    const full = await askReviewQuestion(adminId, workspaceId, meeting.id, "What are the sources?");
    expect(full.messages).toHaveLength(101);
    await expect(askReviewQuestion(adminId, workspaceId, meeting.id, "What next?")).rejects.toThrow("50 questions");
    expect(EnvironmentTransferSchema.safeParse(await exportEnvironment(adminId, workspaceId)).success).toBe(true);
    await setAutomationEnabled(adminId, workspaceId, false);
  });
});
