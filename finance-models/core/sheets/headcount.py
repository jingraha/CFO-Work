"""Generic Headcount tab. Model modules supply a list of Roles; headcount ramps
and fully-loaded costs flow into COGS (for COGS-classified roles) or Opex (for
Opex-classified roles) tabs via `ctx.refs['Headcount'][...]` row lookups.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

from ..context import WorkbookContext
from ..layout import setup_common_sheet, write_timeline_header, write_row_series, section_banner, blank_row
from ..sheets.assumptions import active_ref
from ..utils import col_letter

COGS = "COGS"
OPEX = "Opex"


@dataclass
class Role:
    key: str
    name: str
    classification: str      # 'COGS' or 'Opex'
    department: str
    start_count_key: str     # Assumptions key: starting FTEs
    hires_per_quarter_key: str  # Assumptions key: net adds per quarter
    monthly_cost_key: str    # Assumptions key: fully-loaded monthly cost per FTE ($)
    note: str = ""


def build_headcount_sheet(ctx: WorkbookContext, roles: List[Role]) -> None:
    ws = ctx.add_sheet("Headcount")
    g = ctx.grid
    fmt = ctx.fmt
    row = setup_common_sheet(ctx, ws, "Headcount", "Fully-loaded FTE ramps by role — flows into COGS or Opex by classification.")
    row = write_timeline_header(ctx, ws, row)

    count_rows = {}
    cost_rows = {}

    for dept_group in [COGS, OPEX]:
        row = section_banner(ctx, ws, row,
                              f"{'Cost of Goods Sold headcount' if dept_group == COGS else 'Operating expense headcount'} ({dept_group}-classified)")
        row += 1
        for role in [r for r in roles if r.classification == dept_group]:
            start_ref = active_ref(ctx, role.start_count_key)
            hires_ref = active_ref(ctx, role.hires_per_quarter_key)
            cost_ref = active_ref(ctx, role.monthly_cost_key)

            def headcount_formula(m, start_ref=start_ref, hires_ref=hires_ref, this_row=row):
                if m == 0:
                    return f"ROUND({start_ref},1)"
                prev = f"{col_letter(g.month_col(m - 1))}{this_row + 1}"
                return f"ROUND({prev}+{hires_ref}/3,1)"

            row = write_row_series(ctx, ws, row, f"{role.name} — headcount (FTE)", headcount_formula,
                                    note=f"{role.department} · start + net adds/qtr ÷ 3", fmt=fmt.fte,
                                    aggregation="end")
            count_rows[role.key] = row
            ctx.set_ref("Headcount", f"count_{role.key}", row)
            row += 1

            def cost_formula(m, cost_ref=cost_ref, hc_row=count_rows[role.key]):
                col = col_letter(g.month_col(m))
                return f"{col}{hc_row + 1}*{cost_ref}"

            row = write_row_series(ctx, ws, row, f"{role.name} — fully-loaded cost", cost_formula,
                                    note="Headcount × monthly fully-loaded cost/FTE", fmt=fmt.num,
                                    aggregation="sum")
            cost_rows[role.key] = row
            ctx.set_ref("Headcount", f"cost_{role.key}", row)
            row += 1
        row = blank_row(ctx, ws, row) + 1

    # Totals
    row = section_banner(ctx, ws, row, "Totals")
    row += 1

    def total_headcount_formula(m, rows=list(count_rows.values())):
        col = col_letter(g.month_col(m))
        refs = "+".join(f"{col}{r + 1}" for r in rows)
        return refs

    row = write_row_series(ctx, ws, row, "Total headcount (FTE)", total_headcount_formula,
                            note="Sum of all roles", fmt=fmt.fte, aggregation="end", total=False,
                            subtotal=True)
    ctx.set_ref("Headcount", "total_headcount", row)
    row += 1

    cogs_role_rows = [cost_rows[r.key] for r in roles if r.classification == COGS]
    opex_role_rows = [cost_rows[r.key] for r in roles if r.classification == OPEX]

    def total_cogs_cost(m, rows=cogs_role_rows):
        col = col_letter(g.month_col(m))
        if not rows:
            return "0"
        return "+".join(f"{col}{r + 1}" for r in rows)

    row = write_row_series(ctx, ws, row, "Total COGS-classified people cost", total_cogs_cost,
                            note="Feeds COGS & GM tab", fmt=fmt.num_subtotal, aggregation="sum",
                            subtotal=True)
    ctx.set_ref("Headcount", "total_cogs_cost", row)
    row += 1

    def total_opex_cost(m, rows=opex_role_rows):
        col = col_letter(g.month_col(m))
        if not rows:
            return "0"
        return "+".join(f"{col}{r + 1}" for r in rows)

    row = write_row_series(ctx, ws, row, "Total Opex-classified people cost", total_opex_cost,
                            note="Feeds Opex tab", fmt=fmt.num_subtotal, aggregation="sum",
                            subtotal=True)
    ctx.set_ref("Headcount", "total_opex_cost", row)
    row += 1

    # Per-department subtotal for opex roles (used by Opex tab to split S&M/R&D/G&A)
    depts = sorted(set(r.department for r in roles if r.classification == OPEX))
    for dept in depts:
        dept_rows = [cost_rows[r.key] for r in roles if r.classification == OPEX and r.department == dept]

        def dept_formula(m, rows=dept_rows):
            col = col_letter(g.month_col(m))
            return "+".join(f"{col}{r + 1}" for r in rows)

        row = write_row_series(ctx, ws, row, f"  {dept} people cost", dept_formula, fmt=fmt.num,
                                aggregation="sum", indent=True)
        ctx.set_ref("Headcount", f"dept_cost_{dept}", row)
        row += 1
