import { expect, test } from "@playwright/test";

test("focuses and explains direct Gantt dependencies", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("cfo@example.com");
  await page.getByLabel("Password").fill("local-demo-only");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/app\/aperture-ai$/);

  await page.getByRole("button", { name: "Roadmap & Gantt" }).click();
  await expect(
    page.getByText("How to read dependencies and colors"),
  ).toBeVisible();
  await expect(page.getByText("Blue outline = prerequisite")).toBeVisible();
  await expect(page.getByText("Orange outline = downstream")).toBeVisible();

  const dependencyLines = page.locator(
    '[data-testid="gantt-dependency-lines"] polyline',
  );
  await expect(dependencyLines).toHaveCount(0);

  const focusButton = page
    .locator(
      'button[title="Click to focus dependencies. Double-click for full details."]',
    )
    .filter({ hasText: "Assess the finance function end to end" })
    .first();
  await focusButton.click();

  await expect(page.getByText("Dependency focus", { exact: true })).toBeVisible();
  await expect(page.getByText("Needs to happen first")).toBeVisible();
  await expect(page.getByText("This task directly unblocks")).toBeVisible();
  await expect(
    page.getByText(/tasks in the direct dependency neighborhood/),
  ).toBeVisible();
  expect(await dependencyLines.count()).toBeGreaterThan(0);
  await expect(
    dependencyLines.first(),
  ).toHaveAttribute("marker-end", /gantt-arrow/);

  await focusButton.dblclick();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", {
      name: "Assess the finance function end to end",
    }),
  ).toBeVisible();
  await expect(dialog.getByText("Dependencies and impact")).toBeVisible();
  await expect(dialog.getByText("Needs to happen first")).toBeVisible();
  await expect(dialog.getByText("This task unblocks next")).toBeVisible();

  await dialog.getByRole("button", { name: "Close task" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Dependency focus", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Show full roadmap" }).click();
  await expect(
    page.getByText("Dependency focus", { exact: true }),
  ).toBeHidden();
  await expect(dependencyLines).toHaveCount(0);

  await page.getByRole("button", { name: "Show all arrows" }).click();
  expect(await dependencyLines.count()).toBeGreaterThan(0);
});
