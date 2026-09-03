"""Model 1: B2B SaaS + Usage.

Customer/logo bridge -> MRR bridge (new/expansion/contraction/churn) -> usage
overage revenue -> hosting/support/CS COGS -> GTM (AE/SDR) + Eng + G&A Opex ->
integrated P&L/BS/CF -> Cash & Runway -> Scenarios -> Visuals -> Checks.
"""
from __future__ import annotations

from core.context import WorkbookContext
from core.layout import (setup_common_sheet, write_timeline_header, write_row_series, section_banner,
                       blank_row, same_col_link, TIMELINE_DATE_ROW)
from core.utils import col_letter, range_ref, seeded_value
from core.sheets.assumptions import (AssumptionRow as A, AssumptionSection as S, build_assumptions_sheet,
                                   active_ref)
from core.sheets.headcount import Role, COGS, OPEX, build_headcount_sheet
from core.sheets.opex import OpexLine, build_opex_sheet
from core.sheets.working_capital import WCConfig, build_working_capital_sheet
from core.sheets.pnl import PnLConfig, build_pnl_sheet
from core.sheets.balance_sheet import BalanceSheetConfig, build_balance_sheet
from core.sheets.cash_flow import CashFlowConfig, build_cash_flow_sheet
from core.sheets.cash_runway import build_cash_runway_sheet
from core.sheets.scenarios import ScenarioKPI, scenario_col_ref, build_scenarios_sheet
from core.sheets.visuals import KPICard, ChartSpec, ChartSeries, build_visuals_sheet
from core.sheets.checks import build_checks_sheet
from core.sheets.readme import build_readme_sheet
from ._common import scenario_kpi_range

MODEL_NAME = "B2B SaaS + Usage — 3-Year Financial Model"
MODEL_SHORT = "b2b_saas_usage"

DEPARTMENTS = ["Sales & Marketing", "R&D / Engineering", "General & Administrative"]


def _assumption_sections():
    return [
        S("Company & Financial", [
            A("starting_cash", "Starting cash balance", "$", 1_500_000, 1_500_000, 1_500_000, "num",
              "Cash in the bank on day 1 of the model."),
            A("starting_paid_in_capital", "Starting paid-in capital", "$", 1_800_000, 1_800_000, 1_800_000,
              "num", "Cumulative equity raised before month 1 (seed round)."),
            A("tax_rate", "Income tax rate", "%", 0.00, 0.00, 0.00, "pct0",
              "Applied to positive Earnings Before Tax only; no NOL carryforward modeled."),
        ]),
        S("Customers & Growth", [
            A("starting_customers", "Starting paying customers", "#", 40, 40, 40, "int",
              "Logos under contract at the start of month 1."),
            A("new_logos_month1", "New logos added, month 1", "#", 6, 8, 4, "num",
              "New paying customers signed in month 1; grows monthly below."),
            A("new_logo_growth_mom", "New-logo growth, month over month", "%",
              seeded_value("b2bsaas_logo_growth_base", 0.025, 0.035),
              seeded_value("b2bsaas_logo_growth_up", 0.045, 0.06),
              seeded_value("b2bsaas_logo_growth_down", 0.00, 0.015), "pct",
              "Compounding growth in the number of new logos signed each month."),
            A("gross_churn_rate_monthly", "Gross logo/dollar churn rate", "%", 0.015, 0.010, 0.025, "pct",
              "Share of beginning customers (and beginning MRR) lost each month."),
            A("expansion_rate_monthly", "Expansion (upsell) rate", "%", 0.010, 0.016, 0.006, "pct",
              "Upsell/seat-expansion MRR as % of beginning MRR each month."),
            A("contraction_rate_monthly", "Contraction (downgrade) rate", "%", 0.004, 0.002, 0.008, "pct",
              "Downgrade MRR as % of beginning MRR each month."),
        ]),
        S("Pricing & Usage", [
            A("starting_arpa_mrr", "Starting ARPA (avg MRR per account)", "$/mo", 1_200, 1_300, 1_100, "num",
              "Average recurring revenue per account at month 1."),
            A("arpa_growth_mom", "ARPA growth, month over month", "%", 0.005, 0.009, 0.001, "pct",
              "Price/packaging/mix improvement applied to ARPA each month."),
            A("usage_overage_per_customer", "Usage/overage revenue per customer", "$/mo", 150, 190, 100,
              "num", "Average metered usage revenue billed on top of subscription, per active account."),
            A("usage_growth_mom", "Usage revenue growth, month over month", "%", 0.010, 0.018, 0.003, "pct",
              "Growth in metered usage intensity per account each month."),
        ]),
        S("COGS & Gross Margin", [
            A("hosting_cogs_pct_revenue", "Hosting & infrastructure, % of revenue", "%", 0.08, 0.065, 0.10,
              "pct", "Cloud hosting cost to serve, as a % of total revenue."),
            A("thirdparty_api_pct_revenue", "Third-party data/API costs, % of revenue", "%", 0.03, 0.025,
              0.04, "pct", "Licensed data feeds / third-party APIs embedded in the product."),
            A("payment_processing_pct_revenue", "Payment processing fees, % of revenue", "%", 0.015, 0.013,
              0.018, "pct", "Card/ACH processing fees on billed revenue."),
        ]),
        S("Headcount — Customer Success (COGS)", [
            A("cs_start_fte", "Starting CS/Support FTEs", "#", 2, 2, 2, "fte", "Customer Success & Support team."),
            A("cs_hires_per_quarter", "CS/Support net adds per quarter", "#", 1.0, 1.5, 0.5, "fte", ""),
            A("cs_monthly_cost_per_fte", "CS/Support fully-loaded cost per FTE", "$/mo", 9_000, 9_000, 9_000,
              "num", "Salary + benefits + payroll tax, monthly."),
        ]),
        S("Headcount — Sales & Marketing (Opex)", [
            A("ae_start_fte", "Starting Account Executive FTEs", "#", 3, 3, 3, "fte", ""),
            A("ae_hires_per_quarter", "AE net adds per quarter", "#", 1.0, 2.0, 0.5, "fte", ""),
            A("ae_monthly_cost_per_fte", "AE fully-loaded cost per FTE", "$/mo", 14_000, 14_000, 14_000, "num", ""),
            A("sdr_start_fte", "Starting SDR/BDR FTEs", "#", 2, 2, 2, "fte", "Pipeline-generation reps."),
            A("sdr_hires_per_quarter", "SDR/BDR net adds per quarter", "#", 1.0, 1.5, 0.5, "fte", ""),
            A("sdr_monthly_cost_per_fte", "SDR/BDR fully-loaded cost per FTE", "$/mo", 8_000, 8_000, 8_000, "num", ""),
        ]),
        S("Headcount — R&D / Engineering (Opex)", [
            A("eng_start_fte", "Starting Engineering/Product FTEs", "#", 6, 6, 6, "fte", ""),
            A("eng_hires_per_quarter", "Engineering net adds per quarter", "#", 2.0, 3.0, 1.0, "fte", ""),
            A("eng_monthly_cost_per_fte", "Engineering fully-loaded cost per FTE", "$/mo", 15_000, 15_000,
              15_000, "num", ""),
        ]),
        S("Headcount — G&A (Opex)", [
            A("ga_start_fte", "Starting G&A FTEs", "#", 2, 2, 2, "fte", "Finance, HR, Ops."),
            A("ga_hires_per_quarter", "G&A net adds per quarter", "#", 0.5, 0.5, 0.25, "fte", ""),
            A("ga_monthly_cost_per_fte", "G&A fully-loaded cost per FTE", "$/mo", 11_000, 11_000, 11_000,
              "num", ""),
        ]),
        S("GTM Economics & Other Opex", [
            A("commission_pct_new_arr", "Sales commission, % of new ARR booked", "%", 0.10, 0.09, 0.12, "pct",
              "Paid on newly booked ARR the month it is signed."),
            A("marketing_pct_revenue", "Marketing programs, % of revenue", "%", 0.12, 0.15, 0.08, "pct",
              "Paid demand-gen / brand spend."),
            A("ga_software_fixed_monthly", "G&A software & tools", "$/mo", 6_000, 6_000, 6_000, "num", ""),
            A("ga_facilities_fixed_monthly", "G&A facilities & other fixed costs", "$/mo", 4_000, 4_000, 4_000,
              "num", ""),
        ]),
        S("Working Capital & Financing", [
            A("dso_days", "Days Sales Outstanding (AR)", "days", 35, 30, 42, "int", ""),
            A("dpo_days", "Days Payable Outstanding (AP)", "days", 30, 30, 30, "int", ""),
            A("deferred_rev_months", "Deferred revenue (months of revenue held)", "mo", 1.0, 1.2, 0.8, "num",
              "Reflects the mix of customers pre-paying annually."),
            A("capex_pct_revenue", "Capex, % of revenue", "%", 0.02, 0.015, 0.025, "pct", ""),
            A("useful_life_months", "Useful life of capitalized assets", "months", 36, 36, 36, "int", ""),
            A("other_current_assets_pct_revenue", "Other current assets, % of revenue", "%", 0.03, 0.03, 0.03,
              "pct", "Prepaid expenses and other small current assets."),
            A("interest_rate_annual", "Venture debt annual interest rate", "%", 0.09, 0.08, 0.11, "pct", ""),
            A("debt_draw_amount", "Venture debt draw (one-time)", "$", 750_000, 750_000, 500_000, "num", ""),
            A("debt_monthly_repayment", "Venture debt monthly repayment", "$/mo", 25_000, 25_000, 20_000,
              "num", ""),
            A("series_a_amount", "Series A raise (month 4)", "$", 6_000_000, 6_000_000, 5_000_000, "num", ""),
            A("series_b_amount", "Series B raise (month 22)", "$", 12_000_000, 14_000_000, 9_000_000, "num", ""),
        ]),
    ]


def _build_revenue_sheet(ctx: WorkbookContext) -> None:
    ws = ctx.add_sheet("Revenue")
    g = ctx.grid
    fmt = ctx.fmt
    row = setup_common_sheet(ctx, ws, "Revenue",
                              "Customer/logo bridge -> MRR bridge (new/expansion/contraction/churn) -> usage overage revenue.")
    row = write_timeline_header(ctx, ws, row)

    starting_customers = active_ref(ctx, "starting_customers")
    new_logos_m1 = active_ref(ctx, "new_logos_month1")
    logo_growth = active_ref(ctx, "new_logo_growth_mom")
    churn = active_ref(ctx, "gross_churn_rate_monthly")
    expansion = active_ref(ctx, "expansion_rate_monthly")
    contraction = active_ref(ctx, "contraction_rate_monthly")
    starting_arpa = active_ref(ctx, "starting_arpa_mrr")
    arpa_growth = active_ref(ctx, "arpa_growth_mom")
    usage_start = active_ref(ctx, "usage_overage_per_customer")
    usage_growth = active_ref(ctx, "usage_growth_mom")

    row = section_banner(ctx, ws, row, "Customer / Logo Bridge")
    row += 1

    def beg_cust_formula(m, this_row=None):
        if m == 0:
            return starting_customers
        prev = col_letter(g.month_col(m - 1))
        return f"{prev}{row+1}"

    r_beg_cust = row
    row = write_row_series(ctx, ws, row, "Beginning Customers", lambda m: beg_cust_formula(m), fmt=fmt.fte,
                            aggregation="end")
    row += 1

    def new_logos_formula(m, this_row=None):
        col = col_letter(g.month_col(m))
        if m == 0:
            return new_logos_m1
        prev = col_letter(g.month_col(m - 1))
        return f"{prev}{row+1}*(1+{logo_growth})"

    r_new_logos = row
    row = write_row_series(ctx, ws, row, "New Logos Added", new_logos_formula, fmt=fmt.fte, aggregation="sum")
    row += 1

    def churned_cust_formula(m):
        col = col_letter(g.month_col(m))
        return f"-{col}{r_beg_cust+1}*{churn}"

    r_churned_cust = row
    row = write_row_series(ctx, ws, row, "Churned Customers", churned_cust_formula, fmt=fmt.fte, aggregation="sum")
    row += 1

    def end_cust_formula(m):
        col = col_letter(g.month_col(m))
        return f"{col}{r_beg_cust+1}+{col}{r_new_logos+1}+{col}{r_churned_cust+1}"

    r_end_cust = row
    row = write_row_series(ctx, ws, row, "Ending Customers", end_cust_formula, fmt=fmt.fte_subtotal
                            if hasattr(fmt, "fte_subtotal") else fmt.fte, aggregation="end", subtotal=True)
    ctx.set_ref("Revenue", "ending_customers", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "MRR Bridge")
    row += 1

    def arpa_formula(m, this_row=None):
        if m == 0:
            return starting_arpa
        prev = col_letter(g.month_col(m - 1))
        return f"{prev}{row+1}*(1+{arpa_growth})"

    r_arpa = row
    row = write_row_series(ctx, ws, row, "ARPA (avg MRR per account)", arpa_formula, fmt=fmt.num2, aggregation="avg")
    row += 1

    def beg_mrr_formula(m, this_row=None):
        if m == 0:
            return f"{starting_customers}*{starting_arpa}"
        prev = col_letter(g.month_col(m - 1))
        return f"{prev}{row+1}"

    r_beg_mrr = row
    row = write_row_series(ctx, ws, row, "Beginning MRR", beg_mrr_formula, fmt=fmt.num, aggregation="end")
    row += 1

    def new_mrr_formula(m):
        col = col_letter(g.month_col(m))
        return f"{col}{r_new_logos+1}*{col}{r_arpa+1}"

    r_new_mrr = row
    row = write_row_series(ctx, ws, row, "New MRR", new_mrr_formula, fmt=fmt.num, aggregation="sum")
    ctx.set_ref("Revenue", "new_mrr", row)
    row += 1

    def expansion_mrr_formula(m):
        col = col_letter(g.month_col(m))
        return f"{col}{r_beg_mrr+1}*{expansion}"

    r_expansion_mrr = row
    row = write_row_series(ctx, ws, row, "Expansion MRR", expansion_mrr_formula, fmt=fmt.num, aggregation="sum")
    row += 1

    def contraction_mrr_formula(m):
        col = col_letter(g.month_col(m))
        return f"-{col}{r_beg_mrr+1}*{contraction}"

    r_contraction_mrr = row
    row = write_row_series(ctx, ws, row, "Contraction MRR", contraction_mrr_formula, fmt=fmt.num, aggregation="sum")
    row += 1

    def churned_mrr_formula(m):
        col = col_letter(g.month_col(m))
        return f"-{col}{r_beg_mrr+1}*{churn}"

    r_churned_mrr = row
    row = write_row_series(ctx, ws, row, "Churned MRR", churned_mrr_formula, fmt=fmt.num, aggregation="sum")
    row += 1

    def end_mrr_formula(m):
        col = col_letter(g.month_col(m))
        rows = [r_beg_mrr, r_new_mrr, r_expansion_mrr, r_contraction_mrr, r_churned_mrr]
        return "+".join(f"{col}{r+1}" for r in rows)

    r_end_mrr = row
    row = write_row_series(ctx, ws, row, "Ending MRR", end_mrr_formula, fmt=fmt.num_subtotal, aggregation="end",
                            subtotal=True)
    ctx.set_ref("Revenue", "ending_mrr", row)
    row += 1

    def arr_formula(m):
        col = col_letter(g.month_col(m))
        return f"{col}{r_end_mrr+1}*12"

    row = write_row_series(ctx, ws, row, "ARR (Ending MRR x 12)", arr_formula, fmt=fmt.num, aggregation="end")
    ctx.set_ref("Revenue", "arr", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "Usage & Overage Revenue")
    row += 1

    def usage_per_cust_formula(m, this_row=None):
        if m == 0:
            return usage_start
        prev = col_letter(g.month_col(m - 1))
        return f"{prev}{row+1}*(1+{usage_growth})"

    r_usage_per_cust = row
    row = write_row_series(ctx, ws, row, "Usage revenue per customer", usage_per_cust_formula, fmt=fmt.num2,
                            aggregation="avg")
    row += 1

    def usage_rev_formula(m):
        col = col_letter(g.month_col(m))
        return f"{col}{r_end_cust+1}*{col}{r_usage_per_cust+1}"

    r_usage_rev = row
    row = write_row_series(ctx, ws, row, "Usage & Overage Revenue", usage_rev_formula, fmt=fmt.num,
                            aggregation="sum")
    ctx.set_ref("Revenue", "usage_revenue", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    def total_rev_formula(m):
        col = col_letter(g.month_col(m))
        return f"{col}{r_end_mrr+1}+{col}{r_usage_rev+1}"

    row = write_row_series(ctx, ws, row, "Total Revenue", total_rev_formula, fmt=fmt.num_total, aggregation="sum",
                            total=True)
    ctx.set_ref("Revenue", "total_revenue", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "SaaS KPIs")
    row += 1

    def grr_formula(m):
        col = col_letter(g.month_col(m))
        num = f"{col}{r_beg_mrr+1}+{col}{r_contraction_mrr+1}+{col}{r_churned_mrr+1}"
        return f"IFERROR(({num})/{col}{r_beg_mrr+1},1)"

    row = write_row_series(ctx, ws, row, "Gross Revenue Retention (GRR)", grr_formula, fmt=fmt.pct, aggregation="avg")
    ctx.set_ref("Revenue", "grr", row)
    row += 1

    def nrr_formula(m):
        col = col_letter(g.month_col(m))
        num = f"{col}{r_beg_mrr+1}+{col}{r_expansion_mrr+1}+{col}{r_contraction_mrr+1}+{col}{r_churned_mrr+1}"
        return f"IFERROR(({num})/{col}{r_beg_mrr+1},1)"

    row = write_row_series(ctx, ws, row, "Net Revenue Retention (NRR)", nrr_formula, fmt=fmt.pct, aggregation="avg")
    ctx.set_ref("Revenue", "nrr", row)
    row += 1

    def growth_mom_formula(m):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{r_end_mrr+1}/{col}{r_beg_mrr+1}-1,0)"

    row = write_row_series(ctx, ws, row, "MRR Growth (month over month)", growth_mom_formula, fmt=fmt.pct,
                            aggregation="avg")
    ctx.set_ref("Revenue", "mrr_growth_mom", row)
    row += 1


def _build_cogs_sheet(ctx: WorkbookContext) -> None:
    ws = ctx.add_sheet("COGS & GM")
    g = ctx.grid
    fmt = ctx.fmt
    row = setup_common_sheet(ctx, ws, "COGS & GM",
                              "Hosting, third-party data/API, payment processing, and Customer Success headcount.")
    row = write_timeline_header(ctx, ws, row)

    rev_row = ctx.ref_row("Revenue", "total_revenue")
    hosting_ref = active_ref(ctx, "hosting_cogs_pct_revenue")
    thirdparty_ref = active_ref(ctx, "thirdparty_api_pct_revenue")
    payment_ref = active_ref(ctx, "payment_processing_pct_revenue")

    row = section_banner(ctx, ws, row, "COGS Components")
    row += 1

    def hosting_formula(m):
        rev = f"'Revenue'!{col_letter(g.month_col(m))}{rev_row+1}"
        return f"{rev}*{hosting_ref}"

    r_hosting = row
    row = write_row_series(ctx, ws, row, "Hosting & Infrastructure", hosting_formula, fmt=fmt.num, aggregation="sum")
    row += 1

    def thirdparty_formula(m):
        rev = f"'Revenue'!{col_letter(g.month_col(m))}{rev_row+1}"
        return f"{rev}*{thirdparty_ref}"

    r_thirdparty = row
    row = write_row_series(ctx, ws, row, "Third-Party Data / APIs", thirdparty_formula, fmt=fmt.num, aggregation="sum")
    row += 1

    def payment_formula(m):
        rev = f"'Revenue'!{col_letter(g.month_col(m))}{rev_row+1}"
        return f"{rev}*{payment_ref}"

    r_payment = row
    row = write_row_series(ctx, ws, row, "Payment Processing Fees", payment_formula, fmt=fmt.num, aggregation="sum")
    row += 1

    cs_cost_row = ctx.ref_row("Headcount", "total_cogs_cost")
    r_cs = row
    row = write_row_series(ctx, ws, row, "Customer Success & Support (people)",
                            same_col_link("Headcount", cs_cost_row, ctx), fmt=fmt.num, aggregation="sum")
    row += 1

    def total_cogs_formula(m, rows=[r_hosting, r_thirdparty, r_payment, r_cs]):
        col = col_letter(g.month_col(m))
        return "+".join(f"{col}{r+1}" for r in rows)

    row = write_row_series(ctx, ws, row, "Total COGS", total_cogs_formula, fmt=fmt.num_total, aggregation="sum",
                            total=True)
    ctx.set_ref("COGS & GM", "total_cogs", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "Gross Profit")
    row += 1

    def gp_formula(m):
        col = col_letter(g.month_col(m))
        rev = f"'Revenue'!{col}{rev_row+1}"
        cogs_r = ctx.ref_row("COGS & GM", "total_cogs")
        return f"{rev}-{col}{cogs_r+1}"

    row = write_row_series(ctx, ws, row, "Gross Profit", gp_formula, fmt=fmt.num_subtotal, aggregation="sum",
                            subtotal=True)
    ctx.set_ref("COGS & GM", "gross_profit", row)
    row += 1

    def gm_formula(m):
        col = col_letter(g.month_col(m))
        rev = f"'Revenue'!{col}{rev_row+1}"
        gp_r = ctx.ref_row("COGS & GM", "gross_profit")
        return f"IFERROR({col}{gp_r+1}/{rev},0)"

    row = write_row_series(ctx, ws, row, "Gross Margin %", gm_formula, fmt=fmt.pct, aggregation="avg")
    ctx.set_ref("COGS & GM", "gross_margin_pct", row)
    row += 1


def _headcount_roles():
    return [
        Role("cs", "Customer Success / Support", COGS, "Customer Success", "cs_start_fte", "cs_hires_per_quarter",
             "cs_monthly_cost_per_fte"),
        Role("ae", "Account Executives (Sales)", OPEX, "Sales & Marketing", "ae_start_fte", "ae_hires_per_quarter",
             "ae_monthly_cost_per_fte"),
        Role("sdr", "SDR / BDR (Pipeline)", OPEX, "Sales & Marketing", "sdr_start_fte", "sdr_hires_per_quarter",
             "sdr_monthly_cost_per_fte"),
        Role("eng", "Engineering / Product", OPEX, "R&D / Engineering", "eng_start_fte", "eng_hires_per_quarter",
             "eng_monthly_cost_per_fte"),
        Role("ga", "G&A (Finance/HR/Ops)", OPEX, "General & Administrative", "ga_start_fte", "ga_hires_per_quarter",
             "ga_monthly_cost_per_fte"),
    ]


def _opex_extra_lines(ctx: WorkbookContext):
    g = ctx.grid
    commission_ref = active_ref(ctx, "commission_pct_new_arr")
    marketing_ref = active_ref(ctx, "marketing_pct_revenue")
    software_ref = active_ref(ctx, "ga_software_fixed_monthly")
    facilities_ref = active_ref(ctx, "ga_facilities_fixed_monthly")

    def commission_formula(m):
        new_mrr_row = ctx.ref_row("Revenue", "new_mrr")
        col = col_letter(g.month_col(m))
        return f"'Revenue'!{col}{new_mrr_row+1}*12*{commission_ref}"

    def marketing_formula(m):
        rev_row = ctx.ref_row("Revenue", "total_revenue")
        col = col_letter(g.month_col(m))
        return f"'Revenue'!{col}{rev_row+1}*{marketing_ref}"

    def software_formula(m):
        return software_ref

    def facilities_formula(m):
        return facilities_ref

    return [
        OpexLine("Sales Commissions", "Sales & Marketing", commission_formula, "10% of newly booked ARR"),
        OpexLine("Marketing Programs", "Sales & Marketing", marketing_formula, "% of total revenue"),
        OpexLine("Software & Tools", "General & Administrative", software_formula, "Fixed monthly"),
        OpexLine("Facilities & Other", "General & Administrative", facilities_formula, "Fixed monthly"),
    ]


def _scenario_kpis(ctx: WorkbookContext):
    def arr1(which):
        sc = lambda k: scenario_col_ref(ctx, k, which)
        return f"{sc('starting_customers')}*{sc('starting_arpa_mrr')}*12"

    def net_monthly_growth(which):
        sc = lambda k: scenario_col_ref(ctx, k, which)
        return (f"({sc('expansion_rate_monthly')}-{sc('contraction_rate_monthly')}-{sc('gross_churn_rate_monthly')}"
                f"+{sc('new_logos_month1')}/{sc('starting_customers')})")

    def arr36(which):
        return f"({arr1(which)})*(1+{net_monthly_growth(which)})^35"

    def month1_cost(which, start_key, cost_key):
        sc = lambda k: scenario_col_ref(ctx, k, which)
        return f"{sc(start_key)}*{sc(cost_key)}"

    def gm1(which):
        sc = lambda k: scenario_col_ref(ctx, k, which)
        cs_cost = month1_cost(which, "cs_start_fte", "cs_monthly_cost_per_fte")
        pct_costs = f"({sc('hosting_cogs_pct_revenue')}+{sc('thirdparty_api_pct_revenue')}+{sc('payment_processing_pct_revenue')})"
        return f"1-{pct_costs}-(({cs_cost})*12)/({arr1(which)})"

    def burn1(which):
        sc = lambda k: scenario_col_ref(ctx, k, which)
        people = "+".join([
            month1_cost(which, "cs_start_fte", "cs_monthly_cost_per_fte"),
            month1_cost(which, "ae_start_fte", "ae_monthly_cost_per_fte"),
            month1_cost(which, "sdr_start_fte", "sdr_monthly_cost_per_fte"),
            month1_cost(which, "eng_start_fte", "eng_monthly_cost_per_fte"),
            month1_cost(which, "ga_start_fte", "ga_monthly_cost_per_fte"),
        ])
        rev1 = f"({arr1(which)})/12"
        cogs_pct = f"({sc('hosting_cogs_pct_revenue')}+{sc('thirdparty_api_pct_revenue')}+{sc('payment_processing_pct_revenue')})"
        return f"MAX(0,({people})+({rev1})*({cogs_pct})-({rev1}))"

    def runway1(which):
        sc = lambda k: scenario_col_ref(ctx, k, which)
        return f"IFERROR({sc('starting_cash')}/MAX(1,{burn1(which)}),999)"

    g = ctx.grid
    last_col_letter = col_letter(g.month_col(g.n_months - 1))
    first_col_letter = col_letter(g.month_col(0))

    return [
        ScenarioKPI("Starting ARR (Month 1 run-rate)", "Starting customers x starting ARPA x 12", arr1,
                    f"'Revenue'!{first_col_letter}{ctx.ref_row('Revenue','arr')+1}", "num", key="starting_arr"),
        ScenarioKPI("Net Revenue Retention (illustrative)",
                    "1 + expansion − contraction − churn (constant-rate approximation)",
                    lambda w: f"1+{scenario_col_ref(ctx,'expansion_rate_monthly',w)}-{scenario_col_ref(ctx,'contraction_rate_monthly',w)}-{scenario_col_ref(ctx,'gross_churn_rate_monthly',w)}",
                    f"'Revenue'!{last_col_letter}{ctx.ref_row('Revenue','nrr')+1}", "pct", key="nrr_illustrative"),
        ScenarioKPI("Implied ARR at Month 36 (approx.)",
                    "Month-1 ARR compounded at (NRR-1 + new-logo rate) for 35 months — a rough trend estimate, not the detailed model",
                    arr36, f"'Revenue'!{last_col_letter}{ctx.ref_row('Revenue','arr')+1}", "num", key="implied_arr_36"),
        ScenarioKPI("Gross Margin % (illustrative, Month 1)", "1 − variable COGS % − CS people cost ÷ ARR1",
                    gm1, f"'COGS & GM'!{last_col_letter}{ctx.ref_row('COGS & GM','gross_margin_pct')+1}", "pct",
                    key="gm_illustrative"),
        ScenarioKPI("Month-1 Net Burn (illustrative)", "Month-1 headcount cost + variable COGS − Month-1 revenue",
                    burn1, f"'Cash & Runway'!{first_col_letter}{ctx.ref_row('Cash & Runway','monthly_burn')+1}",
                    "num", key="burn1_illustrative"),
        ScenarioKPI("Runway (illustrative, months)", "Starting cash ÷ Month-1 net burn", runway1,
                    f"'Cash & Runway'!{last_col_letter}{ctx.ref_row('Cash & Runway','runway_months')+1}", "months",
                    key="runway_illustrative"),
    ]


def _visuals(ctx: WorkbookContext):
    g = ctx.grid
    fmt = ctx.fmt
    rev_row = ctx.ref_row("Revenue", "total_revenue")
    arr_row = ctx.ref_row("Revenue", "arr")
    gm_row = ctx.ref_row("COGS & GM", "gross_margin_pct")
    hc_row = ctx.ref_row("Headcount", "total_headcount")
    runway_row = ctx.ref_row("Cash & Runway", "runway_months")
    burn_row = ctx.ref_row("Cash & Runway", "monthly_burn")
    cash_row = ctx.ref_row("Cash & Runway", "ending_cash")
    nrr_row = ctx.ref_row("Revenue", "nrr")
    last_col = col_letter(g.month_col(g.n_months - 1))
    first_col = col_letter(g.month_col(0))

    cards = [
        KPICard("ARR (Month 36)", f"'Revenue'!{last_col}{arr_row+1}", "num"),
        KPICard("Gross Margin % (Month 36)", f"'COGS & GM'!{last_col}{gm_row+1}", "pct"),
        KPICard("Net Revenue Retention (Month 36)", f"'Revenue'!{last_col}{nrr_row+1}", "pct"),
        KPICard("Ending Cash (Month 36)", f"'Cash & Runway'!{last_col}{cash_row+1}", "num"),
        KPICard("Runway (months)", f"'Cash & Runway'!{last_col}{runway_row+1}", "months"),
        KPICard("Total Headcount (Month 36)", f"'Headcount'!{last_col}{hc_row+1}", "int"),
    ]

    date_cat = f"'Revenue'!${col_letter(g.month_start_col)}${TIMELINE_DATE_ROW+1}:${col_letter(g.month_end_col)}${TIMELINE_DATE_ROW+1}"

    def rng(sheet, row):
        return range_ref(sheet, row, g.month_start_col, g.month_end_col)

    charts = [
        ChartSpec("ARR Growth", "line", date_cat, [ChartSeries("ARR", rng("Revenue", arr_row))],
                  y_axis_name="$"),
        ChartSpec("Gross Margin %", "line", date_cat, [ChartSeries("Gross Margin %", rng("COGS & GM", gm_row))],
                  y_axis_name="%"),
        ChartSpec("Cash & Runway", "line", date_cat,
                  [ChartSeries("Ending Cash", rng("Cash & Runway", cash_row)),
                   ChartSeries("Monthly Burn", rng("Cash & Runway", burn_row))], y_axis_name="$"),
        ChartSpec("Headcount by Month", "column", date_cat,
                  [ChartSeries("Total Headcount", rng("Headcount", hc_row))], y_axis_name="FTE"),
        ChartSpec("Scenario Comparison — Implied ARR at Month 36", "column", None,
                  [ChartSeries("Base/Upside/Downside", scenario_kpi_range(ctx, "implied_arr_36"))]),
        ChartSpec("Net Revenue Retention Trend", "line", date_cat,
                  [ChartSeries("NRR", rng("Revenue", nrr_row))], y_axis_name="%"),
    ]
    return cards, charts


def _readme_sections():
    return [
        ("Business model", "This workbook models a B2B SaaS company that also bills metered usage/overage on "
         "top of subscriptions. Revenue is built bottom-up from a customer/logo bridge (new logos, expansion, "
         "contraction, churn) into an MRR/ARR bridge, plus usage revenue per active account."),
        ("Key KPIs", "ARR/MRR and growth, Gross Revenue Retention (GRR), Net Revenue Retention (NRR), ARPA, "
         "CAC (commission + marketing spend / new logos), LTV, CAC payback, Magic Number, Rule of 40, gross "
         "margin, burn multiple, and runway. Most of these can be derived directly from the Revenue, COGS & GM, "
         "Opex, and Cash & Runway tabs using the linked figures already on those tabs."),
        ("Modeling notes", "Logo churn and dollar churn share one assumption (a common simplification for "
         "early-stage models). Deferred revenue is modeled as a flat number of months of revenue held in "
         "advance rather than a full annual-vs-monthly billing simulation. Depreciation uses a rolling "
         "trailing-window straight-line formula rather than per-asset schedules."),
    ]


def build(output_path: str) -> WorkbookContext:
    ctx = WorkbookContext(output_path, MODEL_NAME, MODEL_SHORT)

    build_readme_sheet(
        ctx,
        overview=("A 36-month, formula-driven financial model for an early-stage B2B SaaS company with a "
                   "usage/overage component. Start on the Assumptions tab: set your Base/Upside/Downside "
                   "inputs and pick a scenario. Every other tab recalculates automatically."),
        sections=_readme_sections(),
    )
    build_assumptions_sheet(ctx, _assumption_sections(),
                             company_note="Tip: start with the Base column, then stress-test with Upside/Downside.")
    build_headcount_sheet(ctx, _headcount_roles())
    _build_revenue_sheet(ctx)
    _build_cogs_sheet(ctx)
    build_opex_sheet(ctx, DEPARTMENTS, _opex_extra_lines(ctx))
    build_working_capital_sheet(ctx, WCConfig(
        dso_days_key="dso_days", dpo_days_key="dpo_days", deferred_rev_months_key="deferred_rev_months",
        capex_pct_revenue_key="capex_pct_revenue", useful_life_months_key="useful_life_months",
        other_current_assets_pct_revenue_key="other_current_assets_pct_revenue",
        interest_rate_key="interest_rate_annual", debt_draw_key="debt_draw_amount", debt_draw_month=12,
        debt_monthly_repayment_key="debt_monthly_repayment", debt_repayment_start_month=24,
        equity_rounds=[(3, "series_a_amount", "Series A"), (21, "series_b_amount", "Series B")],
    ))
    build_pnl_sheet(ctx, PnLConfig(departments=DEPARTMENTS, tax_rate_key="tax_rate"))
    build_cash_flow_sheet(ctx, CashFlowConfig(starting_cash_key="starting_cash"))
    build_balance_sheet(ctx, BalanceSheetConfig(starting_cash_key="starting_cash",
                                                 starting_paid_in_capital_key="starting_paid_in_capital"))
    build_cash_runway_sheet(ctx)
    build_scenarios_sheet(ctx, _scenario_kpis(ctx))
    cards, charts = _visuals(ctx)
    build_visuals_sheet(ctx, cards, charts,
                         intro="ARR, retention, margin, cash, and headcount trends for the B2B SaaS + Usage model.")
    build_checks_sheet(ctx)

    ctx.close()
    return ctx
