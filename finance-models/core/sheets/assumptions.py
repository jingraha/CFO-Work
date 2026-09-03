"""Generic Assumptions tab builder.

Every workbook gets: a plain-language scenario selector (with Excel data
validation) plus a Base / Upside / Downside / Active table. Model modules
supply the actual assumption rows grouped into sections; this module only
owns the table mechanics (scenario math + layout), so the plumbing is
identical across all four business models.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from ..context import WorkbookContext
from ..utils import col_letter, SCENARIOS
from ..layout import setup_common_sheet, section_banner, blank_row

LBL, UNIT, BASE, UP, DOWN, ACTIVE, NOTE = 0, 1, 2, 3, 4, 5, 6

SELECTOR_ROW = 3  # 0-based
SELECTOR_LABEL_COL = 0
SELECTOR_CELL_COL = 2
HEADER_ROW = 5


@dataclass
class AssumptionRow:
    key: str
    label: str
    unit: str
    base: float
    upside: float
    downside: float
    fmt: str = "num"       # 'num' | 'pct' | 'int' | 'mult' | 'text'
    note: str = ""


@dataclass
class AssumptionSection:
    title: str
    rows: List[AssumptionRow]


def _fmt_for(ctx: WorkbookContext, kind: str, input_: bool):
    f = ctx.fmt
    m = {
        "num": (f.input_num if input_ else f.num),
        "pct": (f.input_pct if input_ else f.pct),
        "pct0": (f.input_pct0 if input_ else f.pct0),
        "int": (f.input_int if input_ else f.intnum),
        "mult": (f.input_mult if input_ else f.mult),
        "text": (f.input_text if input_ else f.text),
    }
    return m.get(kind, f.input_num if input_ else f.num)


def build_assumptions_sheet(ctx: WorkbookContext, sections: List[AssumptionSection],
                             company_note: str = "") -> None:
    ws = ctx.add_sheet("Assumptions")
    g = ctx.grid
    fmt = ctx.fmt
    last_col = NOTE

    ws.set_column(LBL, LBL, 42)
    ws.set_column(UNIT, UNIT, 14)
    ws.set_column(BASE, DOWN, 13)
    ws.set_column(ACTIVE, ACTIVE, 14)
    ws.set_column(NOTE, NOTE, 46)

    ws.merge_range(0, 0, 0, last_col, f"  {ctx.model_name} — Assumptions", fmt.title_bar)
    ws.set_row(0, 22)
    ws.merge_range(1, 0, 1, last_col,
                   "  Plain-language inputs. Edit the Base / Upside / Downside columns only — "
                   "everything else in this workbook is a formula.", fmt.subtitle_bar)
    ws.set_row(1, 16)

    ws.write(SELECTOR_ROW, SELECTOR_LABEL_COL, "Scenario selector:", fmt.section_header)
    ws.write(SELECTOR_ROW, SELECTOR_CELL_COL, "Base", fmt.selector)
    ws.data_validation(SELECTOR_ROW, SELECTOR_CELL_COL, SELECTOR_ROW, SELECTOR_CELL_COL, {
        "validate": "list", "source": SCENARIOS,
        "input_title": "Choose a scenario", "input_message": "Base, Upside, or Downside.",
    })
    ws.write(SELECTOR_ROW, SELECTOR_CELL_COL + 1,
             "<< Pick Base / Upside / Downside. This one cell drives every formula in the model.",
             fmt.note)
    selector_ref = f"'Assumptions'!${col_letter(SELECTOR_CELL_COL)}${SELECTOR_ROW + 1}"
    ctx.scalars["scenario_selector"] = selector_ref

    ws.write(HEADER_ROW, LBL, "Assumption", fmt.column_header)
    ws.write(HEADER_ROW, UNIT, "Unit", fmt.column_header)
    ws.write(HEADER_ROW, BASE, "Base", fmt.column_header)
    ws.write(HEADER_ROW, UP, "Upside", fmt.column_header)
    ws.write(HEADER_ROW, DOWN, "Downside", fmt.column_header)
    ws.write(HEADER_ROW, ACTIVE, "Active (used in model)", fmt.column_header)
    ws.write(HEADER_ROW, NOTE, "Notes / definition", fmt.column_header)

    row = HEADER_ROW + 1
    for section in sections:
        ws.merge_range(row, LBL, row, NOTE, f"  {section.title}", fmt.section_header)
        ws.set_row(row, 15)
        row += 1
        for a in section.rows:
            ws.write(row, LBL, a.label, fmt.label_indent)
            ws.write(row, UNIT, a.unit, fmt.note)
            input_fmt = _fmt_for(ctx, a.fmt, input_=True)
            active_fmt = _fmt_for(ctx, a.fmt, input_=False)
            ws.write_number(row, BASE, a.base, input_fmt)
            ws.write_number(row, UP, a.upside, input_fmt)
            ws.write_number(row, DOWN, a.downside, input_fmt)
            r1 = row + 1
            active_formula = (
                f"=CHOOSE(MATCH({selector_ref},{{\"Base\",\"Upside\",\"Downside\"}},0),"
                f"{col_letter(BASE)}{r1},{col_letter(UP)}{r1},{col_letter(DOWN)}{r1})"
            )
            ws.write_formula(row, ACTIVE, active_formula, active_fmt)
            ws.write(row, NOTE, a.note, fmt.note_wrap)
            ctx.set_ref("Assumptions", a.key, row)
            row += 1
        row = blank_row(ctx, ws, row) + 1

    if company_note:
        row += 1
        ws.merge_range(row, LBL, row, NOTE, company_note, fmt.note_wrap)
        ws.set_row(row, 30)

    ws.freeze_panes(HEADER_ROW + 1, LBL + 1)
    ws.set_landscape()
    ws.fit_to_pages(1, 0)


def active_ref(ctx: WorkbookContext, key: str) -> str:
    """Fully-qualified reference to the Active-column cell for assumption `key`."""
    return ctx.ref_cell("Assumptions", key, ACTIVE)


def base_ref(ctx: WorkbookContext, key: str) -> str:
    return ctx.ref_cell("Assumptions", key, BASE)
