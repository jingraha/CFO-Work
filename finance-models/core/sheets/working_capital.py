"""Generic Working Capital & Financing Schedules tab.

Houses: Accounts Receivable / Accounts Payable / Deferred Revenue drivers,
the Capex & Depreciation (PP&E) schedule, a simple Debt schedule, and an
Equity financing schedule. These feed the Balance Sheet and Cash Flow tabs
for every business model.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from ..context import WorkbookContext
from ..layout import setup_common_sheet, write_timeline_header, write_row_series, section_banner, blank_row, same_col_link
from ..sheets.assumptions import active_ref
from ..utils import col_letter, range_ref


@dataclass
class WCConfig:
    dso_days_key: str
    dpo_days_key: str
    deferred_rev_months_key: str
    capex_pct_revenue_key: str
    useful_life_months_key: str
    other_current_assets_pct_revenue_key: str
    interest_rate_key: str
    debt_draw_key: str
    debt_draw_month: int
    debt_monthly_repayment_key: str
    debt_repayment_start_month: int
    equity_rounds: List[Tuple[int, str, str]]  # (month_idx 0-based, assumption_key, label)
    revenue_sheet: str = "Revenue"
    revenue_key: str = "total_revenue"
    cogs_sheet: str = "COGS & GM"
    cogs_key: str = "total_cogs"
    opex_sheet: str = "Opex"
    opex_key: str = "total_opex"


def build_working_capital_sheet(ctx: WorkbookContext, cfg: WCConfig) -> None:
    ws = ctx.add_sheet("Working Capital")
    g = ctx.grid
    fmt = ctx.fmt
    row = setup_common_sheet(ctx, ws, "Working Capital",
                              "Balance-sheet drivers: receivables, payables, deferred revenue, capex/depreciation, debt & equity financing.")
    row = write_timeline_header(ctx, ws, row)

    rev_row = ctx.ref_row(cfg.revenue_sheet, cfg.revenue_key)
    cogs_row = ctx.ref_row(cfg.cogs_sheet, cfg.cogs_key)
    opex_row = ctx.ref_row(cfg.opex_sheet, cfg.opex_key)

    # ---------------- AR / AP / Deferred revenue ----------------
    row = section_banner(ctx, ws, row, "Receivables, Payables & Deferred Revenue")
    row += 1
    dso_ref = active_ref(ctx, cfg.dso_days_key)
    dpo_ref = active_ref(ctx, cfg.dpo_days_key)
    defrev_ref = active_ref(ctx, cfg.deferred_rev_months_key)

    def ar_formula(m):
        rev = f"'{cfg.revenue_sheet}'!{col_letter(g.month_col(m))}{rev_row + 1}"
        return f"{rev}*{dso_ref}/30"

    row = write_row_series(ctx, ws, row, "Accounts Receivable balance", ar_formula,
                            note="Revenue × DSO ÷ 30", fmt=fmt.num, aggregation="end")
    ctx.set_ref("Working Capital", "ar_balance", row)
    row += 1

    def ap_formula(m):
        cogs = f"'{cfg.cogs_sheet}'!{col_letter(g.month_col(m))}{cogs_row + 1}"
        opex = f"'{cfg.opex_sheet}'!{col_letter(g.month_col(m))}{opex_row + 1}"
        return f"({cogs}+{opex})*{dpo_ref}/30"

    row = write_row_series(ctx, ws, row, "Accounts Payable balance", ap_formula,
                            note="(COGS + Opex) × DPO ÷ 30", fmt=fmt.num, aggregation="end")
    ctx.set_ref("Working Capital", "ap_balance", row)
    row += 1

    def defrev_formula(m):
        rev = f"'{cfg.revenue_sheet}'!{col_letter(g.month_col(m))}{rev_row + 1}"
        return f"{rev}*{defrev_ref}"

    row = write_row_series(ctx, ws, row, "Deferred Revenue balance", defrev_formula,
                            note="Revenue × months collected in advance", fmt=fmt.num, aggregation="end")
    ctx.set_ref("Working Capital", "deferred_revenue_balance", row)
    row += 1

    oca_pct_ref = active_ref(ctx, cfg.other_current_assets_pct_revenue_key)

    def oca_formula(m):
        rev = f"'{cfg.revenue_sheet}'!{col_letter(g.month_col(m))}{rev_row + 1}"
        return f"{rev}*{oca_pct_ref}"

    row = write_row_series(ctx, ws, row, "Other Current Assets balance", oca_formula,
                            note="Revenue × assumption % (prepaid expenses, etc.)", fmt=fmt.num,
                            aggregation="end")
    ctx.set_ref("Working Capital", "other_current_assets_balance", row)
    row += 1

    for label, key in [("Accounts Receivable", "ar_balance"), ("Accounts Payable", "ap_balance"),
                        ("Deferred Revenue", "deferred_revenue_balance"),
                        ("Other Current Assets", "other_current_assets_balance")]:
        src_row = ctx.ref_row("Working Capital", key)

        def change_formula(m, src_row=src_row):
            col = col_letter(g.month_col(m))
            if m == 0:
                return f"{col}{src_row + 1}"
            prev = col_letter(g.month_col(m - 1))
            return f"{col}{src_row + 1}-{prev}{src_row + 1}"

        row = write_row_series(ctx, ws, row, f"  Change in {label}", change_formula, fmt=fmt.num,
                                aggregation="sum", indent=True)
        ctx.set_ref("Working Capital", f"change_{key}", row)
        row += 1
    row = blank_row(ctx, ws, row) + 1

    # ---------------- Capex & Depreciation ----------------
    row = section_banner(ctx, ws, row, "Capex & Depreciation (PP&E)")
    row += 1
    capex_pct_ref = active_ref(ctx, cfg.capex_pct_revenue_key)
    life_ref = active_ref(ctx, cfg.useful_life_months_key)

    def capex_formula(m):
        rev = f"'{cfg.revenue_sheet}'!{col_letter(g.month_col(m))}{rev_row + 1}"
        return f"{rev}*{capex_pct_ref}"

    row = write_row_series(ctx, ws, row, "Capital expenditures", capex_formula,
                            note="Revenue × capex % of revenue", fmt=fmt.num, aggregation="sum")
    capex_row = row
    ctx.set_ref("Working Capital", "capex", row)
    row += 1

    capex_range = range_ref("Working Capital", capex_row, g.month_start_col, g.month_end_col)

    def dep_formula(m):
        pos = m + 1  # 1-based position within capex_range
        first = f"MAX(1,{pos}-ROUND({life_ref},0)+1)"
        return f"SUM(INDEX({capex_range},1,{first}):INDEX({capex_range},1,{pos}))/ROUND({life_ref},0)"

    row = write_row_series(ctx, ws, row, "Depreciation & amortization", dep_formula,
                            note="Straight-line over useful life; trailing-window formula", fmt=fmt.num,
                            aggregation="sum")
    dep_row = row
    ctx.set_ref("Working Capital", "depreciation", row)
    row += 1

    def net_ppe_formula(m, this_row=row):
        col = col_letter(g.month_col(m))
        if m == 0:
            return f"{col}{capex_row + 1}-{col}{dep_row + 1}"
        prev = col_letter(g.month_col(m - 1))
        return f"{prev}{this_row + 1}+{col}{capex_row + 1}-{col}{dep_row + 1}"

    row = write_row_series(ctx, ws, row, "Net PP&E balance", net_ppe_formula, fmt=fmt.num,
                            aggregation="end")
    ctx.set_ref("Working Capital", "net_ppe", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    # ---------------- Debt schedule ----------------
    row = section_banner(ctx, ws, row, "Debt Schedule")
    row += 1
    rate_ref = active_ref(ctx, cfg.interest_rate_key)
    draw_ref = active_ref(ctx, cfg.debt_draw_key)
    repay_ref = active_ref(ctx, cfg.debt_monthly_repayment_key)

    def draw_formula(m):
        return draw_ref if m == cfg.debt_draw_month else "0"

    row = write_row_series(ctx, ws, row, "Debt draw", draw_formula,
                            note=f"One-time draw in month {cfg.debt_draw_month + 1}", fmt=fmt.num,
                            aggregation="sum")
    draw_row = row
    ctx.set_ref("Working Capital", "debt_draw", row)
    row += 1

    # Repayment and balance rows are interleaved by hand (rather than via write_row_series)
    # because repayment references the PRIOR month's ending balance, which in turn depends on
    # this month's draw/repayment - both only ever need last month's already-written balance.
    row_repay = row
    ws.write(row_repay, g.label_col, "Debt repayment", fmt.label_indent)
    ws.write(row_repay, g.note_col, "Fixed $/month once balance exists, starting the assumed month", fmt.note)
    row_balance = row_repay + 1

    for m in range(g.n_months):
        col = g.month_col(m)
        if m < cfg.debt_repayment_start_month or m == 0:
            ws.write_formula(row_repay, col, "=0", fmt.num)
        else:
            prev_bal = f"{col_letter(g.month_col(m - 1))}{row_balance + 1}"
            ws.write_formula(row_repay, col, f"=MIN({prev_bal},{repay_ref})", fmt.num)
    # quarterly/annual rollups for repayment row
    for q in range(g.n_quarters):
        months = list(g.months_in_quarter(q))
        c0, c1 = col_letter(g.month_col(months[0])), col_letter(g.month_col(months[-1]))
        ws.write_formula(row_repay, g.quarter_col(q), f"=SUM({c0}{row_repay+1}:{c1}{row_repay+1})", fmt.num)
    for y in range(g.n_years):
        months = list(g.months_in_year(y))
        c0, c1 = col_letter(g.month_col(months[0])), col_letter(g.month_col(months[-1]))
        ws.write_formula(row_repay, g.year_col(y), f"=SUM({c0}{row_repay+1}:{c1}{row_repay+1})", fmt.num)
    ctx.set_ref("Working Capital", "debt_repayment", row_repay)

    ws.write(row_balance, g.label_col, "Debt balance (ending)", fmt.subtotal_label)
    ws.write(row_balance, g.note_col, "Prior balance + draw − repayment", fmt.note)
    for m in range(g.n_months):
        col = g.month_col(m)
        if m == 0:
            f_ = f"={col_letter(col)}{draw_row+1}-{col_letter(col)}{row_repay+1}"
        else:
            prev = col_letter(g.month_col(m - 1))
            f_ = f"={prev}{row_balance+1}+{col_letter(col)}{draw_row+1}-{col_letter(col)}{row_repay+1}"
        ws.write_formula(row_balance, col, f_, fmt.num_subtotal)
    for q in range(g.n_quarters):
        months = list(g.months_in_quarter(q))
        c1 = col_letter(g.month_col(months[-1]))
        ws.write_formula(row_balance, g.quarter_col(q), f"={c1}{row_balance+1}", fmt.num_subtotal)
    for y in range(g.n_years):
        months = list(g.months_in_year(y))
        c1 = col_letter(g.month_col(months[-1]))
        ws.write_formula(row_balance, g.year_col(y), f"={c1}{row_balance+1}", fmt.num_subtotal)
    ctx.set_ref("Working Capital", "debt_balance", row_balance)
    row = row_balance + 1

    def interest_formula(m):
        col = col_letter(g.month_col(m))
        if m == 0:
            return f"{col}{draw_row+1}*{rate_ref}/12/2"  # half-month convention on new draw
        prev = col_letter(g.month_col(m - 1))
        return f"{prev}{row_balance+1}*{rate_ref}/12"

    row = write_row_series(ctx, ws, row, "Interest expense", interest_formula,
                            note="Prior month balance × annual rate ÷ 12", fmt=fmt.num, aggregation="sum")
    ctx.set_ref("Working Capital", "interest_expense", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    # ---------------- Equity financing ----------------
    row = section_banner(ctx, ws, row, "Equity Financing")
    row += 1

    def equity_formula(m):
        parts = []
        for month_idx, key, label in cfg.equity_rounds:
            if month_idx == m:
                parts.append(active_ref(ctx, key))
        return "+".join(parts) if parts else "0"

    row = write_row_series(ctx, ws, row, "Equity raised", equity_formula,
                            note="; ".join(f"{lbl} in month {mi+1}" for mi, _, lbl in cfg.equity_rounds),
                            fmt=fmt.num, aggregation="sum")
    equity_row = row
    ctx.set_ref("Working Capital", "equity_raised", row)
    row += 1

    def cum_equity_formula(m, this_row=None):
        col = col_letter(g.month_col(m))
        if m == 0:
            return f"{col}{equity_row+1}"
        prev = col_letter(g.month_col(m - 1))
        return f"{prev}{row+1}+{col}{equity_row+1}"

    row = write_row_series(ctx, ws, row, "Cumulative paid-in capital", cum_equity_formula,
                            fmt=fmt.num_subtotal, aggregation="end")
    ctx.set_ref("Working Capital", "cumulative_paid_in_capital", row)
    row += 1
