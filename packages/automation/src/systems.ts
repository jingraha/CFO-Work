import { CompanyProfileSchema, type CompanyProfile, type MockRecord, type MockSystem } from "@cfo/domain";

export const DEMO_AS_OF_DATE = "2026-09-05";
export const DEMO_ACCOUNTING_MONTH = "2026-08";

const money = (value: number) => Math.round(value * 100) / 100;

/** Fresh, editable records; no credentials, network adapters, or clock-dependent data. */
export function createMockSystems(profile: CompanyProfile): MockSystem[] {
  const company = CompanyProfileSchema.parse(profile);
  const hash = [...company.name].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
  const scale = 0.9 + (hash % 21) / 100;
  const slug = company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 45) || "company";
  const email = (person: string) => `${person}@${slug}.example`;
  const record = (id: string, kind: string, title: string, data: MockRecord["data"]): MockRecord => ({
    id, kind, title, data: { asOfDate: DEMO_AS_OF_DATE, ...data },
  });
  const system = (id: MockSystem["id"], name: string, category: string, records: MockRecord[]): MockSystem => ({
    id, name, category, records,
    description: `${company.name}: synthetic local ${name.toLowerCase()} fixture as of ${DEMO_AS_OF_DATE}. Not a live connection.`,
    scopes: ["local:records:read"],
  });

  const departments = [
    { id: "dept-engineering", name: "Engineering", share: 0.45, salary: 170_000 },
    { id: "dept-sales", name: "Sales", share: 0.2, salary: 135_000 },
    { id: "dept-success", name: "Customer success", share: 0.15, salary: 100_000 },
    { id: "dept-operations", name: "Operations", share: 0.12, salary: 115_000 },
    { id: "dept-finance", name: "Finance", share: 0.08, salary: 145_000 },
  ];
  const headcounts = departments.map((department) => Math.floor(company.employeeCount * department.share));
  let remainder = company.employeeCount - headcounts.reduce((total, value) => total + value, 0);
  for (let index = 0; remainder > 0; index++, remainder--) headcounts[index % departments.length]!++;
  const payroll = departments.map((department, index) => {
    const headcount = headcounts[index]!;
    const annualSalaryPerEmployee = money(department.salary * scale);
    const monthlyGrossPay = money(headcount * annualSalaryPerEmployee / 12);
    const monthlyEmployerCosts = money(monthlyGrossPay * 0.22);
    return record(department.id, "department", `${department.name} payroll`, {
      department: department.name, headcount, annualSalaryPerEmployee, monthlyGrossPay,
      monthlyEmployerCosts, monthlyFullyLoadedCost: money(monthlyGrossPay + monthlyEmployerCosts),
      month: DEMO_ACCOUNTING_MONTH, currency: "USD", owner: email(department.id.slice(5)),
    });
  });
  const payrollCost = money(payroll.reduce((sum, row) => sum + Number(row.data.monthlyFullyLoadedCost), 0));
  const revenue = money(company.annualRevenueMillions * 1_000_000 / 12);
  const infrastructure = money((25_000 + company.employeeCount * 600) * scale);
  const software = money((5_000 + company.employeeCount * 150) * scale);
  const cashBurn = money(payrollCost + infrastructure + software - revenue);
  const cash = money(company.cashRunwayMonths * Math.max(cashBurn, (payrollCost + infrastructure + software) * 0.2));
  if (![revenue, payrollCost, cash].every((value) => Number.isSafeInteger(Math.round(value * 100)))) {
    throw new Error("Profile exceeds the supported local demo monetary range.");
  }

  const customers = ["Northstar", "Cedar", "Harbor"].map((name, index) => record(
    `customer-${index + 1}`, "customer", `${name} customer`, {
      name: `${name} Labs`, billingEmail: `billing@${name.toLowerCase()}.example`,
      accountOwner: email("sales"), termsDays: 30,
    },
  ));
  const invoiceSpecs: Array<[string, string, string, number, number]> = [
    ["customer-1", "2026-04-15", "2026-05-15", money(22_000 * scale), 0],
    ["customer-2", "2026-07-21", "2026-08-20", money(38_000 * scale), money(8_000 * scale)],
    ["customer-3", "2026-08-16", "2026-09-15", money(55_000 * scale), 0],
    ["customer-1", "2026-07-01", "2026-08-01", money(revenue * 0.6), money(revenue * 0.6)],
    ["customer-2", "2026-06-15", "2026-07-15", money(16_000 * scale), 0],
    ["customer-3", "2026-07-15", "2026-08-15", money(revenue - money(revenue * 0.6)), money(revenue - money(revenue * 0.6))],
  ];
  const invoices = invoiceSpecs.map(([customerId, issuedDate, dueDate, amount, paidAmount], index) => record(
    `ar-invoice-${index + 1}`, "invoice", `INV-${1001 + index}`, {
      customerId, issuedDate, dueDate, amount, paidAmount, currency: "USD",
      status: amount === paidAmount ? "paid" : paidAmount ? "part-paid" : "open",
      collectionOwner: index === 0 ? "" : email("collections"),
    },
  ));
  const arBalance = money(invoices.reduce((sum, row) => sum + Number(row.data.amount) - Number(row.data.paidAmount), 0));
  const vendors = [
    record("vendor-cloud", "vendor", "Nimbus Compute", { name: "Nimbus Compute", email: "billing@nimbus.example", category: "infrastructure", approved: true }),
    record("vendor-software", "vendor", "Ledger Tools", { name: "Ledger Tools", email: "billing@ledger-tools.example", category: "software", approved: true }),
    record("vendor-office", "vendor", "Common Workspace", { name: "Common Workspace", email: "billing@common-workspace.example", category: "software", approved: false }),
  ];
  const billSpecs: Array<[string, string, number, number, string]> = [
    ["vendor-cloud", "CLOUD-SEP-01", money(infrastructure * 0.7), 0, "2026-09-15"],
    ["vendor-software", "TOOLS-SEP-01", money(software * 0.5), 0, "2026-09-10"],
    ["vendor-software", "TOOLS-SEP-01", money(software * 0.5), 0, "2026-09-10"],
    ["vendor-office", "OFFICE-AUG-04", money(8_000 * scale), 0, "2026-08-31"],
    ["vendor-cloud", "CLOUD-AUG-01", infrastructure, infrastructure, "2026-08-25"],
    ["vendor-software", "TOOLS-AUG-01", software, software, "2026-08-28"],
  ];
  const bills = billSpecs.map(([vendorId, invoiceNumber, amount, paidAmount, dueDate], index) => record(
    `ap-bill-${index + 1}`, "bill", `${invoiceNumber}${index === 2 ? " imported copy" : ""}`, {
      vendorId, invoiceNumber, amount, paidAmount, dueDate, currency: "USD",
      approvalStatus: index === 2 || index === 3 ? "pending" : "approved",
      status: amount === paidAmount ? "paid" : "open",
    },
  ));
  const apBalance = money(bills.reduce((sum, row) => sum + Number(row.data.amount) - Number(row.data.paidAmount), 0));
  const operatingCash = money(cash * 0.75);
  const reserveCash = money(cash - operatingCash);
  const transactions = [
    record("bank-tx-1", "cash-transaction", "Northstar August receipt", { date: "2026-08-20", amount: invoiceSpecs[3]![4], category: "revenue", linkedSystem: "ar", linkedRecordId: "ar-invoice-4" }),
    record("bank-tx-2", "cash-transaction", "Harbor August receipt", { date: "2026-08-28", amount: invoiceSpecs[5]![4], category: "revenue", linkedSystem: "ar", linkedRecordId: "ar-invoice-6" }),
    record("bank-tx-3", "cash-transaction", "August payroll and employer costs", { date: "2026-08-28", amount: -payrollCost, category: "payroll", linkedSystem: "erp", linkedRecordId: "gl-payroll" }),
    record("bank-tx-4", "cash-transaction", "Nimbus August payment", { date: "2026-08-25", amount: -infrastructure, category: "infrastructure", linkedSystem: "ap", linkedRecordId: "ap-bill-5" }),
    record("bank-tx-5", "cash-transaction", "Ledger Tools August payment", { date: "2026-08-28", amount: -software, category: "software", linkedSystem: "ap", linkedRecordId: "ap-bill-6" }),
  ].map((row) => ({ ...row, data: { ...row.data, accountId: "bank-operating", currency: "USD" } }));
  const bankAccounts = [
    record("bank-operating", "bank-account", `${company.name} operating cash`, {
      currency: "USD", balance: operatingCash, restrictedAmount: 0,
      openingBalance: money(operatingCash + cashBurn), periodStart: "2026-08-01", periodEnd: DEMO_AS_OF_DATE,
      institution: "Local Demo Bank", accountLabel: "DEMO-OPERATING", reconciliationOwner: "",
    }),
    record("bank-reserve", "bank-account", `${company.name} reserve cash`, {
      currency: "USD", balance: reserveCash, restrictedAmount: money(reserveCash * 0.1),
      openingBalance: reserveCash, periodStart: "2026-08-01", periodEnd: DEMO_AS_OF_DATE,
      institution: "Local Demo Reserve", accountLabel: "DEMO-RESERVE", reconciliationOwner: email("controller"),
    }),
  ];
  const equity = money(cash + arBalance + payrollCost + infrastructure + software - apBalance - revenue);
  const tbSpecs: Array<[string, string, number, number]> = [
    ["cash", "Cash", cash, 0], ["ar", "Accounts receivable", arBalance, 0],
    ["ap", "Accounts payable", 0, apBalance], ["payroll", "Payroll expense", payrollCost, 0],
    ["infrastructure", "Infrastructure expense", infrastructure, 0], ["software", "Software expense", software, 0],
    ["revenue", "Revenue", 0, revenue], ["equity", "Opening equity and retained earnings", Math.max(-equity, 0), Math.max(equity, 0)],
  ];
  const trialBalance = tbSpecs.map(([accountCode, accountName, debit, credit]) => record(
    `tb-${accountCode}`, "trial-balance", accountName, { accountCode, debit, credit, currency: "USD", periodEnd: DEMO_AS_OF_DATE },
  ));
  const closeTasks = [
    record("close-bank-rec", "close-task", "Reconcile operating bank account", { owner: "", status: "open", dueDate: "2026-09-03", accountId: "bank-operating", targetDay: 3 }),
    record("close-ar-tieout", "close-task", "Tie AR aging to the trial balance", { owner: email("collections"), status: "open", dueDate: "2026-09-04", accountId: "tb-ar", targetDay: 4 }),
    record("close-ap-cutoff", "close-task", "Review AP duplicate and cutoff exceptions", { owner: email("controller"), status: "open", dueDate: "2026-09-06", accountId: "tb-ap", targetDay: 6 }),
    record("close-payroll", "close-task", "Tie payroll expense to payroll register", { owner: email("people"), status: "complete", dueDate: "2026-09-02", accountId: "tb-payroll", targetDay: 2 }),
  ];
  const gl = [
    record("gl-payroll", "gl-entry", "August loaded payroll", { month: DEMO_ACCOUNTING_MONTH, category: "payroll", amount: payrollCost, currency: "USD", accountCode: "payroll" }),
    record("gl-infrastructure", "gl-entry", "August infrastructure expense", { month: DEMO_ACCOUNTING_MONTH, category: "infrastructure", amount: infrastructure, currency: "USD", accountCode: "infrastructure" }),
    record("gl-software", "gl-entry", "August software expense", { month: DEMO_ACCOUNTING_MONTH, category: "software", amount: software, currency: "USD", accountCode: "software" }),
  ];
  const actuals = { payroll: payrollCost, infrastructure, software, revenue };
  const planning = ["2026-08", "2026-09"].flatMap((month) => Object.entries(actuals).map(([category, actual]) => record(
    `budget-${month}-${category}`, "budget", `${month} ${category} budget`, {
      month, category, amount: money(actual * (category === "revenue" ? 1.1 : category === "infrastructure" ? 0.8 : 0.95)),
      currency: "USD", owner: email(category === "revenue" ? "sales" : "finance"), plannedHeadcount: company.employeeCount,
    },
  )));
  const stakeholderSpecs = [
    ["ceo", "CEO", "cash", "Show runway and downside before the board review.", "banking", "bank-operating", "high"],
    ["controller", "Controller", "close", "Bank reconciliation has no owner. Review the close checklist.", "erp", "close-bank-rec", "high"],
    ["sales", "Sales leader", "collections", "Northstar needs a collection escalation; do not assume payment.", "ar", "ar-invoice-1", "high"],
    ["operations", "Operations leader", "payments", "Two copies of TOOLS-SEP-01 appeared in the AP import.", "ap", "ap-bill-3", "high"],
    ["people", "People leader", "workforce", "Reconcile department payroll costs before proposing new positions.", "payroll", "dept-engineering", "medium"],
  ];
  const gmail = stakeholderSpecs.map(([person, role, theme, body, linkedSystem, linkedRecordId, priority], index) => record(
    `email-${index + 1}`, "email", `${company.name}: ${theme} review request`, {
      from: email(person!), to: email("cfo"), role: role!, theme: theme!, body: body!,
      sentAt: `2026-09-0${index + 1}T09:00:00Z`, dueDate: "2026-09-09", priority: priority!,
      requestedOutcome: body!, linkedSystem: linkedSystem!, linkedRecordId: linkedRecordId!,
    },
  ));
  const channels = ["finance-close", "cash-collections", "people-planning"].map((name, index) => record(
    `channel-${index + 1}`, "channel", `#${name}`, { name, purpose: `${company.name} ${name.replaceAll("-", " ")} coordination` },
  ));
  const slack = stakeholderSpecs.map(([person, , theme, body, linkedSystem, linkedRecordId], index) => record(
    `slack-message-${index + 1}`, "message", `${theme} follow-up`, {
      channelId: `channel-${index === 4 ? 3 : index === 0 || index === 2 ? 2 : 1}`,
      author: email(person!), text: body!, sentAt: `2026-09-0${index + 1}T10:00:00Z`,
      linkedSystem: linkedSystem!, linkedRecordId: linkedRecordId!, theme: theme!,
    },
  ));
  return [
    system("gmail", "Gmail-style inbox", "communications", gmail),
    system("slack", "Slack-style workspace", "communications", [...channels, ...slack]),
    system("erp", "ERP and close", "accounting", [...trialBalance, ...closeTasks, ...gl]),
    system("ar", "Accounts receivable", "receivables", [...customers, ...invoices]),
    system("ap", "Accounts payable", "payables", [...vendors, ...bills]),
    system("planning", "Financial planning", "planning", planning),
    system("payroll", "Payroll register", "people", payroll),
    system("banking", "Local demo banking", "treasury", [...bankAccounts, ...transactions]),
  ];
}
