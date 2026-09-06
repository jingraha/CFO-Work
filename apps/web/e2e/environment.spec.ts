import { expect, test } from "@playwright/test";
import type { AutomationSnapshot } from "@cfo/domain";

test("connects in bulk and runs work from a simpler shared plan", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/sign-in");
  const login = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: new URL(page.url()).origin },
    data: { email: "cfo@example.com", password: "local-demo-only" },
  });
  expect(login.ok()).toBe(true);
  await page.goto("/app/new");
  const name = `Simple workflow ${Date.now()}`;
  await expect(async () => {
    await page.getByLabel("Company name").fill("");
    await page.getByLabel("Company name").fill(name);
    await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled({ timeout: 500 });
  }).toPass({ timeout: 15000 });
  for (let step = 0; step < 3; step++) await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Create CFO workspace" }).click();
  await page.waitForURL(/\/app\/simple-workflow-/);
  const slug = new URL(page.url()).pathname.split("/").at(-1)!;
  const endpoint = `/api/workspaces/${slug}/automation`;
  const snapshot = async (): Promise<AutomationSnapshot> => {
    const response = await page.request.get(endpoint, { maxRetries: 2 });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  const primary = page.getByRole("navigation", { name: "Workspace", exact: true });
  await expect(primary.getByRole("button")).toHaveCount(4);
  await expect(primary.getByRole("button", { name: "Company environment", exact: true })).toHaveCount(0);
  await expect(primary.getByRole("button", { name: "Roadmap & Gantt", exact: true })).toHaveCount(0);
  await primary.getByRole("button", { name: "Connectors & skills" }).click();
  await expect(page.getByTestId("connectors-skills")).toBeVisible();
  expect((await snapshot()).initialized).toBe(false);

  await page.getByTestId("connector-checkbox-gmail").check();
  await page.getByTestId("connector-checkbox-slack").check();
  await expect(page.getByTestId("bulk-connect-button")).toContainText("(2)");
  await page.getByRole("button", { name: "Clear selected connectors" }).click();
  await page.getByRole("button", { name: "Select all disconnected connectors" }).click();
  await page.getByTestId("bulk-connect-button").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Grant access", exact: true })).toBeDisabled();
  await dialog.getByLabel("Confirm synthetic read access").check();
  await dialog.getByRole("button", { name: "Grant access", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("8 of 8 sources available")).toBeVisible();
  const connected = await snapshot();
  expect(connected.enabled).toBe(false);
  expect(connected.runs.every((run) => run.requested === false && run.attempts === 0)).toBe(true);

  await page.getByRole("button", { name: "Skill library", exact: true }).click();
  await page.getByLabel("Search skills").fill("transcript");
  await expect(page.getByTestId("skill-card-team-assessment")).toBeVisible();
  await expect(page.getByText(/Attach meeting transcripts or assessment notes to the task/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Run demo work" })).toHaveCount(0);
  await page.getByRole("button", { name: "Go to Workstreams", exact: true }).click();
  await expect(page.getByRole("button", { name: "List", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "By leader", exact: true }).click();
  const leaders = page.locator("summary").filter({ hasText: /^Leaders/ });
  await leaders.click();
  await page.getByRole("checkbox", { name: "CFO (unassigned)", exact: true }).check();
  await page.getByRole("checkbox", { name: "Controller (unassigned)", exact: true }).check();
  await leaders.click();
  const workRows = page.locator('tr[data-testid^="work-item-"]');
  expect(await workRows.count()).toBeGreaterThan(0);
  for (const row of await workRows.all()) {
    await expect(row.locator("td").nth(1)).toContainText(/CFO|Controller/);
  }
  await page.getByRole("button", { name: "Clear filters", exact: true }).click();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByLabel("Search work").fill("Analyze monthly budget variance");
  const budgetRow = page.getByTestId("work-item-agent-budget-variance");
  await budgetRow.getByRole("button", { name: "View blockers", exact: true }).click();
  await expect(dialog.getByText("What is needed", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Finish:.*workforce/i })).toBeVisible();
  await dialog.getByRole("button", { name: "Queue when ready", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "View output", exact: true })).toBeVisible({ timeout: 30000 });
  let current = await snapshot();
  const budget = current.runs.find((run) => run.playbookId === "budget-variance")!;
  expect(budget.status).toBe("completed");
  expect(current.runs.find((run) => run.playbookId === "board-review")?.requested).toBe(false);
  await dialog.getByRole("button", { name: "View output", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "Validation checks" })).toBeVisible();
  for (const format of ["md", "csv", "pptx"]) {
    const response = await page.request.get(`${endpoint}/artifacts/${budget.id}?format=${format}`);
    expect(response.ok()).toBe(true);
    if (format === "pptx") expect((await response.body()).subarray(0, 2).toString()).toBe("PK");
  }

  await dialog.getByRole("button", { name: "Generate presentation / Start review" }).click();
  await expect(dialog.getByText("Local rehearsal — no remote participants, no recording")).toBeVisible();
  await dialog.getByRole("button", { name: "Start local rehearsal" }).click();
  await dialog.getByRole("button", { name: "Next slide" }).click();
  await expect(dialog.getByText(/Slide 2 of/)).toBeVisible();
  await dialog.getByRole("button", { name: "What should I do next?", exact: true }).click();
  await expect(dialog.getByRole("log")).toContainText("What should I do next?");
  await page.evaluate(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true, value: async () => { throw new DOMException("Denied for test", "NotAllowedError"); },
    });
  });
  await dialog.getByRole("button", { name: "Enable local camera" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Camera could not start");
  await page.evaluate(() => {
    const stream = document.createElement("canvas").captureStream(1);
    (window as Window & { testTracks?: MediaStreamTrack[] }).testTracks = stream.getTracks();
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async () => stream });
  });
  await dialog.getByRole("button", { name: "Enable local camera" }).click();
  await expect(dialog.getByText("Camera on · local preview only · microphone off")).toBeVisible();
  await dialog.getByRole("button", { name: "End review" }).click();
  expect(await page.evaluate(() => (window as Window & { testTracks?: MediaStreamTrack[] }).testTracks?.every((track) => track.readyState === "ended"))).toBe(true);
  await page.keyboard.press("Escape");

  await page.getByLabel("Search work").fill("Assess team skills");
  const teamRow = page.getByTestId("work-item-lead-team-skills-and-capacity-assessment");
  await teamRow.getByRole("button", { name: "View blockers", exact: true }).click();
  await expect(dialog.getByText(/A Word document is not required/)).toBeVisible();
  await dialog.getByRole("button", { name: "Add transcript or notes" }).click();
  await dialog.getByLabel("Evidence name").fill("Finance team interview");
  await dialog.getByLabel("Transcript or notes", { exact: true }).fill("Controller: There is too much manual work in the close. We need a backup owner for bank reconciliation and more training on revenue recognition.");
  await dialog.getByRole("button", { name: "Save evidence" }).click();
  await expect(dialog.getByLabel("Evidence name")).toBeHidden();
  current = await snapshot();
  const teamReady = current.taskReadiness.find((entry) => entry.skillId === "team-assessment" && entry.taskId === current.systems.find((system) => system.id === "gmail")?.records.find((record) => record.kind === "meeting-transcript")?.data.taskId);
  expect(teamReady?.blockers.some((blocker) => blocker.kind === "evidence")).toBe(false);
  expect(teamReady?.blockers.some((blocker) => blocker.kind === "dependency")).toBe(true);
  await page.keyboard.press("Escape");

  await primary.getByRole("button", { name: "Connectors & skills" }).click();
  await page.getByTestId("connector-gmail").getByRole("button", { name: "Browse Gmail records" }).click();
  await dialog.getByRole("button", { name: "Edit mock record" }).click();
  await expect(dialog.getByLabel("Body", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Mock record data (JSON)")).toBeHidden();
  await dialog.getByRole("button", { name: "Cancel edit" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Resources", exact: true }).click();
  await expect(page.getByRole("button", { name: "Financial models", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Finance team", exact: true })).toBeVisible();
});

test("requires authentication for automation data", async ({ request }) => {
  const response = await request.get("/api/workspaces/browser-auth-check/automation");
  expect(response.status()).toBe(401);
});
