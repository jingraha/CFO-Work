"use server";

import {
  addWorkspaceMember,
  createCredentialUser,
  createWorkspace,
  findUserByEmail,
  importWorkspace,
  saveCompanyProfile,
  saveHiringPlan,
  saveTemplateInstance,
  saveVendorEvaluation,
  syncWorkspaceRecommendations,
  updateWorkspaceTask,
  type TaskUpdate,
} from "@cfo/db";
import {
  CompanyProfileSchema,
  EvidenceLinkSchema,
  PhaseSchema,
  PrioritySchema,
  TaskStatusSchema,
  WorkstreamKeySchema,
  generateRoadmap,
  recommendHiring,
} from "@cfo/domain";
import { hiringRoles, masterTasks } from "@cfo/catalog";
import { revalidatePath } from "next/cache";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { requireSession } from "@/lib/session";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function createWorkspaceAction(rawProfile: unknown) {
  const session = await requireSession();
  const profile = CompanyProfileSchema.parse(rawProfile);
  const roadmap = generateRoadmap(profile, masterTasks);
  const recommendations = recommendHiring(profile, hiringRoles);
  const suffix = crypto.randomUUID().slice(0, 5);
  const slug = `${slugify(profile.name) || "company"}-${suffix}`;
  await createWorkspace({
    actorId: session.user.id,
    name: profile.name,
    slug,
    profile,
    roadmap,
    hiringRecommendations: recommendations,
  });
  return { slug };
}

export async function updateTaskAction(
  workspaceSlug: string,
  workspaceId: string,
  taskId: string,
  patch: TaskUpdate,
) {
  const session = await requireSession();
  const task = await updateWorkspaceTask(
    session.user.id,
    workspaceId,
    taskId,
    patch,
  );
  revalidatePath(`/app/${workspaceSlug}`);
  return task;
}

export async function updateCompanyProfileAction(
  workspaceSlug: string,
  workspaceId: string,
  rawProfile: unknown,
) {
  const session = await requireSession();
  const profile = CompanyProfileSchema.parse(rawProfile);
  await saveCompanyProfile(session.user.id, workspaceId, profile);
  const roadmap = generateRoadmap(profile, masterTasks);
  const recommendations = recommendHiring(profile, hiringRoles);
  const result = await syncWorkspaceRecommendations({
    actorId: session.user.id,
    workspaceId,
    roadmap,
    hiringRecommendations: recommendations,
  });
  revalidatePath(`/app/${workspaceSlug}`);
  return result;
}

export async function saveVendorAction(input: {
  workspaceSlug: string;
  workspaceId: string;
  vendorId: string;
  status: string;
  scores: Record<string, number>;
  notes: string;
  decision: string;
}) {
  const session = await requireSession();
  await saveVendorEvaluation({
    ...input,
    userId: session.user.id,
  });
  revalidatePath(`/app/${input.workspaceSlug}`);
}

export async function saveHiringAction(input: {
  workspaceSlug: string;
  workspaceId: string;
  roleId: string;
  status: string;
  targetDate: string | null;
  notes: string;
}) {
  const session = await requireSession();
  await saveHiringPlan({
    ...input,
    userId: session.user.id,
  });
  revalidatePath(`/app/${input.workspaceSlug}`);
}

export async function saveTemplateAction(input: {
  workspaceSlug: string;
  workspaceId: string;
  templateId: string;
  values: Record<string, unknown>;
}) {
  const session = await requireSession();
  await saveTemplateInstance({
    ...input,
    userId: session.user.id,
  });
  revalidatePath(`/app/${input.workspaceSlug}`);
}

const memberInputSchema = z.object({
  workspaceSlug: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string().min(2).max(120),
  email: z.email(),
  password: z.string().min(12).max(128),
  role: z.enum(["finance-editor", "task-contributor", "viewer"]),
});

export async function createLocalMemberAction(rawInput: unknown) {
  const session = await requireSession();
  const input = memberInputSchema.parse(rawInput);
  const existing = await findUserByEmail(input.email);
  const memberUser =
    existing ??
    (await createCredentialUser({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
    }));
  await addWorkspaceMember({
    actorId: session.user.id,
    workspaceId: input.workspaceId,
    userId: memberUser.id,
    role: input.role,
  });
  revalidatePath(`/app/${input.workspaceSlug}`);
  return { id: memberUser.id, name: memberUser.name, email: memberUser.email };
}

const importTaskSchema = z.object({
  masterTaskId: z.string().min(1),
  workstream: WorkstreamKeySchema,
  phase: PhaseSchema,
  title: z.string().min(1),
  description: z.string(),
  outcome: z.string(),
  status: TaskStatusSchema,
  priority: PrioritySchema,
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  percentComplete: z.number().int().min(0).max(100),
  ownerRole: z.string(),
  financeResponsibility: z.enum(["owns", "partners", "advises"]),
  notes: z.string(),
  recommendationReason: z.string(),
  dependencies: z.array(z.string()),
  evidenceLinks: z.array(EvidenceLinkSchema),
  evidenceRequirements: z.array(z.string()),
  deliverables: z.array(z.string()),
  tags: z.array(z.string()),
  cadence: z
    .enum(["daily", "weekly", "monthly", "quarterly", "annual", "event-driven"])
    .nullable(),
});

const workspaceImportSchema = z.object({
  format: z.literal("startup-cfo-os"),
  version: z.literal(1),
  profile: CompanyProfileSchema,
  tasks: z.array(importTaskSchema).max(2_000),
  vendorEvaluations: z
    .array(
      z.object({
        vendorId: z.string(),
        status: z.string(),
        scores: z.record(z.string(), z.number()),
        notes: z.string(),
        decision: z.string(),
      }),
    )
    .max(1_000),
  hiringPlans: z
    .array(
      z.object({
        roleId: z.string(),
        status: z.string(),
        targetDate: z.iso.date().nullable(),
        notes: z.string(),
      }),
    )
    .max(100),
  templateInstances: z
    .array(
      z.object({
        templateId: z.string(),
        values: z.record(z.string(), z.unknown()),
      }),
    )
    .max(500),
});

export async function importWorkspaceAction(json: string) {
  const session = await requireSession();
  if (new TextEncoder().encode(json).length > 5_000_000) {
    throw new Error("Workspace imports are limited to 5 MB.");
  }
  const parsedJson: unknown = JSON.parse(json);
  const payload = workspaceImportSchema.parse(parsedJson);
  const suffix = crypto.randomUUID().slice(0, 5);
  const name = `${payload.profile.name} (Imported)`;
  const slug = `${slugify(payload.profile.name) || "company"}-import-${suffix}`;
  await importWorkspace(session.user.id, {
    name,
    slug,
    profile: payload.profile,
    tasks: payload.tasks,
    vendorEvaluations: payload.vendorEvaluations,
    hiringPlans: payload.hiringPlans,
    templateInstances: payload.templateInstances,
  });
  return { slug };
}
