import type { CompanyProfile, Vendor } from "@cfo/domain";
import { describe, expect, it } from "vitest";
import {
  buildVendorShortlist,
  getAiNativeVendorMetadata,
  getImplementationStyle,
  isVendorAiNative,
} from "./vendor-fit";

function profile(overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    annualRevenueMillions: 14,
    accountingSystem: "quickbooks",
    arrMillions: 18,
    auditDueDate: null,
    auditStatus: "planning",
    billingModel: "hybrid",
    businessModels: ["b2b-saas-usage"],
    cashRunwayMonths: 17,
    closeDays: 12,
    countries: ["US"],
    employeeCount: 112,
    entityCount: 1,
    financeTeam: {
      controller: "fractional",
      financeOperations: "fractional",
      staffAccountants: 1,
      strategicFinance: "none",
      tax: "outsourced",
      treasury: "none",
      ...overrides.financeTeam,
    },
    fiscalYearEndMonth: 12,
    fundraiseDate: null,
    internationalEmployees: false,
    name: "Aperture AI",
    nextBoardDate: null,
    salesTaxNexusStates: 9,
    stage: "series-b",
    startDate: "2026-09-01",
    ...overrides,
  };
}

function vendor(
  overrides: Partial<Vendor> & Pick<Vendor, "id" | "name" | "category">,
): Vendor {
  const { category, id, name, ...rest } = overrides;
  return {
    asOfDate: "2026-09-02",
    businessModels: [],
    category,
    description: "Source-dated vendor description for testing.",
    exportOffboarding: ["CSV export"],
    id,
    implementation: "moderate",
    integrations: [],
    name,
    officialUrl: "https://example.com",
    pricingModel: "Annual subscription",
    pricingNote:
      "Verify current list price, tiering, and contract terms directly with the vendor before budgeting.",
    securityDiligence: ["Review SOC 2"],
    sourceUrl: "https://example.com/source",
    stages: ["series-b", "series-c"],
    strengths: ["Primary strength", "Secondary strength"],
    watchouts: ["Primary tradeoff"],
    ...rest,
  };
}

describe("vendor fit helpers", () => {
  it("maps implementation effort to accessible color classes", () => {
    expect(getImplementationStyle("light")).toMatchObject({
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      label: "Light implementation",
    });
    expect(getImplementationStyle("moderate")).toMatchObject({
      className: "border-amber-200 bg-amber-50 text-amber-700",
      label: "Moderate implementation",
    });
    expect(getImplementationStyle("heavy")).toMatchObject({
      className: "border-red-200 bg-red-50 text-red-700",
      label: "Heavy implementation",
    });
  });

  it("changes ERP recommendations between single-entity and multi-entity profiles", () => {
    const vendors = [
      vendor({
        category: "ERP and core accounting",
        id: "quickbooks-online",
        implementation: "light",
        name: "QuickBooks Online Advanced",
        stages: ["series-b"],
      }),
      vendor({
        category: "ERP and core accounting",
        description: "Cloud ERP with multi-entity consolidation.",
        id: "sage-intacct",
        implementation: "heavy",
        name: "Sage Intacct",
        strengths: ["Dimensional reporting", "Multi-entity consolidation"],
      }),
      vendor({
        category: "ERP and core accounting",
        description: "Cloud ERP with multi-entity and intercompany elimination.",
        id: "netsuite",
        implementation: "heavy",
        name: "Oracle NetSuite",
        strengths: ["Multi-entity consolidation", "Intercompany elimination"],
      }),
    ];

    const singleEntity = buildVendorShortlist({
      profile: profile({
        accountingSystem: "quickbooks",
        entityCount: 1,
        stage: "series-b",
      }),
      selectedCategory: "ERP and core accounting",
      vendors,
    });
    const multiEntity = buildVendorShortlist({
      profile: profile({
        accountingSystem: "quickbooks",
        entityCount: 3,
        stage: "series-c",
      }),
      selectedCategory: "ERP and core accounting",
      vendors,
    });

    expect(singleEntity.recommendations[0]?.vendorId).toBe("quickbooks-online");
    expect(multiEntity.recommendations[0]?.vendorId).toBe("netsuite");
  });

  it("returns a clear message when the company profile is missing", () => {
    const result = buildVendorShortlist({
      profile: null,
      selectedCategory: "all",
      vendors: [],
    });

    expect(result.hasProfile).toBe(false);
    expect(result.recommendations).toEqual([]);
    expect(result.summary).toBe("Complete company profile to tailor recommendations.");
  });

  it("keeps recommendations inside the selected category", () => {
    const vendors = [
      vendor({
        category: "ERP and core accounting",
        id: "quickbooks-online",
        implementation: "light",
        name: "QuickBooks Online Advanced",
        stages: ["series-b"],
      }),
      vendor({
        category: "Accounts payable and spend",
        id: "ramp",
        implementation: "light",
        integrations: ["QuickBooks Online"],
        name: "Ramp",
      }),
      vendor({
        category: "Financial planning and analysis",
        id: "cube-software",
        name: "Cube",
      }),
    ];

    const result = buildVendorShortlist({
      profile: profile(),
      selectedCategory: "Accounts payable and spend",
      vendors,
    });

    expect(result.recommendations.map((item) => item.vendorId)).toEqual(["ramp"]);
    expect(
      result.recommendations.every(
        (item) => item.category === "Accounts payable and spend",
      ),
    ).toBe(true);
  });

  it("classifies AI-native vendors conservatively", () => {
    expect(isVendorAiNative("numeric")).toBe(true);
    expect(isVendorAiNative("trullion")).toBe(true);
    expect(isVendorAiNative("netsuite")).toBe(false);
    expect(getAiNativeVendorMetadata("ramp")).toBeUndefined();
  });
});
