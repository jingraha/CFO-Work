"""Generic Balance Sheet tab. Balances by construction: Assets = Liabilities +
Equity every month, because Cash (from the Cash Flow tab), AR/AP/Deferred
Revenue/PP&E/Debt (from Working Capital), and Retained Earnings (Net Income
roll-forward) all trace back to the same P&L and Working Capital drivers.
"""
from __future__ import annotations

from dataclasses import dataclass

from ..context import WorkbookContext
from ..layout import setup_common_sheet, write_timeline_header, write_row_series, section_banner, blank_row, same_col_link
from ..sheets.assumptions import active_ref
from ..utils import col_letter


@dataclass
class BalanceSheetConfig:
    starting_cash_key: str
    starting_paid_in_capital_key: str


def build_balance_sheet(ctx: WorkbookContext, cfg: BalanceSheetConfig) -> None:
    ws = ctx.add_sheet("Balance Sheet")
    g = ctx.grid
    fmt = ctx.fmt
    row = setup_common_sheet(ctx, ws, "Balance Sheet", "Assets = Liabilities + Equity every month, by construction.")
    row = write_timeline_header(ctx, ws, row)

    starting_cash_ref = active_ref(ctx, cfg.starting_cash_key)
    starting_paidin_ref = active_ref(ctx, cfg.starting_paid_in_capital_key)

    row = section_banner(ctx, ws, row, "Assets")
    row += 1

    cash_row_cf = ctx.ref_row("Cash Flow", "ending_cash")
    row = write_row_series(ctx, ws, row, "Cash & equivalents", same_col_link("Cash Flow", cash_row_cf, ctx),
                            note="Linked from Cash Flow tab", fmt=fmt.num, aggregation="end")
    ctx.set_ref("Balance Sheet", "cash", row)
    row += 1

    ar_row = ctx.ref_row("Working Capital", "ar_balance")
    row = write_row_series(ctx, ws, row, "Accounts Receivable", same_col_link("Working Capital", ar_row, ctx),
                            fmt=fmt.num, aggregation="end")
    ctx.set_ref("Balance Sheet", "ar", row)
    row += 1

    def oca_formula(m):
        oca_row = ctx.ref_row("Working Capital", "other_current_assets_balance")
        col = col_letter(g.month_col(m))
        return f"'Working Capital'!{col}{oca_row + 1}"

    row = write_row_series(ctx, ws, row, "Other Current Assets (prepaid, etc.)", oca_formula,
                            note="Linked from Working Capital tab", fmt=fmt.num, aggregation="end")
    ctx.set_ref("Balance Sheet", "other_current_assets", row)
    row += 1

    ppe_row = ctx.ref_row("Working Capital", "net_ppe")
    row = write_row_series(ctx, ws, row, "Net PP&E", same_col_link("Working Capital", ppe_row, ctx),
                            fmt=fmt.num, aggregation="end")
    ctx.set_ref("Balance Sheet", "net_ppe", row)
    row += 1

    def total_assets_formula(m, rows=[ctx.ref_row("Balance Sheet", "cash")]):
        col = col_letter(g.month_col(m))
        keys = ["cash", "ar", "other_current_assets", "net_ppe"]
        parts = [f"{col}{ctx.ref_row('Balance Sheet', k) + 1}" for k in keys]
        return "+".join(parts)

    row = write_row_series(ctx, ws, row, "Total Assets", total_assets_formula, fmt=fmt.num_total,
                            aggregation="end", total=True)
    ctx.set_ref("Balance Sheet", "total_assets", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "Liabilities")
    row += 1

    ap_row = ctx.ref_row("Working Capital", "ap_balance")
    row = write_row_series(ctx, ws, row, "Accounts Payable", same_col_link("Working Capital", ap_row, ctx),
                            fmt=fmt.num, aggregation="end")
    ctx.set_ref("Balance Sheet", "ap", row)
    row += 1

    defrev_row = ctx.ref_row("Working Capital", "deferred_revenue_balance")
    row = write_row_series(ctx, ws, row, "Deferred Revenue", same_col_link("Working Capital", defrev_row, ctx),
                            fmt=fmt.num, aggregation="end")
    ctx.set_ref("Balance Sheet", "deferred_revenue", row)
    row += 1

    debt_row = ctx.ref_row("Working Capital", "debt_balance")
    row = write_row_series(ctx, ws, row, "Debt", same_col_link("Working Capital", debt_row, ctx),
                            fmt=fmt.num, aggregation="end")
    ctx.set_ref("Balance Sheet", "debt", row)
    row += 1

    def total_liab_formula(m):
        col = col_letter(g.month_col(m))
        keys = ["ap", "deferred_revenue", "debt"]
        parts = [f"{col}{ctx.ref_row('Balance Sheet', k) + 1}" for k in keys]
        return "+".join(parts)

    row = write_row_series(ctx, ws, row, "Total Liabilities", total_liab_formula, fmt=fmt.num_subtotal,
                            aggregation="end", subtotal=True)
    ctx.set_ref("Balance Sheet", "total_liabilities", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "Equity")
    row += 1

    paidin_wc_row = ctx.ref_row("Working Capital", "cumulative_paid_in_capital")

    def paidin_formula(m):
        col = col_letter(g.month_col(m))
        return f"{starting_paidin_ref}+'Working Capital'!{col}{paidin_wc_row + 1}"

    row = write_row_series(ctx, ws, row, "Paid-in Capital", paidin_formula,
                            note="Starting paid-in capital + cumulative equity raised", fmt=fmt.num,
                            aggregation="end")
    ctx.set_ref("Balance Sheet", "paid_in_capital", row)
    row += 1

    starting_re_formula = f"{starting_cash_ref}-{starting_paidin_ref}"
    ni_row = ctx.ref_row("P&L", "net_income")

    def re_formula(m, this_row=None):
        col = col_letter(g.month_col(m))
        ni = f"'P&L'!{col}{ni_row + 1}"
        if m == 0:
            return f"({starting_re_formula})+{ni}"
        prev = col_letter(g.month_col(m - 1))
        return f"{prev}{row+1}+{ni}"

    row = write_row_series(ctx, ws, row, "Retained Earnings", re_formula,
                            note="Starting RE (= starting cash − starting paid-in capital) + cumulative Net Income",
                            fmt=fmt.num, aggregation="end")
    ctx.set_ref("Balance Sheet", "retained_earnings", row)
    row += 1

    def total_equity_formula(m):
        col = col_letter(g.month_col(m))
        keys = ["paid_in_capital", "retained_earnings"]
        parts = [f"{col}{ctx.ref_row('Balance Sheet', k) + 1}" for k in keys]
        return "+".join(parts)

    row = write_row_series(ctx, ws, row, "Total Equity", total_equity_formula, fmt=fmt.num_subtotal,
                            aggregation="end", subtotal=True)
    ctx.set_ref("Balance Sheet", "total_equity", row)
    row += 1

    def total_le_formula(m):
        col = col_letter(g.month_col(m))
        keys = ["total_liabilities", "total_equity"]
        parts = [f"{col}{ctx.ref_row('Balance Sheet', k) + 1}" for k in keys]
        return "+".join(parts)

    row = write_row_series(ctx, ws, row, "Total Liabilities + Equity", total_le_formula, fmt=fmt.num_total,
                            aggregation="end", total=True)
    ctx.set_ref("Balance Sheet", "total_liab_equity", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    def balance_check_formula(m):
        col = col_letter(g.month_col(m))
        ta = f"{col}{ctx.ref_row('Balance Sheet','total_assets')+1}"
        tle = f"{col}{ctx.ref_row('Balance Sheet','total_liab_equity')+1}"
        return f"{ta}-{tle}"

    row = write_row_series(ctx, ws, row, "Balance check (Assets − Liab&Equity)", balance_check_formula,
                            note="Must equal ~0 every month", fmt=fmt.num2, aggregation="end")
    ctx.set_ref("Balance Sheet", "balance_check", row)
    row += 1
