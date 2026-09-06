import type { ArtifactCheck, ArtifactSection, Playbook } from "@cfo/domain";
import {
  addDays, balance, citations, cite, dateValue, daysOverdue, equalMoney, number, references, round, section, sourceCitation, sum, text,
  type EvidenceContext, type EvidenceRecord,
} from "./evidence";
import { playbooks } from "./playbooks";
import { DEMO_ACCOUNTING_MONTH, DEMO_AS_OF_DATE } from "./systems";

export type Report = {
  summary: string;
  sections: ArtifactSection[];
  checks: ArtifactCheck[];
  recommendations: string[];
  limitations: string[];
};
const check = (name: string, passed: boolean, detail: string): ArtifactCheck => ({ name, passed, detail });
const percentage = (change: number, base: number): number | string => base === 0 ? "Not defined: zero base" : round(change / base * 100);
const currentMonth = (rows: EvidenceRecord[]) => rows.filter((row) => text(row, "month") === DEMO_ACCOUNTING_MONTH);
const titleAt = (book: Playbook, index: number) => book.contract.deliverables[index]!;
const criterion = (book: Playbook, index: number) => book.contract.acceptanceCriteria[index + 3]!;
const table = (book: Playbook, index: number, body: string, columns: string[], rows: ArtifactSection["rows"]) => section(titleAt(book, index), body, columns, rows);
const totalBalance = (rows: EvidenceRecord[]) => sum(rows.map(balance));
const tbAccount = (context: EvidenceContext, code: string) => context.rows("erp", "trial-balance").filter((row) => text(row, "accountCode") === code);
const tbNet = (context: EvidenceContext, code: string, credit = false) => sum(tbAccount(context, code).map((row) => (
  credit ? number(row, "credit") - number(row, "debit") : number(row, "debit") - number(row, "credit")
)));
const arRows = (context: EvidenceContext) => context.rows("ar", "invoice");
const apRows = (context: EvidenceContext) => context.rows("ap", "bill");
const duplicateGroups = (rows: EvidenceRecord[]): EvidenceRecord[][] => {
  const groups = new Map<string, EvidenceRecord[]>();
  for (const row of rows) {
    const key = JSON.stringify([text(row, "vendorId"), text(row, "invoiceNumber").trim().toUpperCase().replace(/\s+/g, "")]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
};

function systemInventory(context: EvidenceContext, book: Playbook): Report {
  const refs = references(context);
  const unresolved = refs.filter((reference) => !reference.exists);
  const systems = context.input.systems.filter((system) => book.contract.requiredSystems.includes(system.id));
  const recommendations = unresolved.length
    ? unresolved.map((reference) => `Data steward: resolve ${reference.target} before relying on the linked record. ${cite(reference.row)}`)
    : [`Data steward: preserve revisioned local snapshots before edits; ${context.records.length} records are available. ${citations(context.records.slice(0, 3))}`];
  return {
    summary: `${systems.length} local systems expose ${context.records.length} source records; ${unresolved.length} of ${refs.length} references are unresolved. ${citations(context.records.slice(0, 2))}`,
    sections: [
      table(book, 0, "Connected means locally readable fixture records, not Gmail, Slack, or bank authentication.",
        ["System", "Records", "Kinds", "Revision", "Evidence"], systems.map((system) => [
          system.name, system.records.length, [...new Set(system.records.map((row) => row.kind))].join(", "), system.revision,
          citations(context.rows(system.id)),
        ])),
      table(book, 1, "References join common customer, vendor, channel, account, and message identifiers.",
        ["Source", "Referenced record", "Resolves"], refs.map((reference) => [cite(reference.row), reference.target, reference.exists ? "Yes" : "No"])),
      table(book, 2, "Review data ownership before enabling downstream diagnostics.",
        ["Priority", "Action", "Owner", "Evidence"], unresolved.length
          ? unresolved.map((reference) => ["High", `Repair ${reference.target}`, "Data steward", cite(reference.row)])
          : [["Normal", `Maintain snapshots for ${systems.length} local systems`, "Data steward", citations(context.records.slice(0, 3))]]),
    ],
    checks: [
      check(criterion(book, 0), systems.length === 8 && systems.every((system) => system.records.length > 0), `${systems.length}/8 systems; ${context.records.length} records.`),
      check(criterion(book, 1), unresolved.length === 0, `${refs.length - unresolved.length}/${refs.length} references resolve. ${citations(unresolved.map((reference) => reference.row))}`),
    ],
    recommendations,
    limitations: ["Record presence is not a completeness guarantee. Permissions, OAuth, API uptime, and real credentials are not tested."],
  };
}

function stakeholderContext(context: EvidenceContext, book: Playbook): Report {
  const emails = context.rows("gmail", "email");
  const messages = context.rows("slack", "message");
  const channels = context.rows("slack", "channel");
  const themes = [...new Set([...emails, ...messages].map((row) => text(row, "theme")))];
  const incomplete = emails.filter((row) => !text(row, "from") || !text(row, "requestedOutcome") || !text(row, "dueDate"));
  const orphanMessages = messages.filter((row) => !channels.some((channel) => channel.record.id === text(row, "channelId")));
  return {
    summary: `${emails.length} stakeholder emails and ${messages.length} Slack messages cover ${themes.length} recorded themes. These are written requests, not completed interviews. ${citations(emails)}`,
    sections: [
      table(book, 0, "Quoted requests are attributed to synthetic stakeholder mailboxes. No unwritten intent is inferred.",
        ["Role", "Sender", "Requested outcome", "Due date", "Evidence"],
        emails.map((row) => [text(row, "role"), text(row, "from"), text(row, "requestedOutcome"), text(row, "dueDate"), cite(row)])),
      table(book, 1, "Matching theme labels show repeated topics, not independent confirmation or agreement.",
        ["Theme", "Emails", "Messages", "Assessment", "Evidence"], themes.map((theme) => {
          const mail = emails.filter((row) => text(row, "theme") === theme);
          const chat = messages.filter((row) => text(row, "theme") === theme);
          return [theme || "Unclassified", mail.length, chat.length,
            mail.length && chat.length ? "Repeated in both channels; confirm interpretation" : "Single-channel request; seek confirmation", citations([...mail, ...chat])];
        })),
      table(book, 2, "Human follow-up is still required. Message repetition is not an interview or a sign-off.",
        ["Proposed owner", "Question to confirm", "Priority", "Evidence"], emails.map((row) => [
          text(row, "from"), `What evidence would satisfy: ${text(row, "requestedOutcome")}`, text(row, "priority") || "Unspecified", cite(row),
        ])),
    ],
    checks: [
      check(criterion(book, 0), incomplete.length === 0, `${emails.length - incomplete.length}/${emails.length} emails have required context. ${citations(incomplete)}`),
      check(criterion(book, 1), orphanMessages.length === 0, `${messages.length - orphanMessages.length}/${messages.length} messages have channels. ${citations(orphanMessages)}`),
    ],
    recommendations: emails.map((row) => `CFO: confirm the ${text(row, "theme")} request with ${text(row, "from")} before ${text(row, "dueDate")}. ${cite(row)}`),
    limitations: ["No meetings were held. Sentiment, conflicting views, stakeholder influence, and organizational politics cannot be established from these labeled fixtures."],
  };
}

function closeAssessment(context: EvidenceContext, book: Playbook): Report {
  const tb = context.rows("erp", "trial-balance");
  const tasks = context.rows("erp", "close-task");
  const open = tasks.filter((row) => text(row, "status") !== "complete");
  const debits = sum(tb.map((row) => number(row, "debit")));
  const credits = sum(tb.map((row) => number(row, "credit")));
  const unowned = open.filter((row) => !text(row, "owner").trim());
  const targetFailures = tasks.filter((row) => number(row, "targetDay") > context.input.assessment.closeTargetDays);
  const bank = context.rows("banking", "bank-account");
  const tieouts = [
    { code: "cash", label: "Cash", total: sum(bank.map((row) => number(row, "balance"))), credit: false, records: bank },
    { code: "ar", label: "Accounts receivable", total: totalBalance(arRows(context)), credit: false, records: arRows(context) },
    { code: "ap", label: "Accounts payable (duplicates included)", total: totalBalance(apRows(context)), credit: true, records: apRows(context) },
  ];
  return {
    summary: `Trial balance debits ${debits} USD, credits ${credits} USD, difference ${round(debits - credits)} USD; ${open.length} open close tasks, ${unowned.length} missing owners, and ${targetFailures.length} close-target exceptions. These findings are not remediated by producing this assessment. ${citations([...tb, ...unowned, ...targetFailures])}`,
    sections: [
      table(book, 0, "Balanced debits and credits do not establish accuracy, cutoff, or accounting policy compliance.",
        ["Account", "Debit USD", "Credit USD", "Evidence"], [
          ...tb.map((row) => [row.record.title, number(row, "debit"), number(row, "credit"), cite(row)]),
          ["Total", debits, credits, citations(tb)],
        ]),
      table(book, 1, `Readiness uses the fixed ${DEMO_AS_OF_DATE} snapshot and requested ${context.input.assessment.closeTargetDays}-day close target.`,
        ["Task", "Owner", "Status", "Days overdue", "Target day", "Target assessment", "Evidence"], tasks.map((row) => [
          row.record.title, text(row, "owner").trim() ? text(row, "owner") : "UNASSIGNED", text(row, "status"),
          text(row, "status") === "complete" ? 0 : daysOverdue(row), number(row, "targetDay"),
          number(row, "targetDay") > context.input.assessment.closeTargetDays ? "EXCEEDS TARGET" : "Within target", cite(row),
        ])),
      table(book, 2, "No suspected AP duplicates are removed from balances. Tie-outs compare independently read systems.",
        ["Account", "Source balance USD", "Trial balance USD", "Difference USD", "Evidence"], tieouts.map((item) => [
          item.label, item.total, tbNet(context, item.code, item.credit), round(item.total - tbNet(context, item.code, item.credit)),
          citations([...item.records, ...tbAccount(context, item.code)]),
        ])),
      table(book, 3, "Proposed actions require controller review. No journals are posted and the books remain open.",
        ["Action", "Proposed owner", "Acceptance evidence", "Source"], [
          ...(open.length ? open.map((row) => [
            `${text(row, "owner").trim() ? "Complete evidence for" : "Assign an owner to"} ${row.record.title}`,
            text(row, "owner").trim() ? text(row, "owner") : "Controller", "Reviewed reconciliation with dated source support", cite(row),
          ]) : [["Review completed checklist evidence", "Controller", "Independent reviewer sign-off", citations(tasks)]]),
          ...targetFailures.map((row) => [`Reschedule ${row.record.title} to fit the ${context.input.assessment.closeTargetDays}-day target`,
            text(row, "owner").trim() ? text(row, "owner") : "Controller", "Human-reviewed schedule and feasibility decision", cite(row)]),
        ]),
    ],
    checks: [
      check(criterion(book, 0), equalMoney(debits, credits), `Debits ${debits}; credits ${credits}; delta ${round(debits - credits)} USD. ${citations(tb)}`),
      check(criterion(book, 1), tieouts.every((item) => tbAccount(context, item.code).length > 0 && equalMoney(item.total, tbNet(context, item.code, item.credit))),
        tieouts.map((item) => `${item.label}: delta ${round(item.total - tbNet(context, item.code, item.credit))} USD ${citations(item.records)}`).join("; ")),
    ],
    recommendations: [
      ...open.map((row) => `Controller: ${text(row, "owner").trim() ? "review" : "assign ownership and review"} ${row.record.title}; obtain signed reconciliation before closing books. ${cite(row)}`),
      ...targetFailures.map((row) => `Controller: review rescheduling ${row.record.title}, currently day ${number(row, "targetDay")}, against the requested day ${context.input.assessment.closeTargetDays} target. ${cite(row)}`),
      ...(open.length || targetFailures.length ? [] : [`Controller: review completed checklist evidence; a diagnostic does not sign off the close. ${citations(tasks)}`]),
    ],
    limitations: [
      "The trial balance is a simplified synthetic snapshot. No audit, financial statement opinion, journal posting, or completed month-end close is implied.",
      `${unowned.length} missing-owner and ${targetFailures.length} scheduling exceptions remain business risks even if report-quality checks pass. ${citations([...unowned, ...targetFailures].length ? [...unowned, ...targetFailures] : tasks)}`,
    ],
  };
}

function arAging(context: EvidenceContext, book: Playbook): Report {
  const invoices = arRows(context);
  const customers = context.rows("ar", "customer");
  const bands = [
    { name: "Current", low: 0, high: 0 }, { name: "1-30 days", low: 1, high: 30 },
    { name: "31-60 days", low: 31, high: 60 }, { name: "61-90 days", low: 61, high: 90 },
    { name: "91+ days", low: 91, high: Infinity },
  ];
  const bandRows = bands.map((band) => ({
    ...band, rows: invoices.filter((row) => balance(row) > 0 && daysOverdue(row) >= band.low && daysOverdue(row) <= band.high),
  }));
  const total = totalBalance(invoices);
  const bucketTotal = sum(bandRows.map((band) => totalBalance(band.rows)));
  const overdue = invoices.filter((row) => balance(row) > 0 && daysOverdue(row) > 0).sort((left, right) => balance(right) - balance(left));
  const orphan = invoices.filter((row) => !customers.some((customer) => customer.record.id === text(row, "customerId")));
  const unowned = overdue.filter((row) => !text(row, "collectionOwner").trim());
  return {
    summary: `Outstanding AR is ${total} USD; ${totalBalance(overdue)} USD is overdue across ${overdue.length} invoices, including ${unowned.length} without collection owners; bucket reconciliation difference is ${round(bucketTotal - total)} USD. ${citations(invoices)}`,
    sections: [
      table(book, 0, `Age remaining principal (invoice less payments) at ${DEMO_AS_OF_DATE}; due today is current. Fully paid invoices remain visible.`,
        ["Invoice", "Customer", "Amount USD", "Paid USD", "Open USD", "Days overdue", "Evidence"], invoices.map((row) => {
          const customer = customers.find((item) => item.record.id === text(row, "customerId"));
          return [row.record.title, customer ? text(customer, "name") : `MISSING: ${text(row, "customerId")}`,
            number(row, "amount"), number(row, "paidAmount"), balance(row), balance(row) > 0 ? daysOverdue(row) : 0, citations(customer ? [row, customer] : [row])];
        })),
      table(book, 1, "Category totals are compared to a separate sum of all source invoice balances, including partially paid invoices.",
        ["Aging category", "Invoices", "Open USD", "Evidence"], [
          ...bandRows.map((band) => [band.name, band.rows.length, totalBalance(band.rows), citations(band.rows.length ? band.rows : invoices)]),
          ["Total categorized", invoices.filter((row) => balance(row) > 0).length, bucketTotal, citations(invoices)],
          ["Source total", invoices.length, total, citations(invoices)],
          ["Reconciliation difference", 0, round(bucketTotal - total), citations(invoices)],
        ]),
      table(book, 2, "Largest overdue balances first; escalation is a recommendation, not an email sent or cash collected.",
        ["Invoice", "Open USD", "Owner", "Proposed action", "Evidence"], overdue.length ? overdue.map((row) => [
          row.record.title, balance(row), text(row, "collectionOwner").trim() ? text(row, "collectionOwner") : "UNASSIGNED",
          `${text(row, "collectionOwner").trim() ? "" : "Assign a collection owner; "}${daysOverdue(row) > 90 ? "CFO review: confirm dispute status and recoverability" : "Confirm payment date and resolve billing blockers"}`, cite(row),
        ]) : [["No overdue open invoices", 0, "Collections lead", "Monitor future due dates", citations(invoices)]]),
    ],
    checks: [
      check(criterion(book, 0), equalMoney(bucketTotal, sum(invoices.map((row) => number(row, "amount"))) - sum(invoices.map((row) => number(row, "paidAmount")))),
        `Categorized ${bucketTotal}; source ${total}; delta ${round(bucketTotal - total)} USD. ${citations(invoices)}`),
      check(criterion(book, 1), orphan.length === 0, `${orphan.length} invoices have missing customer references. ${citations(orphan)}`),
    ],
    recommendations: overdue.length ? overdue.map((row) => `Collections lead: ${text(row, "collectionOwner").trim() ? "confirm the next action for" : "assign an owner to"} ${row.record.title} (${balance(row)} USD, ${daysOverdue(row)} days overdue). ${cite(row)}`)
      : [`Collections lead: maintain monitoring; overdue open balance is 0 USD. ${citations(invoices)}`],
    limitations: [
      "No credit loss reserve, legal collectability, collection probability, tax, credit memo, or unrecorded receipt is inferred.",
      `${unowned.length} collection-owner gaps remain unresolved. Accurate aging and exception coverage do not mean cash was collected. ${citations(unowned.length ? unowned : invoices)}`,
    ],
  };
}

function apReview(context: EvidenceContext, book: Playbook): Report {
  const bills = apRows(context);
  const vendors = context.rows("ap", "vendor");
  const duplicates = duplicateGroups(bills);
  const duplicateIds = new Set(duplicates.flat().map((row) => row.record.id));
  const open = bills.filter((row) => balance(row) > 0);
  const missing = bills.filter((row) => !vendors.some((vendor) => vendor.record.id === text(row, "vendorId")));
  const notApproved = open.filter((row) => text(row, "approvalStatus") !== "approved" || !vendors.some((vendor) => vendor.record.id === text(row, "vendorId") && vendor.record.data.approved === true));
  const total = totalBalance(bills);
  const duplicateExposure = sum(duplicates.map((group) => Math.max(0, totalBalance(group) - Math.max(...group.map(balance)))));
  return {
    summary: `Open AP is ${total} USD with ${duplicates.length} possible duplicate groups and ${duplicateExposure} USD of potential repeated open exposure. Balances are not adjusted. ${citations(bills)}`,
    sections: [
      table(book, 0, "Gross, paid, and open amounts retain all imported records, including duplicate suspects.",
        ["Bill", "Vendor", "Gross USD", "Paid USD", "Open USD", "Evidence"], bills.map((row) => {
          const vendor = vendors.find((item) => item.record.id === text(row, "vendorId"));
          return [row.record.title, vendor ? text(vendor, "name") : `MISSING: ${text(row, "vendorId")}`, number(row, "amount"),
            number(row, "paidAmount"), balance(row), citations(vendor ? [row, vendor] : [row])];
        })),
      table(book, 1, "Match normalized vendor ID and supplier invoice number, even when amounts differ. Suspected repeated exposure is not a confirmed recovery.",
        ["Supplier invoice", "Records", "Gross USD", "Open USD", "Potential repeated open USD", "Evidence"], duplicates.length ? duplicates.map((group) => [
          text(group[0]!, "invoiceNumber"), group.length, sum(group.map((row) => number(row, "amount"))), totalBalance(group),
          round(totalBalance(group) - Math.max(...group.map(balance))), citations(group),
        ]) : [["No duplicate invoice keys observed", 0, 0, 0, 0, citations(bills)]]),
      table(book, 2, "Every payment needs human authorization. Hold suspected duplicates, unapproved bills, and unapproved or missing vendors.",
        ["Bill", "Open USD", "Recommendation", "Reason", "Evidence"], open.length ? open.map((row) => {
          const vendor = vendors.find((item) => item.record.id === text(row, "vendorId"));
          const reasons = [
            ...(duplicateIds.has(row.record.id) ? ["Possible duplicate"] : []),
            ...(text(row, "approvalStatus") !== "approved" ? ["Bill approval missing"] : []),
            ...(!vendor || vendor.record.data.approved !== true ? ["Vendor approval missing"] : []),
          ];
          return [row.record.title, balance(row), reasons.length ? "HOLD for review" : "Human approval required",
            reasons.join("; ") || "No local exception; not a payment authorization", citations(vendor ? [row, vendor] : [row])];
        }) : [["No open payables", 0, "No payment proposed", "All recorded bills fully paid", citations(bills)]]),
    ],
    checks: [
      check(criterion(book, 0), equalMoney(total, sum(bills.map((row) => number(row, "amount"))) - sum(bills.map((row) => number(row, "paidAmount")))),
        `Gross ${sum(bills.map((row) => number(row, "amount")))} less paid ${sum(bills.map((row) => number(row, "paidAmount")))} = ${total} USD. Duplicates retained. ${citations(bills)}`),
      check(criterion(book, 1), missing.length === 0, `${missing.length} missing vendor references. ${citations(missing)}`),
    ],
    recommendations: [
      ...duplicates.map((group) => `AP lead: hold ${group.map((row) => row.record.title).join(", ")} and compare source invoices; retain the ledger balance until reviewed. ${citations(group)}`),
      ...notApproved.filter((row) => !duplicateIds.has(row.record.id)).map((row) => `AP lead: obtain bill and vendor approval before releasing ${balance(row)} USD. ${cite(row)}`),
      `Treasury approver: review ${open.length} open bills totaling ${total} USD; this agent cannot release a payment. ${citations(open.length ? open : bills)}`,
    ],
    limitations: [
      "Duplicate matching detects repeated invoice keys, not vendor fraud. No bank-detail verification, sanctions screening, vendor activation, payment, or ledger adjustment occurs.",
      `${duplicates.length} suspected duplicate groups and ${notApproved.length} bill/vendor approval gaps remain unresolved. Passing report-quality checks does not release these holds. ${citations([...duplicates.flat(), ...notApproved].length ? [...duplicates.flat(), ...notApproved] : bills)}`,
    ],
  };
}

function cashMetrics(context: EvidenceContext) {
  const accounts = context.rows("banking", "bank-account");
  const transactions = context.rows("banking", "cash-transaction");
  const august = transactions.filter((row) => text(row, "date").startsWith(`${DEMO_ACCOUNTING_MONTH}-`));
  if (!august.length) throw new Error(`Missing ${DEMO_ACCOUNTING_MONTH} cash history; absence of observations cannot be treated as zero burn.`);
  const totalCash = sum(accounts.map((row) => number(row, "balance")));
  const restricted = sum(accounts.map((row) => number(row, "restrictedAmount")));
  const available = round(totalCash - restricted);
  const receipts = sum(august.filter((row) => number(row, "amount") > 0).map((row) => number(row, "amount")));
  const disbursements = -sum(august.filter((row) => number(row, "amount") < 0).map((row) => number(row, "amount")));
  const burn = round(disbursements - receipts);
  const runway: number | string = available <= 0 ? 0 : burn <= 0 ? "Not finite: no positive observed net burn" : round(available / burn);
  return { accounts, transactions, august, totalCash, restricted, available, receipts, disbursements, burn, runway };
}

function cashForecast(context: EvidenceContext, book: Playbook): Report {
  const cash = cashMetrics(context);
  const weeklyReceipts = round(cash.receipts * 12 / 52);
  const weeklyPayments = round(cash.disbursements * 12 / 52);
  const rows: ArtifactSection["rows"] = [];
  let ending = cash.available;
  for (let week = 1; week <= 13; week++) {
    const opening = ending;
    ending = round(opening + weeklyReceipts - weeklyPayments);
    rows.push([week, addDays((week - 1) * 7 + 1), addDays(week * 7), opening, weeklyReceipts, weeklyPayments, ending,
      citations(week === 1 ? [...cash.accounts, ...cash.august] : cash.august)]);
  }
  const bankDifferences = cash.accounts.map((account) => {
    const movements = cash.transactions.filter((row) => text(row, "accountId") === account.record.id
      && dateValue(text(row, "date")) >= dateValue(text(account, "periodStart"))
      && dateValue(text(row, "date")) <= dateValue(text(account, "periodEnd")));
    return { account, movements, delta: round(number(account, "openingBalance") + sum(movements.map((row) => number(row, "amount"))) - number(account, "balance")) };
  });
  const missingAccounts = cash.transactions.filter((row) => !cash.accounts.some((account) => account.record.id === text(row, "accountId")));
  const unowned = cash.accounts.filter((row) => !text(row, "reconciliationOwner").trim());
  const overdue = arRows(context).filter((row) => balance(row) > 0 && daysOverdue(row) > 0);
  const openAp = apRows(context).filter((row) => balance(row) > 0);
  const duplicates = duplicateGroups(apRows(context));
  const sensitivities = [
    ["Steady-state base", ending, "13 weeks of observed August run-rate", citations([...cash.accounts, ...cash.august])],
    ["20% receipts downside", round(cash.available + 13 * (round(weeklyReceipts * 0.8) - weeklyPayments)), "Illustrative receipt stress, not a probability forecast", citations(cash.august)],
    ["Full overdue AR recovery (incremental)", round(ending + totalBalance(overdue)), "Only if collected outside the base run-rate; no assumed collection in base", citations(overdue.length ? overdue : arRows(context))],
    ["All open AP incremental payment stress", round(ending - totalBalance(openAp)), "Conservative stress only; may overlap base payments; includes duplicate suspects", citations(openAp.length ? openAp : apRows(context))],
  ];
  const negativePeriods = [
    { label: "opening balance", amount: cash.available },
    ...rows.map((row) => ({ label: `week ${row[0]}`, amount: Number(row[6]) })),
  ].filter((period) => period.amount < 0);
  const negativeScenarios = sensitivities.filter((row) => row[0] !== "Steady-state base" && Number(row[1]) < 0);
  return {
    summary: `Cash ${cash.totalCash} USD, restricted ${cash.restricted} USD, available ${cash.available} USD; observed monthly net burn ${cash.burn} USD; runway ${cash.runway}${typeof cash.runway === "number" ? " months" : ""}. Week 13 base cash ${ending} USD; ${negativePeriods.length} negative base periods, ${negativeScenarios.length} negative stress scenarios, and ${unowned.length} missing bank reconciliation owners. ${citations([...cash.accounts, ...cash.august])}`,
    sections: [
      table(book, 0, "Use signed August cash movements for net burn. Restricted balances are excluded from runway. Zero/negative available cash has zero runway.",
        ["Metric", "Value", "Unit", "Evidence"], [
          ["Total cash", cash.totalCash, "USD", citations(cash.accounts)], ["Restricted cash", cash.restricted, "USD", citations(cash.accounts)],
          ["Available cash", cash.available, "USD", citations(cash.accounts)], ["Observed monthly receipts", cash.receipts, "USD", citations(cash.august)],
          ["Observed monthly disbursements", cash.disbursements, "USD", citations(cash.august)], ["Observed monthly net burn", cash.burn, "USD", citations(cash.august)],
          ["Runway", cash.runway, "months", citations([...cash.accounts, ...cash.august])],
          ...bankDifferences.map(({ account, delta }) => [`${account.record.title} reconciliation difference`, delta, "USD", cite(account)]),
        ]),
      table(book, 1, "Projection assumption: August receipts and disbursements repeat at monthly × 12 ÷ 52 each week. No AP/AR balances are added to the base, avoiding duplicate cash flows.",
        ["Week", "Start", "End", "Opening USD", "Receipts USD", "Payments USD", "Ending USD", "Evidence"], rows),
      table(book, 2, "Sensitivities are separate, non-additive scenarios. They do not authorize payments or promise collections.",
        ["Scenario", "Week 13 cash USD", "Assumption", "Evidence"], sensitivities),
      table(book, 3, "Source exceptions stay visible even when the forecast is successfully produced.",
        ["Action", "Proposed owner", "Observed magnitude", "Evidence"], [
          ...unowned.map((row) => [`Assign bank reconciliation owner: ${row.record.title}`, "Controller", number(row, "balance"), cite(row)]),
          ["Validate timing of overdue receipts", "Collections lead", totalBalance(overdue), citations(overdue.length ? overdue : arRows(context))],
          ["Resolve AP duplicate groups before authorizing payment", "AP lead", duplicates.length, citations(duplicates.length ? duplicates.flat() : apRows(context))],
          ...negativePeriods.map((period) => [`Funding risk: ${period.label}; escalate the projected funding gap`, "CFO", period.amount, citations([...cash.accounts, ...cash.august])]),
          ...negativeScenarios.map((scenario) => [`Scenario risk: ${scenario[0]}; review downside funding response`, "CFO", Number(scenario[1]), String(scenario[3])]),
          ["Review assumptions and maintain weekly forecast; no financing action taken", "CFO", ending, citations([...cash.accounts, ...cash.august])],
        ]),
    ],
    checks: [
      check(criterion(book, 0), bankDifferences.every((item) => equalMoney(item.delta, 0)) && missingAccounts.length === 0,
        `${bankDifferences.map((item) => `${item.account.record.id}: delta ${item.delta} USD ${cite(item.account)}`).join("; ")}; ${missingAccounts.length} orphan transactions.`),
      check(criterion(book, 1), rows.length === 13 && rows.every((row, index) => equalMoney(Number(row[3]), index === 0 ? cash.available : Number(rows[index - 1]![6]))
        && equalMoney(Number(row[3]) + Number(row[4]) - Number(row[5]), Number(row[6])))
        && equalMoney(ending, cash.available + 13 * weeklyReceipts - 13 * weeklyPayments),
      `Start ${cash.available}; 13 × receipts ${weeklyReceipts}; 13 × payments ${weeklyPayments}; end ${ending} USD. ${citations(cash.august)}`),
    ],
    recommendations: [
      ...unowned.map((row) => `Controller: assign a reconciliation owner and verify the ${number(row, "balance")} USD balance. ${cite(row)}`),
      ...(negativePeriods.length ? [`CFO: escalate ${negativePeriods.length} negative base periods, beginning at ${negativePeriods[0]!.label}; minimum available cash ${Math.min(...negativePeriods.map((period) => period.amount))} USD. Obtain a human funding decision; this forecast does not raise or transfer funds. ${citations([...cash.accounts, ...cash.august])}`] : []),
      ...negativeScenarios.map((scenario) => `CFO: review the negative ${scenario[0]} scenario (${scenario[1]} USD); do not combine this stress with other scenarios. ${scenario[3]}`),
      `CFO: validate the ${cash.burn} USD monthly net burn and ${ending} USD week-13 base balance before a funding decision. ${citations([...cash.accounts, ...cash.august])}`,
      `AP lead: resolve ${duplicates.length} duplicate groups before any cash release; do not net suspects out of source AP. ${citations(duplicates.length ? duplicates.flat() : apRows(context))}`,
    ],
    limitations: [
      "Only August cash flows inform the run-rate. This is a simple deterministic scenario, not a statistical or LLM forecast.",
      "No seasonality, credit facilities, taxes, FX, debt, new hiring, financing, or future growth is modeled. Payment and collection timing requires human validation.",
      "An unchanged run-rate can be wrong. AP/AR sensitivities may overlap operating flows and must not be added together.",
      `${negativePeriods.length} negative base periods, ${negativeScenarios.length} negative stress scenarios, and ${unowned.length} bank ownership gaps remain business risks. Passing report-quality checks is not a liquidity or control sign-off. ${citations([...cash.accounts, ...cash.august])}`,
    ],
  };
}

function workforceReview(context: EvidenceContext, book: Playbook): Report {
  const departments = currentMonth(context.rows("payroll", "department"));
  const gl = currentMonth(context.rows("erp", "gl-entry")).filter((row) => text(row, "category") === "payroll");
  const budget = currentMonth(context.rows("planning", "budget")).filter((row) => text(row, "category") === "payroll");
  const headcount = departments.reduce((total, row) => total + number(row, "headcount"), 0);
  const gross = sum(departments.map((row) => number(row, "monthlyGrossPay")));
  const employer = sum(departments.map((row) => number(row, "monthlyEmployerCosts")));
  const loaded = sum(departments.map((row) => number(row, "monthlyFullyLoadedCost")));
  const glPayroll = sum(gl.map((row) => number(row, "amount")));
  const budgetPayroll = sum(budget.map((row) => number(row, "amount")));
  const independentGross = sum(departments.map((row) => round(number(row, "headcount") * number(row, "annualSalaryPerEmployee") / 12)));
  return {
    summary: `${headcount} recorded employees; loaded monthly payroll ${loaded} USD, GL ${glPayroll} USD, payroll budget ${budget.length === 1 ? budgetPayroll : "missing/ambiguous"} USD. ${citations([...departments, ...gl, ...budget])}`,
    sections: [
      table(book, 0, "Headcount and average salaries are department aggregates, not employee-level payroll records.",
        ["Department", "Headcount", "Annual salary/employee USD", "Gross monthly USD", "Employer costs USD", "Loaded monthly USD", "Evidence"],
        departments.map((row) => [text(row, "department"), number(row, "headcount"), number(row, "annualSalaryPerEmployee"),
          number(row, "monthlyGrossPay"), number(row, "monthlyEmployerCosts"), number(row, "monthlyFullyLoadedCost"), cite(row)])),
      table(book, 1, `Compare ${DEMO_ACCOUNTING_MONTH} payroll with the same month's GL and budget; profile headcount is user-provided context, not an independent HR audit.`,
        ["Metric", "Actual", "Comparison", "Difference", "Evidence"], [
          ["Headcount vs company profile", headcount, context.input.profile.employeeCount, headcount - context.input.profile.employeeCount, citations(departments)],
          ["Gross pay vs headcount × annual salary / 12", gross, independentGross, round(gross - independentGross), citations(departments)],
          ["Loaded pay vs gross + employer", loaded, round(gross + employer), round(loaded - gross - employer), citations(departments)],
          ["Loaded pay vs GL payroll", loaded, glPayroll, round(loaded - glPayroll), citations([...departments, ...gl])],
          ["Loaded pay vs payroll budget", loaded, budget.length === 1 ? budgetPayroll : "Missing/ambiguous",
            budget.length === 1 ? round(loaded - budgetPayroll) : "Not comparable", citations([...departments, ...budget])],
        ]),
      table(book, 2, "No hiring, layoffs, salary decisions, employee changes, or payroll approvals are executed.",
        ["Department", "Share of loaded payroll %", "Review action", "Owner", "Evidence"], departments.map((row) => [
          text(row, "department"), percentage(number(row, "monthlyFullyLoadedCost"), loaded),
          "Validate roster, compensation basis, and next-quarter staffing assumptions", text(row, "owner") || "People lead", cite(row),
        ])),
    ],
    checks: [
      check(criterion(book, 0), departments.length > 0 && headcount === context.input.profile.employeeCount,
        `Register ${headcount}; profile ${context.input.profile.employeeCount}; delta ${headcount - context.input.profile.employeeCount}. ${citations(departments)}`),
      check(criterion(book, 1), departments.length > 0 && gl.length > 0 && departments.every((row) => equalMoney(number(row, "monthlyFullyLoadedCost"), number(row, "monthlyGrossPay") + number(row, "monthlyEmployerCosts")))
        && equalMoney(loaded, glPayroll), `Loaded ${loaded}; gross + employer ${round(gross + employer)}; GL ${glPayroll} USD. ${citations([...departments, ...gl])}`),
      check(criterion(book, 2), departments.length > 0 && departments.every((row) => equalMoney(number(row, "monthlyGrossPay"), round(number(row, "headcount") * number(row, "annualSalaryPerEmployee") / 12))),
        `Gross ${gross}; independent salary calculation ${independentGross} USD. ${citations(departments)}`),
      check(criterion(book, 3), budget.length === 1, `${budget.length} payroll budgets in ${DEMO_ACCOUNTING_MONTH}. ${citations(budget)}`),
    ],
    recommendations: [
      `People lead: validate ${headcount} aggregate employees against the live HR roster before workforce decisions. ${citations(departments)}`,
      `Finance partner: explain the payroll-to-budget difference of ${budget.length === 1 ? `${round(loaded - budgetPayroll)} USD` : "unknown (missing or ambiguous budget)"}. ${citations([...departments, ...budget])}`,
    ],
    limitations: ["No employee identities, locations, benefits elections, vacancies, contractors, retention risk, pay equity, or hiring authorization are established from department averages."],
  };
}

function budgetVariance(context: EvidenceContext, book: Playbook): Report {
  const gl = currentMonth(context.rows("erp", "gl-entry"));
  const revenueRows = tbAccount(context, "revenue");
  const budgets = currentMonth(context.rows("planning", "budget"));
  const categories = [...new Set([...gl.map((row) => text(row, "category")), "revenue", ...budgets.map((row) => text(row, "category"))])];
  const analysis = categories.map((category) => {
    const actualRows = category === "revenue" ? revenueRows : gl.filter((row) => text(row, "category") === category);
    const plans = budgets.filter((row) => text(row, "category") === category);
    const actual = category === "revenue" ? tbNet(context, "revenue", true) : sum(actualRows.map((row) => number(row, "amount")));
    const budget = plans.length === 1 ? number(plans[0]!, "amount") : null;
    return { category, actualRows, plans, actual, budget, delta: budget === null || !actualRows.length ? null : round(actual - budget) };
  });
  const expenses = analysis.filter((row) => row.category !== "revenue");
  const expenseTotal = sum(expenses.map((row) => row.actual));
  const glTotal = sum(gl.map((row) => number(row, "amount")));
  const exceptionRows = analysis.filter((row) => row.delta === null || row.category === "" || (row.category === "revenue" ? row.delta < 0 : row.delta > 0));
  return {
    summary: `August GL expenses ${glTotal} USD, reported revenue ${tbNet(context, "revenue", true)} USD; ${exceptionRows.length} unfavorable or incomplete categories require review. ${citations([...gl, ...revenueRows, ...budgets])}`,
    sections: [
      table(book, 0, "Expense variance = actual minus budget (positive is unfavorable). Revenue variance uses the same formula, but negative is unfavorable. Revenue is the synthetic August TB revenue account.",
        ["Category", "Actual USD", "Budget USD", "Variance USD", "Variance %", "Interpretation", "Evidence"],
        analysis.map((row) => [row.category || "UNCATEGORIZED", row.actualRows.length ? row.actual : "Missing actual",
          row.budget ?? "Missing/ambiguous budget", row.delta ?? "Not comparable",
          row.delta === null || row.budget === null ? "Not comparable" : percentage(row.delta, row.budget),
          row.delta === null ? "Data-quality exception" : row.delta === 0 ? "On budget" : (row.category === "revenue" ? row.delta < 0 : row.delta > 0) ? "Unfavorable" : "Favorable",
          citations([...row.actualRows, ...row.plans])])),
      table(book, 1, "Missing category coverage is not silently filled with zero. Duplicate budget records are not combined into an approved budget.",
        ["Metric", "Value", "Evidence"], [
          ["Reported expense total USD", expenseTotal, citations(gl)],
          ["Independent GL total USD", glTotal, citations(gl)],
          ["Expense reconciliation difference USD", round(expenseTotal - glTotal), citations(gl)],
          ["Actual categories without one budget", analysis.filter((row) => row.actualRows.length && row.plans.length !== 1).length, citations([...gl, ...budgets])],
          ["Budget categories without an actual", analysis.filter((row) => !row.actualRows.length).length, citations(budgets)],
        ]),
      table(book, 2, "Seek budget-owner explanations; this report does not prove the cause of any variance.",
        ["Category", "Variance USD", "Proposed owner", "Action", "Evidence"],
        (exceptionRows.length ? exceptionRows : analysis).map((row) => [
          row.category || "UNCATEGORIZED", row.delta ?? "Unknown",
          row.plans.length === 1 ? text(row.plans[0]!, "owner") || "FP&A lead" : "FP&A lead",
          row.delta === null ? "Repair missing or ambiguous period/category mapping" : "Confirm price, usage, staffing, and timing drivers before forecast changes",
          citations([...row.actualRows, ...row.plans]),
        ])),
    ],
    checks: [
      check(criterion(book, 0), analysis.every((row) => !row.actualRows.length || row.plans.length === 1) && gl.length > 0,
        `${analysis.filter((row) => row.actualRows.length && row.plans.length !== 1).length} actual categories lack exactly one budget. ${citations([...gl, ...budgets])}`),
      check(criterion(book, 1), equalMoney(expenseTotal, glTotal), `Report ${expenseTotal}; source GL ${glTotal}; delta ${round(expenseTotal - glTotal)} USD. ${citations(gl)}`),
      check(criterion(book, 2), analysis.every((row) => row.category.trim() && row.actualRows.length > 0),
        `${analysis.filter((row) => !row.category.trim() || !row.actualRows.length).length} unmapped or budget-only categories. ${citations([...gl, ...budgets])}`),
    ],
    recommendations: (exceptionRows.length ? exceptionRows : analysis).map((row) => `FP&A: review ${row.category || "uncategorized"}; variance ${row.delta === null ? "unknown due to incomplete coverage" : `${row.delta} USD`}. Request an owner explanation rather than infer causes. ${citations([...row.actualRows, ...row.plans])}`),
    limitations: ["The fixture GL contains August operating expenses only. No bookings, cash/GAAP timing bridge, allocations, product margins, or causal attribution is inferred."],
  };
}

type ControlFinding = { id: string; risk: string; owner: string; amount: number; method: string; records: EvidenceRecord[] };
function controlFindings(context: EvidenceContext): ControlFinding[] {
  return [
    ...context.rows("banking", "bank-account").filter((row) => !text(row, "reconciliationOwner").trim()).map((row) => ({
      id: `bank-${row.record.id}`, risk: "Bank reconciliation has no owner", owner: "Controller", amount: number(row, "balance"),
      method: "Assign preparer and independent reviewer; tie statement opening plus movements to ending balance.", records: [row],
    })),
    ...context.rows("erp", "close-task").filter((row) => text(row, "status") !== "complete" && !text(row, "owner").trim()).map((row) => ({
      id: `close-${row.record.id}`, risk: "Open close task has no owner", owner: "Controller", amount: 0,
      method: "Assign an owner and inspect a dated reconciliation with independent reviewer sign-off.", records: [row],
    })),
    ...duplicateGroups(apRows(context)).map((group, index) => ({
      id: `ap-duplicate-${index + 1}`, risk: "Possible duplicate supplier invoice", owner: "AP lead", amount: totalBalance(group),
      method: "Compare invoice originals and import history; hold payment and obtain a documented disposition.", records: group,
    })),
    ...apRows(context).filter((row) => balance(row) > 0 && (text(row, "approvalStatus") !== "approved"
      || !context.rows("ap", "vendor").some((vendor) => vendor.record.id === text(row, "vendorId") && vendor.record.data.approved === true))).map((row) => ({
      id: `ap-approval-${row.record.id}`, risk: "Open bill lacks bill/vendor approval", owner: "AP approver", amount: balance(row),
      method: "Verify supplier due diligence, bill approval, and independent payment release authority.", records: [row],
    })),
    ...arRows(context).filter((row) => balance(row) > 0 && daysOverdue(row) > 0 && !text(row, "collectionOwner").trim()).map((row) => ({
      id: `ar-owner-${row.record.id}`, risk: "Overdue receivable has no collection owner", owner: "Collections lead", amount: balance(row),
      method: "Assign a collections owner and inspect a dated customer follow-up and escalation record.", records: [row],
    })),
  ];
}

function controlsRegister(context: EvidenceContext, book: Playbook): Report {
  const findings = controlFindings(context);
  const fallback = citations(context.records.slice(0, 3));
  return {
    summary: `${findings.length} observed high-priority exceptions need control-owner review. Exposure rows overlap and must not be summed. ${citations(findings.length ? findings.flatMap((finding) => finding.records) : context.records.slice(0, 3))}`,
    sections: [
      table(book, 0, "Only observed exceptions are included. Proposed owners are roles, not confirmed appointments. An empty register is not proof of effective controls.",
        ["Control ID", "Observed risk", "Severity", "Affected balance USD", "Proposed owner", "Evidence"],
        findings.length ? findings.map((finding) => [finding.id, finding.risk, "High", finding.amount, finding.owner, citations(finding.records)])
          : [["No exceptions in covered rules", "Independent testing still required", "Unassessed", 0, "Controller", fallback]]),
      table(book, 1, "These are future tests. The local agent does not perform independent control testing or approve remediation.",
        ["Control ID", "Test method", "Owner", "Required evidence", "Source"],
        findings.length ? findings.map((finding) => [finding.id, finding.method, finding.owner, "Dated source support and independent human review", citations(finding.records)])
          : [["Coverage review", "Confirm scope and independently sample evidence", "Controller", "Reviewed sample and exceptions log", fallback]]),
      table(book, 2, "Request explicit human decisions; do not classify a generated document as a resolved risk.",
        ["Decision", "Owner", "Target date (proposed)", "Evidence"],
        findings.length ? findings.map((finding) => [`Accept ownership and remediation plan for ${finding.id}`, finding.owner, addDays(7), citations(finding.records)])
          : [["Approve independent control testing scope", "CFO", addDays(7), fallback]]),
    ],
    checks: [],
    recommendations: findings.length ? findings.map((finding) => `${finding.owner}: ${finding.method} ${citations(finding.records)}`)
      : [`Controller: commission independent control testing; absence of a triggered local rule is not assurance. ${fallback}`],
    limitations: [
      "Coverage is limited to seeded ownership, duplicate-invoice, and approval rules. No security audit, SOC attestation, fraud conclusion, or control-effectiveness opinion is produced.",
      `${findings.length} observed control exceptions remain unresolved. Report acceptance confirms coverage, not remediation or effective controls. ${findings.length ? citations(findings.flatMap((finding) => finding.records)) : fallback}`,
    ],
  };
}

function synthesis(context: EvidenceContext, book: Playbook): Report {
  const cash = cashMetrics(context);
  const ar = arRows(context);
  const ap = apRows(context);
  const tb = context.rows("erp", "trial-balance");
  const departments = currentMonth(context.rows("payroll", "department"));
  const expected = book.dependsOn.map((id) => playbooks.find((candidate) => candidate.id === id)!);
  const prior = expected.map((dependency) => {
    const matches = context.input.previousArtifacts.filter((artifact) => artifact.contract.title === dependency.contract.title);
    const artifact = matches.length === 1 ? matches[0] : undefined;
    const fresh = Boolean(artifact && artifact.sources.length && artifact.sources.every((source) => context.sources.some((current) =>
      current.systemId === source.systemId && current.recordId === source.recordId && current.revision === source.revision && current.title === source.title)));
    const completeChecks = Boolean(artifact && dependency.contract.acceptanceCriteria.every((name) => artifact.checks.some((item) => item.name === name))
      && dependency.contract.deliverables.every((title) => artifact.sections.some((part) => part.title === title && part.rows.length > 0)));
    return { dependency, artifact, matches: matches.length, fresh, completeChecks };
  });
  const findings = controlFindings(context);
  const priorFailures = prior.flatMap((item) => item.fresh
    ? item.artifact?.checks.filter((item) => !item.passed).map((failure) => ({ item, failure })) ?? [] : []);
  const actualHeadcount = departments.reduce((total, row) => total + number(row, "headcount"), 0);
  const sourceTotal = { cash: cash.totalCash, ar: totalBalance(ar), ap: totalBalance(ap) };
  const allFresh = prior.every((item) => item.fresh && item.completeChecks);
  const allAccepted = prior.every((item) => item.artifact && item.fresh && item.completeChecks && item.artifact.checks.every((result) => result.passed));
  const board = book.id === "board-review";
  const baselineSources = [...cash.accounts, ...ar, ...ap, ...departments, ...tb];
  return {
    summary: `${board ? "Board" : "CFO"} diagnostic: available cash ${cash.available} USD, AR ${sourceTotal.ar} USD, AP ${sourceTotal.ap} USD, ${actualHeadcount} employees. ${prior.filter((item) => item.fresh && item.completeChecks).length}/${expected.length} prerequisite reports are current; ${priorFailures.length} prior report-quality checks failed. ${findings.length} observed control exceptions remain unresolved despite completion of this draft. ${citations(baselineSources)}`,
    sections: [
      table(book, 0, `Current source-derived baseline for ${context.input.profile.name}; ${context.input.assessment.objective} No external work is marked complete.`,
        ["Metric", "Value", "Basis", "Evidence"], [
          ["Available cash USD", cash.available, "Bank balances less restricted cash", citations(cash.accounts)],
          ["Observed monthly net burn USD", cash.burn, "August disbursements less receipts", citations(cash.august)],
          ["Runway months", cash.runway, "Available cash / positive observed net burn", citations([...cash.accounts, ...cash.august])],
          ["Outstanding AR USD", sourceTotal.ar, "Invoice amounts less payments", citations(ar)],
          ["Overdue AR USD", totalBalance(ar.filter((row) => balance(row) > 0 && daysOverdue(row) > 0)), "Open amounts past due", citations(ar)],
          ["Outstanding AP USD", sourceTotal.ap, "All source bills; suspected duplicates retained", citations(ap)],
          ["Recorded headcount", actualHeadcount, "Department register, August", citations(departments)],
          ["TB debit-credit difference USD", round(sum(tb.map((row) => number(row, "debit"))) - sum(tb.map((row) => number(row, "credit")))), "Arithmetic balance test", citations(tb)],
        ]),
      table(book, 1, "Prior report claims are included only as attributed diagnostic evidence. Missing, duplicate, stale, or incomplete reports block acceptance, not report production.",
        ["Prerequisite", "Evidence state", "Failed checks", "Prior conclusion", "Evidence"], prior.map((item) => [
          item.dependency.title, !item.artifact ? item.matches > 1 ? "AMBIGUOUS: duplicate reports" : "MISSING" : !item.fresh ? "STALE" : !item.completeChecks ? "INCOMPLETE" : "CURRENT",
          item.artifact?.checks.filter((result) => !result.passed).length ?? "Unknown",
          item.artifact && item.fresh ? item.artifact.summary
            : item.artifact ? "Prior conclusion withheld: historical sources do not match the connected snapshot. Re-run this diagnostic."
              : "Insufficient evidence: a unique prior diagnostic was not supplied.",
          item.artifact && item.fresh ? item.artifact.sources.map(sourceCitation).join("; ")
            : citations(context.records.filter((row) => item.dependency.contract.requiredSystems.includes(row.system.id))),
        ])),
      table(book, 2, "Decision requests are not approvals. Source exceptions and failed prior checks remain unresolved until a human provides evidence.",
        ["Priority", "Decision requested", "Owner", "Evidence"], [
          ...findings.slice(0, 8).map((finding) => ["High", finding.method, finding.owner, citations(finding.records)]),
          ...prior.filter((item) => !item.fresh || !item.completeChecks).map((item) => ["High", `Run or refresh ${item.dependency.title}`, "CFO / data owner", citations(context.records.slice(0, 2))]),
          ...priorFailures.slice(0, 8).map(({ item, failure }) => ["High", `Resolve prior check: ${failure.name}`, "Diagnostic owner",
            `${failure.detail} ${item.artifact!.sources.map(sourceCitation).join("; ")}`]),
          ["Review", board ? "Review the package and record board decisions through normal governance" : "Agree the finance remediation sequence; do not approve payments or a close from this report", "CFO", citations(baselineSources)],
        ]),
      table(book, 3, "Dates and owners below are proposals. No meeting was held, policy approved, hire made, audit completed, or books closed.",
        ["Checkpoint", "Proposed date", "Deliverable", "Owner", "Evidence"], [
          ["Week 1", addDays(7), "Resolve ownership and duplicate-payment holds; review cash reconciliation", "Controller / AP lead", citations([...cash.accounts, ...ap])],
          ["Week 2", addDays(14), "Confirm collection commitments and reconcile workforce costs", "Collections / People leads", citations([...ar, ...departments])],
          ["Week 3", addDays(21), "Review category variances and forecast assumptions", "FP&A lead", citations([...context.rows("planning"), ...context.rows("erp", "gl-entry")])],
          ["Day 30", addDays(30), board ? "Record human board decisions and approved follow-ups" : "Present revised CFO diagnostic with reviewed remediation evidence", "CFO", citations(tb)],
        ]),
    ],
    checks: [
      check(criterion(book, 0), allFresh, prior.map((item) => `${item.dependency.id}: ${item.fresh && item.completeChecks ? "current" : "missing/stale/ambiguous/incomplete"}`).join("; ")),
      check(criterion(book, 1), equalMoney(sourceTotal.cash, tbNet(context, "cash")) && equalMoney(sourceTotal.ar, tbNet(context, "ar"))
        && equalMoney(sourceTotal.ap, tbNet(context, "ap", true)) && equalMoney(sum(tb.map((row) => number(row, "debit"))), sum(tb.map((row) => number(row, "credit")))),
      `Cash delta ${round(sourceTotal.cash - tbNet(context, "cash"))}; AR delta ${round(sourceTotal.ar - tbNet(context, "ar"))}; AP delta ${round(sourceTotal.ap - tbNet(context, "ap", true))} USD. ${citations(baselineSources)}`),
      check(criterion(book, 2), allAccepted, `${priorFailures.length} failed report-quality checks in current prerequisites; missing, stale, or incomplete prerequisites also fail this gate. Reported business risks do not by themselves block a complete diagnostic.`),
    ],
    recommendations: [
      ...findings.slice(0, 5).map((finding) => `${finding.owner}: ${finding.method} ${citations(finding.records)}`),
      ...prior.filter((item) => !item.fresh || !item.completeChecks).map((item) => `CFO: obtain a current, complete "${item.dependency.title}" before accepting this package. ${citations(context.records.slice(0, 2))}`),
      ...priorFailures.slice(0, 3).map(({ failure, item }) => `CFO: retain the unresolved check "${failure.name}" from "${item.dependency.title}" in the review agenda. ${item.artifact!.sources.slice(0, 3).map(sourceCitation).join("; ")}`),
      `CFO: review available cash of ${cash.available} USD and record human decisions separately from these generated materials. ${citations(cash.accounts)}`,
    ],
    limitations: [
      "Prior artifacts are user-supplied local diagnostic documents, not signed audit evidence. Stale conclusions are withheld; citations include current connected records only. Revision checks cannot detect edits made without incrementing a source revision.",
      "This package is a draft. It does not complete a board meeting, external audit, hiring plan implementation, fundraising, filing, payment, or approval.",
    ],
  };
}

export const reportBuilders: Record<string, (context: EvidenceContext, book: Playbook) => Report> = {
  "system-inventory": systemInventory,
  "stakeholder-context": stakeholderContext,
  "close-assessment": closeAssessment,
  "ar-aging": arAging,
  "ap-review": apReview,
  "cash-forecast": cashForecast,
  "workforce-review": workforceReview,
  "budget-variance": budgetVariance,
  "controls-register": controlsRegister,
  "cfo-diagnostic": synthesis,
  "board-review": synthesis,
};
