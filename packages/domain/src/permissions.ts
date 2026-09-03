import type { Role } from "./types";

export const PERMISSIONS = [
  "workspace:view",
  "workspace:edit",
  "members:manage",
  "profile:edit",
  "tasks:edit",
  "tasks:edit-assigned",
  "vendors:edit",
  "hiring:edit",
  "templates:edit",
  "evidence:edit",
  "audit:view",
  "export:create",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const rolePermissions: Record<Role, ReadonlySet<Permission>> = {
  "cfo-admin": new Set(PERMISSIONS),
  "finance-editor": new Set([
    "workspace:view",
    "workspace:edit",
    "profile:edit",
    "tasks:edit",
    "vendors:edit",
    "hiring:edit",
    "templates:edit",
    "evidence:edit",
    "audit:view",
    "export:create",
  ]),
  "task-contributor": new Set([
    "workspace:view",
    "tasks:edit-assigned",
    "evidence:edit",
  ]),
  viewer: new Set(["workspace:view"]),
};

export function can(role: Role, permission: Permission): boolean {
  return rolePermissions[role].has(permission);
}

export function permissionsFor(role: Role): Permission[] {
  return [...rolePermissions[role]];
}
