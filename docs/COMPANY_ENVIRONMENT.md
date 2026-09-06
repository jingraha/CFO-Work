# Connectors, skills, and work

## Scope

The company environment contains eight local mock systems and a deterministic demo agent.
It does not connect to real Gmail, Slack, banks, or finance providers.
It does not use a paid model or subscription.

The agent performs calculations and produces reports from synthetic records.
It is not a live language model.
The report shows its source records, required deliverables, acceptance checks, and limitations.

## Connect work areas

1. Open **Connectors & skills**.
2. Select one or more disconnected work areas.
3. Select **Connect selected**.
4. Review the requested read access.
5. Grant access to the selected mock systems.

The first connection prepares the demo records and available workflow tasks.
It does not replace existing tasks, notes, dates, or company settings.
Connecting a new work area does not request unrelated agent work.
Previously requested jobs can resume after their missing connections become available.

## Find the right skill

The **Skill library** shows each skill's inputs and outputs.
Skills run from **Workstreams**, not from the connector area.
The library includes financial diagnostics and a transcript-assisted team assessment.

## Run work

1. Open **Workstreams**.
2. Choose **List**, **Gantt**, or **By leader**.
3. Select one or more leaders to narrow the view.
4. Open a task's agent action.
5. If inputs are missing, read the blocker list.
6. Select **Run with agent**, or queue the task until its blockers clear.

Each request includes the selected task and its supported prerequisite skills.
It does not request unrelated work.
The task's manual blockers remain in place.
Agent drafts attached to broader catalog tasks require a finance reviewer.

The **Outputs & reviews** tab contains generated reports and saved reviews.
The **Agent options** control contains the assessment objective and review preferences.
Resources contains templates, financial models, and the finance team plan.

## Supply assessment evidence

1. Open the team assessment task.
2. Select **Add transcript or notes**.
3. Paste the meeting transcript or assessment text.
4. Save the evidence.
5. Grant access to the Gmail / evidence connector.

A Word document is not required.
The skill groups exact source quotes into workload, ownership, and support themes.
It does not infer employee ratings or departure probabilities.
The resulting draft requires human review.

## Mock systems

| System | Synthetic records |
|---|---|
| Gmail | Stakeholder email and finance requests |
| Slack | Team messages and operational context |
| ERP | Ledger data and close activities |
| AR | Customer invoices and collection status |
| AP | Vendor bills and payment controls |
| Planning | Budget and operating-plan data |
| Payroll | Workforce and compensation data |
| Banking | Cash accounts and transactions |

A connection grants access to local synthetic records only.
No password, token, or external OAuth consent is necessary.
Each record edit increases the source revision.
Existing reports retain their original evidence references.

## Automatic handoffs

The server worker runs while the local app server runs.
It continues after you close the browser tab.
It stops when the app server stops.
The next server start restores the persisted queue.

A requested job becomes ready after every prerequisite is complete or not applicable.
Required mock systems must also be connected.
Target dates do not delay ready work.
Missing prerequisites, disconnected sources, and manual task blockers prevent execution.

The agent first defines the output contract.
It then reads the permitted records and produces the output.
Acceptance checks determine whether the result can complete the task.

Valid demo analyses complete automatically unless the assessment requires a human review.
Tasks with mandatory approval always wait for that approval.
Failed checks do not complete tasks.
Completion makes downstream jobs eligible immediately.

A failed job does not retry indefinitely.
The error and run history remain visible.
A rebuild restarts the affected dependency chain.
Previous outputs remain in the audit history.

## Review the output

1. Open a result in the agent work queue.
2. Read the output contract and acceptance checks.
3. Inspect the cited source records.
4. Download the report as Markdown or CSV.
5. If the output has slides, download its PowerPoint presentation.
6. If human approval is required, approve the result or request changes.

Source changes can make an earlier report outdated.
Approval rejects a result whose evidence changed or disconnected.
A retry produces a new result from the current records.

## Local video review

The review room displays the generated slides and speaker notes.
Its local facilitator answers questions from the stored output.
It does not infer answers from the internet or send the report to a model provider.

The camera control displays your own video locally.
It does not transmit or record that video.
There are no remote participants.
This room is a rehearsal, not a multi-person conferencing service.

Each review retains an immutable copy of its report.
Its slide position and written conversation persist in the local database.
Closing the room stops the camera.

## Tasks without a skill

Any roadmap task can receive an output assessment.
Tasks without a specific execution playbook receive a work specification, not a completed deliverable.
The app does not mark an external audit, hire, payment, filing, or signature complete merely because it generated text.

Real execution requires a separate connector, execution playbook, and permission design.
The local demo never sends payments, email, or Slack messages to real recipients.

## Backup and migration

Workspace JSON export includes mock records, agent runs, generated reports, and review conversations.
Import preserves those records but pauses automation.
Imported connections start disconnected.
An active review becomes scheduled after import.

The local database remains outside Git.
GitHub does not receive changes that you make inside the running app.
An exported file can contain sensitive information if you replace synthetic records with real data.
