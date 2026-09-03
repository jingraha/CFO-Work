# Startup CFO OS — Excel Model Track

A reusable Python 3 + [XlsxWriter](https://xlsxwriter.readthedocs.io/) engine
that generates four native `.xlsx` 3-year (36-month) integrated financial
models for early-stage companies, plus quarterly/annual roll-ups, scenario
switching, and formula-driven checks — no macros, no external services, no
network calls.

## What gets generated

Running the generator produces four workbooks under
`apps\web\public\downloads\`:

| File | Business model |
|---|---|
| `b2b-saas-usage-model.xlsx` | B2B SaaS + Usage |
| `ai-api-infrastructure-model.xlsx` | AI API / Infrastructure |
| `consumer-subscription-model.xlsx` | Consumer Subscription |
| `ai-enabled-services-model.xlsx` | AI-Enabled Services |

Every workbook has the same 14 tabs: **Read Me, Assumptions, Headcount,
Revenue, COGS & GM, Opex, Working Capital, P&L, Balance Sheet, Cash Flow,
Cash & Runway, Scenarios, Visuals, Checks.** Every number that can be a
formula *is* a formula — cross-sheet references, not hard-coded outputs —
so editing an assumption recalculates the whole model.

## Generating the workbooks

```powershell
cd finance-models
pip install -r requirements.txt      # XlsxWriter (+ openpyxl/pytest for tests)
python generate.py                   # builds all four workbooks
python generate.py b2b_saas          # build just one (see --list for keys)
python generate.py --out-dir <path>  # override the output directory
```

Output defaults to `..\apps\web\public\downloads\` relative to
`finance-models\`.
Generation is fast (well under a second per workbook) and fully
deterministic — the same code always produces the same file byte-for-byte
given the same XlsxWriter version, because all "random" variation comes from
a seeded FNV-1a-style hash (`core.utils.seeded_value`), not a live RNG.

## Architecture

```
finance-models/
  core/                    # model-agnostic, reusable workbook engine
    context.py             # WorkbookContext: owns the Workbook, formats, grid,
                            # and a cross-sheet "refs" registry for linking
    layout.py               # shared sheet chrome: title bars, timeline header,
                            # write_row_series() (the workhorse: one row of
                            # monthly formulas + quarterly/annual roll-ups)
    formats.py              # GitHub/Copilot color palette + all cell formats
    utils.py                # column-letter math, MonthGrid, seeded_value()
    sheets/                 # one generic builder per tab type
      assumptions.py         # plain-language inputs + scenario selector
      headcount.py           # FTE ramps by role, COGS/OPEX classification
      opex.py                # opex lines + linked headcount cost by dept
      working_capital.py     # AR/AP/deferred rev, capex/depreciation,
                              # debt schedule, equity financing
      pnl.py                 # integrated income statement
      balance_sheet.py        # balances by construction (see below)
      cash_flow.py            # indirect-method cash flow
      cash_runway.py          # burn & runway
      scenarios.py            # Base/Upside/Downside comparison + validity check
      visuals.py              # KPI cards + charts
      checks.py                # 6 automated integrity checks + roll-up
      readme.py                # Read Me tab incl. required disclaimer
  models/                  # one file per business model, using core/ builders
    b2b_saas.py, ai_api.py, consumer.py, ai_services.py
    _common.py              # tiny shared helpers for model-specific code
  generate.py              # CLI entry point
  tests/
    test_generate.py       # pytest suite (see below)
  requirements.txt
  README.md                # this file
```

Each `models\*.py` file supplies only what's genuinely model-specific:
assumption values, the Revenue and COGS & GM sheets (these differ per
business model), headcount roles, extra Opex lines, Scenario KPI formulas,
Visuals content, and Read Me text. Everything else — Working Capital,
P&L, Balance Sheet, Cash Flow, Cash & Runway, Checks, the Assumptions
scaffold, and the Visuals/Read Me chrome — is one shared implementation
in `core\`, so there is no duplicated statement logic across the four
models.

### How the model integrates (Assets = Liabilities + Equity, every month)

- Working Capital owns every balance-sheet *driver* (AR, AP, Deferred
  Revenue, Other Current Assets, Net PP&E via capex/depreciation, Debt,
  and cumulative Equity raised) and their period-over-period changes.
- P&L links Revenue/COGS/Opex totals and Working Capital's depreciation
  and interest expense.
- Cash Flow (indirect method) reconciles Net Income + non-cash add-backs
  ± working-capital changes ± investing/financing activity to a
  Beginning/Ending Cash roll-forward.
- Balance Sheet links Cash from Cash Flow, the driver balances from
  Working Capital, Paid-in Capital = starting + cumulative equity raised,
  and Retained Earnings = a *derived* starting value
  (`starting_cash − starting_paid_in_capital`, so month 0 balances by
  construction) + cumulative Net Income thereafter.
- Because every asset/liability change on the Balance Sheet has a
  matching line in Cash Flow, Assets = Liabilities + Equity holds every
  month by construction — the Checks tab verifies this numerically rather
  than assuming it.

### Scenarios

One selector cell (`Assumptions!C4`, an Excel data-validation dropdown:
Base / Upside / Downside) drives an `Active` column on every assumption
row via `CHOOSE(MATCH(...))`. All monthly formulas across the workbook
reference the `Active` column, so flipping the dropdown recalculates the
entire 36-month model, every tab, automatically (workbook calculation
mode is set to Automatic).

The **Scenarios** tab additionally shows a fast, clearly-labeled
*analytical approximation* of Base vs. Upside vs. Downside side-by-side
(closed-form formulas straight off the Assumptions Base/Upside/Downside
columns), plus a "Full model (selected)" column that cross-checks against
the real detailed model at whichever scenario is currently active. This
is a deliberate simplification — running the full 36-month engine three
times in parallel would triple every tab — and is documented on the tab
itself and in the Read Me.

### Checks tab

Every workbook's Checks tab validates, with real formulas (several using
`write_array_formula` for cross-Excel-version compatibility):

1. **Balance Sheet balances** — `MAX(ABS(Assets − Liab&Equity))` across all 36 months < $1.
2. **Cash Flow reconciles to Balance Sheet** — Cash Flow's Ending Cash ties to the Balance Sheet's Cash line every month.
3. **Retained Earnings roll-forward** — `RE(m) = RE(m−1) + NetIncome(m)`.
4. **P&L subtotal integrity** — Gross Profit / EBITDA / EBIT / EBT / Net Income all foot correctly.
5. **Scenario selector validity** — the selector must be exactly Base, Upside, or Downside.
6. **No formula errors** — a `SUMPRODUCT(--ISERROR(range))` scan across every key schedule tab.

An overall `ALL CHECKS` cell reports `ALL PASS` or `REVIEW NEEDED` via `AND()` over the six statuses.

## Formatting conventions

- **Palette**: purple `#7B68EE`, blue `#49CCF9`, teal `#79D9B9`, pink `#FD71AF`, orange `#FFB08E` (GitHub/Copilot brand colors), plus light backgrounds and dark title bars.
- **Blue text = input** (Assumptions Base/Upside/Downside columns, and the scenario selector). **Black text = formula.** **Gray band = linked from another tab.** This legend is on every Read Me tab.
- Every schedule tab has frozen panes (label/timeline columns + header rows stay visible while scrolling), sensible column widths, print/landscape/fit-to-page settings, and a Monthly (36) / Quarterly (12) / Annual (3) column layout with a blank spacer column between sections.
- Workbook calculation mode is set to Automatic.

## Running the tests

```powershell
cd finance-models
python -m pytest tests -v
PowerShell -NoProfile -ExecutionPolicy Bypass -File tests\validate_with_excel.ps1
```

The suite (`tests\test_generate.py`, 48 tests: 12 checks × 4 models) calls
each model's `build()` directly (the same function `generate.py` uses),
loads the result with `openpyxl`, and asserts:

- the output file exists and is non-trivial in size,
- all 14 required tabs are present,
- every schedule tab has 36 monthly formula columns (`C:AL`) followed by a
  blank spacer column, confirming the fixed monthly grid,
- the Assumptions tab has a Base/Upside/Downside list data validation
  anchored at `C4`,
- the Checks tab has 6 check rows with PASS/FAIL formulas plus an overall
  `AND(...)` roll-up,
- a formula-error (`ISERROR`) scan is present,
- the Balance Sheet check is a real formula (not a hard-coded pass),
- sampled cells on Revenue, COGS & GM, P&L, Balance Sheet, and Cash Flow
  are formulas, not hard-coded numbers,
- P&L, Balance Sheet, and Cash Flow each contain at least one
  cross-sheet-linked formula,
- the Visuals tab has charts,
- the Read Me tab contains the required disclaimer text,
- the Scenarios tab's validity check uses `MATCH` against the Assumptions
  selector.

As of the last run, all 56 tests pass for all four models.

On Windows with Microsoft Excel installed, `validate_with_excel.ps1` opens
copies of all four workbooks, cycles through Base/Upside/Downside, forces a full
formula rebuild, confirms every Cash & Runway month is populated and
mathematically tied to ending cash and trailing pre-financing burn, and requires
every Checks tab test to return `PASS`. The source workbooks are never modified.

## Input conventions

- Every input lives on the **Assumptions** tab in plain language, with a
  unit, a Base/Upside/Downside value, and a short note — no jargon-only
  labels.
- Upside is meant to represent better-than-plan growth/margins; Downside
  worse-than-plan; Base is the realistic default. All three columns are
  provided with deterministic seeded defaults so every workbook is
  internally consistent out of the box — replace them with your own
  numbers.
- Headcount roles are pre-classified as COGS (e.g., Customer Success,
  delivery/billable staff) or Opex (e.g., Sales, Engineering, G&A) and
  flow automatically into the corresponding COGS or Opex department
  totals — you don't need to re-wire anything to add or remove a role's
  cost from the P&L.
- 36 monthly columns run left to right, followed by 12 quarterly and 3
  annual roll-up columns on every schedule tab, so you can view the model
  at whatever granularity is useful without leaving the tab.

## Limitations

- These are **planning-level** models, not GAAP/IFRS-compliant books.
  Depreciation uses a rolling trailing-window straight-line formula
  (not per-asset/per-cohort schedules); deferred revenue and working
  capital are driver-based (days/months assumptions), not transaction-
  level; tax has no NOL carryforward; debt has a single draw and a flat
  repayment schedule rather than an amortization table.
- The **Scenarios** tab's Base/Upside/Downside comparison is an
  intentionally simplified closed-form approximation, not a live re-run
  of the full 36-month engine for all three scenarios simultaneously — see
  "Scenarios" above. Use the Assumptions selector plus the "Full model"
  column for the authoritative numbers at the scenario you actually care
  about.
- Formula-error scanning uses a generous fixed cell range per sheet rather
  than exact row bounds, since blank cells never trigger `ISERROR` — this
  keeps the check simple and safe to extend as sheets grow.
- No real-time market data, pricing benchmarks, or third-party data are
  fetched; all defaults are illustrative, seeded, and meant to be replaced
  with your own numbers.

**This workbook is a lightweight planning tool built to help you reason
about unit economics, burn, and runway. It is NOT accounting, tax, or
investment advice, and it is not a substitute for GAAP/IFRS-compliant
books, a CPA, or legal/financial counsel.** Formulas use simplified,
transparent approximations (documented on each tab) rather than full
cohort- or lot-level accounting. Validate every assumption against your
own data before using this model for fundraising, budgeting, or
compliance decisions.
