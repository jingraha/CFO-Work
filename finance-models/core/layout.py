"""Common sheet chrome and row-writing helpers shared by every tab builder."""
from __future__ import annotations

from typing import Callable, Optional, Sequence

from .context import WorkbookContext
from .utils import col_letter, cell as a1

Formula = Callable[[int], str]  # month_idx (0..35) -> excel formula WITHOUT leading '='

LABEL_W = 40
NOTE_W = 30
MONTH_W = 11
SEP_W = 2
SUMMARY_W = 12


def setup_common_sheet(ctx: WorkbookContext, ws, title: str, subtitle: str,
                        n_header_rows: int = 4, freeze_row: Optional[int] = None,
                        freeze_col: int = 2) -> int:
    """Writes the standard title bar + column widths + freeze panes.

    Returns the row index (0-based) where the caller should start writing
    the timeline header (date row).
    """
    g = ctx.grid
    fmt = ctx.fmt
    last_col = g.last_col

    ws.merge_range(0, 0, 0, last_col, f"  {ctx.model_name} — {title}", fmt.title_bar)
    ws.set_row(0, 22)
    ws.merge_range(1, 0, 1, last_col, f"  {subtitle}", fmt.subtitle_bar)
    ws.set_row(1, 16)

    ws.set_column(g.label_col, g.label_col, LABEL_W)
    ws.set_column(g.note_col, g.note_col, NOTE_W)
    ws.set_column(g.month_start_col, g.month_end_col, MONTH_W)
    ws.set_column(g.quarter_sep_col, g.quarter_sep_col, SEP_W)
    ws.set_column(g.quarter_start_col, g.quarter_end_col, SUMMARY_W)
    ws.set_column(g.year_sep_col, g.year_sep_col, SEP_W)
    ws.set_column(g.year_start_col, g.year_end_col, SUMMARY_W)

    ws.freeze_panes(freeze_row if freeze_row is not None else n_header_rows, freeze_col)

    ws.set_landscape()
    ws.fit_to_pages(1, 0)
    ws.set_print_scale(55)
    ws.repeat_rows(0, n_header_rows - 1)
    ws.set_paper(9)  # A4

    return n_header_rows


def write_timeline_header(ctx: WorkbookContext, ws, row: int) -> int:
    """Writes section banners + date/period headers for Monthly/Quarterly/Annual blocks.

    Returns the next free row index.
    """
    g = ctx.grid
    fmt = ctx.fmt

    ws.merge_range(row, g.month_start_col, row, g.month_end_col, "Monthly (36 months)", fmt.section_header)
    ws.merge_range(row, g.quarter_start_col, row, g.quarter_end_col, "Quarterly", fmt.section_header)
    ws.merge_range(row, g.year_start_col, row, g.year_end_col, "Annual", fmt.section_header)
    ws.write(row, g.label_col, "Line item", fmt.section_header)
    ws.write(row, g.note_col, "Units / source", fmt.section_header)
    row += 1

    dates = g.month_dates()
    for i, d in enumerate(dates):
        ws.write_datetime(row, g.month_col(i), d, fmt.column_header_date)
    for q in range(g.n_quarters):
        ws.write(row, g.quarter_col(q), f"Q{q + 1}", fmt.column_header)
    for y in range(g.n_years):
        ws.write(row, g.year_col(y), f"FY{y + 1}", fmt.column_header)
    ws.write(row, g.label_col, "", fmt.column_header)
    ws.write(row, g.note_col, "", fmt.column_header)
    row += 1
    return row


def write_row_series(ctx: WorkbookContext, ws, row: int, label: str, formula_fn: Formula,
                      note: str = "", fmt=None, aggregation: str = "sum",
                      subtotal: bool = False, total: bool = False, indent: bool = True,
                      pct_fmt=None) -> int:
    """Writes one full row: label, note, 36 monthly formulas, quarterly & annual rollups.

    aggregation: 'sum' (flow, e.g. revenue/expense), 'end' (balance, e.g. cash/AR balance
                 - period value = last month in period), or 'avg' (ratios/percentages).
    Returns the row index used (same as `row`), so caller can do `row += 1` after.
    """
    g = ctx.grid
    f = ctx.fmt
    value_fmt = fmt or f.num
    if subtotal and fmt is None:
        value_fmt = f.num_subtotal
    if total and fmt is None:
        value_fmt = f.num_total

    label_fmt = f.subtotal_label if subtotal else (f.total_label if total else
                                                     (f.label_indent if indent else f.label))
    ws.write(row, g.label_col, label, label_fmt)
    ws.write(row, g.note_col, note, f.note)

    for m in range(g.n_months):
        col = g.month_col(m)
        formula = formula_fn(m)
        if formula is None:
            continue
        ws.write_formula(row, col, "=" + formula, value_fmt)

    r1 = row + 1  # 1-based row for formulas
    for q in range(g.n_quarters):
        months = list(g.months_in_quarter(q))
        c0 = col_letter(g.month_col(months[0]))
        c1 = col_letter(g.month_col(months[-1]))
        qcol = g.quarter_col(q)
        if aggregation == "sum":
            formula = f"SUM({c0}{r1}:{c1}{r1})"
        elif aggregation == "end":
            formula = f"{c1}{r1}"
        else:
            formula = f"AVERAGE({c0}{r1}:{c1}{r1})"
        ws.write_formula(row, qcol, "=" + formula, value_fmt)

    for y in range(g.n_years):
        months = list(g.months_in_year(y))
        c0 = col_letter(g.month_col(months[0]))
        c1 = col_letter(g.month_col(months[-1]))
        ycol = g.year_col(y)
        if aggregation == "sum":
            formula = f"SUM({c0}{r1}:{c1}{r1})"
        elif aggregation == "end":
            formula = f"{c1}{r1}"
        else:
            formula = f"AVERAGE({c0}{r1}:{c1}{r1})"
        ws.write_formula(row, ycol, "=" + formula, value_fmt)

    return row


def blank_row(ctx: WorkbookContext, ws, row: int) -> int:
    ws.set_row(row, 5)
    return row


# Every sheet built with setup_common_sheet() + write_timeline_header() places the date header
# row at this fixed 0-based row index (4 header rows from setup_common_sheet, +1 banner row).
TIMELINE_DATE_ROW = 5


def section_banner(ctx: WorkbookContext, ws, row: int, text: str) -> int:
    g = ctx.grid
    ws.merge_range(row, g.label_col, row, g.last_col, f"  {text}", ctx.fmt.section_header)
    ws.set_row(row, 16)
    return row


def same_col_link(sheet: str, row_idx: int, ctx: WorkbookContext) -> Formula:
    """Returns a formula function that links to the same month-column cell on another sheet."""
    def fn(m: int) -> str:
        from .utils import sheet_ref
        col = ctx.grid.month_col(m)
        return sheet_ref(sheet, row_idx, col)
    return fn
