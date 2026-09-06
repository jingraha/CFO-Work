import { expect, test } from "@playwright/test";

test("explains company fit and implementation effort without overriding decisions", async ({ page }) => {
  await page.goto("/sign-in");
  const login = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: new URL(page.url()).origin },
    data: { email: "cfo@example.com", password: "local-demo-only" },
  });
  expect(login.ok()).toBe(true);
  await page.goto("/app/aperture-ai");
  await expect(async () => {
    await page.getByRole("navigation", { name: "Workspace", exact: true }).getByRole("button", { name: "Vendor decisions" }).click();
    await expect(page.getByRole("heading", { name: "Recommended for Aperture AI" })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
  const heavy = page.getByTestId("vendor-netsuite").getByText("Heavy implementation", { exact: true });
  await page.getByLabel("Search vendors").fill("NetSuite");
  await expect(heavy).toHaveClass(/bg-red-50/);
  await page.getByLabel("Search vendors").fill("QuickBooks");
  await expect(page.getByTestId("vendor-quickbooks-online").getByText("Light implementation", { exact: true })).toHaveClass(/bg-emerald-50/);
  await page.getByRole("button", { name: "Reset filters", exact: true }).first().click();
  await page.getByLabel("AI-native only", { exact: false }).check();
  await expect(page.getByTestId("vendor-numeric")).toBeVisible();
  await expect(page.getByTestId("vendor-netsuite")).toHaveCount(0);
  await expect(page.getByTestId("vendor-numeric").getByRole("link", { name: /Numeric is marked AI-native/ })).toHaveAttribute("href", "https://www.numeric.io/");
  await page.getByRole("button", { name: "Reset filters", exact: true }).first().click();
  await page.getByLabel("Filter vendors by category").selectOption("ERP and core accounting");
  await expect(page.getByRole("heading", { name: "ERP and core accounting shortlist" })).toBeVisible();
  await expect(page.getByTestId("vendor-numeric")).toHaveCount(0);
  await page.getByTestId("vendor-quickbooks-online").getByRole("button", { name: /Add .* to compare/ }).click();
  await expect(page.getByText("Compare 1 vendor", { exact: true })).toBeVisible();
});
