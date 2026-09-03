"""Generic P&L tab: links Revenue, COGS & GM, Opex, and Working Capital
(D&A, interest) into one integrated income statement, ending in Net Income
which then rolls forward into Retained Earnings on the Balance Sheet.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List

from ..context import WorkbookContext
from ..layout import setup_common_sheet, write_timeline_header, write_row_series, section_banner, blank_row, same_col_link
from ..sheets.assumptions import active_ref
from ..utils import col_letter


@dataclass
class PnLConfig:
    departments: List[str]        # Opex department labels, in display order
    tax_rate_key: str


def build_pnl_sheet(ctx: WorkbookContext, cfg: PnLConfig) -> None:
    ws = ctx.add_sheet("P&L")
    g = ctx.grid
    fmt = ctx.fmt
    row = setup_common_sheet(ctx, ws, "P&L", "Integrated income statement — every line links to Revenue, COGS & GM, Opex, or Working Capital.")
    row = write_timeline_header(ctx, ws, row)

    rev_row = ctx.ref_row("Revenue", "total_revenue")
    cogs_row = ctx.ref_row("COGS & GM", "total_cogs")

    row = write_row_series(ctx, ws, row, "Revenue", same_col_link("Revenue", rev_row, ctx), fmt=fmt.num,
                            aggregation="sum")
    ctx.set_ref("P&L", "revenue", row)
    row += 1
    row = write_row_series(ctx, ws, row, "Cost of Goods Sold", same_col_link("COGS & GM", cogs_row, ctx),
                            fmt=fmt.num, aggregation="sum")
    ctx.set_ref("P&L", "cogs", row)
    row += 1

    def gp_formula(m):
        col = col_letter(g.month_col(m))
        return f"{col}{ctx.ref_row('P&L','revenue')+1}-{col}{ctx.ref_row('P&L','cogs')+1}"

    row = write_row_series(ctx, ws, row, "Gross Profit", gp_formula, fmt=fmt.num_subtotal,
                            aggregation="sum", subtotal=True)
    ctx.set_ref("P&L", "gross_profit", row)
    row += 1

    def gm_formula(m):
        col = col_letter(g.month_col(m))
        rev = f"{col}{ctx.ref_row('P&L','revenue')+1}"
        gp = f"{col}{ctx.ref_row('P&L','gross_profit')+1}"
        return f"IFERROR({gp}/{rev},0)"

    row = write_row_series(ctx, ws, row, "Gross Margin %", gm_formula, fmt=fmt.pct, aggregation="avg")
    ctx.set_ref("P&L", "gross_margin_pct", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "Operating Expenses")
    row += 1
    dept_rows = []
    for dept in cfg.departments:
        opex_dept_row = ctx.ref_row("Opex", f"total_{dept}")
        row = write_row_series(ctx, ws, row, dept, same_col_link("Opex", opex_dept_row, ctx), fmt=fmt.num,
                                aggregation="sum")
        dept_rows.append(row)
        row += 1

    def total_opex_formula(m, rows=list(dept_rows)):
        col = col_letter(g.month_col(m))
        return "+".join(f"{col}{r+1}" for r in rows)

    row = write_row_series(ctx, ws, row, "Total Operating Expenses", total_opex_formula, fmt=fmt.num_subtotal,
                            aggregation="sum", subtotal=True)
    ctx.set_ref("P&L", "total_opex", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    def ebitda_formula(m):
        col = col_letter(g.month_col(m))
        return f"{col}{ctx.ref_row('P&L','gross_profit')+1}-{col}{ctx.ref_row('P&L','total_opex')+1}"

    row = write_row_series(ctx, ws, row, "EBITDA", ebitda_formula, fmt=fmt.num_subtotal, aggregation="sum",
                            subtotal=True)
    ctx.set_ref("P&L", "ebitda", row)
    row += 1

    dep_row = ctx.ref_row("Working Capital", "depreciation")
    row = write_row_series(ctx, ws, row, "Depreciation & Amortization", same_col_link("Working Capital", dep_row, ctx),
                            fmt=fmt.num, aggregation="sum")
    ctx.set_ref("P&L", "da", row)
    row += 1

    def ebit_formula(m):
        col = col_letter(g.month_col(m))
        return f"{col}{ctx.ref_row('P&L','ebitda')+1}-{col}{ctx.ref_row('P&L','da')+1}"

    row = write_row_series(ctx, ws, row, "EBIT (Operating Income)", ebit_formula, fmt=fmt.num_subtotal,
                            aggregation="sum", subtotal=True)
    ctx.set_ref("P&L", "ebit", row)
    row += 1

    int_row = ctx.ref_row("Working Capital", "interest_expense")
    row = write_row_series(ctx, ws, row, "Interest Expense", same_col_link("Working Capital", int_row, ctx),
                            fmt=fmt.num, aggregation="sum")
    ctx.set_ref("P&L", "interest_expense", row)
    row += 1

    def ebt_formula(m):
        col = col_letter(g.month_col(m))
        return f"{col}{ctx.ref_row('P&L','ebit')+1}-{col}{ctx.ref_row('P&L','interest_expense')+1}"

    row = write_row_series(ctx, ws, row, "Earnings Before Tax", ebt_formula, fmt=fmt.num_subtotal,
                            aggregation="sum", subtotal=True)
    ctx.set_ref("P&L", "ebt", row)
    row += 1

    tax_ref = active_ref(ctx, cfg.tax_rate_key)

    def tax_formula(m):
        col = col_letter(g.month_col(m))
        ebt = f"{col}{ctx.ref_row('P&L','ebt')+1}"
        return f"MAX(0,{ebt})*{tax_ref}"

    row = write_row_series(ctx, ws, row, "Income Tax Expense", tax_formula, note="MAX(0, EBT) × tax rate — no NOL modeling",
                            fmt=fmt.num, aggregation="sum")
    ctx.set_ref("P&L", "tax", row)
    row += 1

    def ni_formula(m):
        col = col_letter(g.month_col(m))
        return f"{col}{ctx.ref_row('P&L','ebt')+1}-{col}{ctx.ref_row('P&L','tax')+1}"

    row = write_row_series(ctx, ws, row, "Net Income", ni_formula, fmt=fmt.num_total, aggregation="sum",
                            total=True)
    ctx.set_ref("P&L", "net_income", row)
    row += 1
