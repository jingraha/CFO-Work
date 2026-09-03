"""Generic Read Me tab: model overview, how-to, formatting legend, and the
standard "planning tool, not advice" disclaimer required on every workbook.
"""
from __future__ import annotations

from typing import List, Tuple

from ..context import WorkbookContext
from ..formats import PALETTE

LBL = 0

DISCLAIMER = (
    "This workbook is a lightweight planning tool built to help you reason about unit economics, "
    "burn, and runway. It is NOT accounting, tax, or investment advice, and it is not a substitute for "
    "GAAP/IFRS-compliant books, a CPA, or legal/financial counsel. Formulas use simplified, transparent "
    "approximations (documented on each tab) rather than full cohort- or lot-level accounting. Validate "
    "every assumption against your own data before using this model for fundraising, budgeting, or "
    "compliance decisions."
)


def build_readme_sheet(ctx: WorkbookContext, overview: str, sections: List[Tuple[str, str]]) -> None:
    ws = ctx.add_sheet("Read Me")
    fmt = ctx.fmt
    ws.set_column(0, 0, 100)

    ws.write(0, 0, f"  {ctx.model_name}", fmt.title_bar)
    ws.set_row(0, 26)
    ws.write(1, 0, "  36-month integrated financial model — Read Me", fmt.subtitle_bar)
    ws.set_row(1, 18)

    row = 3
    ws.write(row, LBL, "Overview", fmt.readme_h1)
    row += 1
    ws.write(row, 0, overview, fmt.readme_body)
    ws.set_row(row, 90)
    row += 2

    ws.write(row, LBL, "How this workbook is organized", fmt.readme_h2)
    row += 1
    tabs_desc = (
        "Assumptions -> Headcount -> Revenue -> COGS & GM -> Opex -> Working Capital -> P&L -> "
        "Balance Sheet -> Cash Flow -> Cash & Runway -> Scenarios -> Visuals -> Checks. "
        "Data flows strictly left-to-right through that order: change an assumption, and every "
        "downstream tab recalculates automatically (workbook calculation mode is Automatic)."
    )
    ws.write(row, 0, tabs_desc, fmt.readme_body)
    ws.set_row(row, 45)
    row += 2

    ws.write(row, LBL, "Formatting legend", fmt.readme_h2)
    row += 1
    ws.write(row, LBL, "Blue text on light-blue fill = an input you can edit (Assumptions tab, and scenario selector).",
             fmt.legend_input)
    ws.set_row(row, 18)
    row += 1
    ws.write(row, LBL, "Black text on white = a live formula. Do not hard-code over these cells.",
             fmt.legend_formula)
    ws.set_row(row, 18)
    row += 1
    ws.write(row, LBL, "Cells on a light-gray band = a value linked in from another tab.", fmt.legend_link)
    ws.set_row(row, 18)
    row += 2

    ws.write(row, LBL, "Color palette", fmt.readme_h2)
    row += 1
    for name, hexcode in [("Purple", PALETTE["purple"]), ("Blue", PALETTE["blue"]), ("Teal", PALETTE["teal"]),
                          ("Pink", PALETTE["pink"]), ("Orange", PALETTE["orange"])]:
        swatch_fmt = ctx.wb.add_format({"bg_color": hexcode, "font_color": "#FFFFFF", "bold": True,
                                         "align": "center"})
        ws.write(row, LBL, f"{name}  ({hexcode})", swatch_fmt)
        ws.set_row(row, 16)
        row += 1
    row += 1

    for title, body in sections:
        ws.write(row, LBL, title, fmt.readme_h2)
        row += 1
        ws.write(row, 0, body, fmt.readme_body)
        lines = max(2, (len(body) // 95) + 1)
        ws.set_row(row, 15 * lines)
        row += 2

    ws.write(row, LBL, "Limitations & disclaimer", fmt.readme_h2)
    row += 1
    ws.write(row, 0, DISCLAIMER, fmt.readme_body)
    ws.set_row(row, 75)
    row += 2

    ws.write(row, LBL, "Timeline & recalculation", fmt.readme_h2)
    row += 1
    tech = ("36 monthly periods, plus quarterly (12) and annual (3) roll-up columns on each schedule tab. "
            "Workbook calculation is set to Automatic — Excel recalculates on every edit. Deterministic, "
            "seeded default assumptions are provided so the model is internally consistent out of the box; "
            "replace them with your own numbers on the Assumptions tab.")
    ws.write(row, 0, tech, fmt.readme_body)
    ws.set_row(row, 45)

    ws.freeze_panes(3, 0)
