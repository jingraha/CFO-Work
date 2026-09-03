# Content library

This directory holds the tailored content that powers the Startup CFO OS: the ten
finance workstreams, the master task library, the hiring sequence, the template
catalog, and the vendor landscape. Everything here is plain JSON so that a finance
person can edit it without touching application code.

## What lives here

| Path | What it is | Schema |
| --- | --- | --- |
| `workstreams/workstreams.json` | The ten workstreams, their descriptions, outcomes, colors, and icons | `WorkstreamDefinitionSchema` |
| `workstreams/tasks.json` | The master task library across all phases and cadences | `MasterTaskSchema` |
| `hiring/roles.json` | Finance hiring and fractional capability sequence | `HiringRoleSchema` |
| `templates/catalog.json` | Working templates with their field definitions | `TemplateDefinitionSchema` |
| `vendors/catalog.json` | Representative vendor landscape by category | `VendorSchema` |
| `scripts/validate-content.mjs` | Dependency-free validator for all of the above | n/a |

The authoritative schemas are in `packages/domain/src/types.ts`. If a field name or
an enum value here disagrees with that file, that file wins.

## Ownership boundary

This directory is content only. It contains no application logic, no spreadsheet
models, and no build configuration. Application code lives in `apps/` and
`packages/`; financial models live in the modeling workspace. Do not add code here
beyond the validation script, and do not edit files outside `content/` as part of a
content change.

## How to edit

1. Open the relevant JSON file and edit it directly. Records are plain objects in a
   top-level array.
2. Keep IDs stable. IDs are kebab-case, globally unique inside their file, and are
   referenced by `dependencies` arrays and by saved user workspaces. Renaming an ID
   breaks existing workspaces; add a new record instead.
3. Match the phase to the start offset. `days-1-30` uses offsets 0-29, `days-31-60`
   uses 30-59, `days-61-90` uses 60-89, `months-4-6` uses 90-179, and `months-7-12`
   uses 180-365. Recurring work uses the `recurring` phase and must declare a
   cadence.
4. Run the validator before you finish:

   ```bash
   node content/scripts/validate-content.mjs
   ```

   It parses every file, checks ASCII encoding and trailing commas, enforces the
   schema field names and enum values, confirms every dependency points at a real
   ID and never at itself, and prints coverage counts by workstream, phase,
   cadence, and vendor category.

### Writing style

Write for a busy CFO scanning on a phone. Use plain English, active voice, and
concrete nouns. Every task needs an `outcome` a reader can verify, a
`recommendationReason` that explains why the app surfaced it, and `deliverables`
that name an actual artifact. Avoid filler such as "leverage synergies" and avoid
restating the title in the description.

### Conditions and tailoring

`conditions` control whether a task or role appears for a given company profile.
The evaluator in `packages/domain/src/tailoring.ts` requires **all** conditions to
pass. There is no OR operator. If you need alternative triggers, write separate
records rather than trying to express a disjunction.

Valid condition fields are the company profile fields: `stage`, `businessModels`,
`annualRevenueMillions`, `arrMillions`, `cashRunwayMonths`, `employeeCount`,
`entityCount`, `countries`, `internationalEmployees`, `closeDays`, `auditStatus`,
`auditDueDate`, `fundraiseDate`, `nextBoardDate`, `accountingSystem`,
`billingModel`, `salesTaxNexusStates`, and the nested `financeTeam.controller`,
`financeTeam.strategicFinance`, `financeTeam.financeOperations`, `financeTeam.tax`,
`financeTeam.treasury`, and `financeTeam.staffAccountants`.

Use conditions sparingly. Work that every Series B or Series C company should do
carries an empty `conditions` array. Reserve conditions for genuinely
profile-specific work such as international entity readiness, venture debt covenant
monitoring, or usage-based billing controls.

## Sourcing standards

* Prefer primary sources: government agencies (IRS, Department of Labor, state
  revenue departments, the Delaware Division of Corporations), standard setters
  (FASB, PCAOB, AICPA, COSO, NIST, OECD), and vendor documentation on the vendor's
  own domain.
* Link to a stable landing page rather than a deep link that rotates each year.
* Do not cite paywalled summaries, marketing blogs, or aggregator sites as the
  authority for a compliance requirement.
* Never include confidential, customer, employee, or non-public company data in any
  file here. This library ships to every user of the application.

## Date freshness

Vendor records carry an `asOfDate` of `2026-09-02`. That date records when the
description, positioning, and offering mix were last reviewed. It does **not**
certify that pricing, packaging, ownership, or security posture are unchanged
today.

Refresh expectations:

* Vendor records: re-review at least every six months, and immediately after an
  acquisition, a rebrand, or a pricing model change.
* Tax and regulatory source links: re-verify annually and after any filing deadline
  or threshold change.
* Task sequencing and hiring triggers: revisit each planning cycle.

Deliberately, no vendor record quotes a specific price. Pricing models are
described qualitatively and every `pricingNote` tells the reader to verify current
terms directly with the vendor. Keep it that way.

## Vendor listings are not endorsements

The vendor catalog is a decision starting point, not a recommendation, a ranking,
or a shortlist. Inclusion means the vendor is commonly encountered by finance teams
at this stage in that category. Omission means nothing. No vendor paid for
placement and no commercial relationship influenced these entries. Run your own
evaluation, security review, and reference checks before you sign anything.

## Not professional advice

This content is general educational material for finance leaders. It is **not**
legal, tax, accounting, audit, insurance, or investment advice, and it does not
create any professional relationship. Accounting standards, tax rules, employment
law, and securities requirements vary by jurisdiction, change over time, and depend
on facts specific to your company.

Engage qualified counsel, a licensed tax adviser, and your independent auditor
before you rely on anything here for a filing, a financial statement, a board
representation, a financing, or an employment decision.
