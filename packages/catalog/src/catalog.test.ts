import { describe, expect, it } from "vitest";
import {
  masterTasks,
  templates,
  validateCatalog,
  vendors,
  workstreams,
} from "./index";

describe("CFO master catalog", () => {
  it("contains valid references and unique IDs", () => {
    const result = validateCatalog();
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("meets the operating-system coverage floor", () => {
    expect(workstreams).toHaveLength(10);
    expect(masterTasks.length).toBeGreaterThanOrEqual(180);
    expect(templates.length).toBeGreaterThanOrEqual(24);
    expect(vendors.length).toBeGreaterThanOrEqual(55);

    const taskWorkstreams = new Set(masterTasks.map((task) => task.workstream));
    const taskPhases = new Set(masterTasks.map((task) => task.phase));
    expect(taskWorkstreams.size).toBe(10);
    expect(taskPhases).toEqual(
      new Set([
        "days-1-30",
        "days-31-60",
        "days-61-90",
        "months-4-6",
        "months-7-12",
        "recurring",
      ]),
    );
  });

  it("keeps vendor guidance source dated and category diverse", () => {
    expect(new Set(vendors.map((vendor) => vendor.category)).size).toBeGreaterThanOrEqual(
      16,
    );
    expect(vendors.every((vendor) => vendor.asOfDate === "2026-09-02")).toBe(
      true,
    );
    expect(
      vendors.every((vendor) =>
        vendor.pricingNote.toLowerCase().includes("verify"),
      ),
    ).toBe(true);
  });
});
