import type { BusinessModel, CompanyProfile, Vendor } from "@cfo/domain";

export const FOUNDATION_VENDOR_CATEGORIES = [
  "ERP and core accounting",
  "Close management and reconciliation",
  "Accounts payable and spend",
  "Financial planning and analysis",
] as const;

const ERP_CATEGORY = "ERP and core accounting";
const CLOSE_CATEGORY = "Close management and reconciliation";
const AP_CATEGORY = "Accounts payable and spend";
const FP_AND_A_CATEGORY = "Financial planning and analysis";
const BILLING_CATEGORY = "Billing and usage metering";
const TAX_CATEGORY = "Tax compliance";
const AR_CATEGORY = "Accounts receivable and collections";
const PAYROLL_CATEGORY = "Payroll, HRIS, and benefits";
const AUDIT_CATEGORY = "Audit and outsourced accounting";
const TREASURY_CATEGORY = "Treasury and banking";
const PROCUREMENT_CATEGORY = "Procurement and vendor management";
const CAP_TABLE_CATEGORY = "Cap table, equity, and 409A";
const BI_CATEGORY = "Business intelligence and data";
const SECURITY_CATEGORY = "Security and compliance automation";
const LEGAL_CATEGORY = "Legal, entity, and governance";

const ACCOUNTING_SYSTEM_LABELS: Record<
  CompanyProfile["accountingSystem"],
  string
> = {
  spreadsheets: "spreadsheets",
  quickbooks: "QuickBooks Online",
  xero: "Xero",
  "sage-intacct": "Sage Intacct",
  netsuite: "NetSuite",
  other: "your current ledger",
};

const BUSINESS_MODEL_LABELS: Record<BusinessModel, string> = {
  "b2b-saas-usage": "usage-based B2B SaaS",
  "ai-infrastructure": "AI infrastructure",
  "consumer-subscription": "consumer subscription",
  "ai-enabled-services": "AI-enabled services",
};

const IMPLEMENTATION_STYLES = {
  light: {
    label: "Light implementation",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  moderate: {
    label: "Moderate implementation",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  heavy: {
    label: "Heavy implementation",
    className: "border-red-200 bg-red-50 text-red-700",
  },
} satisfies Record<
  Vendor["implementation"],
  { label: string; className: string }
>;

export function getImplementationStyle(implementation: Vendor["implementation"]) {
  return IMPLEMENTATION_STYLES[implementation];
}

export const AI_NATIVE_DEFINITION =
  "AI-native means the vendor's official product page clearly positions the core product around AI-powered workflows or AI-first automation. AI-enabled add-ons alone do not qualify.";

export type AiNativeVendorMetadata = {
  evidence: string;
  sourceUrl: string;
};

const AI_NATIVE_VENDOR_METADATA: Record<string, AiNativeVendorMetadata> = {
  numeric: {
    evidence: 'Numeric describes its product as "AI-Powered Close Automation".',
    sourceUrl: "https://www.numeric.io/",
  },
  trullion: {
    evidence:
      'Trullion describes its core product as an "AI-Powered Accounting Platform".',
    sourceUrl: "https://trullion.com/products/platform/",
  },
};

export function getAiNativeVendorMetadata(vendorId: string) {
  return AI_NATIVE_VENDOR_METADATA[vendorId];
}

export function isVendorAiNative(vendorId: string) {
  return Object.prototype.hasOwnProperty.call(
    AI_NATIVE_VENDOR_METADATA,
    vendorId,
  );
}

export type VendorRecommendation = {
  category: string;
  label: string;
  reasons: string[];
  tradeoff: string;
  vendorId: string;
  vendorName: string;
};

export type VendorShortlist = {
  criteria: string[];
  emptyMessage?: string;
  hasProfile: boolean;
  recommendations: VendorRecommendation[];
  summary: string;
  title: string;
};

type FitContext = {
  accountingSystemLabel: string;
  fullTimeStrategicFinance: boolean;
  hasControllerCoverage: boolean;
  hasStrategicFinanceCoverage: boolean;
  isAiInfrastructure: boolean;
  isConsumerSubscription: boolean;
  isLeanFinanceTeam: boolean;
  isMultiEntity: boolean;
  isStaffedFinanceTeam: boolean;
  isUsageRevenueBusiness: boolean;
};

export function buildCompanyFitCriteria(
  profile: CompanyProfile | null,
): string[] {
  if (!profile) return [];

  return [
    `Stage: ${formatStage(profile.stage)}`,
    `Entities: ${profile.entityCount}`,
    `Ledger: ${ACCOUNTING_SYSTEM_LABELS[profile.accountingSystem]}`,
    `Close: ${profile.closeDays} days`,
    `Controller: ${formatCoverage(profile.financeTeam.controller)}`,
    `Strategic finance: ${formatCoverage(profile.financeTeam.strategicFinance)}`,
  ];
}

export function buildVendorShortlist({
  profile,
  vendors,
  selectedCategory,
}: {
  profile: CompanyProfile | null;
  selectedCategory: string;
  vendors: Vendor[];
}): VendorShortlist {
  if (!profile) {
    return {
      criteria: [],
      hasProfile: false,
      recommendations: [],
      summary: "Complete company profile to tailor recommendations.",
      title: "Tailored shortlist unavailable",
    };
  }

  const categories =
    selectedCategory === "all"
      ? [...FOUNDATION_VENDOR_CATEGORIES]
      : [selectedCategory];
  const recommendations = categories.flatMap((category) =>
    resolveCategoryRecommendations(
      profile,
      vendors,
      category,
      selectedCategory === "all" ? 1 : 2,
    ),
  );

  return {
    criteria: buildCompanyFitCriteria(profile),
    hasProfile: true,
    recommendations,
    summary:
      selectedCategory === "all"
        ? "Finance foundations based on stage, entity count, current ledger, close pace, and finance coverage. Recommendations are directional, not auto-decisions."
        : `Shortlist for ${selectedCategory.toLowerCase()} using stage, entity count, current ledger, close pace, and finance coverage.`,
    title:
      selectedCategory === "all"
        ? `Recommended for ${profile.name}`
        : `${selectedCategory} shortlist`,
    ...(recommendations.length
      ? {}
      : {
          emptyMessage:
            "No suitable fit from the current profile alone. Search the catalog or evaluate vendors directly.",
        }),
  };
}

function buildCategoryReasons(profile: CompanyProfile, vendor: Vendor): string[] {
  const context = getContext(profile);

  switch (vendor.category) {
    case ERP_CATEGORY:
      return buildErpReasons(profile, vendor, context);
    case CLOSE_CATEGORY:
      return buildCloseReasons(profile, vendor, context);
    case AP_CATEGORY:
      return buildAccountsPayableReasons(vendor, context);
    case FP_AND_A_CATEGORY:
      return buildFpAndAReasons(vendor);
    case BILLING_CATEGORY:
      return buildBillingReasons(vendor);
    case TAX_CATEGORY:
      return buildTaxReasons(vendor, context);
    case AR_CATEGORY:
      return buildCollectionsReasons(profile, vendor, context);
    case PAYROLL_CATEGORY:
      return buildPayrollReasons(profile, vendor);
    case AUDIT_CATEGORY:
      return buildAuditReasons(vendor, context);
    case TREASURY_CATEGORY:
      return buildTreasuryReasons(vendor);
    case PROCUREMENT_CATEGORY:
      return buildProcurementReasons(vendor);
    case CAP_TABLE_CATEGORY:
      return buildCapTableReasons(vendor);
    case BI_CATEGORY:
      return buildBusinessIntelligenceReasons(vendor);
    case SECURITY_CATEGORY:
      return buildSecurityReasons(vendor);
    case LEGAL_CATEGORY:
      return buildLegalReasons(vendor);
    default:
      return [];
  }
}

function buildErpReasons(
  profile: CompanyProfile,
  vendor: Vendor,
  context: FitContext,
): string[] {
  switch (vendor.id) {
    case "quickbooks-online":
      return [
        "Single-entity Series B scope points to the lightest ERP lift.",
        profile.accountingSystem === "quickbooks"
          ? "Keeps the current QuickBooks ledger in place while the rest of the stack matures."
          : "Fastest move off spreadsheets without kicking off a full ERP program.",
      ];
    case "xero":
      return [
        "Single-entity scale keeps a lighter ledger viable.",
        profile.accountingSystem === "xero"
          ? "Keeps the current Xero ledger in place while the team stays lean."
          : "Useful when you want a light ledger with strong bank-feed automation.",
      ];
    case "sage-intacct":
      return [
        context.isMultiEntity
          ? "Multi-entity reporting points to consolidation and dimensional controls."
          : "A growing finance stack can benefit from dimensional reporting before a tier-one ERP.",
        profile.accountingSystem === "sage-intacct"
          ? "Stays on the current Sage Intacct ledger instead of re-platforming."
          : "Often the better middle ground between starter ledgers and the heaviest ERP path.",
      ];
    case "netsuite":
      return [
        context.isMultiEntity
          ? "Multi-entity structure is the clearest trigger for a consolidated ERP."
          : `${formatStage(profile.stage)} scale makes a more durable ERP worth considering.`,
        profile.accountingSystem === "netsuite"
          ? "Keeps NetSuite as the system of record while you improve the surrounding stack."
          : "More durable once starter ledgers begin to strain under close and reporting complexity.",
      ];
    default:
      return [];
  }
}

function buildCloseReasons(
  profile: CompanyProfile,
  vendor: Vendor,
  context: FitContext,
): string[] {
  switch (vendor.id) {
    case "numeric":
      return [
        context.isLeanFinanceTeam
          ? "Lean finance coverage favors a faster-close tool with a lighter setup."
          : "Quick setup is a better fit when you want close automation without a long program.",
        profile.closeDays <= 10
          ? `${profile.closeDays}-day close suggests speed matters more than a heavy controls layer.`
          : `${profile.closeDays}-day close can shrink with automated flux analysis and faster review.`,
      ];
    case "floqast":
      return [
        profile.closeDays > 10
          ? `${profile.closeDays}-day close points to more checklist and reconciliation discipline.`
          : "Adds close structure without replacing the ERP.",
        context.accountingSystemLabel !== "spreadsheets"
          ? `Connects to ${context.accountingSystemLabel}.`
          : "Reconciliation sign-off creates cleaner audit evidence.",
      ];
    case "blackline":
      return [
        "A multi-entity Series C close can justify a heavier controls layer.",
        "Best when reconciliation governance matters more than rollout speed.",
      ];
    case "trullion":
      return [
        context.isAiInfrastructure
          ? "AI-infrastructure finance teams often feel contract and workpaper pressure earlier."
          : "Useful when accounting review time is shifting toward contract and workpaper work.",
        "AI-led workpaper automation is more compelling once a lean team is stretched.",
      ];
    default:
      return [];
  }
}

function buildAccountsPayableReasons(
  vendor: Vendor,
  context: FitContext,
): string[] {
  switch (vendor.id) {
    case "ramp":
      return [
        context.isLeanFinanceTeam
          ? "Lean finance teams usually benefit from the lightest AP and card rollout."
          : "Combined card, expense, and AP cuts tool sprawl.",
        context.accountingSystemLabel !== "spreadsheets"
          ? `Strong coding rules can keep ${context.accountingSystemLabel} cleaner at month end.`
          : "Strong coding rules reduce month-end recategorization.",
      ];
    case "bill":
      return [
        "Mature approval routing fits a more controlled AP process.",
        context.accountingSystemLabel !== "spreadsheets"
          ? `Direct integration with ${context.accountingSystemLabel} lowers duplicate entry.`
          : "Wide accountant familiarity shortens onboarding.",
      ];
    case "tipalti":
      return [
        context.isMultiEntity
          ? "Multi-entity scale increases the value of stronger supplier onboarding and payout controls."
          : "Better suited once payables complexity moves beyond simple domestic invoice routing.",
        "A better fit when AP needs global or higher-volume controls.",
      ];
    case "brex":
      return [
        "Keeps spend control lighter for a startup operating model.",
        "Works best when card-led spend is the main AP problem to solve.",
      ];
    default:
      return [];
  }
}

function buildFpAndAReasons(vendor: Vendor): string[] {
  switch (vendor.id) {
    case "cube-software":
      return [
        "Spreadsheet-native planning keeps change management low.",
        "Good bridge from ERP actuals to planning before a full planning program.",
      ];
    case "mosaic-tech":
      return [
        "Prebuilt SaaS metrics help recurring and usage reporting land faster.",
        "Useful once strategic finance needs board-ready dashboards quickly.",
      ];
    case "pigment":
      return [
        "Series C planning often needs deeper scenario analysis across functions.",
        "More appropriate once planning complexity outweighs the implementation cost.",
      ];
    case "anaplan":
      return [
        "Large multi-dimensional planning models are the main reason to accept a heavier FP&A rollout.",
        "Best fit when the team can actually maintain a connected-planning model.",
      ];
    default:
      return [];
  }
}

function buildBillingReasons(vendor: Vendor): string[] {
  switch (vendor.id) {
    case "stripe-billing":
      return [
        "Recurring revenue needs a billing system before it needs an enterprise billing program.",
        "Strong default option when you want moderate implementation overhead.",
      ];
    case "chargebee":
      return [
        "Good fit when recurring billing needs more structure than a homegrown stack.",
        "Moderate rollout fits teams that are not ready for a heavier platform.",
      ];
    case "metronome":
      return [
        "AI infrastructure pricing changes quickly and benefits from flexible usage metering.",
        "Best fit when the business model itself is usage-priced.",
      ];
    case "orb":
      return [
        "Usage-based pricing becomes more central when the business sells infrastructure or agents.",
        "Built for faster pricing iteration than a traditional subscription stack.",
      ];
    case "zuora":
      return [
        "Enterprise billing only pays off once monetization complexity is already real.",
        "Stronger option when scale outweighs rollout cost.",
      ];
    default:
      return [];
  }
}

function buildTaxReasons(vendor: Vendor, context: FitContext): string[] {
  switch (vendor.id) {
    case "anrok":
      return [
        "Software and AI companies usually hit product-tax complexity early.",
        "Lighter rollout than a broader enterprise tax stack.",
      ];
    case "stripe-tax":
      return [
        "Consumer subscription businesses often want the fastest possible tax add-on.",
        "Makes more sense while the entity structure stays simple.",
      ];
    case "avalara":
      return [
        context.isMultiEntity
          ? "Broader entity complexity pushes toward a more established tax compliance platform."
          : "More durable if tax complexity is already spreading across products or channels.",
        "Good middle ground before the heaviest enterprise tax stack.",
      ];
    case "vertex":
      return [
        "Enterprise tax complexity is usually the reason to accept a heavy implementation.",
        "Better fit once multi-entity tax rules outweigh rollout cost.",
      ];
    default:
      return [];
  }
}

function buildCollectionsReasons(
  profile: CompanyProfile,
  vendor: Vendor,
  context: FitContext,
): string[] {
  switch (vendor.id) {
    case "upflow":
      return [
        "Lean AR teams usually need faster execution before heavier collections software.",
        "Straightforward fit for a smaller receivables motion.",
      ];
    case "tesorio":
      return [
        `${profile.closeDays}-day close suggests collections visibility can still tighten cash conversion.`,
        "Useful once AR follow-up needs more structure.",
      ];
    case "highradius":
      return [
        "Better aligned to enterprise-scale AR complexity.",
        context.isMultiEntity
          ? "More sensible once receivables operations span multiple entities."
          : "Heavier than most single-entity teams need.",
      ];
    default:
      return [];
  }
}

function buildPayrollReasons(profile: CompanyProfile, vendor: Vendor): string[] {
  switch (vendor.id) {
    case "gusto":
      return [
        "Single-entity Series B teams usually want the lightest payroll and benefits stack.",
        profile.accountingSystem === "quickbooks"
          ? "Good fit when finance is still staying close to a starter ledger."
          : "Best when payroll simplicity matters more than deep configuration.",
      ];
    case "rippling":
      return [
        "More control across HRIS, payroll, and IT becomes valuable as the org scales.",
        "Moderate implementation is reasonable once finance and people ops are more staffed.",
      ];
    case "adp-workforce-now":
      return [
        "Series C and multi-entity growth can justify a heavier payroll controls stack.",
        "Better fit once complexity outruns startup-native tools.",
      ];
    case "justworks":
      return [
        "Useful when the team still values a simpler employer-services package.",
        "Lighter operating overhead than a broader enterprise HR stack.",
      ];
    case "trinet":
      return [
        "Moderate fit when the company wants more services wrapped around payroll.",
        "A step up in structure without going full enterprise.",
      ];
    default:
      return [];
  }
}

function buildAuditReasons(vendor: Vendor, context: FitContext): string[] {
  switch (vendor.id) {
    case "pilot":
      return [
        "No full-time controller coverage is the clearest signal for outsourced accounting help.",
        "Lighter lift for a single-entity Series B team.",
      ];
    case "kruze-consulting":
      return [
        "Works when startup-specific accounting support matters more than breadth.",
        "Simpler fit while the team and entity count are still small.",
      ];
    case "armanino":
      return [
        context.isMultiEntity
          ? "Multi-entity growth usually needs broader outsourced accounting depth."
          : "More suitable once finance needs both accounting help and audit coordination.",
        "Good step up from startup-only bookkeeping support.",
      ];
    case "grant-thornton":
      return [
        "Heavier firm, but more suitable once audit expectations are rising.",
        "Better fit when scale matters more than startup simplicity.",
      ];
    default:
      return [];
  }
}

function buildTreasuryReasons(vendor: Vendor): string[] {
  switch (vendor.id) {
    case "mercury":
      return [
        "Single-entity Series B teams usually optimize for speed and day-to-day banking usability.",
        "Lightest treasury overhead while the stack stays simple.",
      ];
    case "first-citizens-svb":
      return [
        "Useful once the company wants a more traditional venture-bank relationship.",
        "Moderate operational overhead is easier to absorb after the earliest stage.",
      ];
    case "jpmorgan-commercial-banking":
      return [
        "Larger banking programs make more sense once entities and cash workflows expand.",
        "Best fit when treasury control is growing beyond startup basics.",
      ];
    case "trovata":
      return [
        "Cash visibility becomes more valuable as entities, accounts, or close friction expand.",
        "Adds treasury analytics without replacing the bank.",
      ];
    case "modern-treasury":
      return [
        "A heavier treasury platform makes sense only after operational complexity is real.",
        "Best fit once payments orchestration needs engineering-grade controls.",
      ];
    default:
      return [];
  }
}

function buildProcurementReasons(vendor: Vendor): string[] {
  switch (vendor.id) {
    case "vendr":
      return [
        "Lean teams usually want help with renewals and savings before a full procurement rollout.",
        "Lower process overhead than a full enterprise intake tool.",
      ];
    case "tropic":
      return [
        "More process discipline around vendor spend becomes useful as headcount and contract count grow.",
        "Middle ground between broker-style help and enterprise procurement.",
      ];
    case "zip":
      return [
        "Series C multi-entity growth is when a formal intake and approval layer starts to pay off.",
        "Heavier procurement governance than early teams usually need.",
      ];
    default:
      return [];
  }
}

function buildCapTableReasons(vendor: Vendor): string[] {
  switch (vendor.id) {
    case "pulley":
      return [
        "Series B teams often want cleaner equity workflows without enterprise admin overhead.",
        "Lighter lift while the cap table is still relatively concentrated.",
      ];
    case "carta":
      return [
        "Broader equity admin depth is more helpful once the company or entity structure expands.",
        "Stronger default when scale matters more than lowest overhead.",
      ];
    case "fidelity-private-shares":
      return [
        "A more institutional cap-table program fits later-stage governance needs.",
        "Better fit once scale and administration depth outweigh simplicity.",
      ];
    default:
      return [];
  }
}

function buildBusinessIntelligenceReasons(vendor: Vendor): string[] {
  switch (vendor.id) {
    case "power-bi":
      return [
        "Moderate implementation fits teams that want reporting depth without building a full semantic stack.",
        "Good bridge between exported actuals and board reporting.",
      ];
    case "sigma-computing":
      return [
        "A staffed finance team can get more value from a warehouse-connected analysis layer.",
        "Useful when reporting needs more flexibility than packaged dashboards.",
      ];
    case "snowflake":
      return [
        "A warehouse-first data stack only pays off once reporting requirements are already broad.",
        "Heavier foundation than most lean finance teams need on day one.",
      ];
    case "looker":
      return [
        "Stronger choice once metrics governance needs a dedicated semantic layer.",
        "Better fit for later-stage reporting depth than for quick wins.",
      ];
    default:
      return [];
  }
}

function buildSecurityReasons(vendor: Vendor): string[] {
  switch (vendor.id) {
    case "vanta":
      return [
        "Lean teams usually want faster compliance automation with a familiar startup motion.",
        "Moderate rollout, but still lighter than building control evidence manually.",
      ];
    case "secureframe":
      return [
        "Another lighter compliance automation option when the team is still small.",
        "Good fit when speed matters more than customization.",
      ];
    case "drata":
      return [
        "A more staffed team can absorb a broader compliance automation rollout.",
        "Useful when ongoing control evidence needs more structure.",
      ];
    default:
      return [];
  }
}

function buildLegalReasons(vendor: Vendor): string[] {
  switch (vendor.id) {
    case "ct-corporation":
      return [
        "If the entity structure is still simple, start with basic agent and compliance coverage.",
        "Lower overhead than a larger governance program.",
      ];
    case "csc-global":
      return [
        "More entities increase the value of a stronger governance and entity administration partner.",
        "Useful once compliance complexity is no longer incidental.",
      ];
    case "diligent":
      return [
        "Later-stage governance and board process often justify a more formal system.",
        "Better fit once board administration needs a dedicated layer.",
      ];
    case "ironclad":
      return [
        "Formal contract workflow is more likely to pay off after the company outgrows lightweight legal ops.",
        "Heavier implementation than most early finance teams need.",
      ];
    default:
      return [];
  }
}

function buildDefaultReasons(profile: CompanyProfile, vendor: Vendor): string[] {
  const context = getContext(profile);
  const reasons: string[] = [];
  const matchingModels = vendor.businessModels.filter((model) =>
    profile.businessModels.includes(model),
  );

  if (matchingModels.length > 0) {
    reasons.push(
      `Matches ${joinList(
        matchingModels.map((model) => BUSINESS_MODEL_LABELS[model]),
      )}.`,
    );
  }

  if (
    vendor.category !== ERP_CATEGORY &&
    context.accountingSystemLabel !== "spreadsheets" &&
    vendor.integrations.includes(context.accountingSystemLabel)
  ) {
    reasons.push(`Connects to ${context.accountingSystemLabel}.`);
  }

  if (context.isMultiEntity && mentionsMultiEntityDepth(vendor)) {
    reasons.push("Handles multi-entity finance complexity.");
  }

  if (context.isLeanFinanceTeam && vendor.implementation === "light") {
    reasons.push("Keeps implementation overhead lower for a lean finance team.");
  }

  if (vendor.category === CLOSE_CATEGORY && profile.closeDays > 10) {
    reasons.push(`Adds structure to a ${profile.closeDays}-day close.`);
  }

  return reasons;
}

function createRecommendation(
  profile: CompanyProfile,
  vendor: Vendor,
  label: string,
): VendorRecommendation {
  const reasons = uniqueStrings([
    ...buildCategoryReasons(profile, vendor),
    ...buildDefaultReasons(profile, vendor),
    vendor.strengths[0],
    vendor.strengths[1] ?? vendor.description,
  ]).slice(0, 2);

  return {
    category: vendor.category,
    label,
    reasons,
    tradeoff:
      vendor.watchouts[0] ??
      "Validate the implementation and support model directly with the vendor.",
    vendorId: vendor.id,
    vendorName: vendor.name,
  };
}

function getContext(profile: CompanyProfile): FitContext {
  const hasControllerCoverage = profile.financeTeam.controller !== "none";
  const hasStrategicFinanceCoverage =
    profile.financeTeam.strategicFinance !== "none";
  const fullTimeStrategicFinance =
    profile.financeTeam.strategicFinance === "full-time";
  const isStaffedFinanceTeam =
    profile.financeTeam.controller === "full-time" ||
    fullTimeStrategicFinance ||
    profile.financeTeam.staffAccountants >= 2;

  return {
    accountingSystemLabel: ACCOUNTING_SYSTEM_LABELS[profile.accountingSystem],
    fullTimeStrategicFinance,
    hasControllerCoverage,
    hasStrategicFinanceCoverage,
    isAiInfrastructure: profile.businessModels.includes("ai-infrastructure"),
    isConsumerSubscription: profile.businessModels.includes(
      "consumer-subscription",
    ),
    isLeanFinanceTeam:
      profile.financeTeam.controller !== "full-time" &&
      !fullTimeStrategicFinance &&
      profile.financeTeam.staffAccountants <= 1,
    isMultiEntity: profile.entityCount > 1,
    isStaffedFinanceTeam,
    isUsageRevenueBusiness: profile.businessModels.some(
      (model) =>
        model === "b2b-saas-usage" || model === "ai-infrastructure",
    ),
  };
}

function mentionsMultiEntityDepth(vendor: Vendor) {
  const text = `${vendor.description} ${vendor.strengths.join(" ")}`.toLowerCase();
  return [
    "multi-entity",
    "consolidation",
    "intercompany",
    "multi-currency",
    "shared calculation engine",
  ].some((term) => text.includes(term));
}

function pickVendorIdsForCategory(
  profile: CompanyProfile,
  category: string,
): string[] {
  const context = getContext(profile);

  switch (category) {
    case ERP_CATEGORY:
      if (profile.accountingSystem === "netsuite") return ["netsuite"];
      if (profile.accountingSystem === "sage-intacct") {
        return context.isMultiEntity || profile.stage === "series-c"
          ? ["sage-intacct", "netsuite"]
          : ["sage-intacct"];
      }
      if (profile.accountingSystem === "xero" && !context.isMultiEntity) {
        return ["xero", "sage-intacct"];
      }
      if (
        !context.isMultiEntity &&
        profile.stage === "series-b" &&
        (profile.accountingSystem === "spreadsheets" ||
          profile.accountingSystem === "quickbooks")
      ) {
        return ["quickbooks-online", "sage-intacct"];
      }
      if (context.isMultiEntity || profile.stage === "series-c") {
        return ["netsuite", "sage-intacct"];
      }
      return ["sage-intacct", "quickbooks-online"];
    case CLOSE_CATEGORY:
      if (
        profile.stage === "series-c" &&
        context.isMultiEntity &&
        context.isStaffedFinanceTeam
      ) {
        return ["floqast", "blackline"];
      }
      if (context.isLeanFinanceTeam || profile.closeDays <= 10) {
        return ["numeric", context.isAiInfrastructure ? "trullion" : "floqast"];
      }
      if (profile.closeDays > 10) {
        return ["floqast", context.isAiInfrastructure ? "trullion" : "numeric"];
      }
      return ["numeric", "floqast"];
    case AP_CATEGORY:
      if (profile.stage === "series-c" && context.isMultiEntity) {
        return ["tipalti", "bill"];
      }
      if (context.isLeanFinanceTeam || !context.isMultiEntity) {
        return ["ramp", "bill"];
      }
      return ["bill", "ramp"];
    case FP_AND_A_CATEGORY:
      if (
        profile.stage === "series-c" &&
        context.isMultiEntity &&
        context.fullTimeStrategicFinance
      ) {
        return ["pigment", "anaplan"];
      }
      if (
        context.hasStrategicFinanceCoverage &&
        (context.isUsageRevenueBusiness || context.isAiInfrastructure)
      ) {
        return ["mosaic-tech", "cube-software"];
      }
      if (!context.hasStrategicFinanceCoverage || context.isLeanFinanceTeam) {
        return ["cube-software", "mosaic-tech"];
      }
      return ["mosaic-tech", "cube-software"];
    case BILLING_CATEGORY:
      if (context.isAiInfrastructure) return ["metronome", "orb"];
      if (
        context.isConsumerSubscription ||
        profile.businessModels.includes("b2b-saas-usage")
      ) {
        return ["stripe-billing", "chargebee"];
      }
      return [];
    case TAX_CATEGORY:
      if (profile.stage === "series-c" && context.isMultiEntity) {
        return ["avalara", "vertex"];
      }
      if (
        context.isAiInfrastructure ||
        profile.businessModels.includes("b2b-saas-usage")
      ) {
        return ["anrok", "avalara"];
      }
      if (context.isConsumerSubscription && !context.isMultiEntity) {
        return ["stripe-tax", "avalara"];
      }
      return ["avalara"];
    case AR_CATEGORY:
      if (profile.stage === "series-c" && context.isMultiEntity) {
        return ["tesorio", "highradius"];
      }
      if (context.isLeanFinanceTeam) return ["upflow", "tesorio"];
      if (profile.closeDays > 10) return ["tesorio", "upflow"];
      return ["upflow"];
    case PAYROLL_CATEGORY:
      if (profile.stage === "series-c" || context.isMultiEntity) {
        return ["rippling", "adp-workforce-now"];
      }
      if (
        profile.accountingSystem === "quickbooks" ||
        profile.accountingSystem === "spreadsheets"
      ) {
        return ["gusto", "rippling"];
      }
      return ["rippling", "gusto"];
    case AUDIT_CATEGORY:
      if (
        !context.hasControllerCoverage &&
        !context.isMultiEntity &&
        profile.stage === "series-b"
      ) {
        return ["pilot", "kruze-consulting"];
      }
      if (
        !context.hasControllerCoverage ||
        context.isMultiEntity ||
        profile.stage === "series-c"
      ) {
        return ["armanino", "grant-thornton"];
      }
      return [];
    case TREASURY_CATEGORY:
      if (
        profile.stage === "series-c" &&
        context.isMultiEntity &&
        context.isStaffedFinanceTeam
      ) {
        return ["trovata", "modern-treasury"];
      }
      if (profile.stage === "series-b" && !context.isMultiEntity) {
        return ["mercury", "first-citizens-svb"];
      }
      if (context.isMultiEntity || context.isStaffedFinanceTeam) {
        return ["trovata", "jpmorgan-commercial-banking"];
      }
      return ["mercury"];
    case PROCUREMENT_CATEGORY:
      if (profile.stage === "series-c" && context.isMultiEntity) {
        return ["tropic", "zip"];
      }
      return ["vendr", "tropic"];
    case CAP_TABLE_CATEGORY:
      if (profile.stage === "series-c" || context.isMultiEntity) {
        return ["carta", "fidelity-private-shares"];
      }
      return ["pulley", "carta"];
    case BI_CATEGORY:
      if (
        (profile.stage === "series-c" && context.isMultiEntity) ||
        context.hasStrategicFinanceCoverage
      ) {
        return ["sigma-computing", "power-bi"];
      }
      return [];
    case SECURITY_CATEGORY:
      return context.isLeanFinanceTeam
        ? ["vanta", "secureframe"]
        : ["vanta", "drata"];
    case LEGAL_CATEGORY:
      return profile.stage === "series-c" || context.isMultiEntity
        ? ["csc-global", "diligent"]
        : ["ct-corporation"];
    default:
      return [];
  }
}

function resolveCategoryRecommendations(
  profile: CompanyProfile,
  vendors: Vendor[],
  category: string,
  maxItems: number,
): VendorRecommendation[] {
  const vendorsById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const recommendations: VendorRecommendation[] = [];
  const seen = new Set<string>();

  for (const vendorId of pickVendorIdsForCategory(profile, category)) {
    const vendor = vendorsById.get(vendorId);

    if (!vendor || vendor.category !== category || seen.has(vendorId)) continue;
    if (!vendor.stages.includes(profile.stage)) continue;
    if (
      vendor.businessModels.length > 0 &&
      !vendor.businessModels.some((model) => profile.businessModels.includes(model))
    ) {
      continue;
    }

    seen.add(vendorId);
    recommendations.push(
      createRecommendation(
        profile,
        vendor,
        recommendations.length === 0
          ? maxItems === 1
            ? "Foundation pick"
            : "Best fit"
          : "Shortlist pick",
      ),
    );

    if (recommendations.length === maxItems) break;
  }

  return recommendations;
}

function formatCoverage(
  coverage: CompanyProfile["financeTeam"]["controller"],
) {
  switch (coverage) {
    case "none":
      return "no coverage";
    case "full-time":
      return "full-time";
    case "fractional":
      return "fractional";
    case "outsourced":
      return "outsourced";
    default:
      return coverage;
  }
}

function formatStage(stage: CompanyProfile["stage"]) {
  return stage === "series-b" ? "Series B" : "Series C";
}

function joinList(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function uniqueStrings(values: Array<string | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .filter((value, index, array) => array.indexOf(value) === index);
}
