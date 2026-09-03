"""Generic indirect-method Cash Flow tab. Reconciles Net Income + non-cash
add-backs + working-capital changes + investing + financing activity into
a monthly ending cash balance that the Balance Sheet and Cash & Runway tabs
both link to.
"""
from __future__ import annotations

from dataclasses import dataclass

from ..context import WorkbookContext
from ..layout import setup_common_sheet, write_timeline_header, write_row_series, section_banner, blank_row, same_col_link
from ..sheets.assumptions import active_ref
from ..utils import col_letter


@dataclass
class CashFlowConfig:
    starting_cash_key: str


def _linked_signed(ctx, sheet, key, sign="+"):
    row = ctx.ref_row(sheet, key)

    def fn(m):
        col = col_letter(ctx.grid.month_col(m))
        expr = f"'{sheet}'!{col}{row + 1}"
        return expr if sign == "+" else f"-{expr}"
    return fn


def build_cash_flow_sheet(ctx: WorkbookContext, cfg: CashFlowConfig) -> None:
    ws = ctx.add_sheet("Cash Flow")
    g = ctx.grid
    fmt = ctx.fmt
    row = setup_common_sheet(ctx, ws, "Cash Flow", "Indirect method — Net Income reconciled to the change in cash.")
    row = write_timeline_header(ctx, ws, row)

    row = section_banner(ctx, ws, row, "Cash from Operations")
    row += 1

    ni_row = ctx.ref_row("P&L", "net_income")
    row = write_row_series(ctx, ws, row, "Net Income", same_col_link("P&L", ni_row, ctx), fmt=fmt.num,
                            aggregation="sum")
    row += 1
    da_row = ctx.ref_row("P&L", "da")
    row = write_row_series(ctx, ws, row, "+ Depreciation & Amortization", same_col_link("P&L", da_row, ctx),
                            fmt=fmt.num, aggregation="sum")
    row += 1
    row = write_row_series(ctx, ws, row, "− Change in Accounts Receivable",
                            _linked_signed(ctx, "Working Capital", "change_ar_balance", "-"), fmt=fmt.num,
                            aggregation="sum")
    row += 1
    row = write_row_series(ctx, ws, row, "− Change in Other Current Assets",
                            _linked_signed(ctx, "Working Capital", "change_other_current_assets_balance", "-"),
                            fmt=fmt.num, aggregation="sum")
    row += 1
    row = write_row_series(ctx, ws, row, "+ Change in Accounts Payable",
                            _linked_signed(ctx, "Working Capital", "change_ap_balance", "+"), fmt=fmt.num,
                            aggregation="sum")
    row += 1
    row = write_row_series(ctx, ws, row, "+ Change in Deferred Revenue",
                            _linked_signed(ctx, "Working Capital", "change_deferred_revenue_balance", "+"),
                            fmt=fmt.num, aggregation="sum")
    cfo_component_rows = list(range(row - 5, row + 1))
    row += 1

    def cfo_formula(m, rows=cfo_component_rows):
        col = col_letter(g.month_col(m))
        return "+".join(f"{col}{r+1}" for r in rows)

    row = write_row_series(ctx, ws, row, "Cash from Operations", cfo_formula, fmt=fmt.num_subtotal,
                            aggregation="sum", subtotal=True)
    ctx.set_ref("Cash Flow", "cfo", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "Cash from Investing")
    row += 1
    row = write_row_series(ctx, ws, row, "− Capital Expenditures",
                            _linked_signed(ctx, "Working Capital", "capex", "-"), fmt=fmt.num, aggregation="sum")
    cfi_row_component = row
    row += 1

    def cfi_formula(m, r=cfi_row_component):
        col = col_letter(g.month_col(m))
        return f"{col}{r+1}"

    row = write_row_series(ctx, ws, row, "Cash from Investing", cfi_formula, fmt=fmt.num_subtotal,
                            aggregation="sum", subtotal=True)
    ctx.set_ref("Cash Flow", "cfi", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "Cash from Financing")
    row += 1
    row = write_row_series(ctx, ws, row, "+ Debt Draw", _linked_signed(ctx, "Working Capital", "debt_draw", "+"),
                            fmt=fmt.num, aggregation="sum")
    row += 1
    row = write_row_series(ctx, ws, row, "− Debt Repayment",
                            _linked_signed(ctx, "Working Capital", "debt_repayment", "-"), fmt=fmt.num,
                            aggregation="sum")
    row += 1
    row = write_row_series(ctx, ws, row, "+ Equity Raised", _linked_signed(ctx, "Working Capital", "equity_raised", "+"),
                            fmt=fmt.num, aggregation="sum")
    cff_component_rows = [row - 2, row - 1, row]
    row += 1

    def cff_formula(m, rows=cff_component_rows):
        col = col_letter(g.month_col(m))
        return "+".join(f"{col}{r+1}" for r in rows)

    row = write_row_series(ctx, ws, row, "Cash from Financing", cff_formula, fmt=fmt.num_subtotal,
                            aggregation="sum", subtotal=True)
    ctx.set_ref("Cash Flow", "cff", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    def net_change_formula(m):
        col = col_letter(g.month_col(m))
        keys = ["cfo", "cfi", "cff"]
        return "+".join(f"{col}{ctx.ref_row('Cash Flow', k) + 1}" for k in keys)

    row = write_row_series(ctx, ws, row, "Net Change in Cash", net_change_formula, fmt=fmt.num_subtotal,
                            aggregation="sum", subtotal=True)
    ctx.set_ref("Cash Flow", "net_change_cash", row)
    row += 1

    starting_cash_ref = active_ref(ctx, cfg.starting_cash_key)
    net_change_row = ctx.ref_row("Cash Flow", "net_change_cash")

    row_beginning = row
    ws.write(row_beginning, g.label_col, "Beginning Cash", fmt.label_indent)
    ws.write(row_beginning, g.note_col, "Prior month ending cash (or starting cash in month 1)", fmt.note)
    row_ending = row_beginning + 1
    for m in range(g.n_months):
        col = g.month_col(m)
        if m == 0:
            ws.write_formula(row_beginning, col, f"={starting_cash_ref}", fmt.num)
        else:
            prev = col_letter(g.month_col(m - 1))
            ws.write_formula(row_beginning, col, f"={prev}{row_ending+1}", fmt.num)
    for q in range(g.n_quarters):
        months = list(g.months_in_quarter(q))
        c0 = col_letter(g.month_col(months[0]))
        ws.write_formula(row_beginning, g.quarter_col(q), f"={c0}{row_beginning+1}", fmt.num)
    for y in range(g.n_years):
        months = list(g.months_in_year(y))
        c0 = col_letter(g.month_col(months[0]))
        ws.write_formula(row_beginning, g.year_col(y), f"={c0}{row_beginning+1}", fmt.num)
    ctx.set_ref("Cash Flow", "beginning_cash", row_beginning)

    ws.write(row_ending, g.label_col, "Ending Cash", fmt.subtotal_label)
    ws.write(row_ending, g.note_col, "Beginning cash + net change in cash", fmt.note)
    for m in range(g.n_months):
        col = g.month_col(m)
        c = col_letter(col)
        ws.write_formula(row_ending, col, f"={c}{row_beginning+1}+{c}{net_change_row+1}", fmt.num_subtotal)
    for q in range(g.n_quarters):
        months = list(g.months_in_quarter(q))
        c1 = col_letter(g.month_col(months[-1]))
        ws.write_formula(row_ending, g.quarter_col(q), f"={c1}{row_ending+1}", fmt.num_subtotal)
    for y in range(g.n_years):
        months = list(g.months_in_year(y))
        c1 = col_letter(g.month_col(months[-1]))
        ws.write_formula(row_ending, g.year_col(y), f"={c1}{row_ending+1}", fmt.num_subtotal)
    ctx.set_ref("Cash Flow", "ending_cash", row_ending)
