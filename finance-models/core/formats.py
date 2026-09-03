"""Centralized color palette and cell formats (GitHub / Copilot brand colors).

All workbook builders pull formats from a single `Formats` instance so that
every generated file looks consistent regardless of business model.
"""
from __future__ import annotations

from dataclasses import dataclass


PALETTE = {
    "purple": "#7B68EE",
    "blue": "#49CCF9",
    "teal": "#79D9B9",
    "pink": "#FD71AF",
    "orange": "#FFB08E",
    "ink": "#1B1F2A",       # near-black text
    "white": "#FFFFFF",
    "bg_light": "#F7F8FC",  # page background tint
    "bg_band": "#EEF0FA",   # alternating band
    "grid": "#D7DAE6",
    "note_gray": "#6B7280",
    "input_blue": "#1B5FD6",  # font color for input cells (blue inputs)
    "good_green": "#1E8A5F",
    "bad_red": "#C0392B",
}

NUMBER_FMT_USD0 = '#,##0;(#,##0)'
NUMBER_FMT_USD2 = '#,##0.00;(#,##0.00)'
NUMBER_FMT_USD_K = '#,##0,"K";(#,##0,"K")'
NUMBER_FMT_PCT1 = '0.0%;(0.0%)'
NUMBER_FMT_PCT0 = '0%;(0%)'
NUMBER_FMT_INT = '#,##0;(#,##0)'
NUMBER_FMT_MULT = '0.00"x"'
NUMBER_FMT_MONTHS = '#,##0.0" mo"'
NUMBER_FMT_DATE = 'mmm-yy'


@dataclass
class Formats:
    wb: object

    def __post_init__(self):
        wb = self.wb
        base_font = "Calibri"

        def f(**kw):
            d = dict(font_name=base_font, font_size=10)
            d.update(kw)
            return wb.add_format(d)

        # ---- Structural / chrome ----
        self.title_bar = f(bold=True, font_color=PALETTE["white"], bg_color=PALETTE["ink"],
                            font_size=14, valign="vcenter", indent=1)
        self.subtitle_bar = f(italic=True, font_color=PALETTE["white"], bg_color=PALETTE["ink"],
                               font_size=10, valign="vcenter", indent=1)
        self.section_header = f(bold=True, font_color=PALETTE["white"], bg_color=PALETTE["purple"],
                                 font_size=11, valign="vcenter", indent=1)
        self.column_header = f(bold=True, font_color=PALETTE["ink"], bg_color=PALETTE["bg_band"],
                                border=1, border_color=PALETTE["grid"], align="center", valign="vcenter")
        self.column_header_date = f(bold=True, font_color=PALETTE["ink"], bg_color=PALETTE["bg_band"],
                                     border=1, border_color=PALETTE["grid"], align="center",
                                     num_format=NUMBER_FMT_DATE)

        # ---- Labels / notes ----
        self.label = f(font_color=PALETTE["ink"])
        self.label_bold = f(font_color=PALETTE["ink"], bold=True)
        self.label_indent = f(font_color=PALETTE["ink"], indent=1)
        self.subtotal_label = f(font_color=PALETTE["ink"], bold=True, top=1, top_color=PALETTE["grid"])
        self.total_label = f(font_color=PALETTE["white"], bold=True, bg_color=PALETTE["ink"])
        self.note = f(italic=True, font_color=PALETTE["note_gray"], font_size=9)
        self.note_wrap = f(italic=True, font_color=PALETTE["note_gray"], font_size=9, text_wrap=True,
                            valign="top")

        # ---- Values: formula (black) vs input (blue) ----
        self.num = f(font_color=PALETTE["ink"], num_format=NUMBER_FMT_USD0)
        self.num2 = f(font_color=PALETTE["ink"], num_format=NUMBER_FMT_USD2)
        self.pct = f(font_color=PALETTE["ink"], num_format=NUMBER_FMT_PCT1)
        self.pct0 = f(font_color=PALETTE["ink"], num_format=NUMBER_FMT_PCT0)
        self.intnum = f(font_color=PALETTE["ink"], num_format=NUMBER_FMT_INT)
        self.mult = f(font_color=PALETTE["ink"], num_format=NUMBER_FMT_MULT)
        self.months_fmt = f(font_color=PALETTE["ink"], num_format=NUMBER_FMT_MONTHS)
        self.text = f(font_color=PALETTE["ink"])
        self.fte = f(font_color=PALETTE["ink"], num_format='#,##0.0')
        self.input_fte = f(font_color=PALETTE["input_blue"], num_format='#,##0.0', bg_color="#F5F8FF")

        self.input_num = f(font_color=PALETTE["input_blue"], num_format=NUMBER_FMT_USD0,
                            bg_color="#F5F8FF")
        self.input_pct = f(font_color=PALETTE["input_blue"], num_format=NUMBER_FMT_PCT1,
                            bg_color="#F5F8FF")
        self.input_pct0 = f(font_color=PALETTE["input_blue"], num_format=NUMBER_FMT_PCT0,
                             bg_color="#F5F8FF")
        self.input_int = f(font_color=PALETTE["input_blue"], num_format=NUMBER_FMT_INT,
                            bg_color="#F5F8FF")
        self.input_mult = f(font_color=PALETTE["input_blue"], num_format=NUMBER_FMT_MULT,
                             bg_color="#F5F8FF")
        self.input_text = f(font_color=PALETTE["input_blue"], bg_color="#F5F8FF")
        self.input_date = f(font_color=PALETTE["input_blue"], bg_color="#F5F8FF",
                             num_format=NUMBER_FMT_DATE)

        # ---- Subtotal / total numeric rows ----
        self.num_subtotal = f(font_color=PALETTE["ink"], bold=True, num_format=NUMBER_FMT_USD0,
                               top=1, top_color=PALETTE["grid"])
        self.num_total = f(font_color=PALETTE["white"], bold=True, bg_color=PALETTE["ink"],
                            num_format=NUMBER_FMT_USD0)
        self.pct_total = f(font_color=PALETTE["white"], bold=True, bg_color=PALETTE["ink"],
                            num_format=NUMBER_FMT_PCT1)

        # ---- Checks ----
        self.check_pass = f(font_color=PALETTE["white"], bold=True, bg_color=PALETTE["good_green"],
                             align="center")
        self.check_fail = f(font_color=PALETTE["white"], bold=True, bg_color=PALETTE["bad_red"],
                             align="center")
        self.check_num = f(font_color=PALETTE["ink"], num_format='0.0000')

        # ---- KPI cards (Visuals tab) ----
        self.kpi_label = f(font_color=PALETTE["white"], bg_color=PALETTE["purple"], bold=True,
                            align="center", valign="vcenter", font_size=10)
        self.kpi_value = f(font_color=PALETTE["ink"], bg_color=PALETTE["bg_light"], bold=True,
                            align="center", valign="vcenter", font_size=16, border=1,
                            border_color=PALETTE["grid"])
        self.kpi_value_pct = f(font_color=PALETTE["ink"], bg_color=PALETTE["bg_light"], bold=True,
                                align="center", valign="vcenter", font_size=16, border=1,
                                border_color=PALETTE["grid"], num_format=NUMBER_FMT_PCT1)

        # ---- Scenario selector ----
        self.selector = f(font_color=PALETTE["input_blue"], bold=True, bg_color="#FFF7E6",
                           border=2, border_color=PALETTE["orange"], align="center")

        # ---- Read Me ----
        self.readme_h1 = f(bold=True, font_size=16, font_color=PALETTE["purple"])
        self.readme_h2 = f(bold=True, font_size=12, font_color=PALETTE["ink"])
        self.readme_body = f(font_size=10, font_color=PALETTE["ink"], text_wrap=True, valign="top")

        # legend swatches
        self.legend_input = f(bg_color="#F5F8FF", font_color=PALETTE["input_blue"], border=1,
                               border_color=PALETTE["grid"], align="center")
        self.legend_formula = f(bg_color=PALETTE["white"], font_color=PALETTE["ink"], border=1,
                                 border_color=PALETTE["grid"], align="center")
        self.legend_link = f(bg_color=PALETTE["bg_band"], font_color=PALETTE["ink"], border=1,
                              border_color=PALETTE["grid"], align="center")
