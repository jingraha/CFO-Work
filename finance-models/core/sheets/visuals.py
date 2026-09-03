"""Generic Visuals tab: KPI cards + charts. Model modules supply the exact
KPI formulas and chart data ranges (which reference rows already written on
other tabs), so the mechanics of laying out cards/charts stay identical
across all four business models.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from ..context import WorkbookContext
from ..formats import PALETTE

CARD_W = 3   # columns spanned by one KPI card
CARD_H = 4   # rows spanned by one KPI card (label + value)


@dataclass
class KPICard:
    label: str
    formula: str            # excel formula WITHOUT leading '='
    fmt: str = "num"         # num | pct | int | mult | months | text


@dataclass
class ChartSeries:
    name: str
    value_range: str        # fully-qualified range, e.g. "'Revenue'!$C$7:$AL$7"


@dataclass
class ChartSpec:
    title: str
    chart_type: str          # 'line' | 'column' | 'bar' | 'doughnut'
    categories: Optional[str]
    series: List[ChartSeries]
    y_axis_name: str = ""
    subtype: Optional[str] = None
    width: int = 480
    height: int = 300


def _fmt_for(ctx, kind):
    fmt = ctx.fmt
    return {"num": fmt.kpi_value, "pct": fmt.kpi_value_pct, "int": fmt.kpi_value, "mult": fmt.kpi_value,
            "months": fmt.kpi_value, "text": fmt.kpi_value}.get(kind, fmt.kpi_value)


def build_visuals_sheet(ctx: WorkbookContext, kpi_cards: List[KPICard], charts: List[ChartSpec],
                         intro: str = "") -> None:
    ws = ctx.add_sheet("Visuals")
    fmt = ctx.fmt
    n_cols = max(18, CARD_W * len(kpi_cards))
    ws.set_column(0, n_cols, 9)

    ws.merge_range(0, 0, 0, n_cols, f"  {ctx.model_name} — Visuals", fmt.title_bar)
    ws.set_row(0, 22)
    ws.merge_range(1, 0, 1, n_cols, f"  {intro}" if intro else
                   "  Headline KPIs and charts. All values are formulas linked to the model tabs.",
                   fmt.subtitle_bar)
    ws.set_row(1, 16)

    row = 3
    col = 0
    for card in kpi_cards:
        ws.merge_range(row, col, row, col + CARD_W - 1, card.label, fmt.kpi_label)
        ws.set_row(row, 20)
        ws.merge_range(row + 1, col, row + 2, col + CARD_W - 1, "", _fmt_for(ctx, card.fmt))
        ws.write_formula(row + 1, col, "=" + card.formula, _fmt_for(ctx, card.fmt))
        col += CARD_W
        if col + CARD_W > n_cols + 1:
            col = 0
            row += CARD_H

    row += CARD_H + 1
    chart_col = 0
    chart_row = row
    for i, spec in enumerate(charts):
        chart = ctx.wb.add_chart({"type": spec.chart_type, "subtype": spec.subtype} if spec.subtype
                                  else {"type": spec.chart_type})
        palette_cycle = [PALETTE["purple"], PALETTE["blue"], PALETTE["teal"], PALETTE["pink"], PALETTE["orange"]]
        for si, s in enumerate(spec.series):
            series_def = {"name": s.name, "values": s.value_range,
                          "line": {"color": palette_cycle[si % len(palette_cycle)], "width": 2.25},
                          "fill": {"color": palette_cycle[si % len(palette_cycle)]},
                          "border": {"color": "#FFFFFF"}}
            if spec.categories:
                series_def["categories"] = spec.categories
            chart.add_series(series_def)
        chart.set_title({"name": spec.title, "name_font": {"bold": True, "color": PALETTE["ink"], "size": 12}})
        chart.set_size({"width": spec.width, "height": spec.height})
        chart.set_legend({"position": "bottom"})
        if spec.y_axis_name:
            chart.set_y_axis({"name": spec.y_axis_name})
        chart.set_chartarea({"border": {"none": True}, "fill": {"color": "#FFFFFF"}})
        ws.insert_chart(chart_row, chart_col, chart)
        chart_col += 9
        if (i + 1) % 2 == 0:
            chart_col = 0
            chart_row += 17

    ws.freeze_panes(3, 0)
