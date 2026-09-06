import { expect, test } from "@playwright/test";

test("focuses and explains direct Gantt dependencies", async ({ page }) => {
  await page.goto("/sign-in");
  const response = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: new URL(page.url()).origin },
    data: { email: "cfo@example.com", password: "local-demo-only" },
  });
  expect(response.ok()).toBeTruthy();
  await page.goto("/app/aperture-ai");

  await expect(async () => {
    await page.getByRole("navigation", { name: "Workspace", exact: true }).getByRole("button", { name: "Workstreams", exact: true }).click();
    await expect(page.getByRole("button", { name: "Gantt", exact: true })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole("button", { name: "Gantt", exact: true }).click();
  await page.getByText("How to read dependencies and colors").click();
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
