import { randomUUID } from "node:crypto";
import {
  CompanyProfileSchema,
  EvidenceLinkSchema,
  RoleSchema,
  TaskStatusSchema,
  can,
  type CompanyProfile,
  type HiringRole,
  type Permission,
  type RoadmapTask,
  type Role,
} from "@cfo/domain";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "./client";
import {
  account,
  auditEvents,
  companyProfiles,
  hiringPlans,
  memberships,
  templateInstances,
  user,
  vendorEvaluations,
  workspaces,
  workspaceTasks,
} from "./schema";

const taskUpdateSchema = z
  .object({
    status: TaskStatusSchema.optional(),
    priority: z.enum(["critical", "high", "medium", "low"]).optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    percentComplete: z.number().int().min(0).max(100).optional(),
    ownerId: z.string().nullable().optional(),
    notes: z.string().max(20_000).optional(),
    evidenceLinks: z.array(EvidenceLinkSchema).max(50).optional(),
  })
  .refine(
    (patch) =>
      !patch.startDate ||
      !patch.endDate ||
      patch.startDate.localeCompare(patch.endDate) <= 0,
    { message: "The task end date must be on or after its start date." },
  );

export type TaskUpdate = z.infer<typeof taskUpdateSchema>;

export type WorkspaceSummary = {
  id: string;
  slug: string;
  name: string;
  role: Role;
};

export type WorkspaceSnapshot = {
  workspace: WorkspaceSummary;
  profile: CompanyProfile | null;
  tasks: (typeof workspaceTasks.$inferSelect)[];
  vendorEvaluations: (typeof vendorEvaluations.$inferSelect)[];
  hiringPlans: (typeof hiringPlans.$inferSelect)[];
  templateInstances: (typeof templateInstances.$inferSelect)[];
  auditEvents: (typeof auditEvents.$inferSelect)[];
  members: Array<{
    id: string;
    userId: string;
    name: string;
    email: string;
    role: Role;
  }>;
};

export type WorkspaceImportData = {
  name: string;
  slug: string;
  profile: CompanyProfile;
  tasks: Array<
    Pick<
      typeof workspaceTasks.$inferInsert,
      | "masterTaskId"
      | "workstream"
      | "phase"
      | "title"
      | "description"
      | "outcome"
      | "status"
      | "priority"
      | "startDate"
      | "endDate"
      | "percentComplete"
      | "ownerRole"
      | "financeResponsibility"
      | "notes"
      | "recommendationReason"
      | "dependencies"
      | "evidenceLinks"
      | "evidenceRequirements"
      | "deliverables"
      | "tags"
      | "cadence"
    >
  >;
  vendorEvaluations: Array<{
    vendorId: string;
    status: string;
    scores: Record<string, number>;
    notes: string;
    decision: string;
  }>;
  hiringPlans: Array<{
    roleId: string;
    status: string;
    targetDate: string | null;
    notes: string;
  }>;
  templateInstances: Array<{
    templateId: string;
    values: Record<string, unknown>;
  }>;
};

function id(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export async function findUserByEmail(email: string) {
  const db = await getDatabase();
  const [found] = await db
    .select()
    .from(user)
    .where(eq(user.email, email.trim().toLowerCase()))
    .limit(1);
  return found ?? null;
}

export async function createCredentialUser(input: {
  name: string;
  email: string;
  passwordHash: string;
}) {
  const db = await getDatabase();
  const userId = id("user");
  const email = input.email.trim().toLowerCase();
  await db.transaction(async (transaction) => {
    await transaction.insert(user).values({
      id: userId,
      name: input.name.trim(),
      email,
      emailVerified: true,
    });
    await transaction.insert(account).values({
      id: id("account"),
      accountId: userId,
      providerId: "credential",
      issuer: "local:credential",
      userId,
      password: input.passwordHash,
    });
  });
  return { id: userId, name: input.name.trim(), email };
}

export async function ensureCredentialAccount(
  userId: string,
  passwordHash: string,
): Promise<void> {
  const db = await getDatabase();
  const [existing] = await db
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, "credential"),
      ),
    )
    .limit(1);
  if (existing) return;
  await db.insert(account).values({
    id: id("account"),
    accountId: userId,
    providerId: "credential",
    issuer: "local:credential",
    userId,
    password: passwordHash,
  });
}

async function getMembership(
  userId: string,
  workspaceId: string,
): Promise<{ id: string; role: Role }> {
  const db = await getDatabase();
  const [membership] = await db
    .select({ id: memberships.id, role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.workspaceId, workspaceId),
        eq(memberships.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) throw new Error("Workspace access denied.");
  return { id: membership.id, role: RoleSchema.parse(membership.role) };
}

async function requirePermission(
  userId: string,
  workspaceId: string,
  permission: Permission,
): Promise<Role> {
  const membership = await getMembership(userId, workspaceId);
  if (!can(membership.role, permission)) {
    throw new Error("You do not have permission to perform this action.");
  }
  return membership.role;
}

async function writeAuditEvent(input: {
  workspaceId: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  const db = await getDatabase();
  await db.insert(auditEvents).values({
    id: id("audit"),
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    before: input.before ?? null,
    after: input.after ?? null,
  });
}

export async function listUserWorkspaces(
  userId: string,
): Promise<WorkspaceSummary[]> {
  const db = await getDatabase();
  const rows = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(workspaces.name));

  return rows.map((row) => ({
    ...row,
    role: RoleSchema.parse(row.role),
  }));
}

export async function getWorkspaceSnapshot(
  userId: string,
  workspaceSlug: string,
): Promise<WorkspaceSnapshot> {
  const db = await getDatabase();
  const [workspaceRow] = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(
      and(
        eq(memberships.userId, userId),
        eq(workspaces.slug, workspaceSlug),
      ),
    )
    .limit(1);

  if (!workspaceRow) throw new Error("Workspace not found.");
  const role = RoleSchema.parse(workspaceRow.role);

  const [
    profileRows,
    taskRows,
    vendorRows,
    hiringRows,
    templateRows,
    auditRows,
    memberRows,
  ] = await Promise.all([
    db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.workspaceId, workspaceRow.id))
      .limit(1),
    db
      .select()
      .from(workspaceTasks)
      .where(eq(workspaceTasks.workspaceId, workspaceRow.id))
      .orderBy(asc(workspaceTasks.startDate), asc(workspaceTasks.title)),
    db
      .select()
      .from(vendorEvaluations)
      .where(eq(vendorEvaluations.workspaceId, workspaceRow.id)),
    db
      .select()
      .from(hiringPlans)
      .where(eq(hiringPlans.workspaceId, workspaceRow.id)),
    db
      .select()
      .from(templateInstances)
      .where(eq(templateInstances.workspaceId, workspaceRow.id)),
    db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.workspaceId, workspaceRow.id))
      .orderBy(desc(auditEvents.createdAt))
      .limit(100),
    db
      .select({
        id: memberships.id,
        userId: memberships.userId,
        name: user.name,
        email: user.email,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(user, eq(user.id, memberships.userId))
      .where(eq(memberships.workspaceId, workspaceRow.id))
      .orderBy(asc(user.name)),
  ]);

  return {
    workspace: {
      id: workspaceRow.id,
      slug: workspaceRow.slug,
      name: workspaceRow.name,
      role,
    },
    profile: profileRows[0]
      ? CompanyProfileSchema.parse(profileRows[0].profile)
      : null,
    tasks: taskRows,
    vendorEvaluations: vendorRows,
    hiringPlans: hiringRows,
    templateInstances: templateRows,
    auditEvents: can(role, "audit:view") ? auditRows : [],
    members: memberRows.map((member) => ({
      ...member,
      role: RoleSchema.parse(member.role),
    })),
  };
}

export async function createWorkspace(input: {
  actorId: string;
  name: string;
  slug: string;
  profile: CompanyProfile;
  roadmap: RoadmapTask[];
  hiringRecommendations: HiringRole[];
}): Promise<WorkspaceSummary> {
  const profile = CompanyProfileSchema.parse(input.profile);
  const db = await getDatabase();
  const workspaceId = id("ws");

  await db.transaction(async (transaction) => {
    await transaction.insert(workspaces).values({
      id: workspaceId,
      slug: input.slug,
      name: input.name,
    });
    await transaction.insert(memberships).values({
      id: id("member"),
      workspaceId,
      userId: input.actorId,
      role: "cfo-admin",
    });
    await transaction.insert(companyProfiles).values({
      workspaceId,
      profile,
    });
    if (input.roadmap.length > 0) {
      await transaction.insert(workspaceTasks).values(
        input.roadmap.map((task) => ({
          id: id("task"),
          workspaceId,
          masterTaskId: task.id,
          workstream: task.workstream,
          phase: task.phase,
          title: task.title,
          description: task.description,
          outcome: task.outcome,
          status: "not-started" as const,
          priority: task.priority,
          startDate: task.startDate,
          endDate: task.endDate,
          percentComplete: 0,
          ownerRole: task.ownerRole,
          financeResponsibility: task.financeResponsibility,
          recommendationReason: task.includedBecause,
          dependencies: task.dependencies,
          evidenceRequirements: task.evidence,
          deliverables: task.deliverables,
          tags: task.tags,
          cadence: task.cadence,
        })),
      );
    }

    if (input.hiringRecommendations.length > 0) {
      await transaction.insert(hiringPlans).values(
        input.hiringRecommendations.map((role) => ({
          id: id("hire"),
          workspaceId,
          roleId: role.id,
          status: "recommended",
        })),
      );
    }
  });

  await writeAuditEvent({
    workspaceId,
    actorId: input.actorId,
    entityType: "workspace",
    entityId: workspaceId,
    action: "created",
    after: { name: input.name, slug: input.slug },
  });

  return {
    id: workspaceId,
    slug: input.slug,
    name: input.name,
    role: "cfo-admin",
  };
}

export async function addWorkspaceMember(input: {
  actorId: string;
  workspaceId: string;
  userId: string;
  role: Role;
}): Promise<void> {
  await requirePermission(input.actorId, input.workspaceId, "members:manage");
  const role = RoleSchema.parse(input.role);
  const db = await getDatabase();
  await db.insert(memberships).values({
    id: id("member"),
    workspaceId: input.workspaceId,
    userId: input.userId,
    role,
  });
  await writeAuditEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    entityType: "membership",
    entityId: input.userId,
    action: "created",
    after: { role },
  });
}

export async function importWorkspace(
  actorId: string,
  input: WorkspaceImportData,
): Promise<WorkspaceSummary> {
  const profile = CompanyProfileSchema.parse(input.profile);
  const db = await getDatabase();
  const workspaceId = id("ws");
  await db.transaction(async (transaction) => {
    await transaction.insert(workspaces).values({
      id: workspaceId,
      name: input.name,
      slug: input.slug,
    });
    await transaction.insert(memberships).values({
      id: id("member"),
      workspaceId,
      userId: actorId,
      role: "cfo-admin",
    });
    await transaction.insert(companyProfiles).values({
      workspaceId,
      profile,
    });
    if (input.tasks.length > 0) {
      await transaction.insert(workspaceTasks).values(
        input.tasks.map((task) => ({
          ...task,
          id: id("task"),
          workspaceId,
          ownerId: null,
        })),
      );
    }
    if (input.vendorEvaluations.length > 0) {
      await transaction.insert(vendorEvaluations).values(
        input.vendorEvaluations.map((evaluation) => ({
          ...evaluation,
          id: id("vendor"),
          workspaceId,
        })),
      );
    }
    if (input.hiringPlans.length > 0) {
      await transaction.insert(hiringPlans).values(
        input.hiringPlans.map((plan) => ({
          ...plan,
          id: id("hire"),
          workspaceId,
        })),
      );
    }
    if (input.templateInstances.length > 0) {
      await transaction.insert(templateInstances).values(
        input.templateInstances.map((instance) => ({
          ...instance,
          id: id("template"),
          workspaceId,
          updatedBy: actorId,
        })),
      );
    }
  });
  await writeAuditEvent({
    workspaceId,
    actorId,
    entityType: "workspace",
    entityId: workspaceId,
    action: "imported",
    after: {
      taskCount: input.tasks.length,
      vendorEvaluationCount: input.vendorEvaluations.length,
      hiringPlanCount: input.hiringPlans.length,
      templateInstanceCount: input.templateInstances.length,
    },
  });
  return {
    id: workspaceId,
    slug: input.slug,
    name: input.name,
    role: "cfo-admin",
  };
}

export async function updateWorkspaceTask(
  userId: string,
  workspaceId: string,
  taskId: string,
  rawPatch: TaskUpdate,
): Promise<typeof workspaceTasks.$inferSelect> {
  const patch = taskUpdateSchema.parse(rawPatch);
  const db = await getDatabase();
  const [current] = await db
    .select()
    .from(workspaceTasks)
    .where(
      and(
        eq(workspaceTasks.id, taskId),
        eq(workspaceTasks.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!current) throw new Error("Task not found.");

  const membership = await getMembership(userId, workspaceId);
  const canEditAll = can(membership.role, "tasks:edit");
  const canEditAssigned =
    can(membership.role, "tasks:edit-assigned") && current.ownerId === userId;
  if (!canEditAll && !canEditAssigned) {
    throw new Error("You can only edit tasks assigned to you.");
  }
  if (
    patch.ownerId !== undefined &&
    patch.ownerId !== current.ownerId &&
    !canEditAll
  ) {
    throw new Error("Only a finance editor or CFO admin can reassign tasks.");
  }
  if (patch.ownerId) {
    const [ownerMembership] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.workspaceId, workspaceId),
          eq(memberships.userId, patch.ownerId),
        ),
      )
      .limit(1);
    if (!ownerMembership) {
      throw new Error("The selected task owner is not a workspace member.");
    }
  }

  const nextStart = patch.startDate ?? current.startDate;
  const nextEnd = patch.endDate ?? current.endDate;
  if (nextStart.localeCompare(nextEnd) > 0) {
    throw new Error("The task end date must be on or after its start date.");
  }

  const normalizedPatch = {
    ...patch,
    ...(patch.status === "complete" ? { percentComplete: 100 } : {}),
    updatedAt: new Date(),
  };
  const [updated] = await db
    .update(workspaceTasks)
    .set(normalizedPatch)
    .where(
      and(
        eq(workspaceTasks.id, taskId),
        eq(workspaceTasks.workspaceId, workspaceId),
      ),
    )
    .returning();
  if (!updated) throw new Error("Task update failed.");

  await writeAuditEvent({
    workspaceId,
    actorId: userId,
    entityType: "task",
    entityId: taskId,
    action: "updated",
    before: current,
    after: updated,
  });
  return updated;
}

export async function saveCompanyProfile(
  userId: string,
  workspaceId: string,
  rawProfile: CompanyProfile,
): Promise<CompanyProfile> {
  await requirePermission(userId, workspaceId, "profile:edit");
  const profile = CompanyProfileSchema.parse(rawProfile);
  const db = await getDatabase();
  const [current] = await db
    .select()
    .from(companyProfiles)
    .where(eq(companyProfiles.workspaceId, workspaceId))
    .limit(1);
  await db
    .insert(companyProfiles)
    .values({ workspaceId, profile })
    .onConflictDoUpdate({
      target: companyProfiles.workspaceId,
      set: { profile, updatedAt: new Date() },
    });
  await writeAuditEvent({
    workspaceId,
    actorId: userId,
    entityType: "company-profile",
    entityId: workspaceId,
    action: current ? "updated" : "created",
    before: current?.profile,
    after: profile,
  });
  return profile;
}

export async function syncWorkspaceRecommendations(input: {
  actorId: string;
  workspaceId: string;
  roadmap: RoadmapTask[];
  hiringRecommendations: HiringRole[];
}): Promise<{ tasksAdded: number; hiringRolesAdded: number }> {
  await requirePermission(input.actorId, input.workspaceId, "profile:edit");
  const db = await getDatabase();
  const [existingTaskRows, existingHiringRows] = await Promise.all([
    db
      .select({ masterTaskId: workspaceTasks.masterTaskId })
      .from(workspaceTasks)
      .where(eq(workspaceTasks.workspaceId, input.workspaceId)),
    db
      .select({ roleId: hiringPlans.roleId })
      .from(hiringPlans)
      .where(eq(hiringPlans.workspaceId, input.workspaceId)),
  ]);
  const existingTaskIds = new Set(
    existingTaskRows.map((task) => task.masterTaskId),
  );
  const existingHiringIds = new Set(
    existingHiringRows.map((plan) => plan.roleId),
  );
  const newTasks = input.roadmap.filter(
    (task) => !existingTaskIds.has(task.id),
  );
  const newHiring = input.hiringRecommendations.filter(
    (role) => !existingHiringIds.has(role.id),
  );

  await db.transaction(async (transaction) => {
    if (newTasks.length > 0) {
      await transaction.insert(workspaceTasks).values(
        newTasks.map((task) => ({
          id: id("task"),
          workspaceId: input.workspaceId,
          masterTaskId: task.id,
          workstream: task.workstream,
          phase: task.phase,
          title: task.title,
          description: task.description,
          outcome: task.outcome,
          status: "not-started" as const,
          priority: task.priority,
          startDate: task.startDate,
          endDate: task.endDate,
          percentComplete: 0,
          ownerRole: task.ownerRole,
          financeResponsibility: task.financeResponsibility,
          recommendationReason: task.includedBecause,
          dependencies: task.dependencies,
          evidenceRequirements: task.evidence,
          deliverables: task.deliverables,
          tags: task.tags,
          cadence: task.cadence,
        })),
      );
    }
    if (newHiring.length > 0) {
      await transaction.insert(hiringPlans).values(
        newHiring.map((role) => ({
          id: id("hire"),
          workspaceId: input.workspaceId,
          roleId: role.id,
          status: "recommended",
        })),
      );
    }
  });
  await writeAuditEvent({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    entityType: "roadmap",
    entityId: input.workspaceId,
    action: "recommendations-synced",
    after: {
      tasksAdded: newTasks.length,
      hiringRolesAdded: newHiring.length,
    },
  });
  return {
    tasksAdded: newTasks.length,
    hiringRolesAdded: newHiring.length,
  };
}

export async function saveVendorEvaluation(input: {
  userId: string;
  workspaceId: string;
  vendorId: string;
  status: string;
  scores: Record<string, number>;
  notes: string;
  decision: string;
}): Promise<void> {
  await requirePermission(input.userId, input.workspaceId, "vendors:edit");
  const db = await getDatabase();
  const values = {
    status: input.status.slice(0, 60),
    scores: input.scores,
    notes: input.notes.slice(0, 20_000),
    decision: input.decision.slice(0, 10_000),
    updatedAt: new Date(),
  };
  await db
    .insert(vendorEvaluations)
    .values({
      id: id("vendor"),
      workspaceId: input.workspaceId,
      vendorId: input.vendorId,
      ...values,
    })
    .onConflictDoUpdate({
      target: [
        vendorEvaluations.workspaceId,
        vendorEvaluations.vendorId,
      ],
      set: values,
    });
  await writeAuditEvent({
    workspaceId: input.workspaceId,
    actorId: input.userId,
    entityType: "vendor-evaluation",
    entityId: input.vendorId,
    action: "updated",
    after: values,
  });
}

export async function saveHiringPlan(input: {
  userId: string;
  workspaceId: string;
  roleId: string;
  status: string;
  targetDate: string | null;
  notes: string;
}): Promise<void> {
  await requirePermission(input.userId, input.workspaceId, "hiring:edit");
  const targetDate = input.targetDate
    ? z.iso.date().parse(input.targetDate)
    : null;
  const db = await getDatabase();
  const values = {
    status: input.status.slice(0, 60),
    targetDate,
    notes: input.notes.slice(0, 20_000),
    updatedAt: new Date(),
  };
  await db
    .insert(hiringPlans)
    .values({
      id: id("hire"),
      workspaceId: input.workspaceId,
      roleId: input.roleId,
      ...values,
    })
    .onConflictDoUpdate({
      target: [hiringPlans.workspaceId, hiringPlans.roleId],
      set: values,
    });
  await writeAuditEvent({
    workspaceId: input.workspaceId,
    actorId: input.userId,
    entityType: "hiring-plan",
    entityId: input.roleId,
    action: "updated",
    after: values,
  });
}

export async function saveTemplateInstance(input: {
  userId: string;
  workspaceId: string;
  templateId: string;
  values: Record<string, unknown>;
}): Promise<void> {
  await requirePermission(input.userId, input.workspaceId, "templates:edit");
  const db = await getDatabase();
  await db
    .insert(templateInstances)
    .values({
      id: id("template"),
      workspaceId: input.workspaceId,
      templateId: input.templateId,
      values: input.values,
      updatedBy: input.userId,
    })
    .onConflictDoUpdate({
      target: [
        templateInstances.workspaceId,
        templateInstances.templateId,
      ],
      set: {
        values: input.values,
        updatedBy: input.userId,
        updatedAt: new Date(),
      },
    });
  await writeAuditEvent({
    workspaceId: input.workspaceId,
    actorId: input.userId,
    entityType: "template",
    entityId: input.templateId,
    action: "updated",
    after: input.values,
  });
}

export async function exportWorkspace(
  userId: string,
  workspaceSlug: string,
): Promise<Record<string, unknown>> {
  const snapshot = await getWorkspaceSnapshot(userId, workspaceSlug);
  if (!can(snapshot.workspace.role, "export:create")) {
    throw new Error("You do not have permission to export this workspace.");
  }
  return {
    format: "startup-cfo-os",
    version: 1,
    exportedAt: new Date().toISOString(),
    workspace: snapshot.workspace,
    profile: snapshot.profile,
    tasks: snapshot.tasks,
    vendorEvaluations: snapshot.vendorEvaluations,
    hiringPlans: snapshot.hiringPlans,
    templateInstances: snapshot.templateInstances,
  };
}
