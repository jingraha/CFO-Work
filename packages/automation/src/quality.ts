import type { ArtifactCheck, ArtifactSection, Playbook } from "@cfo/domain";
import { balance, cite, citations, daysOverdue, equalMoney, number, round, sum, text, type EvidenceContext, type EvidenceRecord } from "./evidence";
import { DEMO_ACCOUNTING_MONTH } from "./systems";

type TableRow = ArtifactSection["rows"][number];
const cites = (row: TableRow, source: EvidenceRecord) => row.some((cell) => typeof cell === "string" && cell.includes(cite(source)));
const namedRows = (sections: ArtifactSection[], title: string): TableRow[] => sections.find((section) => section.title === title)?.rows ?? [];
const matchesExactly = (expected: EvidenceRecord[], rows: TableRow[], predicate: (row: TableRow, source: EvidenceRecord) => boolean) =>
  rows.length === expected.length && expected.every((source) => rows.filter((row) => cites(row, source) && predicate(row, source)).length === 1);

function detectDuplicates(bills: EvidenceRecord[]) {
  const keys = new Map<string, EvidenceRecord[]>();
  bills.forEach((bill) => {
    const key = JSON.stringify([text(bill, "vendorId"), text(bill, "invoiceNumber").replace(/\s/g, "").toUpperCase()]);
    const existing = keys.get(key) ?? [];
    existing.push(bill);
    keys.set(key, existing);
  });
  return [...keys.values()].filter((group) => group.length > 1);
}

/** Re-read source facts and inspect rendered rows, independently of report construction. */
export function validateExceptionCoverage(context: EvidenceContext, book: Playbook, sections: ArtifactSection[]): ArtifactCheck[] {
  const checks: ArtifactCheck[] = [];
  const add = (index: number, passed: boolean, detail: string) => checks.push({
    name: book.contract.acceptanceCriteria[index + 3]!, passed, detail,
  });
  if (book.id === "close-assessment") {
    const tasks = context.rows("erp", "close-task");
    const unowned = tasks.filter((row) => text(row, "status") !== "complete" && !text(row, "owner").trim());
    const late = tasks.filter((row) => number(row, "targetDay") > context.input.assessment.closeTargetDays);
    const readiness = namedRows(sections, "Close task readiness");
    const actions = namedRows(sections, "Close remediation queue");
    const unownedRows = readiness.filter((row) => row[1] === "UNASSIGNED" && row[2] !== "complete");
    const ownershipActions = actions.filter((row) => String(row[0]).startsWith("Assign an owner to "));
    const lateRows = readiness.filter((row) => row[5] === "EXCEEDS TARGET");
    const schedulingActions = actions.filter((row) => String(row[0]).startsWith("Reschedule "));
    add(2, matchesExactly(unowned, unownedRows, (row, source) => row[0] === source.record.title)
      && matchesExactly(unowned, ownershipActions, (row) => Boolean(row[1]) && Boolean(row[2])),
    `${unownedRows.length}/${unowned.length} missing-owner exceptions and ${ownershipActions.length} assignment actions documented. Ownership remains unresolved. ${citations(unowned.length ? unowned : tasks)}`);
    add(3, matchesExactly(late, lateRows, (row, source) => row[4] === number(source, "targetDay"))
      && matchesExactly(late, schedulingActions, (row) => Boolean(row[1]) && Boolean(row[2])),
    `${lateRows.length}/${late.length} close-target exceptions and ${schedulingActions.length} scheduling actions documented against a ${context.input.assessment.closeTargetDays}-day target. ${citations(late.length ? late : tasks)}`);
  }
  if (book.id === "ar-aging") {
    const invoices = context.rows("ar", "invoice");
    const overdue = invoices.filter((row) => balance(row) > 0 && daysOverdue(row) > 0);
    const queue = namedRows(sections, "Collections action queue").filter((row) => row[0] !== "No overdue open invoices");
    add(2, matchesExactly(overdue, queue, (row, source) => equalMoney(Number(row[1]), balance(source))
      && (text(source, "collectionOwner").trim() ? row[2] === text(source, "collectionOwner")
        : row[2] === "UNASSIGNED" && String(row[3]).includes("Assign a collection owner"))),
    `${queue.length}/${overdue.length} overdue invoices classified; ${overdue.filter((row) => !text(row, "collectionOwner").trim()).length} still need ownership. No collection occurred. ${citations(overdue.length ? overdue : invoices)}`);
  }
  if (book.id === "ap-review") {
    const bills = context.rows("ap", "bill");
    const vendors = context.rows("ap", "vendor");
    const groups = detectDuplicates(bills);
    const duplicates = namedRows(sections, "Duplicate invoice exceptions").filter((row) => row[0] !== "No duplicate invoice keys observed");
    const details = namedRows(sections, "Payables detail");
    add(2, duplicates.length === groups.length && groups.every((group) => duplicates.filter((row) =>
      row[1] === group.length && group.every((bill) => cites(row, bill))
      && equalMoney(Number(row[2]), sum(group.map((bill) => number(bill, "amount"))))
      && equalMoney(Number(row[3]), sum(group.map(balance)))
      && equalMoney(Number(row[4]), sum(group.map(balance)) - Math.max(...group.map(balance)))).length === 1)
      && matchesExactly(bills, details, (row, bill) => equalMoney(Number(row[2]), number(bill, "amount"))
        && equalMoney(Number(row[3]), number(bill, "paidAmount")) && equalMoney(Number(row[4]), balance(bill))),
    `${duplicates.length}/${groups.length} duplicate groups documented; all ${bills.length} source bill balances must remain unchanged. Suspects remain unresolved. ${citations(groups.length ? groups.flat() : bills)}`);
    const open = bills.filter((row) => balance(row) > 0);
    const queue = namedRows(sections, "Payment review queue").filter((row) => row[0] !== "No open payables");
    add(3, matchesExactly(open, queue, (row, bill) => {
      const vendor = vendors.find((source) => source.record.id === text(bill, "vendorId"));
      const reasons = [
        ...(groups.some((group) => group.includes(bill)) ? ["Possible duplicate"] : []),
        ...(text(bill, "approvalStatus") !== "approved" ? ["Bill approval missing"] : []),
        ...(!vendor || vendor.record.data.approved !== true ? ["Vendor approval missing"] : []),
      ];
      return equalMoney(Number(row[1]), balance(bill))
        && row[2] === (reasons.length ? "HOLD for review" : "Human approval required")
        && row[3] === (reasons.join("; ") || "No local exception; not a payment authorization");
    }), `${queue.length}/${open.length} open bills classified for all applicable payment exceptions. No payment is authorized or released. ${citations(open.length ? open : bills)}`);
  }
  if (book.id === "cash-forecast") {
    const accounts = context.rows("banking", "bank-account");
    const unowned = accounts.filter((row) => !text(row, "reconciliationOwner").trim());
    const actions = namedRows(sections, "Treasury action queue");
    const ownership = actions.filter((row) => String(row[0]).startsWith("Assign bank reconciliation owner: "));
    add(2, matchesExactly(unowned, ownership, (row, account) => row[1] === "Controller" && equalMoney(Number(row[2]), number(account, "balance"))),
      `${ownership.length}/${unowned.length} bank ownership exceptions documented with assignment actions. The agent did not appoint owners. ${citations(unowned.length ? unowned : accounts)}`);
    const transactions = context.rows("banking", "cash-transaction").filter((row) => text(row, "date").startsWith(`${DEMO_ACCOUNTING_MONTH}-`));
    const available = sum(accounts.map((row) => number(row, "balance") - number(row, "restrictedAmount")));
    const receipts = round(sum(transactions.filter((row) => number(row, "amount") > 0).map((row) => number(row, "amount"))) * 12 / 52);
    const payments = round(-sum(transactions.filter((row) => number(row, "amount") < 0).map((row) => number(row, "amount"))) * 12 / 52);
    const periods = [{ label: "opening balance", amount: available }, ...Array.from({ length: 13 }, (_, index) => ({
      label: `week ${index + 1}`, amount: round(available + (index + 1) * (receipts - payments)),
    }))];
    const negative = periods.filter((period) => period.amount < 0);
    const risks = actions.filter((row) => String(row[0]).startsWith("Funding risk: "));
    add(3, risks.length === negative.length && negative.every((period) => risks.filter((row) =>
      row[0] === `Funding risk: ${period.label}; escalate the projected funding gap`
      && equalMoney(Number(row[2]), period.amount) && row[1] === "CFO"
      && transactions.every((transaction) => cites(row, transaction))).length === 1),
    `${risks.length}/${negative.length} negative cash periods documented; minimum ${Math.min(...periods.map((period) => period.amount))} USD. This validates reporting, not liquidity adequacy. ${citations([...accounts, ...transactions])}`);
  }
  if (book.id === "controls-register") {
    const findings: Array<{ id: string; owner: string; amount: number; sources: EvidenceRecord[] }> = [];
    const register = namedRows(sections, "Observed controls register").filter((row) => row[0] !== "No exceptions in covered rules");
    const tests = namedRows(sections, "Control testing plan").filter((row) => row[0] !== "Coverage review");
    const decisions = namedRows(sections, "Prioritized control decisions").filter((row) => String(row[0]).startsWith("Accept ownership and remediation plan for "));
    for (const account of context.rows("banking", "bank-account")) {
      if (!text(account, "reconciliationOwner").trim()) findings.push({ id: `bank-${account.record.id}`, owner: "Controller", amount: number(account, "balance"), sources: [account] });
    }
    for (const task of context.rows("erp", "close-task")) {
      if (text(task, "status") !== "complete" && !text(task, "owner").trim()) findings.push({ id: `close-${task.record.id}`, owner: "Controller", amount: 0, sources: [task] });
    }
    detectDuplicates(context.rows("ap", "bill")).forEach((group, index) => findings.push({
      id: `ap-duplicate-${index + 1}`, owner: "AP lead", amount: sum(group.map(balance)), sources: group,
    }));
    for (const bill of context.rows("ap", "bill")) {
      if (balance(bill) > 0 && (text(bill, "approvalStatus") !== "approved"
        || !context.rows("ap", "vendor").some((vendor) => vendor.record.id === text(bill, "vendorId") && vendor.record.data.approved === true))) {
        findings.push({ id: `ap-approval-${bill.record.id}`, owner: "AP approver", amount: balance(bill), sources: [bill] });
      }
    }
    for (const invoice of context.rows("ar", "invoice")) {
      if (balance(invoice) > 0 && daysOverdue(invoice) > 0 && !text(invoice, "collectionOwner").trim()) {
        findings.push({ id: `ar-owner-${invoice.record.id}`, owner: "Collections lead", amount: balance(invoice), sources: [invoice] });
      }
    }
    add(0, register.length === findings.length && register.every((row) => findings.some((finding) =>
      row[0] === finding.id && finding.sources.every((source) => cites(row, source)))),
    `${register.length}/${findings.length} observed findings have traceable source evidence. ${citations(findings.flatMap((finding) => finding.sources))}`);
    add(1, tests.length === findings.length && findings.every((finding) => tests.filter((row) =>
      row[0] === finding.id && row[2] === finding.owner && String(row[1]).length > 20
      && Boolean(row[3]) && finding.sources.every((source) => cites(row, source))).length === 1),
    `${tests.length}/${findings.length} proposed control tests specify owners, methods, and evidence. No test or appointment has been completed.`);
    add(2, register.length === findings.length && decisions.length === findings.length && findings.every((finding) =>
      register.filter((row) => row[0] === finding.id && equalMoney(Number(row[3]), finding.amount) && row[4] === finding.owner).length === 1
      && decisions.filter((row) => row[0] === `Accept ownership and remediation plan for ${finding.id}`
        && row[1] === finding.owner && finding.sources.every((source) => cites(row, source))).length === 1),
    `${findings.length} independently detected exceptions; ${register.length} register entries and ${decisions.length} decision requests. Business risks remain unresolved. ${citations(findings.flatMap((finding) => finding.sources))}`);
  }
  return checks;
}
