"""Workbook context: shared state passed to every sheet builder.

`WorkbookContext` owns the xlsxwriter Workbook, the Formats bundle, the
MonthGrid timeline, and a `refs` registry that lets later sheets (e.g. the
P&L) look up exactly which row on an earlier sheet (e.g. Revenue) holds the
"Total Revenue" line, without the sheets needing to import each other.
"""
from __future__ import annotations

from typing import Dict, List, Optional

import xlsxwriter

from .formats import Formats, PALETTE
from .utils import MonthGrid, SCENARIOS, col_letter, cell, sheet_ref, range_ref

SHEET_ORDER = [
    "Read Me", "Assumptions", "Headcount", "Revenue", "COGS & GM", "Opex",
    "Working Capital", "P&L", "Balance Sheet", "Cash Flow", "Cash & Runway",
    "Scenarios", "Visuals", "Checks",
]


class WorkbookContext:
    def __init__(self, filename: str, model_name: str, model_short: str):
        self.filename = filename
        self.model_name = model_name
        self.model_short = model_short
        self.wb = xlsxwriter.Workbook(filename, {"default_date_format": "mmm-yy"})
        self.wb.set_calc_mode("auto")
        self.wb.set_size(2200, 1200)
        self.fmt = Formats(self.wb)
        self.grid = MonthGrid()
        self.sheets: Dict[str, "xlsxwriter.worksheet.Worksheet"] = {}
        # refs[sheet_key][line_key] = 0-based row index
        self.refs: Dict[str, Dict[str, int]] = {}
        # scalar single-cell refs, e.g. ctx.scalars['scenario_selector'] = 'Assumptions!$C$4'
        self.scalars: Dict[str, str] = {}
        self.check_ranges: List[str] = []  # list of 'Sheet'!A1:A1 ranges to scan for #ERR in Checks
        self.check_rows: List[dict] = []  # list of dicts describing a numeric check row

    # ------------------------------------------------------------------
    def add_sheet(self, name: str) -> "xlsxwriter.worksheet.Worksheet":
        ws = self.wb.add_worksheet(name[:31])
        self.sheets[name] = ws
        self.refs.setdefault(name, {})
        ws.hide_gridlines(2)
        ws.set_zoom(110)
        return ws

    def set_ref(self, sheet: str, key: str, row: int) -> None:
        self.refs.setdefault(sheet, {})[key] = row

    def ref_row(self, sheet: str, key: str) -> int:
        return self.refs[sheet][key]

    def ref_cell(self, sheet: str, key: str, col: int, row_abs=True, col_abs=True) -> str:
        row = self.ref_row(sheet, key)
        return sheet_ref(sheet, row, col, row_abs=row_abs, col_abs=col_abs)

    def ref_range(self, sheet: str, key: str, col_start: int, col_end: int) -> str:
        row = self.ref_row(sheet, key)
        return range_ref(sheet, row, col_start, col_end)

    def close(self):
        self.wb.close()
