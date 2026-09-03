"""Generic Scenarios tab.

Shows a fast, side-by-side Base / Upside / Downside comparison of headline
KPIs computed directly from the Assumptions tab's Base/Upside/Downside
columns (a simplified analytical approximation), plus a cross-check column
linking to the fully detailed 36-month model, which always reflects
whichever scenario is currently selected on the Assumptions tab.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, List, Optional

from ..context import WorkbookContext
from ..layout import setup_common_sheet, section_banner, blank_row
from ..sheets.assumptions import BASE, UP, DOWN
from ..utils import col_letter, SCENARIOS

WhichFormula = Callable[[str], str]  # which in {'Base','Upside','Downside'} -> formula (no leading '=')

_COL_FOR_WHICH = {"Base": BASE, "Upside": UP, "Downside": DOWN}


def scenario_col_ref(ctx: WorkbookContext, key: str, which: str) -> str:
    return ctx.ref_cell("Assumptions", key, _COL_FOR_WHICH[which])


@dataclass
class ScenarioKPI:
    label: str
    note: str
    formula_fn: WhichFormula          # which -> formula string (approximate, uses Assumptions Base/Up/Down cols)
    full_model_formula: Optional[str] = None  # formula string for the "Full model (selected)" column
    fmt: str = "num"
    key: Optional[str] = None         # if set, row is registered in ctx.refs['Scenarios'][key]


LBL, NOTE, C_BASE, C_UP, C_DOWN, C_FULL = 0, 1, 2, 3, 4, 5


def build_scenarios_sheet(ctx: WorkbookContext, kpis: List[ScenarioKPI]) -> None:
    ws = ctx.add_sheet("Scenarios")
    fmt = ctx.fmt
    ws.set_column(LBL, LBL, 34)
    ws.set_column(NOTE, NOTE, 42)
    ws.set_column(C_BASE, C_FULL, 18)

    ws.merge_range(0, 0, 0, C_FULL, f"  {ctx.model_name} — Scenario Comparison", fmt.title_bar)
    ws.set_row(0, 22)
    ws.merge_range(1, 0, 1, C_FULL,
                   "  Base/Upside/Downside columns are a fast analytical approximation for side-by-side "
                   "comparison. The 'Full model' column reflects the detailed 36-month model at the "
                   "scenario currently selected on the Assumptions tab.", fmt.subtitle_bar)
    ws.set_row(1, 28)

    ws.write(3, 0, "Currently selected scenario:", fmt.section_header)
    ws.write_formula(3, 2, f"={ctx.scalars['scenario_selector']}", fmt.selector)

    row = 5
    ws.write(row, LBL, "KPI", fmt.column_header)
    ws.write(row, NOTE, "Definition", fmt.column_header)
    ws.write(row, C_BASE, "Base", fmt.column_header)
    ws.write(row, C_UP, "Upside", fmt.column_header)
    ws.write(row, C_DOWN, "Downside", fmt.column_header)
    ws.write(row, C_FULL, "Full model (selected)", fmt.column_header)
    row += 1

    def fmt_for(kind):
        return {"num": fmt.num, "pct": fmt.pct, "int": fmt.intnum, "mult": fmt.mult,
                "months": fmt.months_fmt, "text": fmt.text}.get(kind, fmt.num)

    for kpi in kpis:
        ws.write(row, LBL, kpi.label, fmt.label_bold)
        ws.write(row, NOTE, kpi.note, fmt.note_wrap)
        value_fmt = fmt_for(kpi.fmt)
        for which, col in [("Base", C_BASE), ("Upside", C_UP), ("Downside", C_DOWN)]:
            formula = kpi.formula_fn(which)
            ws.write_formula(row, col, "=" + formula, value_fmt)
        if kpi.full_model_formula:
            ws.write_formula(row, C_FULL, "=" + kpi.full_model_formula, value_fmt)
        else:
            ws.write(row, C_FULL, "n/a", fmt.note)
        if kpi.key:
            ctx.set_ref("Scenarios", kpi.key, row)
        row += 1

    row += 1
    ws.merge_range(row, LBL, row, C_FULL, "  Scenario Validity", fmt.section_header)
    row += 1
    ws.write(row, LBL, "Selector value is valid (Base/Upside/Downside)?", fmt.label)
    ws.write_formula(row, C_BASE,
                      f"=IF(ISNUMBER(MATCH({ctx.scalars['scenario_selector']},{{\"Base\",\"Upside\",\"Downside\"}},0)),\"OK\",\"INVALID\")",
                      fmt.text)
    ctx.set_ref("Scenarios", "selector_validity", row)
    row += 1
