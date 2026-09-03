process.env.CFO_ALLOW_SIGNUP = "true";

export {};

const [
  { auth },
  {
    listUserWorkspaces,
    closeDatabase,
    createWorkspace,
    ensureCredentialAccount,
    findUserByEmail,
  },
  catalog,
  domain,
  crypto,
] =
  await Promise.all([
    import("../lib/auth"),
    import("@cfo/db"),
    import("@cfo/catalog"),
    import("@cfo/domain"),
    import("better-auth/crypto"),
  ]);

const email = process.env.CFO_DEMO_EMAIL ?? "cfo@example.com";
const password = process.env.CFO_DEMO_PASSWORD ?? "local-demo-only";

const existingUser = await findUserByEmail(email);
const userId =
  existingUser?.id ??
  (
    await auth.api.signUpEmail({
      body: {
        name: "Demo CFO",
        email,
        password,
      },
      asResponse: false,
    })
  ).user.id;

await ensureCredentialAccount(userId, await crypto.hashPassword(password));

const existing = await listUserWorkspaces(userId);
if (existing.length === 0) {
  const profile = domain.CompanyProfileSchema.parse({
    name: "Aperture AI",
    stage: "series-b",
    startDate: domain.localDateString(new Date()),
    fiscalYearEndMonth: 12,
    businessModels: ["b2b-saas-usage"],
    annualRevenueMillions: 14,
    arrMillions: 18,
    cashRunwayMonths: 17,
    employeeCount: 112,
    entityCount: 1,
    countries: ["US"],
    internationalEmployees: false,
    closeDays: 18,
    auditStatus: "planning",
    auditDueDate: null,
    fundraiseDate: null,
    nextBoardDate: null,
    accountingSystem: "quickbooks",
    billingModel: "hybrid",
    salesTaxNexusStates: 9,
    financeTeam: {
      controller: "none",
      strategicFinance: "none",
      financeOperations: "fractional",
      tax: "outsourced",
      treasury: "none",
      staffAccountants: 1,
    },
  });
  const roadmap = domain.generateRoadmap(profile, catalog.masterTasks);
  const hiringRecommendations = domain.recommendHiring(
    profile,
    catalog.hiringRoles,
  );
  await createWorkspace({
    actorId: userId,
    name: profile.name,
    slug: "aperture-ai",
    profile,
    roadmap,
    hiringRecommendations,
  });
}

console.log(`Seeded local workspace. Sign in with ${email} / ${password}`);
await closeDatabase();
