"""Generic Cash & Runway tab: burn rate, trailing-average burn, and months
of runway, all reconciled to the Cash Flow tab's ending cash.
"""
from __future__ import annotations

from ..context import WorkbookContext
from ..layout import setup_common_sheet, write_timeline_header, write_row_series, section_banner, blank_row, same_col_link
from ..utils import col_letter


def build_cash_runway_sheet(ctx: WorkbookContext) -> None:
    ws = ctx.add_sheet("Cash & Runway")
    g = ctx.grid
    fmt = ctx.fmt
    row = setup_common_sheet(ctx, ws, "Cash & Runway", "Burn rate and runway — reconciled to the Cash Flow tab.")
    row = write_timeline_header(ctx, ws, row)

    row = section_banner(ctx, ws, row, "Cash Position")
    row += 1

    end_cash_row = ctx.ref_row("Cash Flow", "ending_cash")
    row = write_row_series(ctx, ws, row, "Ending Cash Balance", same_col_link("Cash Flow", end_cash_row, ctx),
                            fmt=fmt.num, aggregation="end")
    cash_row = row
    ctx.set_ref("Cash & Runway", "ending_cash", row)
    row += 1

    cfo_row = ctx.ref_row("Cash Flow", "cfo")
    cfi_row = ctx.ref_row("Cash Flow", "cfi")

    def burn_formula(m):
        col = col_letter(g.month_col(m))
        cfo = f"'Cash Flow'!{col}{cfo_row + 1}"
        cfi = f"'Cash Flow'!{col}{cfi_row + 1}"
        return f"MAX(0,-({cfo}+{cfi}))"

    row = write_row_series(ctx, ws, row, "Monthly Net Burn (pre-financing)", burn_formula,
                            note="MAX(0, −(operating + investing cash flow)); excludes debt and equity proceeds",
                            fmt=fmt.num,
                            aggregation="sum")
    burn_row = row
    ctx.set_ref("Cash & Runway", "monthly_burn", row)
    row += 1

    def trailing_burn_formula(m, burn_row=burn_row):
        col = col_letter(g.month_col(m))
        window = min(3, m + 1)
        start_col = col_letter(g.month_col(m - window + 1))
        return f"AVERAGE({start_col}{burn_row + 1}:{col}{burn_row + 1})"

    row = write_row_series(ctx, ws, row, "Trailing 3-Month Avg Burn", trailing_burn_formula,
                            fmt=fmt.num, aggregation="avg")
    trailing_row = row
    ctx.set_ref("Cash & Runway", "trailing_burn", row)
    row += 1

    def runway_formula(m, cash_row=cash_row, trailing_row=trailing_row):
        col = col_letter(g.month_col(m))
        cash = f"{col}{cash_row + 1}"
        burn = f"{col}{trailing_row + 1}"
        return f"IF({cash}<=0,0,IF({burn}<=0,999,{cash}/{burn}))"

    row = write_row_series(ctx, ws, row, "Runway (months)", runway_formula,
                            note="Ending cash ÷ trailing 3-month pre-financing burn; 0 if cash is depleted; 999 if cash-flow positive",
                            fmt=fmt.months_fmt, aggregation="end")
    ctx.set_ref("Cash & Runway", "runway_months", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "Headline")
    row += 1
    last_col = g.month_col(g.n_months - 1)
    runway_r = ctx.ref_row("Cash & Runway", "runway_months")
    cash_r = ctx.ref_row("Cash & Runway", "ending_cash")
    trailing_r = ctx.ref_row("Cash & Runway", "trailing_burn")
    last_col_name = col_letter(last_col)
    ws.write(row, g.label_col, "Runway as of final month (36)", ctx.fmt.label_bold)
    ws.write_formula(row, 2,
                      f'=IF({last_col_name}{cash_r+1}<=0,0,'
                      f'IF({last_col_name}{trailing_r+1}<=0,"Cash-flow positive",'
                      f"{last_col_name}{runway_r+1}))",
                      fmt.months_fmt)
    ctx.set_ref("Cash & Runway", "headline_runway_row", row)
    row += 1
