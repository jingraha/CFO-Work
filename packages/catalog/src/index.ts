import {
  hiringRoles as rawHiringRoles,
  masterTasks as rawMasterTasks,
  templates as rawTemplates,
  vendors as rawVendors,
  workstreams as rawWorkstreams,
} from "@cfo/content";
import {
  HiringRoleSchema,
  MasterTaskSchema,
  TemplateDefinitionSchema,
  VendorSchema,
  WorkstreamDefinitionSchema,
} from "@cfo/domain";
import { z } from "zod";

export const workstreams = z
  .array(WorkstreamDefinitionSchema)
  .parse(rawWorkstreams);
export const masterTasks = z.array(MasterTaskSchema).parse(rawMasterTasks);
export const hiringRoles = z.array(HiringRoleSchema).parse(rawHiringRoles);
export const vendors = z.array(VendorSchema).parse(rawVendors);
export const templates = z
  .array(TemplateDefinitionSchema)
  .parse(rawTemplates);

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

export type CatalogValidation = {
  valid: boolean;
  errors: string[];
  counts: {
    workstreams: number;
    tasks: number;
    hiringRoles: number;
    templates: number;
    vendors: number;
  };
};

export function validateCatalog(): CatalogValidation {
  const errors: string[] = [];
  const taskIds = new Set(masterTasks.map((task) => task.id));
  const hiringIds = new Set(hiringRoles.map((role) => role.id));

  for (const duplicate of findDuplicates(masterTasks.map((task) => task.id))) {
    errors.push(`Duplicate task id: ${duplicate}`);
  }
  for (const duplicate of findDuplicates(vendors.map((vendor) => vendor.id))) {
    errors.push(`Duplicate vendor id: ${duplicate}`);
  }
  for (const task of masterTasks) {
    for (const dependency of task.dependencies) {
      if (!taskIds.has(dependency)) {
        errors.push(`Task ${task.id} has unknown dependency ${dependency}`);
      }
      if (dependency === task.id) {
        errors.push(`Task ${task.id} depends on itself`);
      }
    }
  }
  for (const role of hiringRoles) {
    for (const dependency of role.dependencies) {
      if (!hiringIds.has(dependency)) {
        errors.push(`Hiring role ${role.id} has unknown dependency ${dependency}`);
      }
      if (dependency === role.id) {
        errors.push(`Hiring role ${role.id} depends on itself`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    counts: {
      workstreams: workstreams.length,
      tasks: masterTasks.length,
      hiringRoles: hiringRoles.length,
      templates: templates.length,
      vendors: vendors.length,
    },
  };
}

export function tasksByWorkstream() {
  return masterTasks.reduce<Record<string, typeof masterTasks>>(
    (groups, task) => {
      (groups[task.workstream] ??= []).push(task);
      return groups;
    },
    {},
  );
}

export function vendorsByCategory() {
  return vendors.reduce<Record<string, typeof vendors>>((groups, vendor) => {
    (groups[vendor.category] ??= []).push(vendor);
    return groups;
  }, {});
}
