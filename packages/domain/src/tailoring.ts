import type {
  CompanyProfile,
  Condition,
  HiringRole,
  MasterTask,
  RoadmapTask,
} from "./types";

function getNestedValue(source: unknown, field: string): unknown {
  return field.split(".").reduce<unknown>((current, segment) => {
    if (
      current === null ||
      typeof current !== "object" ||
      !(segment in current)
    ) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, source);
}

function asComparable(value: unknown): number | string | boolean | null {
  if (
    typeof value === "number" ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }
  return null;
}

export function evaluateCondition(
  profile: CompanyProfile,
  condition: Condition,
): boolean {
  const actual = getNestedValue(profile, condition.field);
  const expected = condition.value;

  switch (condition.operator) {
    case "equals":
      return actual === expected;
    case "not-equals":
      return actual !== expected;
    case "truthy":
      return Boolean(actual);
    case "falsy":
      return !actual;
    case "contains":
      return Array.isArray(actual)
        ? actual.includes(expected)
        : typeof actual === "string" && typeof expected === "string"
          ? actual.includes(expected)
          : false;
    case "in":
      return Array.isArray(expected) && expected.includes(actual);
    case "not-in":
      return Array.isArray(expected) && !expected.includes(actual);
    case "gte":
    case "lte":
    case "gt":
    case "lt": {
      const left = asComparable(actual);
      const right = asComparable(expected);
      if (typeof left !== "number" || typeof right !== "number") {
        return false;
      }
      if (condition.operator === "gte") return left >= right;
      if (condition.operator === "lte") return left <= right;
      if (condition.operator === "gt") return left > right;
      return left < right;
    }
  }
}

export function matchesConditions(
  profile: CompanyProfile,
  conditions: Condition[],
): boolean {
  return conditions.every((condition) =>
    evaluateCondition(profile, condition),
  );
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function generateRoadmap(
  profile: CompanyProfile,
  masterTasks: MasterTask[],
): RoadmapTask[] {
  const start = new Date(`${profile.startDate}T00:00:00.000Z`);

  return masterTasks
    .filter((task) => matchesConditions(profile, task.conditions))
    .map((task) => {
      const taskStart = addUtcDays(start, task.startOffsetDays);
      const taskEnd = addUtcDays(taskStart, task.durationDays - 1);
      return {
        ...task,
        startDate: toDateOnly(taskStart),
        endDate: toDateOnly(taskEnd),
        includedBecause: task.recommendationReason,
      };
    })
    .sort((left, right) => {
      const dateOrder = left.startDate.localeCompare(right.startDate);
      if (dateOrder !== 0) return dateOrder;
      return left.priority.localeCompare(right.priority);
    });
}

export function recommendHiring(
  profile: CompanyProfile,
  roles: HiringRole[],
): HiringRole[] {
  return roles
    .filter((role) => matchesConditions(profile, role.conditions))
    .sort((left, right) => left.sequence - right.sequence);
}

export function blockedTaskIds(
  tasks: Array<{ id: string; dependencies: string[] }>,
  completeTaskIds: ReadonlySet<string>,
): Set<string> {
  const presentTaskIds = new Set(tasks.map((task) => task.id));
  return new Set(
    tasks
      .filter((task) =>
        task.dependencies.some(
          (dependencyId) =>
            presentTaskIds.has(dependencyId) &&
            !completeTaskIds.has(dependencyId),
        ),
      )
      .map((task) => task.id),
  );
}
