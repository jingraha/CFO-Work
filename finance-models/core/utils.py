"""Small, dependency-free helper utilities shared across the engine."""
from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass, field
from typing import List


def col_letter(col_idx: int) -> str:
    """Convert a zero-based column index to an Excel column letter (0 -> A)."""
    letters = ""
    n = col_idx + 1
    while n > 0:
        n, rem = divmod(n - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def cell(row_idx: int, col_idx: int, row_abs: bool = False, col_abs: bool = False) -> str:
    """Return an A1-style reference for zero-based (row, col)."""
    c = ("$" if col_abs else "") + col_letter(col_idx)
    r = ("$" if row_abs else "") + str(row_idx + 1)
    return f"{c}{r}"


def sheet_ref(sheet_name: str, row_idx: int, col_idx: int, row_abs: bool = True, col_abs: bool = True) -> str:
    """Return a fully-qualified '<Sheet>'!$A$1-style reference."""
    return f"'{sheet_name}'!{cell(row_idx, col_idx, row_abs, col_abs)}"


def range_ref(sheet_name: str, row_idx: int, col_start: int, col_end: int, row_abs: bool = True) -> str:
    """Return a fully-qualified range reference across a row, e.g. Revenue!$C$5:$AL$5."""
    a = sheet_ref(sheet_name, row_idx, col_start, row_abs=row_abs, col_abs=True)
    b = sheet_ref(sheet_name, row_idx, col_end, row_abs=row_abs, col_abs=True).split("!")[1]
    return f"{a}:{b}"


@dataclass
class MonthGrid:
    """Defines the 36-month monthly timeline plus quarterly/annual summary blocks.

    Layout (0-based column indices):
      col 0        : row label
      col 1        : unit / note
      col 2 .. 37  : 36 monthly columns (Month 1 .. Month 36)
      col 38       : blank separator
      col 39 .. 50 : 12 quarterly summary columns (Q1 .. Q12)
      col 51       : blank separator
      col 52 .. 54 : 3 annual summary columns (Yr 1 .. Yr 3)
    """

    n_months: int = 36
    start_year: int = 2026
    start_month: int = 1
    label_col: int = 0
    note_col: int = 1
    month_start_col: int = 2

    @property
    def month_end_col(self) -> int:
        return self.month_start_col + self.n_months - 1

    @property
    def quarter_sep_col(self) -> int:
        return self.month_end_col + 1

    @property
    def quarter_start_col(self) -> int:
        return self.quarter_sep_col + 1

    @property
    def n_quarters(self) -> int:
        return self.n_months // 3

    @property
    def quarter_end_col(self) -> int:
        return self.quarter_start_col + self.n_quarters - 1

    @property
    def year_sep_col(self) -> int:
        return self.quarter_end_col + 1

    @property
    def year_start_col(self) -> int:
        return self.year_sep_col + 1

    @property
    def n_years(self) -> int:
        return self.n_months // 12

    @property
    def year_end_col(self) -> int:
        return self.year_start_col + self.n_years - 1

    @property
    def last_col(self) -> int:
        return self.year_end_col

    def month_dates(self) -> List[_dt.date]:
        dates = []
        y, m = self.start_year, self.start_month
        for _ in range(self.n_months):
            dates.append(_dt.date(y, m, 1))
            m += 1
            if m > 12:
                m = 1
                y += 1
        return dates

    def month_col(self, month_idx: int) -> int:
        """0-based column for month_idx (0-based, 0..n_months-1)."""
        return self.month_start_col + month_idx

    def quarter_col(self, quarter_idx: int) -> int:
        return self.quarter_start_col + quarter_idx

    def year_col(self, year_idx: int) -> int:
        return self.year_start_col + year_idx

    def months_in_quarter(self, quarter_idx: int):
        return range(quarter_idx * 3, quarter_idx * 3 + 3)

    def months_in_year(self, year_idx: int):
        return range(year_idx * 12, year_idx * 12 + 12)


SCENARIOS = ["Base", "Upside", "Downside"]


def seeded_value(seed_key: str, low: float, high: float) -> float:
    """Deterministic pseudo-random value in [low, high] derived from a string key.

    Used only to give assumption defaults a small amount of realistic
    variation without relying on Python's `random` module state (keeps
    generation fully reproducible run to run).
    """
    h = 2166136261
    for ch in seed_key:
        h = (h ^ ord(ch)) * 16777619 & 0xFFFFFFFF
    frac = (h % 10000) / 10000.0
    return round(low + frac * (high - low), 4)
