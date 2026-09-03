"""Generic Checks tab: visibly validates balance-sheet balance, cash-flow
reconciliation, retained-earnings roll-forward, P&L subtotal integrity,
scenario-selector validity, and scans key schedules for Excel formula
errors. Every workbook ends with one PASS/FAIL roll-up cell.
"""
from __future__ import annotations

from ..context import WorkbookContext
from ..utils import col_letter

LBL, DESC, METRIC, STATUS = 0, 1, 2, 3

TOLERANCE = 1.0  # dollars — rounding tolerance for balance/reconciliation checks

SCAN_SHEETS = [
    "Headcount", "Revenue", "COGS & GM", "Opex", "Working Capital", "P&L",
    "Balance Sheet", "Cash Flow", "Cash & Runway",
]


def build_checks_sheet(ctx: WorkbookContext) -> None:
    ws = ctx.add_sheet("Checks")
    fmt = ctx.fmt
    g = ctx.grid
    ws.set_column(LBL, LBL, 34)
    ws.set_column(DESC, DESC, 52)
    ws.set_column(METRIC, METRIC, 16)
    ws.set_column(STATUS, STATUS, 14)

    ws.merge_range(0, 0, 0, STATUS, f"  {ctx.model_name} — Checks", fmt.title_bar)
    ws.set_row(0, 22)
    ws.merge_range(1, 0, 1, STATUS,
                   "  Every control below should read PASS. If anything reads FAIL, trace it back through "
                   "the linked tabs before trusting the outputs.", fmt.subtitle_bar)
    ws.set_row(1, 16)

    row = 3
    ws.write(row, LBL, "Check", fmt.column_header)
    ws.write(row, DESC, "Description", fmt.column_header)
    ws.write(row, METRIC, "Metric", fmt.column_header)
    ws.write(row, STATUS, "Status", fmt.column_header)
    row += 1

    status_rows = []

    def write_check(label, desc, metric_formula, pass_formula, metric_fmt=None):
        nonlocal row
        ws.write(row, LBL, label, fmt.label_bold)
        ws.write(row, DESC, desc, fmt.note_wrap)
        ws.write_array_formula(row, METRIC, row, METRIC, "=" + metric_formula, metric_fmt or fmt.check_num)
        status_cell_row = row
        ws.write_array_formula(row, STATUS, row, STATUS, f'=IF({pass_formula},"PASS","FAIL")', fmt.text)
        ws.conditional_format(row, STATUS, row, STATUS, {
            "type": "cell", "criteria": "==", "value": '"PASS"', "format": fmt.check_pass})
        ws.conditional_format(row, STATUS, row, STATUS, {
            "type": "cell", "criteria": "==", "value": '"FAIL"', "format": fmt.check_fail})
        status_rows.append(status_cell_row)
        row += 1

    # 1. Balance sheet balances
    bc_row = ctx.ref_row("Balance Sheet", "balance_check")
    bc_range = f"'Balance Sheet'!{col_letter(g.month_start_col)}{bc_row+1}:{col_letter(g.month_end_col)}{bc_row+1}"
    write_check("Balance Sheet balances", "MAX absolute (Assets − Liabilities&Equity) across all 36 months",
                f"MAX(ABS({bc_range}))", f"MAX(ABS({bc_range}))<{TOLERANCE}")

    # 2. Cash flow reconciliation
    bs_cash_row = ctx.ref_row("Balance Sheet", "cash")
    cf_cash_row = ctx.ref_row("Cash Flow", "ending_cash")
    c0, c1 = col_letter(g.month_start_col), col_letter(g.month_end_col)
    bs_range = f"'Balance Sheet'!{c0}{bs_cash_row+1}:{c1}{bs_cash_row+1}"
    cf_range = f"'Cash Flow'!{c0}{cf_cash_row+1}:{c1}{cf_cash_row+1}"
    write_check("Cash Flow reconciles to Balance Sheet",
                "MAX absolute difference between BS cash and CF ending cash across all 36 months",
                f"MAX(ABS({bs_range}-{cf_range}))", f"MAX(ABS({bs_range}-{cf_range}))<{TOLERANCE}")

    # 3. Retained earnings roll-forward
    re_row = ctx.ref_row("Balance Sheet", "retained_earnings")
    ni_row = ctx.ref_row("P&L", "net_income")
    re_c0, re_c1 = col_letter(g.month_col(1)), col_letter(g.month_col(g.n_months - 1))
    re_range = f"'Balance Sheet'!{re_c0}{re_row+1}:{re_c1}{re_row+1}"
    re_prev_range = f"'Balance Sheet'!{col_letter(g.month_col(0))}{re_row+1}:{col_letter(g.month_col(g.n_months-2))}{re_row+1}"
    ni_range = f"'P&L'!{re_c0}{ni_row+1}:{re_c1}{ni_row+1}"
    write_check("Retained Earnings roll-forward", "MAX absolute (RE(m) − RE(m−1) − NetIncome(m)) for months 2-36",
                f"MAX(ABS({re_range}-{re_prev_range}-{ni_range}))",
                f"MAX(ABS({re_range}-{re_prev_range}-{ni_range}))<{TOLERANCE}")

    # 4. P&L subtotal integrity
    rev_row = ctx.ref_row("P&L", "revenue")
    cogs_row = ctx.ref_row("P&L", "cogs")
    gp_row = ctx.ref_row("P&L", "gross_profit")
    opex_row = ctx.ref_row("P&L", "total_opex")
    ebitda_row = ctx.ref_row("P&L", "ebitda")
    da_row = ctx.ref_row("P&L", "da")
    ebit_row = ctx.ref_row("P&L", "ebit")
    int_row = ctx.ref_row("P&L", "interest_expense")
    ebt_row = ctx.ref_row("P&L", "ebt")
    tax_row = ctx.ref_row("P&L", "tax")
    ni_row2 = ctx.ref_row("P&L", "net_income")

    def rr(r):
        return f"'P&L'!{c0}{r+1}:{c1}{r+1}"

    gp_check = f"MAX(ABS(({rr(rev_row)}-{rr(cogs_row)})-{rr(gp_row)}))"
    ebitda_check = f"MAX(ABS(({rr(gp_row)}-{rr(opex_row)})-{rr(ebitda_row)}))"
    ebit_check = f"MAX(ABS(({rr(ebitda_row)}-{rr(da_row)})-{rr(ebit_row)}))"
    ebt_check = f"MAX(ABS(({rr(ebit_row)}-{rr(int_row)})-{rr(ebt_row)}))"
    ni_check = f"MAX(ABS(({rr(ebt_row)}-{rr(tax_row)})-{rr(ni_row2)}))"
    combined_metric = f"MAX({gp_check},{ebitda_check},{ebit_check},{ebt_check},{ni_check})"
    write_check("P&L subtotal integrity", "MAX absolute error across Gross Profit / EBITDA / EBIT / EBT / Net Income subtotals",
                combined_metric, f"{combined_metric}<{TOLERANCE}")

    # 5. Scenario validity
    sel_row = ctx.ref_row("Scenarios", "selector_validity")
    sel_cell = f"'Scenarios'!C{sel_row+1}"
    write_check("Scenario selector validity", "Assumptions scenario selector must equal Base, Upside, or Downside",
                f'IF({sel_cell}="OK",1,0)', f'{sel_cell}="OK"', metric_fmt=fmt.check_num)

    # 6. Formula error scan
    error_parts = []
    for sheet in SCAN_SHEETS:
        rng = f"'{sheet}'!{col_letter(g.month_start_col)}5:{col_letter(g.last_col)}260"
        error_parts.append(f"SUMPRODUCT(--ISERROR({rng}))")
    error_formula = "+".join(error_parts)
    write_check("No formula errors", "Count of #REF!/#DIV0!/#VALUE! etc. across all key schedules (Headcount through Cash & Runway)",
                error_formula, f"({error_formula})=0", metric_fmt=fmt.intnum)

    row += 1
    ws.write(row, LBL, "ALL CHECKS", fmt.total_label)
    ws.merge_range(row, DESC, row, METRIC, "Overall model integrity status", fmt.total_label)
    status_cells = [f"D{r+1}" for r in status_rows]
    and_formula = "AND(" + ",".join(f'{c}="PASS"' for c in status_cells) + ")"
    ws.write_formula(row, STATUS, f'=IF({and_formula},"ALL PASS","REVIEW NEEDED")', fmt.total_label)
    ws.conditional_format(row, STATUS, row, STATUS, {
        "type": "cell", "criteria": "==", "value": '"ALL PASS"', "format": fmt.check_pass})
    ws.conditional_format(row, STATUS, row, STATUS, {
        "type": "cell", "criteria": "==", "value": '"REVIEW NEEDED"', "format": fmt.check_fail})

    ws.freeze_panes(4, 0)
    ws.set_landscape()
