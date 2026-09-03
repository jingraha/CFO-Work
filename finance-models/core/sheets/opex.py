"""Generic Opex tab. Combines Headcount-classified Opex cost (by department)
with model-specific non-headcount operating expense lines.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, List, Optional

from ..context import WorkbookContext
from ..layout import setup_common_sheet, write_timeline_header, write_row_series, section_banner, blank_row, same_col_link
from ..utils import col_letter

Formula = Callable[[int], str]


@dataclass
class OpexLine:
    label: str
    department: str
    formula_fn: Formula
    note: str = ""


def build_opex_sheet(ctx: WorkbookContext, departments: List[str], extra_lines: List[OpexLine]) -> None:
    ws = ctx.add_sheet("Opex")
    g = ctx.grid
    fmt = ctx.fmt
    row = setup_common_sheet(ctx, ws, "Opex", "Operating expenses by department — headcount cost plus program spend.")
    row = write_timeline_header(ctx, ws, row)

    dept_total_row = {}
    for dept in departments:
        row = section_banner(ctx, ws, row, dept)
        row += 1
        tracked_rows = []

        hc_key = f"dept_cost_{dept}"
        if hc_key in ctx.refs.get("Headcount", {}):
            hc_row = ctx.ref_row("Headcount", hc_key)
            row = write_row_series(ctx, ws, row, f"{dept} — people cost", same_col_link("Headcount", hc_row, ctx),
                                    note="Linked from Headcount tab", fmt=fmt.num, aggregation="sum")
            tracked_rows.append(row)
            row += 1

        for line in [l for l in extra_lines if l.department == dept]:
            row = write_row_series(ctx, ws, row, line.label, line.formula_fn, note=line.note,
                                    fmt=fmt.num, aggregation="sum")
            tracked_rows.append(row)
            row += 1

        def subtotal_formula(m, rows=list(tracked_rows)):
            col = col_letter(g.month_col(m))
            if not rows:
                return "0"
            return "+".join(f"{col}{r + 1}" for r in rows)

        row = write_row_series(ctx, ws, row, f"Total {dept}", subtotal_formula, fmt=fmt.num_subtotal,
                                aggregation="sum", subtotal=True)
        dept_total_row[dept] = row
        ctx.set_ref("Opex", f"total_{dept}", row)
        row += 1
        row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "Total Operating Expenses")
    row += 1

    def total_opex_formula(m, rows=list(dept_total_row.values())):
        col = col_letter(g.month_col(m))
        return "+".join(f"{col}{r + 1}" for r in rows)

    row = write_row_series(ctx, ws, row, "Total Opex", total_opex_formula, fmt=fmt.num_total,
                            aggregation="sum", total=True)
    ctx.set_ref("Opex", "total_opex", row)
    row += 1
