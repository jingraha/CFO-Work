#!/usr/bin/env node
/**
 * Dependency-free validator for the content library.
 *
 * Mirrors the Zod schemas in packages/domain/src/types.ts. Run with:
 *   node content/scripts/validate-content.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const contentRoot = join(here, "..");

const WORKSTREAMS = [
  "leadership",
  "controllership",
  "strategic-finance",
  "commercial-finance",
  "finance-operations",
  "treasury-capital",
  "tax",
  "risk-controls",
  "people-equity",
  "governance-legal",
];
const PHASES = [
  "days-1-30",
  "days-31-60",
  "days-61-90",
  "months-4-6",
  "months-7-12",
  "recurring",
];
const PRIORITIES = ["critical", "high", "medium", "low"];
const BUSINESS_MODELS = [
  "b2b-saas-usage",
  "ai-infrastructure",
  "consumer-subscription",
  "ai-enabled-services",
];
const RESPONSIBILITIES = ["owns", "partners", "advises"];
const CADENCES = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annual",
  "event-driven",
];
const OPERATORS = [
  "equals",
  "not-equals",
  "in",
  "not-in",
  "gte",
  "lte",
  "gt",
  "lt",
  "truthy",
  "falsy",
  "contains",
];
const EMPLOYMENT_MODELS = ["full-time", "fractional", "outsourced", "either"];
const IMPLEMENTATIONS = ["light", "moderate", "heavy"];
const FORMATS = ["interactive", "csv", "xlsx", "markdown"];
const FIELD_TYPES = [
  "text",
  "long-text",
  "number",
  "date",
  "select",
  "checkbox",
  "url",
];
const STAGES = ["series-b", "series-c"];

const PROFILE_FIELDS = new Set([
  "name",
  "stage",
  "startDate",
  "fiscalYearEndMonth",
  "businessModels",
  "annualRevenueMillions",
  "arrMillions",
  "cashRunwayMonths",
  "employeeCount",
  "entityCount",
  "countries",
  "internationalEmployees",
  "closeDays",
  "auditStatus",
  "auditDueDate",
  "fundraiseDate",
  "nextBoardDate",
  "accountingSystem",
  "billingModel",
  "salesTaxNexusStates",
  "financeTeam.controller",
  "financeTeam.strategicFinance",
  "financeTeam.financeOperations",
  "financeTeam.tax",
  "financeTeam.treasury",
  "financeTeam.staffAccountants",
]);

const PHASE_WINDOWS = {
  "days-1-30": [0, 29],
  "days-31-60": [30, 59],
  "days-61-90": [60, 89],
  "months-4-6": [90, 179],
  "months-7-12": [180, 365],
  recurring: [0, 365],
};

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VENDOR_AS_OF = "2026-09-02";

const errors = [];
const warnings = [];

function fail(where, message) {
  errors.push(`${where}: ${message}`);
}

function loadJson(relPath) {
  const abs = join(contentRoot, relPath);
  const raw = readFileSync(abs, "utf8");
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (code > 126 || code === 11 || code === 12) {
      const line = raw.slice(0, i).split("\n").length;
      fail(relPath, `non-ASCII or control character (code ${code}) at line ${line}`);
      break;
    }
  }
  if (/,\s*[}\]]/.test(raw)) {
    fail(relPath, "possible trailing comma detected");
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(relPath, `invalid JSON: ${err.message}`);
    return null;
  }
  if (!Array.isArray(parsed)) {
    fail(relPath, "expected a top-level JSON array");
    return null;
  }
  return parsed;
}

function isUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function str(where, obj, key, min, { optional = false } = {}) {
  const value = obj[key];
  if (value === undefined || value === null) {
    if (!optional) fail(where, `missing string field "${key}"`);
    return;
  }
  if (typeof value !== "string") {
    fail(where, `"${key}" must be a string`);
    return;
  }
  if (value.length < min) {
    fail(where, `"${key}" must be at least ${min} characters (got ${value.length})`);
  }
}

function enumField(where, obj, key, allowed, { nullable = false } = {}) {
  const value = obj[key];
  if (value === null && nullable) return;
  if (!allowed.includes(value)) {
    fail(where, `"${key}" must be one of ${allowed.join(", ")} (got ${JSON.stringify(value)})`);
  }
}

function stringArray(where, obj, key, { min = 0, itemMin = 0 } = {}) {
  const value = obj[key];
  if (!Array.isArray(value)) {
    fail(where, `"${key}" must be an array`);
    return [];
  }
  if (value.length < min) {
    fail(where, `"${key}" must have at least ${min} item(s)`);
  }
  value.forEach((item, i) => {
    if (typeof item !== "string") {
      fail(where, `"${key}[${i}]" must be a string`);
    } else if (item.length < itemMin) {
      fail(where, `"${key}[${i}]" must be at least ${itemMin} characters`);
    }
  });
  return value;
}

function intField(where, obj, key, min, max) {
  const value = obj[key];
  if (!Number.isInteger(value)) {
    fail(where, `"${key}" must be an integer`);
    return;
  }
  if (value < min || value > max) {
    fail(where, `"${key}" must be between ${min} and ${max} (got ${value})`);
  }
}

function checkConditions(where, obj) {
  const conditions = obj.conditions;
  if (!Array.isArray(conditions)) {
    fail(where, '"conditions" must be an array');
    return;
  }
  conditions.forEach((cond, i) => {
    const at = `${where} conditions[${i}]`;
    if (typeof cond !== "object" || cond === null) {
      fail(at, "condition must be an object");
      return;
    }
    const allowedKeys = ["field", "operator", "value"];
    Object.keys(cond).forEach((k) => {
      if (!allowedKeys.includes(k)) fail(at, `unexpected key "${k}"`);
    });
    if (typeof cond.field !== "string" || cond.field.length < 1) {
      fail(at, "field must be a non-empty string");
    } else if (!PROFILE_FIELDS.has(cond.field)) {
      fail(at, `field "${cond.field}" is not a known company profile field`);
    }
    if (!OPERATORS.includes(cond.operator)) {
      fail(at, `operator "${cond.operator}" is not valid`);
    }
    if (cond.operator === "truthy" || cond.operator === "falsy") {
      if ("value" in cond) fail(at, `operator "${cond.operator}" must not carry a value`);
    } else if (!("value" in cond)) {
      fail(at, `operator "${cond.operator}" requires a value`);
    }
    if ((cond.operator === "in" || cond.operator === "not-in") && !Array.isArray(cond.value)) {
      fail(at, `operator "${cond.operator}" requires an array value`);
    }
    if (["gte", "lte", "gt", "lt"].includes(cond.operator) && typeof cond.value !== "number") {
      fail(at, `operator "${cond.operator}" requires a numeric value`);
    }
    if (cond.operator === "contains" && Array.isArray(cond.value)) {
      fail(at, 'operator "contains" expects a single value, not an array (no OR logic is supported)');
    }
  });
}

function checkDependencies(where, obj, validIds, selfId) {
  const deps = stringArray(where, obj, "dependencies");
  deps.forEach((dep) => {
    if (dep === selfId) fail(where, `dependency "${dep}" is a self-reference`);
    if (!validIds.has(dep)) fail(where, `dependency "${dep}" does not reference a known id`);
  });
}

function uniqueIds(label, records) {
  const seen = new Set();
  records.forEach((rec, i) => {
    const id = rec && rec.id;
    if (typeof id !== "string" || !ID_RE.test(id)) {
      fail(`${label}[${i}]`, `id ${JSON.stringify(id)} is missing or not kebab-case`);
      return;
    }
    if (seen.has(id)) fail(`${label}[${i}]`, `duplicate id "${id}"`);
    seen.add(id);
  });
  return seen;
}

function tally(records, key) {
  const counts = {};
  records.forEach((r) => {
    const k = r[key];
    counts[k] = (counts[k] || 0) + 1;
  });
  return counts;
}

function printTable(title, counts) {
  console.log(`\n${title}`);
  const width = Math.max(...Object.keys(counts).map((k) => k.length));
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, n]) => console.log(`  ${k.padEnd(width)}  ${String(n).padStart(4)}`));
}

// ---------------------------------------------------------------- load
const workstreams = loadJson("workstreams/workstreams.json") || [];
const tasks = loadJson("workstreams/tasks.json") || [];
const roles = loadJson("hiring/roles.json") || [];
const templates = loadJson("templates/catalog.json") || [];
const vendors = loadJson("vendors/catalog.json") || [];

// ---------------------------------------------------------------- workstreams
const wsIds = new Set();
workstreams.forEach((ws, i) => {
  const where = `workstreams[${i}] ${ws.id || "?"}`;
  if (!WORKSTREAMS.includes(ws.id)) fail(where, `id "${ws.id}" is not a valid workstream key`);
  if (wsIds.has(ws.id)) fail(where, "duplicate workstream id");
  wsIds.add(ws.id);
  str(where, ws, "name", 1);
  str(where, ws, "shortName", 1);
  str(where, ws, "description", 1);
  str(where, ws, "outcome", 1);
  str(where, ws, "icon", 1);
  if (!HEX_RE.test(ws.color || "")) fail(where, `color "${ws.color}" must match #RRGGBB`);
});
WORKSTREAMS.forEach((key) => {
  if (!wsIds.has(key)) fail("workstreams", `missing required workstream "${key}"`);
});
if (workstreams.length !== WORKSTREAMS.length) {
  fail("workstreams", `expected exactly ${WORKSTREAMS.length} workstreams, got ${workstreams.length}`);
}

// ---------------------------------------------------------------- tasks
const taskIds = uniqueIds("tasks", tasks);
tasks.forEach((task, i) => {
  const where = `tasks[${i}] ${task.id || "?"}`;
  enumField(where, task, "workstream", WORKSTREAMS);
  enumField(where, task, "phase", PHASES);
  enumField(where, task, "priority", PRIORITIES);
  enumField(where, task, "financeResponsibility", RESPONSIBILITIES);
  enumField(where, task, "cadence", CADENCES, { nullable: true });
  str(where, task, "title", 5);
  str(where, task, "description", 12);
  str(where, task, "outcome", 5);
  str(where, task, "ownerRole", 2);
  str(where, task, "recommendationReason", 8);
  intField(where, task, "startOffsetDays", 0, 365);
  intField(where, task, "durationDays", 1, 365);
  stringArray(where, task, "evidence", { min: 1, itemMin: 2 });
  stringArray(where, task, "deliverables", { min: 1, itemMin: 2 });
  stringArray(where, task, "tags", { min: 1, itemMin: 2 });
  checkConditions(where, task);
  checkDependencies(where, task, taskIds, task.id);
  const urls = stringArray(where, task, "sourceUrls");
  urls.forEach((u) => {
    if (!isUrl(u)) fail(where, `sourceUrls entry "${u}" is not a valid URL`);
  });
  const window = PHASE_WINDOWS[task.phase];
  if (window && Number.isInteger(task.startOffsetDays)) {
    const [lo, hi] = window;
    if (task.startOffsetDays < lo || task.startOffsetDays > hi) {
      fail(where, `startOffsetDays ${task.startOffsetDays} is outside phase ${task.phase} window ${lo}-${hi}`);
    }
  }
  if (task.phase === "recurring" && task.cadence === null) {
    fail(where, "recurring tasks must declare a cadence");
  }
  if (task.phase !== "recurring" && task.cadence !== null && task.cadence !== "event-driven") {
    warnings.push(`${where}: non-recurring task carries cadence "${task.cadence}"`);
  }
});

// ---------------------------------------------------------------- roles
const roleIds = uniqueIds("roles", roles);
const sequences = new Set();
roles.forEach((role, i) => {
  const where = `roles[${i}] ${role.id || "?"}`;
  str(where, role, "title", 2);
  intField(where, role, "sequence", 1, 999);
  if (sequences.has(role.sequence)) warnings.push(`${where}: duplicate sequence ${role.sequence}`);
  sequences.add(role.sequence);
  enumField(where, role, "defaultEmploymentModel", EMPLOYMENT_MODELS);
  str(where, role, "triggerSummary", 10);
  stringArray(where, role, "outcomes", { min: 2, itemMin: 5 });
  stringArray(where, role, "scorecard", { min: 3, itemMin: 5 });
  stringArray(where, role, "interviewQuestions", { min: 3, itemMin: 10 });
  checkConditions(where, role);
  checkDependencies(where, role, roleIds, role.id);
});

// ---------------------------------------------------------------- templates
const templateIds = uniqueIds("templates", templates);
templates.forEach((tpl, i) => {
  const where = `templates[${i}] ${tpl.id || "?"}`;
  enumField(where, tpl, "workstream", WORKSTREAMS);
  str(where, tpl, "name", 3);
  str(where, tpl, "description", 10);
  enumField(where, tpl, "format", FORMATS);
  if (!Array.isArray(tpl.fields) || tpl.fields.length === 0) {
    fail(where, "fields must be a non-empty array");
    return;
  }
  const fieldIds = new Set();
  tpl.fields.forEach((field, j) => {
    const at = `${where} fields[${j}]`;
    str(at, field, "id", 1);
    if (fieldIds.has(field.id)) fail(at, `duplicate field id "${field.id}"`);
    fieldIds.add(field.id);
    str(at, field, "label", 2);
    enumField(at, field, "type", FIELD_TYPES);
    if (typeof field.required !== "boolean") fail(at, '"required" must be a boolean');
    const options = stringArray(at, field, "options");
    if (field.type === "select" && options.length < 2) {
      fail(at, "select fields need at least two options");
    }
    if (field.type !== "select" && options.length > 0) {
      fail(at, "options are only valid on select fields");
    }
    if (typeof field.help !== "string") fail(at, '"help" must be a string');
  });
});

// ---------------------------------------------------------------- vendors
const vendorIds = uniqueIds("vendors", vendors);
vendors.forEach((vendor, i) => {
  const where = `vendors[${i}] ${vendor.id || "?"}`;
  str(where, vendor, "name", 2);
  str(where, vendor, "category", 2);
  str(where, vendor, "description", 10);
  str(where, vendor, "pricingModel", 2);
  str(where, vendor, "pricingNote", 8);
  enumField(where, vendor, "implementation", IMPLEMENTATIONS);
  if (!isUrl(vendor.officialUrl)) fail(where, `officialUrl "${vendor.officialUrl}" is not a valid URL`);
  if (!isUrl(vendor.sourceUrl)) fail(where, `sourceUrl "${vendor.sourceUrl}" is not a valid URL`);
  if (!DATE_RE.test(vendor.asOfDate || "")) fail(where, `asOfDate "${vendor.asOfDate}" is not an ISO date`);
  if (vendor.asOfDate !== VENDOR_AS_OF) fail(where, `asOfDate must be ${VENDOR_AS_OF}`);
  const stages = stringArray(where, vendor, "stages", { min: 1 });
  stages.forEach((s) => {
    if (!STAGES.includes(s)) fail(where, `stage "${s}" is not valid`);
  });
  if ("businessModels" in vendor) {
    const bms = stringArray(where, vendor, "businessModels", { min: 1 });
    bms.forEach((b) => {
      if (!BUSINESS_MODELS.includes(b)) fail(where, `businessModel "${b}" is not valid`);
    });
  }
  stringArray(where, vendor, "strengths", { min: 1, itemMin: 5 });
  stringArray(where, vendor, "watchouts", { min: 1, itemMin: 5 });
  stringArray(where, vendor, "integrations", { min: 1, itemMin: 2 });
  stringArray(where, vendor, "securityDiligence", { min: 1, itemMin: 5 });
  stringArray(where, vendor, "exportOffboarding", { min: 1, itemMin: 5 });
  if (typeof vendor.pricingNote === "string" && !/verify current/i.test(vendor.pricingNote)) {
    fail(where, "pricingNote must instruct the reader to verify current terms");
  }
  if (typeof vendor.pricingNote === "string" && /\$\s?\d/.test(vendor.pricingNote)) {
    fail(where, "pricingNote must not quote specific prices");
  }
});

// ---------------------------------------------------------------- coverage
const taskWorkstreamCounts = tally(tasks, "workstream");
const taskPhaseCounts = tally(tasks, "phase");
const vendorCategoryCounts = tally(vendors, "category");
const templateWorkstreamCounts = tally(templates, "workstream");

WORKSTREAMS.forEach((key) => {
  const n = taskWorkstreamCounts[key] || 0;
  if (n < 12) fail("coverage", `workstream "${key}" has only ${n} tasks (minimum 12)`);
});
PHASES.forEach((phase) => {
  const n = taskPhaseCounts[phase] || 0;
  if (n < 10) fail("coverage", `phase "${phase}" has only ${n} tasks (minimum 10)`);
});
const cadences = new Set(tasks.filter((t) => t.cadence).map((t) => t.cadence));
CADENCES.forEach((cadence) => {
  if (!cadences.has(cadence)) fail("coverage", `no task uses cadence "${cadence}"`);
});
if (tasks.length < 180) fail("coverage", `expected at least 180 tasks, got ${tasks.length}`);
if (roles.length < 10 || roles.length > 14) {
  fail("coverage", `expected 10-14 hiring roles, got ${roles.length}`);
}
if (templates.length < 24) fail("coverage", `expected at least 24 templates, got ${templates.length}`);
if (vendors.length < 55) fail("coverage", `expected at least 55 vendors, got ${vendors.length}`);
const vendorCategories = Object.keys(vendorCategoryCounts).length;
if (vendorCategories < 16) fail("coverage", `expected at least 16 vendor categories, got ${vendorCategories}`);

const referenced = new Set();
tasks.forEach((t) => (t.dependencies || []).forEach((d) => referenced.add(d)));

// ---------------------------------------------------------------- report
console.log("Startup CFO OS content validation");
console.log(`  root: ${relative(process.cwd(), contentRoot) || "."}`);
console.log("");
console.log(`  workstreams : ${workstreams.length}`);
console.log(`  tasks       : ${tasks.length}`);
console.log(`  roles       : ${roles.length} (${roleIds.size} unique ids)`);
console.log(`  templates   : ${templates.length} (${templateIds.size} unique ids)`);
console.log(`  vendors     : ${vendors.length} (${vendorIds.size} unique ids) across ${vendorCategories} categories`);
console.log(`  task deps   : ${referenced.size} distinct tasks referenced as dependencies`);

printTable("Tasks by workstream", taskWorkstreamCounts);
printTable("Tasks by phase", taskPhaseCounts);
printTable("Tasks by cadence", tally(tasks.filter((t) => t.cadence), "cadence"));
printTable("Templates by workstream", templateWorkstreamCounts);
printTable("Vendors by category", vendorCategoryCounts);

if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  warnings.slice(0, 40).forEach((w) => console.log(`  - ${w}`));
}

if (errors.length) {
  console.log(`\nFAILED with ${errors.length} error(s):`);
  errors.slice(0, 120).forEach((e) => console.log(`  - ${e}`));
  process.exit(1);
}

console.log("\nAll checks passed.");
