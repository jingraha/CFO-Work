# CFO operator guide

## 1. Create the company workspace

Complete the onboarding questionnaire with approximate values. The rules engine
uses stage, business model, scale, finance coverage, close speed, audit status,
international footprint, and risk dates to build the first roadmap.

Every tailored task includes the reason it was selected. The complete master
catalog remains visible under **Workstreams**.

## 2. Confirm the critical path

Start with:

1. Cash, payroll, compliance, banking, and entity-risk triage.
2. Controller coverage if no reliable controllership owner exists.
3. Close, audit, revenue recognition, AR/AP, and forecast baselines.
4. Strategic Finance capacity for board, scenario, and annual planning.
5. Systems and specialist hiring only after the requirements are clear.

Use dependency warnings rather than forcing downstream work to appear
complete.

In **Roadmap & Gantt**:

- A single click isolates the selected task, its direct prerequisites, and the
  tasks that directly depend on it.
- A double-click, or the row chevron, opens full task details with separate
  **Needs to happen first** and **This task unblocks next** lists.
- Arrows point from prerequisite to downstream task. Blue identifies work that
  must happen first; orange identifies work the selected task unblocks.
- The bar fill identifies the workstream. Green means complete, red/dashed
  means blocked, and the dark segment inside a bar shows percent complete.
- Use **Show full roadmap** to leave dependency focus. All dependency arrows are
  hidden in the full roadmap by default to avoid a spaghetti chart.

## 3. Run the cadence

- Daily: cash and urgent exceptions.
- Weekly: collections, liquidity, GTM, hiring, and implementation risks.
- Monthly: close, forecast, budget versus actual, KPIs, and access controls.
- Quarterly: board, reforecast, treasury, tax, vendor, and risk reviews.
- Annual: budget, audit, insurance, 409A, Delaware, tax, controls, and policy
  cycles.

## 4. Attach evidence safely

Task evidence is an HTTPS link to SharePoint, Google Drive, Dropbox, or the
company data room. The app stores only the label, link, and source-system type.
It does not fetch, preview, copy, or index the linked document.

## 5. Select vendors

Treat the vendor catalog as a starting point. Score workflow fit, integrations,
security, implementation, and economics. Verify current pricing, contract
minimums, data ownership, export formats, and offboarding rights directly.

## 6. Use the financial models

Choose the workbook closest to the company's revenue and COGS model. Start on
the Assumptions tab, select Base/Upside/Downside, then update headcount,
commercial drivers, direct costs, Opex, working capital, financing, and capex.
Review the Checks tab before using any output.

The models are planning tools, not accounting systems of record.

## 7. Move between companies

Use **Export workspace JSON** to preserve the profile, roadmap state, vendor
decisions, hiring plan, and template values. Import the package into a new local
instance. Assigned user IDs are intentionally cleared during import.
