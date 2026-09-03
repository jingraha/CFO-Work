import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { CompanyProfileSchema, type RoadmapTask } from "@cfo/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addWorkspaceMember,
  closeDatabase,
  createCredentialUser,
  createWorkspace,
  getDatabase,
  getWorkspaceSnapshot,
  importWorkspace,
  updateWorkspaceTask,
} from "./index";

const databasePath = path.join(
  tmpdir(),
  `startup-cfo-os-db-test-${crypto.randomUUID()}`,
);

const profile = CompanyProfileSchema.parse({
  name: "Tenant Test AI",
  stage: "series-b",
  startDate: "2026-09-01",
  fiscalYearEndMonth: 12,
  businessModels: ["b2b-saas-usage"],
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
  salesTaxNexusStates: 4,
  financeTeam: {
    controller: "none",
    strategicFinance: "none",
    financeOperations: "fractional",
    tax: "outsourced",
    treasury: "none",
    staffAccountants: 1,
  },
});

const roadmap: RoadmapTask[] = [
  {
    id: "tenant-test-task",
    workstream: "leadership",
    phase: "days-1-30",
    title: "Confirm the finance operating cadence",
    description: "Document the recurring meetings and decision owners.",
    outcome: "A published operating cadence.",
    priority: "high",
    startOffsetDays: 0,
    durationDays: 5,
    ownerRole: "CFO",
    financeResponsibility: "owns",
    dependencies: [],
    conditions: [],
    recommendationReason: "Every incoming CFO needs an explicit cadence.",
    evidence: ["Published cadence"],
    deliverables: ["Finance operating cadence"],
    tags: ["leadership"],
    cadence: null,
    sourceUrls: [],
    startDate: "2026-09-01",
    endDate: "2026-09-05",
    includedBecause: "Every incoming CFO needs an explicit cadence.",
  },
];

describe("workspace persistence and authorization", () => {
  let adminId: string;
  let viewerId: string;
  let firstWorkspace: { id: string; slug: string };
  let secondWorkspace: { id: string; slug: string };

  beforeAll(async () => {
    process.env.CFO_DATABASE_PATH = databasePath;
    const [firstConnection, secondConnection] = await Promise.all([
      getDatabase(),
      getDatabase(),
    ]);
    expect(firstConnection).toBe(secondConnection);
    const admin = await createCredentialUser({
      name: "Admin",
      email: "admin@test.local",
      passwordHash: "test-hash",
    });
    const viewer = await createCredentialUser({
      name: "Viewer",
      email: "viewer@test.local",
      passwordHash: "test-hash",
    });
    adminId = admin.id;
    viewerId = viewer.id;
    firstWorkspace = await createWorkspace({
      actorId: adminId,
      name: "First",
      slug: "first",
      profile,
      roadmap,
      hiringRecommendations: [],
    });
    secondWorkspace = await createWorkspace({
      actorId: adminId,
      name: "Second",
      slug: "second",
      profile: { ...profile, name: "Second" },
      roadmap,
      hiringRecommendations: [],
    });
    await addWorkspaceMember({
      actorId: adminId,
      workspaceId: firstWorkspace.id,
      userId: viewerId,
      role: "viewer",
    });
  });

  afterAll(async () => {
    await closeDatabase();
    await rm(databasePath, { recursive: true, force: true });
  });

  it("allows a member to read only their workspace", async () => {
    const snapshot = await getWorkspaceSnapshot(viewerId, firstWorkspace.slug);
    expect(snapshot.workspace.role).toBe("viewer");
    expect(snapshot.tasks).toHaveLength(1);
    expect(snapshot.auditEvents).toHaveLength(0);
    await expect(
      getWorkspaceSnapshot(viewerId, secondWorkspace.slug),
    ).rejects.toThrow("Workspace not found");
  });

  it("enforces role permissions on task mutations", async () => {
    const snapshot = await getWorkspaceSnapshot(adminId, firstWorkspace.slug);
    const task = snapshot.tasks[0];
    expect(task).toBeDefined();
    if (!task) return;

    await expect(
      updateWorkspaceTask(viewerId, firstWorkspace.id, task.id, {
        status: "complete",
      }),
    ).rejects.toThrow("only edit tasks assigned");

    const updated = await updateWorkspaceTask(
      adminId,
      firstWorkspace.id,
      task.id,
      { status: "complete" },
    );
    expect(updated.status).toBe("complete");
    expect(updated.percentComplete).toBe(100);

    const secondSnapshot = await getWorkspaceSnapshot(
      adminId,
      secondWorkspace.slug,
    );
    const secondTask = secondSnapshot.tasks[0];
    expect(secondTask).toBeDefined();
    if (!secondTask) return;
    await expect(
      updateWorkspaceTask(adminId, secondWorkspace.id, secondTask.id, {
        ownerId: viewerId,
      }),
    ).rejects.toThrow("not a workspace member");
  });

  it("imports a portable workspace without carrying user assignments", async () => {
    const source = await getWorkspaceSnapshot(adminId, firstWorkspace.slug);
    const task = source.tasks[0];
    expect(task).toBeDefined();
    if (!task) return;
    const imported = await importWorkspace(adminId, {
      name: "Imported",
      slug: "imported",
      profile: { ...profile, name: "Imported" },
      tasks: [
        {
          masterTaskId: task.masterTaskId,
          workstream: task.workstream,
          phase: task.phase,
          title: task.title,
          description: task.description,
          outcome: task.outcome,
          status: task.status,
          priority: task.priority,
          startDate: task.startDate,
          endDate: task.endDate,
          percentComplete: task.percentComplete,
          ownerRole: task.ownerRole,
          financeResponsibility: task.financeResponsibility,
          notes: task.notes,
          recommendationReason: task.recommendationReason,
          dependencies: task.dependencies,
          evidenceLinks: task.evidenceLinks,
          evidenceRequirements: task.evidenceRequirements,
          deliverables: task.deliverables,
          tags: task.tags,
          cadence: task.cadence,
        },
      ],
      vendorEvaluations: [],
      hiringPlans: [],
      templateInstances: [],
    });
    const snapshot = await getWorkspaceSnapshot(adminId, imported.slug);
    expect(snapshot.profile?.name).toBe("Imported");
    expect(snapshot.tasks).toHaveLength(1);
    expect(snapshot.tasks[0]?.ownerId).toBeNull();
  });
});
