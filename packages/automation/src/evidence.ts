import {
  AgentArtifactSchema, AssessmentAnswersSchema, CompanyProfileSchema, MockRecordSchema, SYSTEM_IDS,
  type AgentExecutionInput, type ArtifactSection, type ArtifactSource, type MockRecord, type Playbook, type SystemConnection, type SystemId,
} from "@cfo/domain";
import { DEMO_AS_OF_DATE } from "./systems";

export type EvidenceRecord = { system: SystemConnection; record: MockRecord };
export type EvidenceContext = {
  input: AgentExecutionInput;
  records: EvidenceRecord[];
  sources: ArtifactSource[];
  rows: (systemId: SystemId, kind?: string) => EvidenceRecord[];
};

export const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const sum = (values: number[]) => {
  const cents = values.reduce((total, value) => {
    const result = total + Math.round(value * 100);
    if (!Number.isSafeInteger(result)) throw new Error("Source totals exceed the supported local monetary range.");
    return result;
  }, 0);
  return round(cents / 100);
};
export const equalMoney = (left: number, right: number) => Math.round(left * 100) === Math.round(right * 100);
export const text = (row: EvidenceRecord, key: string): string => String(row.record.data[key] ?? "");
export const number = (row: EvidenceRecord, key: string): number => {
  const value = row.record.data[key];
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 100))) {
    throw new Error(`Invalid numeric field ${row.system.id}/${row.record.id}.${key}.`);
  }
  return value;
};
export const balance = (row: EvidenceRecord) => round(number(row, "amount") - number(row, "paidAmount"));
export const cite = (row: EvidenceRecord) => `[${row.system.id}/${row.record.id}@r${row.system.revision}: ${row.record.title}]`;
export const citations = (rows: EvidenceRecord[]) => rows.map(cite).join("; ") || "No source records";
export const sourceCitation = (source: ArtifactSource) => `[${source.systemId}/${source.recordId}@r${source.revision}: ${source.title}]`;
export const section = (title: string, body: string, columns: string[], rows: ArtifactSection["rows"]): ArtifactSection => ({
  title, body, columns, rows,
});
export function dateValue(value: string): number {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid date "${value}"; expected a real YYYY-MM-DD date.`);
  }
  return timestamp;
}
export const daysOverdue = (row: EvidenceRecord) => Math.max(0, Math.floor((dateValue(DEMO_AS_OF_DATE) - dateValue(text(row, "dueDate"))) / 86_400_000));
export const addDays = (days: number) => new Date(dateValue(DEMO_AS_OF_DATE) + days * 86_400_000).toISOString().slice(0, 10);

const monetaryKinds = new Set(["invoice", "bill", "bank-account", "cash-transaction", "trial-balance", "gl-entry", "budget", "department"]);
const numericFields: Record<string, string[]> = {
  invoice: ["amount", "paidAmount"], bill: ["amount", "paidAmount"],
  "bank-account": ["balance", "restrictedAmount", "openingBalance"],
  "cash-transaction": ["amount"], "trial-balance": ["debit", "credit"],
  "gl-entry": ["amount"], budget: ["amount"],
  department: ["headcount", "annualSalaryPerEmployee", "monthlyGrossPay", "monthlyEmployerCosts", "monthlyFullyLoadedCost"],
  "close-task": ["targetDay"],
};
const stringFields: Record<string, string[]> = {
  invoice: ["customerId", "issuedDate", "dueDate", "collectionOwner", "status"],
  bill: ["vendorId", "invoiceNumber", "dueDate", "approvalStatus", "status"],
  customer: ["name", "billingEmail", "accountOwner"], vendor: ["name", "email", "category"],
  "bank-account": ["institution", "reconciliationOwner", "periodStart", "periodEnd"],
  "cash-transaction": ["date", "category", "accountId"],
  "trial-balance": ["accountCode", "periodEnd"], "gl-entry": ["month", "category", "accountCode"],
  budget: ["month", "category", "owner"], department: ["department", "month", "owner"],
  "close-task": ["owner", "status", "dueDate", "accountId"],
  email: ["from", "to", "role", "body", "theme", "requestedOutcome", "dueDate"],
  message: ["channelId", "author", "text", "theme"], channel: ["name", "purpose"],
};
const expectedKinds: Record<SystemId, string[]> = {
  gmail: ["email"], slack: ["message", "channel"], erp: ["trial-balance", "gl-entry", "close-task"],
  ar: ["customer", "invoice"], ap: ["vendor", "bill"], planning: ["budget"],
  payroll: ["department"], banking: ["bank-account", "cash-transaction"],
};

export function createContext(input: AgentExecutionInput, playbook: Playbook): EvidenceContext {
  if (!input || !Array.isArray(input.systems) || !Array.isArray(input.previousArtifacts)) {
    throw new Error("Invalid execution input: provide profile, assessment, systems, and previousArtifacts.");
  }
  CompanyProfileSchema.parse(input.profile);
  AssessmentAnswersSchema.parse(input.assessment);
  input.previousArtifacts.forEach((artifact) => AgentArtifactSchema.parse(artifact));
  const ids = new Set<string>();
  for (const system of input.systems) {
    if (!system || !SYSTEM_IDS.includes(system.id) || ids.has(system.id) || typeof system.connected !== "boolean"
      || !Number.isInteger(system.revision) || system.revision < 1 || !Array.isArray(system.records)) {
      throw new Error("Invalid or duplicate system: require a known id, connection state, records, and positive integer revision.");
    }
    ids.add(system.id);
  }
  const missing = playbook.contract.requiredSystems.filter((id) => !input.systems.some((system) => system.id === id && system.connected));
  if (missing.length) throw new Error(`Missing required connected systems: ${missing.join(", ")}.`);
  const records: EvidenceRecord[] = [];
  for (const system of input.systems.filter((candidate) => playbook.contract.requiredSystems.includes(candidate.id))) {
    const recordIds = new Set<string>();
    for (const record of system.records) {
      MockRecordSchema.parse(record);
      if (recordIds.has(record.id)) throw new Error(`Duplicate record id ${system.id}/${record.id}.`);
      recordIds.add(record.id);
      const row = { system, record };
      if (text(row, "asOfDate") !== DEMO_AS_OF_DATE) throw new Error(`Unsupported snapshot date in ${system.id}/${record.id}; expected ${DEMO_AS_OF_DATE}.`);
      for (const key of stringFields[record.kind] ?? []) {
        if (typeof record.data[key] !== "string") throw new Error(`Missing or invalid field ${system.id}/${record.id}.${key}.`);
      }
      for (const key of numericFields[record.kind] ?? []) {
        const value = number(row, key);
        const signed = record.kind === "cash-transaction" || (record.kind === "bank-account" && key !== "restrictedAmount");
        if (!signed && value < 0) throw new Error(`Negative ${key} in ${system.id}/${record.id}.`);
        if (["headcount", "targetDay"].includes(key) && !Number.isInteger(value)) throw new Error(`Non-integer ${key} in ${record.id}.`);
      }
      if (monetaryKinds.has(record.kind) && text(row, "currency") !== "USD") {
        throw new Error(`Unsupported currency in ${system.id}/${record.id}; local recipes require USD.`);
      }
      for (const key of ["dueDate", "issuedDate", "date", "periodStart", "periodEnd"]) {
        if (record.data[key] !== undefined) dateValue(text(row, key));
      }
      if (record.data.month !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(text(row, "month"))) {
        throw new Error(`Invalid accounting month in ${system.id}/${record.id}.`);
      }
      if (record.kind === "invoice" || record.kind === "bill") {
        if (number(row, "paidAmount") > number(row, "amount")) throw new Error(`Paid amount exceeds invoice amount in ${record.id}.`);
        if (record.kind === "invoice" && dateValue(text(row, "issuedDate")) > dateValue(text(row, "dueDate"))) {
          throw new Error(`Invoice due date precedes issue date in ${record.id}.`);
        }
        if (record.kind === "invoice" && dateValue(text(row, "issuedDate")) > dateValue(DEMO_AS_OF_DATE)) {
          throw new Error(`Invoice issue date exceeds the snapshot date in ${record.id}.`);
        }
      }
      if (record.kind === "bank-account" && number(row, "restrictedAmount") > Math.max(0, number(row, "balance"))) {
        throw new Error(`Restricted cash exceeds positive bank balance in ${record.id}.`);
      }
      if (record.kind === "vendor" && typeof record.data.approved !== "boolean") throw new Error(`Invalid vendor approval flag in ${record.id}.`);
      if (record.kind === "cash-transaction" && dateValue(text(row, "date")) > dateValue(DEMO_AS_OF_DATE)) {
        throw new Error(`Cash transaction date exceeds the snapshot date in ${record.id}.`);
      }
      if (record.kind === "bank-account" && (dateValue(text(row, "periodStart")) > dateValue(text(row, "periodEnd"))
        || text(row, "periodEnd") !== DEMO_AS_OF_DATE)) {
        throw new Error(`Bank account period must end at the snapshot date and start before it in ${record.id}.`);
      }
      if (record.kind === "trial-balance" && text(row, "periodEnd") !== DEMO_AS_OF_DATE) {
        throw new Error(`Trial balance period must match the snapshot date in ${record.id}.`);
      }
      records.push(row);
    }
    for (const kind of expectedKinds[system.id]) {
      if (!system.records.some((record) => record.kind === kind)) throw new Error(`Missing required ${kind} records in ${system.id}.`);
    }
  }
  return {
    input, records,
    rows: (id, kind) => records.filter((row) => row.system.id === id && (!kind || row.record.kind === kind)),
    sources: records.map(({ system, record }) => ({ systemId: system.id, recordId: record.id, title: record.title, revision: system.revision })),
  };
}

export type Reference = { row: EvidenceRecord; target: string; exists: boolean };
export function references(context: EvidenceContext): Reference[] {
  const refs: Reference[] = [];
  const add = (row: EvidenceRecord, id: string, systemId: string) => refs.push({
    row, target: `${systemId}/${id}`,
    exists: context.records.some((candidate) => candidate.system.id === systemId && candidate.record.id === id),
  });
  for (const row of context.records) {
    if (row.record.data.linkedRecordId !== undefined) add(row, text(row, "linkedRecordId"), text(row, "linkedSystem"));
    if (row.record.kind === "invoice") add(row, text(row, "customerId"), "ar");
    if (row.record.kind === "bill") add(row, text(row, "vendorId"), "ap");
    if (row.record.kind === "message") add(row, text(row, "channelId"), "slack");
    if (row.record.kind === "cash-transaction") add(row, text(row, "accountId"), "banking");
    if (row.record.kind === "close-task") add(row, text(row, "accountId"), text(row, "accountId").startsWith("bank-") ? "banking" : "erp");
  }
  return refs;
}
