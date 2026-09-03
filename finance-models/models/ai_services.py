"""Model 4: AI-Enabled Services.

Sales pipeline -> bookings -> backlog -> delivery-capacity-constrained revenue
recognition -> delivery-labor / subcontractor / AI-tool COGS -> operating
expenses -> integrated P&L / Balance Sheet / Cash Flow / Runway.
"""
from __future__ import annotations

from core.context import WorkbookContext
from core.layout import (
    TIMELINE_DATE_ROW,
    blank_row,
    same_col_link,
    section_banner,
    setup_common_sheet,
    write_row_series,
    write_timeline_header,
)
from core.sheets.assumptions import AssumptionRow as A
from core.sheets.assumptions import AssumptionSection as S
from core.sheets.assumptions import active_ref, build_assumptions_sheet
from core.sheets.balance_sheet import BalanceSheetConfig, build_balance_sheet
from core.sheets.cash_flow import CashFlowConfig, build_cash_flow_sheet
from core.sheets.cash_runway import build_cash_runway_sheet
from core.sheets.checks import build_checks_sheet
from core.sheets.headcount import COGS, OPEX, Role, build_headcount_sheet
from core.sheets.opex import OpexLine, build_opex_sheet
from core.sheets.pnl import PnLConfig, build_pnl_sheet
from core.sheets.readme import build_readme_sheet
from core.sheets.scenarios import ScenarioKPI, build_scenarios_sheet, scenario_col_ref
from core.sheets.visuals import ChartSeries, ChartSpec, KPICard, build_visuals_sheet
from core.sheets.working_capital import WCConfig, build_working_capital_sheet
from core.utils import col_letter, range_ref, seeded_value
from ._common import cost_of_role_month1, scenario_kpi_range

MODEL_NAME = "AI-Enabled Services — 3-Year Financial Model"
MODEL_SHORT = "ai_enabled_services"

DEPARTMENTS = ["Sales & Marketing", "General & Administrative"]


def _assumption_sections():
    return [
        S("Company & Financial", [
            A("starting_cash", "Starting cash balance", "$", 900_000, 900_000, 900_000, "num",
              "Cash on hand at the start of month 1."),
            A("starting_paid_in_capital", "Starting paid-in capital", "$", 1_250_000, 1_250_000, 1_250_000,
              "num", "Cumulative equity funded before the model begins."),
            A("tax_rate", "Income tax rate", "%", 0.00, 0.00, 0.00, "pct0",
              "Applied only to positive EBT; no NOL carryforward modeled."),
        ]),
        S("Pipeline & Bookings", [
            A("starting_backlog", "Starting signed backlog", "$", 650_000, 725_000, 500_000, "num",
              "Contracted work not yet recognized as revenue at the start of month 1."),
            A("pipeline_projects_per_sales_fte_month1", "Qualified pipeline opportunities per Sales/BD FTE, month 1",
              "#/mo", 2.4, 2.9, 1.9, "num",
              "Average proposal-ready projects each sales rep creates in month 1."),
            A("pipeline_projects_growth_mom", "Pipeline opportunities growth, month over month", "%",
              seeded_value("aiservices_pipeline_growth_base", 0.025, 0.045),
              seeded_value("aiservices_pipeline_growth_up", 0.045, 0.070),
              seeded_value("aiservices_pipeline_growth_down", -0.005, 0.015), "pct",
              "Improvement in qualified opportunities per sales rep over time from references, content, and partner channels."),
            A("proposal_win_rate", "Proposal win rate", "%", 0.34, 0.40, 0.26, "pct",
              "Share of qualified opportunities that close into signed projects."),
            A("average_project_value_month1", "Average project contract value, month 1", "$", 85_000, 95_000,
              72_000, "num", "Fixed-fee project value equivalent for a typical implementation or consulting engagement."),
            A("project_value_growth_mom", "Average project value growth, month over month", "%",
              seeded_value("aiservices_project_value_growth_base", 0.003, 0.008),
              seeded_value("aiservices_project_value_growth_up", 0.008, 0.015),
              seeded_value("aiservices_project_value_growth_down", -0.002, 0.004), "pct",
              "Mix/pricing improvement in signed project value over time."),
            A("average_project_duration_months", "Average project duration", "months", 2.5, 2.2, 3.1, "num",
              "Average time over which signed backlog converts into recognized revenue."),
        ]),
        S("Delivery & Utilization", [
            A("standard_billable_hours_per_delivery_fte_month", "Standard billable-hours capacity per Delivery FTE",
              "hrs/mo", 140, 145, 135, "int",
              "Monthly capacity before utilization and AI productivity uplift."),
            A("target_utilization_pct", "Target delivery utilization", "%", 0.72, 0.80, 0.62, "pct",
              "Share of effective delivery capacity expected to be client-billable."),
            A("realization_pct", "Realization rate", "%", 0.93, 0.97, 0.88, "pct",
              "Billed/collected rate as a % of standard rate after discounts, write-offs, and scope leakage."),
            A("blended_billing_rate_month1", "Blended billing rate, month 1", "$/hr", 195, 210, 180, "num",
              "Average realized delivery price before realization adjustments."),
            A("billing_rate_growth_mom", "Billing-rate growth, month over month", "%",
              seeded_value("aiservices_billing_rate_growth_base", 0.002, 0.006),
              seeded_value("aiservices_billing_rate_growth_up", 0.006, 0.012),
              seeded_value("aiservices_billing_rate_growth_down", -0.001, 0.003), "pct",
              "Price/mix improvement in the standard delivery rate."),
            A("ai_productivity_uplift_pct", "AI productivity uplift", "%", 0.18, 0.28, 0.08, "pct",
              "AI tooling increases effective delivery capacity without a proportional increase in headcount."),
        ]),
        S("COGS & AI Tooling", [
            A("subcontractor_pct_revenue", "Subcontractor cost, % of revenue", "%", 0.10, 0.07, 0.14, "pct",
              "External specialists used to flex delivery capacity or cover niche skills."),
            A("ai_tool_api_cost_per_delivery_fte_month", "AI tool/API cost per Delivery FTE", "$/mo", 1_450, 1_300,
              1_700, "num", "Model/API/tooling spend consumed directly in service delivery."),
        ]),
        S("Headcount — Delivery (COGS)", [
            A("delivery_start_fte", "Starting Delivery/Consulting FTEs", "#", 6, 7, 5, "num",
              "Billable consultants and implementation specialists."),
            A("delivery_hires_per_quarter", "Delivery/Consulting net adds per quarter", "#", 1.5, 2.0, 0.8, "num",
              "Net hires supporting growth in signed and delivered work."),
            A("delivery_monthly_cost_per_fte", "Delivery/Consulting fully-loaded cost per FTE", "$/mo", 12_500,
              12_500, 12_500, "num", "Salary, benefits, payroll tax, and bonus accrual."),
        ]),
        S("Headcount — Delivery Management / Solutions (COGS)", [
            A("delivery_mgmt_start_fte", "Starting Delivery Management / Solutions FTEs", "#", 1.5, 2.0, 1.0, "num",
              "Classified in COGS because this team is directly tied to project oversight and solution delivery."),
            A("delivery_mgmt_hires_per_quarter", "Delivery Management / Solutions net adds per quarter", "#", 0.5,
              0.8, 0.2, "num", "Staffing added as project volume and delivery complexity increase."),
            A("delivery_mgmt_monthly_cost_per_fte", "Delivery Management / Solutions fully-loaded cost per FTE", "$/mo",
              15_500, 15_500, 15_500, "num", "Higher-cost solution leads / delivery managers."),
        ]),
        S("Headcount — Sales / BD (Opex)", [
            A("sales_start_fte", "Starting Sales / BD FTEs", "#", 2, 2, 2, "num",
              "Quota-carrying sales and business development reps."),
            A("sales_hires_per_quarter", "Sales / BD net adds per quarter", "#", 0.75, 1.0, 0.4, "num",
              "Net rep additions supporting pipeline generation."),
            A("sales_monthly_cost_per_fte", "Sales / BD fully-loaded cost per FTE", "$/mo", 13_500, 13_500,
              13_500, "num", "Base pay, benefits, payroll tax, and bonus accrual before commissions."),
        ]),
        S("Headcount — G&A (Opex)", [
            A("ga_start_fte", "Starting G&A FTEs", "#", 2, 2, 2, "num", "Finance, ops, recruiting, and admin."),
            A("ga_hires_per_quarter", "G&A net adds per quarter", "#", 0.4, 0.5, 0.2, "num",
              "Back-office scaling as the services business grows."),
            A("ga_monthly_cost_per_fte", "G&A fully-loaded cost per FTE", "$/mo", 10_500, 10_500, 10_500, "num",
              "Salary, benefits, payroll tax, and bonus accrual."),
        ]),
        S("Sales / Opex", [
            A("sales_commission_pct_bookings", "Sales commissions, % of new bookings", "%", 0.06, 0.05, 0.07,
              "pct", "Variable sales compensation paid on signed bookings."),
            A("marketing_bd_month1", "Marketing / BD programs, month 1", "$/mo", 18_000, 22_000, 14_000, "num",
              "Events, outbound tools, content, and partner development spend."),
            A("marketing_bd_growth_mom", "Marketing / BD spend growth, month over month", "%",
              seeded_value("aiservices_marketing_growth_base", 0.004, 0.010),
              seeded_value("aiservices_marketing_growth_up", 0.008, 0.015),
              seeded_value("aiservices_marketing_growth_down", 0.000, 0.006), "pct",
              "Growth in non-people demand generation and business development spend."),
            A("software_tools_monthly", "Corporate software & tools", "$/mo", 7_500, 7_500, 7_500, "num",
              "Back-office software not directly consumed in delivery."),
            A("facilities_monthly", "Facilities & admin overhead", "$/mo", 5_500, 5_500, 5_500, "num",
              "Office, insurance, and other fixed operating overhead."),
        ]),
        S("Working Capital & Financing", [
            A("dso_days", "Days Sales Outstanding (AR)", "days", 55, 45, 65, "int",
              "Services businesses typically invoice and collect on net-30/45/60 terms."),
            A("dpo_days", "Days Payable Outstanding (AP)", "days", 30, 35, 25, "int",
              "Vendor payment timing."),
            A("deferred_rev_months", "Deferred revenue (months of revenue collected in advance)", "mo", 0.10, 0.20,
              0.00, "num", "Kept small: backlog on the Revenue tab does the primary signed-work tracking."),
            A("capex_pct_revenue", "Capex, % of revenue", "%", 0.01, 0.008, 0.015, "pct",
              "Laptop refreshes and modest internal tooling capitalization."),
            A("useful_life_months", "Useful life of capitalized assets", "months", 36, 36, 36, "int", ""),
            A("other_current_assets_pct_revenue", "Other current assets, % of revenue", "%", 0.02, 0.02, 0.025,
              "pct", "Prepaids and other small current asset balances."),
            A("interest_rate_annual", "Debt annual interest rate", "%", 0.10, 0.09, 0.12, "pct", ""),
            A("debt_draw_amount", "Debt draw (one-time)", "$", 300_000, 300_000, 200_000, "num", ""),
            A("debt_monthly_repayment", "Debt monthly repayment", "$/mo", 10_000, 10_000, 8_000, "num", ""),
            A("seed_extension_amount", "Seed extension / bridge raise (month 4)", "$", 2_000_000, 2_400_000,
              1_500_000, "num", ""),
            A("growth_equity_amount", "Growth equity raise (month 19)", "$", 4_000_000, 5_000_000, 3_000_000,
              "num", ""),
        ]),
    ]


def _headcount_roles():
    return [
        Role("delivery", "Delivery / Consulting", COGS, "Delivery", "delivery_start_fte", "delivery_hires_per_quarter",
             "delivery_monthly_cost_per_fte", "Billable consultants delivering client work."),
        Role("delivery_mgmt", "Delivery Management / Solutions", COGS, "Delivery", "delivery_mgmt_start_fte",
             "delivery_mgmt_hires_per_quarter", "delivery_mgmt_monthly_cost_per_fte",
             "Classified in COGS because the team directly supports scoped delivery."),
        Role("sales", "Sales / Business Development", OPEX, "Sales & Marketing", "sales_start_fte",
             "sales_hires_per_quarter", "sales_monthly_cost_per_fte"),
        Role("ga", "General & Administrative", OPEX, "General & Administrative", "ga_start_fte",
             "ga_hires_per_quarter", "ga_monthly_cost_per_fte"),
    ]


def _build_revenue_sheet(ctx: WorkbookContext) -> None:
    ws = ctx.add_sheet("Revenue")
    g = ctx.grid
    fmt = ctx.fmt
    row = setup_common_sheet(
        ctx,
        ws,
        "Revenue",
        "Pipeline -> bookings -> backlog -> revenue recognized as projects are delivered against capacity.",
    )
    row = write_timeline_header(ctx, ws, row)

    sales_fte_row = ctx.ref_row("Headcount", "count_sales")
    delivery_fte_row = ctx.ref_row("Headcount", "count_delivery")

    starting_backlog = active_ref(ctx, "starting_backlog")
    pipeline_projects_m1 = active_ref(ctx, "pipeline_projects_per_sales_fte_month1")
    pipeline_growth = active_ref(ctx, "pipeline_projects_growth_mom")
    win_rate = active_ref(ctx, "proposal_win_rate")
    project_value_m1 = active_ref(ctx, "average_project_value_month1")
    project_value_growth = active_ref(ctx, "project_value_growth_mom")
    avg_duration = active_ref(ctx, "average_project_duration_months")
    hours_per_fte = active_ref(ctx, "standard_billable_hours_per_delivery_fte_month")
    target_util = active_ref(ctx, "target_utilization_pct")
    realization = active_ref(ctx, "realization_pct")
    billing_rate_m1 = active_ref(ctx, "blended_billing_rate_month1")
    billing_rate_growth = active_ref(ctx, "billing_rate_growth_mom")
    ai_uplift = active_ref(ctx, "ai_productivity_uplift_pct")

    row = section_banner(ctx, ws, row, "Pipeline & Bookings")
    row += 1

    row = write_row_series(ctx, ws, row, "Sales / BD FTE", same_col_link("Headcount", sales_fte_row, ctx),
                            note="Linked from Headcount tab", fmt=fmt.fte, aggregation="end")
    sales_row = row
    ctx.set_ref("Revenue", "sales_fte", row)
    row += 1

    def pipeline_per_fte_formula(m, this_row=row):
        if m == 0:
            return pipeline_projects_m1
        prev = col_letter(g.month_col(m - 1))
        return f"{prev}{this_row + 1}*(1+{pipeline_growth})"

    row = write_row_series(ctx, ws, row, "Qualified pipeline opportunities / Sales FTE", pipeline_per_fte_formula,
                            note="Starts from month-1 assumption and compounds with go-to-market efficiency gains",
                            fmt=fmt.num2, aggregation="avg")
    pipeline_per_fte_row = row
    row += 1

    def qualified_pipeline_formula(m, sales_row=sales_row, pipeline_per_fte_row=pipeline_per_fte_row):
        col = col_letter(g.month_col(m))
        return f"{col}{sales_row + 1}*{col}{pipeline_per_fte_row + 1}"

    row = write_row_series(ctx, ws, row, "Qualified pipeline opportunities", qualified_pipeline_formula,
                            note="Sales FTE x qualified opportunities per Sales FTE", fmt=fmt.num2,
                            aggregation="sum")
    qualified_pipeline_row = row
    row += 1

    row = write_row_series(ctx, ws, row, "Proposal win rate", lambda m: win_rate,
                            note="Active scenario assumption", fmt=fmt.pct, aggregation="avg")
    win_rate_row = row
    row += 1

    def new_projects_formula(m, qualified_pipeline_row=qualified_pipeline_row, win_rate_row=win_rate_row):
        col = col_letter(g.month_col(m))
        return f"{col}{qualified_pipeline_row + 1}*{col}{win_rate_row + 1}"

    row = write_row_series(ctx, ws, row, "New projects booked", new_projects_formula,
                            note="Qualified pipeline x win rate", fmt=fmt.num2, aggregation="sum")
    new_projects_row = row
    ctx.set_ref("Revenue", "new_projects_booked", row)
    row += 1

    def project_value_formula(m, this_row=row):
        if m == 0:
            return project_value_m1
        prev = col_letter(g.month_col(m - 1))
        return f"{prev}{this_row + 1}*(1+{project_value_growth})"

    row = write_row_series(ctx, ws, row, "Average project contract value", project_value_formula,
                            note="Fixed-fee project equivalent; grows with pricing and mix", fmt=fmt.num,
                            aggregation="avg")
    project_value_row = row
    row += 1

    def new_bookings_formula(m, new_projects_row=new_projects_row, project_value_row=project_value_row):
        col = col_letter(g.month_col(m))
        return f"{col}{new_projects_row + 1}*{col}{project_value_row + 1}"

    row = write_row_series(ctx, ws, row, "New Bookings", new_bookings_formula,
                            note="New projects booked x average project value", fmt=fmt.num, aggregation="sum")
    new_bookings_row = row
    ctx.set_ref("Revenue", "new_bookings", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "Delivery Capacity")
    row += 1

    row = write_row_series(ctx, ws, row, "Delivery / Consulting FTE", same_col_link("Headcount", delivery_fte_row, ctx),
                            note="Linked from Headcount tab", fmt=fmt.fte, aggregation="end")
    delivery_row = row
    ctx.set_ref("Revenue", "delivery_fte", row)
    row += 1

    row = write_row_series(ctx, ws, row, "Standard billable-hours capacity / Delivery FTE",
                            lambda m: hours_per_fte,
                            note="Per-FTE monthly capacity before AI uplift and utilization", fmt=fmt.intnum,
                            aggregation="avg")
    hours_row = row
    row += 1

    def standard_capacity_formula(m, delivery_row=delivery_row, hours_row=hours_row):
        col = col_letter(g.month_col(m))
        return f"{col}{delivery_row + 1}*{col}{hours_row + 1}"

    row = write_row_series(ctx, ws, row, "Standard delivery capacity hours", standard_capacity_formula,
                            note="Delivery FTE x standard billable-hours capacity", fmt=fmt.num2,
                            aggregation="sum")
    standard_capacity_row = row
    ctx.set_ref("Revenue", "standard_capacity_hours", row)
    row += 1

    row = write_row_series(ctx, ws, row, "AI productivity uplift", lambda m: ai_uplift,
                            note="AI-assisted hours improve effective delivery capacity", fmt=fmt.pct,
                            aggregation="avg")
    ai_uplift_input_row = row
    row += 1

    def effective_capacity_formula(m, standard_capacity_row=standard_capacity_row, ai_uplift_input_row=ai_uplift_input_row):
        col = col_letter(g.month_col(m))
        return f"{col}{standard_capacity_row + 1}*(1+{col}{ai_uplift_input_row + 1})"

    row = write_row_series(ctx, ws, row, "Effective capacity hours (post-AI)", effective_capacity_formula,
                            note="Standard capacity x (1 + AI productivity uplift)", fmt=fmt.num2,
                            aggregation="sum")
    effective_capacity_row = row
    ctx.set_ref("Revenue", "effective_capacity_hours", row)
    row += 1

    row = write_row_series(ctx, ws, row, "Target utilization", lambda m: target_util,
                            note="Share of effective capacity expected to be client-billable", fmt=fmt.pct,
                            aggregation="avg")
    target_util_row = row
    row += 1

    def billing_rate_formula(m, this_row=row):
        if m == 0:
            return billing_rate_m1
        prev = col_letter(g.month_col(m - 1))
        return f"{prev}{this_row + 1}*(1+{billing_rate_growth})"

    row = write_row_series(ctx, ws, row, "Standard blended billing rate", billing_rate_formula,
                            note="Starting rate grown by monthly price/mix improvement", fmt=fmt.num2,
                            aggregation="avg")
    billing_rate_row = row
    row += 1

    row = write_row_series(ctx, ws, row, "Realization rate", lambda m: realization,
                            note="Collected / billed rate versus standard rate", fmt=fmt.pct,
                            aggregation="avg")
    realization_input_row = row
    row += 1

    def realized_rate_formula(m, billing_rate_row=billing_rate_row, realization_input_row=realization_input_row):
        col = col_letter(g.month_col(m))
        return f"{col}{billing_rate_row + 1}*{col}{realization_input_row + 1}"

    row = write_row_series(ctx, ws, row, "Realized billing rate", realized_rate_formula,
                            note="Standard blended rate x realization rate", fmt=fmt.num2, aggregation="avg")
    realized_rate_row = row
    ctx.set_ref("Revenue", "realized_billing_rate", row)
    row += 1

    def capacity_revenue_formula(
        m,
        effective_capacity_row=effective_capacity_row,
        target_util_row=target_util_row,
        realized_rate_row=realized_rate_row,
    ):
        col = col_letter(g.month_col(m))
        return f"{col}{effective_capacity_row + 1}*{col}{target_util_row + 1}*{col}{realized_rate_row + 1}"

    row = write_row_series(ctx, ws, row, "Revenue capacity at target utilization", capacity_revenue_formula,
                            note="Effective capacity hours x utilization x realized rate", fmt=fmt.num,
                            aggregation="sum")
    capacity_revenue_row = row
    ctx.set_ref("Revenue", "capacity_revenue", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "Backlog & Revenue Recognition")
    row += 1

    def beginning_backlog_formula(m, this_row=row):
        if m == 0:
            return starting_backlog
        prev = col_letter(g.month_col(m - 1))
        return f"{prev}{this_row + 7}"

    row = write_row_series(ctx, ws, row, "Beginning Backlog", beginning_backlog_formula,
                            note="Prior month ending backlog; month 1 seeded from assumptions", fmt=fmt.num,
                            aggregation="end")
    beginning_backlog_row = row
    ctx.set_ref("Revenue", "beginning_backlog", row)
    row += 1
    row = write_row_series(ctx, ws, row, "+ New Bookings", same_col_link("Revenue", new_bookings_row, ctx),
                            note="Linked from Pipeline & Bookings above", fmt=fmt.num, aggregation="sum")
    row += 1

    def backlog_available_formula(m, beginning_backlog_row=beginning_backlog_row, new_bookings_row=new_bookings_row):
        col = col_letter(g.month_col(m))
        return f"{col}{beginning_backlog_row + 1}+'Revenue'!{col}{new_bookings_row + 1}"

    row = write_row_series(ctx, ws, row, "Backlog available to deliver", backlog_available_formula,
                            note="Beginning backlog + new bookings", fmt=fmt.num_subtotal, aggregation="end",
                            subtotal=True)
    backlog_available_row = row
    row += 1

    def rev_duration_formula(m, backlog_available_row=backlog_available_row):
        col = col_letter(g.month_col(m))
        return f"{col}{backlog_available_row + 1}/MAX(1,{avg_duration})"

    row = write_row_series(ctx, ws, row, "Revenue recognized at project-duration pace", rev_duration_formula,
                            note="Backlog available / average project duration", fmt=fmt.num, aggregation="sum")
    rev_duration_row = row
    row += 1

    row = write_row_series(ctx, ws, row, "Revenue recognized at delivery capacity",
                            same_col_link("Revenue", capacity_revenue_row, ctx),
                            note="Linked from delivery-capacity calculation above", fmt=fmt.num,
                            aggregation="sum")
    rev_capacity_row = row
    row += 1

    def revenue_recognized_formula(m, rev_duration_row=rev_duration_row, rev_capacity_row=rev_capacity_row):
        col = col_letter(g.month_col(m))
        return f"MIN({col}{rev_duration_row + 1},{col}{rev_capacity_row + 1})"

    row = write_row_series(ctx, ws, row, "Revenue Recognized", revenue_recognized_formula,
                            note="The lower of backlog runoff pace and delivery capacity", fmt=fmt.num_subtotal,
                            aggregation="sum", subtotal=True)
    revenue_recognized_row = row
    ctx.set_ref("Revenue", "revenue_recognized", row)
    row += 1

    def ending_backlog_formula(m, backlog_available_row=backlog_available_row, revenue_recognized_row=revenue_recognized_row):
        col = col_letter(g.month_col(m))
        return f"{col}{backlog_available_row + 1}-{col}{revenue_recognized_row + 1}"

    row = write_row_series(ctx, ws, row, "Ending Backlog", ending_backlog_formula,
                            note="Backlog available to deliver - revenue recognized", fmt=fmt.num, aggregation="end")
    ctx.set_ref("Revenue", "ending_backlog", row)
    row += 1

    row = write_row_series(ctx, ws, row, "Total Revenue", same_col_link("Revenue", revenue_recognized_row, ctx),
                            note="Services revenue equals recognized project delivery", fmt=fmt.num_total,
                            aggregation="sum", total=True)
    total_revenue_row = row
    ctx.set_ref("Revenue", "total_revenue", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "Service Delivery KPIs")
    row += 1

    def billable_hours_formula(m, revenue_recognized_row=revenue_recognized_row, realized_rate_row=realized_rate_row):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{revenue_recognized_row + 1}/{col}{realized_rate_row + 1},0)"

    row = write_row_series(ctx, ws, row, "Billable hours delivered", billable_hours_formula,
                            note="Revenue recognized / realized billing rate", fmt=fmt.num2, aggregation="sum")
    billable_hours_row = row
    ctx.set_ref("Revenue", "billable_hours_delivered", row)
    row += 1

    def utilization_formula(m, billable_hours_row=billable_hours_row, effective_capacity_row=effective_capacity_row):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{billable_hours_row + 1}/{col}{effective_capacity_row + 1},0)"

    row = write_row_series(ctx, ws, row, "Utilization %", utilization_formula,
                            note="Billable hours delivered / effective capacity hours", fmt=fmt.pct,
                            aggregation="avg")
    ctx.set_ref("Revenue", "utilization_pct", row)
    row += 1

    def realization_formula(m, realized_rate_row=realized_rate_row, billing_rate_row=billing_rate_row):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{realized_rate_row + 1}/{col}{billing_rate_row + 1},0)"

    row = write_row_series(ctx, ws, row, "Realization %", realization_formula,
                            note="Realized rate / standard blended billing rate", fmt=fmt.pct,
                            aggregation="avg")
    ctx.set_ref("Revenue", "realization_pct", row)
    row += 1

    def revenue_per_fte_formula(m, total_revenue_row=total_revenue_row, delivery_row=delivery_row):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{total_revenue_row + 1}/{col}{delivery_row + 1},0)"

    row = write_row_series(ctx, ws, row, "Revenue per Delivery FTE", revenue_per_fte_formula,
                            note="Total revenue / delivery FTE", fmt=fmt.num, aggregation="avg")
    ctx.set_ref("Revenue", "revenue_per_delivery_fte", row)
    row += 1

    def trailing_revenue_formula(m, total_revenue_row=total_revenue_row):
        col = col_letter(g.month_col(m))
        window = min(3, m + 1)
        start_col = col_letter(g.month_col(m - window + 1))
        return f"AVERAGE({start_col}{total_revenue_row + 1}:{col}{total_revenue_row + 1})"

    row = write_row_series(ctx, ws, row, "Trailing 3-month avg revenue", trailing_revenue_formula,
                            note="Used for backlog coverage KPI", fmt=fmt.num, aggregation="avg")
    trailing_revenue_row = row
    row += 1

    def backlog_coverage_formula(m, trailing_revenue_row=trailing_revenue_row):
        col = col_letter(g.month_col(m))
        ending_backlog_row = ctx.ref_row("Revenue", "ending_backlog")
        return f"IFERROR({col}{ending_backlog_row + 1}/{col}{trailing_revenue_row + 1},0)"

    row = write_row_series(ctx, ws, row, "Backlog coverage (months)", backlog_coverage_formula,
                            note="Ending backlog / trailing 3-month revenue run-rate", fmt=fmt.months_fmt,
                            aggregation="avg")
    ctx.set_ref("Revenue", "backlog_coverage_months", row)
    row += 1

    def ai_uplift_metric_formula(m, effective_capacity_row=effective_capacity_row, standard_capacity_row=standard_capacity_row):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{effective_capacity_row + 1}/{col}{standard_capacity_row + 1}-1,0)"

    row = write_row_series(ctx, ws, row, "AI productivity uplift", ai_uplift_metric_formula,
                            note="Effective capacity / standard capacity - 1", fmt=fmt.pct, aggregation="avg")
    ctx.set_ref("Revenue", "ai_productivity_uplift", row)
    row += 1


def _build_cogs_sheet(ctx: WorkbookContext) -> None:
    ws = ctx.add_sheet("COGS & GM")
    g = ctx.grid
    fmt = ctx.fmt
    row = setup_common_sheet(
        ctx,
        ws,
        "COGS & GM",
        "Delivery people, subcontractors, and AI tool/API spend roll up into project gross margin.",
    )
    row = write_timeline_header(ctx, ws, row)

    rev_row = ctx.ref_row("Revenue", "total_revenue")
    delivery_cost_row = ctx.ref_row("Headcount", "cost_delivery")
    delivery_mgmt_cost_row = ctx.ref_row("Headcount", "cost_delivery_mgmt")
    delivery_fte_row = ctx.ref_row("Revenue", "delivery_fte")
    subcontractor_pct = active_ref(ctx, "subcontractor_pct_revenue")
    ai_tool_cost_per_fte = active_ref(ctx, "ai_tool_api_cost_per_delivery_fte_month")

    row = section_banner(ctx, ws, row, "COGS Components")
    row += 1

    row = write_row_series(ctx, ws, row, "Delivery / Consulting people cost",
                            same_col_link("Headcount", delivery_cost_row, ctx),
                            note="Linked from Headcount tab", fmt=fmt.num, aggregation="sum")
    delivery_people_row = row
    row += 1

    row = write_row_series(ctx, ws, row, "Delivery Management / Solutions people cost",
                            same_col_link("Headcount", delivery_mgmt_cost_row, ctx),
                            note="Linked from Headcount tab", fmt=fmt.num, aggregation="sum")
    delivery_mgmt_people_row = row
    row += 1

    def subcontractor_formula(m, rev_row=rev_row):
        col = col_letter(g.month_col(m))
        return f"'Revenue'!{col}{rev_row + 1}*{subcontractor_pct}"

    row = write_row_series(ctx, ws, row, "Subcontractor costs", subcontractor_formula,
                            note="Total revenue x subcontractor %", fmt=fmt.num, aggregation="sum")
    subcontractor_row = row
    row += 1

    def ai_tool_formula(m, delivery_fte_row=delivery_fte_row):
        col = col_letter(g.month_col(m))
        return f"'Revenue'!{col}{delivery_fte_row + 1}*{ai_tool_cost_per_fte}"

    row = write_row_series(ctx, ws, row, "AI tool / API delivery costs", ai_tool_formula,
                            note="Delivery FTE x AI tooling / API spend per FTE", fmt=fmt.num, aggregation="sum")
    ai_tool_row = row
    row += 1

    def total_cogs_formula(m, rows=[delivery_people_row, delivery_mgmt_people_row, subcontractor_row, ai_tool_row]):
        col = col_letter(g.month_col(m))
        return "+".join(f"{col}{r + 1}" for r in rows)

    row = write_row_series(ctx, ws, row, "Total COGS", total_cogs_formula, fmt=fmt.num_total,
                            aggregation="sum", total=True)
    total_cogs_row = row
    ctx.set_ref("COGS & GM", "total_cogs", row)
    row += 1
    row = blank_row(ctx, ws, row) + 1
    row = section_banner(ctx, ws, row, "Gross Profit & Service Economics")
    row += 1

    def gross_profit_formula(m, rev_row=rev_row, total_cogs_row=total_cogs_row):
        col = col_letter(g.month_col(m))
        return f"'Revenue'!{col}{rev_row + 1}-{col}{total_cogs_row + 1}"

    row = write_row_series(ctx, ws, row, "Gross Profit", gross_profit_formula, fmt=fmt.num_subtotal,
                            aggregation="sum", subtotal=True)
    gross_profit_row = row
    ctx.set_ref("COGS & GM", "gross_profit", row)
    row += 1

    def gm_formula(m, gross_profit_row=gross_profit_row, rev_row=rev_row):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{gross_profit_row + 1}/'Revenue'!{col}{rev_row + 1},0)"

    row = write_row_series(ctx, ws, row, "Project Gross Margin %", gm_formula, fmt=fmt.pct,
                            aggregation="avg")
    ctx.set_ref("COGS & GM", "gross_margin_pct", row)
    row += 1

    utilization_row = ctx.ref_row("Revenue", "utilization_pct")
    row = write_row_series(ctx, ws, row, "Utilization %", same_col_link("Revenue", utilization_row, ctx),
                            note="Linked from Revenue tab", fmt=fmt.pct, aggregation="avg")
    ctx.set_ref("COGS & GM", "utilization_pct", row)
    row += 1

    realization_row = ctx.ref_row("Revenue", "realization_pct")
    row = write_row_series(ctx, ws, row, "Realization %", same_col_link("Revenue", realization_row, ctx),
                            note="Linked from Revenue tab", fmt=fmt.pct, aggregation="avg")
    ctx.set_ref("COGS & GM", "realization_pct", row)
    row += 1

    revenue_per_fte_row = ctx.ref_row("Revenue", "revenue_per_delivery_fte")
    row = write_row_series(ctx, ws, row, "Revenue per Delivery FTE",
                            same_col_link("Revenue", revenue_per_fte_row, ctx),
                            note="Linked from Revenue tab", fmt=fmt.num, aggregation="avg")
    ctx.set_ref("COGS & GM", "revenue_per_delivery_fte", row)
    row += 1

    def contribution_per_fte_formula(m, gross_profit_row=gross_profit_row, delivery_fte_row=delivery_fte_row):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{gross_profit_row + 1}/'Revenue'!{col}{delivery_fte_row + 1},0)"

    row = write_row_series(ctx, ws, row, "Contribution margin per Delivery FTE", contribution_per_fte_formula,
                            note="Gross profit / delivery FTE", fmt=fmt.num, aggregation="avg")
    ctx.set_ref("COGS & GM", "contribution_margin_per_delivery_fte", row)
    row += 1

    ai_uplift_row = ctx.ref_row("Revenue", "ai_productivity_uplift")
    row = write_row_series(ctx, ws, row, "AI productivity uplift",
                            same_col_link("Revenue", ai_uplift_row, ctx),
                            note="Linked from Revenue tab", fmt=fmt.pct, aggregation="avg")
    ctx.set_ref("COGS & GM", "ai_productivity_uplift", row)
    row += 1


def _opex_extra_lines(ctx: WorkbookContext):
    commission_ref = active_ref(ctx, "sales_commission_pct_bookings")
    marketing_m1 = active_ref(ctx, "marketing_bd_month1")
    marketing_growth = active_ref(ctx, "marketing_bd_growth_mom")
    software_ref = active_ref(ctx, "software_tools_monthly")
    facilities_ref = active_ref(ctx, "facilities_monthly")

    def commissions_formula(m):
        bookings_row = ctx.ref_row("Revenue", "new_bookings")
        col = col_letter(ctx.grid.month_col(m))
        return f"'Revenue'!{col}{bookings_row + 1}*{commission_ref}"

    def marketing_formula(m):
        return f"{marketing_m1}*(1+{marketing_growth})^{m}"

    def software_formula(m):
        return software_ref

    def facilities_formula(m):
        return facilities_ref

    return [
        OpexLine("Sales Commissions", "Sales & Marketing", commissions_formula, "% of monthly new bookings"),
        OpexLine("Marketing / BD Programs", "Sales & Marketing", marketing_formula,
                 "Month-1 assumption compounded by monthly growth"),
        OpexLine("Corporate Software & Tools", "General & Administrative", software_formula, "Fixed monthly"),
        OpexLine("Facilities & Admin Overhead", "General & Administrative", facilities_formula, "Fixed monthly"),
    ]


def _scenario_kpis(ctx: WorkbookContext):
    def sc(which, key):
        return scenario_col_ref(ctx, key, which)

    def hc36(which, start_key, hires_key):
        return f"({sc(which, start_key)}+35*{sc(which, hires_key)}/3)"

    def bookings1(which):
        return (
            f"{sc(which, 'sales_start_fte')}*{sc(which, 'pipeline_projects_per_sales_fte_month1')}*"
            f"{sc(which, 'proposal_win_rate')}*{sc(which, 'average_project_value_month1')}"
        )

    def pipeline_per_sales36(which):
        return f"{sc(which, 'pipeline_projects_per_sales_fte_month1')}*(1+{sc(which, 'pipeline_projects_growth_mom')})^35"

    def project_value36(which):
        return f"{sc(which, 'average_project_value_month1')}*(1+{sc(which, 'project_value_growth_mom')})^35"

    def rate36(which):
        return f"{sc(which, 'blended_billing_rate_month1')}*(1+{sc(which, 'billing_rate_growth_mom')})^35"

    def bookings36(which):
        return (
            f"({hc36(which, 'sales_start_fte', 'sales_hires_per_quarter')})*({pipeline_per_sales36(which)})*"
            f"{sc(which, 'proposal_win_rate')}*({project_value36(which)})"
        )

    def capacity1(which):
        return (
            f"{sc(which, 'delivery_start_fte')}*{sc(which, 'standard_billable_hours_per_delivery_fte_month')}*"
            f"(1+{sc(which, 'ai_productivity_uplift_pct')})*{sc(which, 'target_utilization_pct')}*"
            f"{sc(which, 'blended_billing_rate_month1')}*{sc(which, 'realization_pct')}"
        )

    def capacity36(which):
        delivery36 = hc36(which, 'delivery_start_fte', 'delivery_hires_per_quarter')
        return (
            f"({delivery36})*{sc(which, 'standard_billable_hours_per_delivery_fte_month')}*"
            f"(1+{sc(which, 'ai_productivity_uplift_pct')})*{sc(which, 'target_utilization_pct')}*"
            f"({rate36(which)})*{sc(which, 'realization_pct')}"
        )

    def revenue1(which):
        return f"MIN(({sc(which, 'starting_backlog')}+({bookings1(which)}))/MAX(1,{sc(which, 'average_project_duration_months')}),{capacity1(which)})"

    def revenue36(which):
        return f"MIN(({bookings36(which)}),{capacity36(which)})"

    def util36(which):
        delivery36 = hc36(which, 'delivery_start_fte', 'delivery_hires_per_quarter')
        denom = (
            f"({delivery36})*{sc(which, 'standard_billable_hours_per_delivery_fte_month')}*"
            f"(1+{sc(which, 'ai_productivity_uplift_pct')})*({rate36(which)})*{sc(which, 'realization_pct')}"
        )
        return f"IFERROR(({revenue36(which)})/({denom}),0)"

    def gm36(which):
        delivery36 = hc36(which, 'delivery_start_fte', 'delivery_hires_per_quarter')
        delivery_mgmt36 = hc36(which, 'delivery_mgmt_start_fte', 'delivery_mgmt_hires_per_quarter')
        cogs_people = (
            f"({delivery36})*{sc(which, 'delivery_monthly_cost_per_fte')}+"
            f"({delivery_mgmt36})*{sc(which, 'delivery_mgmt_monthly_cost_per_fte')}"
        )
        ai_tools = f"({delivery36})*{sc(which, 'ai_tool_api_cost_per_delivery_fte_month')}"
        return f"1-IFERROR((({cogs_people})+({ai_tools})+({revenue36(which)})*{sc(which, 'subcontractor_pct_revenue')})/({revenue36(which)}),0)"

    def burn1(which):
        people = "+".join([
            cost_of_role_month1(ctx, "delivery_start_fte", "delivery_monthly_cost_per_fte", which),
            cost_of_role_month1(ctx, "delivery_mgmt_start_fte", "delivery_mgmt_monthly_cost_per_fte", which),
            cost_of_role_month1(ctx, "sales_start_fte", "sales_monthly_cost_per_fte", which),
            cost_of_role_month1(ctx, "ga_start_fte", "ga_monthly_cost_per_fte", which),
        ])
        revenue = revenue1(which)
        variable_cogs = (
            f"({revenue})*{sc(which, 'subcontractor_pct_revenue')}+"
            f"{sc(which, 'delivery_start_fte')}*{sc(which, 'ai_tool_api_cost_per_delivery_fte_month')}"
        )
        opex_programs = "+".join([
            f"({bookings1(which)})*{sc(which, 'sales_commission_pct_bookings')}",
            sc(which, "marketing_bd_month1"),
            sc(which, "software_tools_monthly"),
            sc(which, "facilities_monthly"),
        ])
        return f"MAX(0,({people})+({variable_cogs})+({opex_programs})-({revenue}))"

    def runway1(which):
        return f"IF(({burn1(which)})<=0,999,{sc(which, 'starting_cash')}/({burn1(which)}))"

    g = ctx.grid
    first_col = col_letter(g.month_col(0))
    last_col = col_letter(g.month_col(g.n_months - 1))

    return [
        ScenarioKPI(
            "Month-1 New Bookings",
            "Starting sales capacity x pipeline generation x win rate x average project value.",
            bookings1,
            f"'Revenue'!{first_col}{ctx.ref_row('Revenue', 'new_bookings') + 1}",
            "num",
            key="starting_bookings",
        ),
        ScenarioKPI(
            "Utilization % (illustrative, Month 36)",
            "Approximate month-36 recognized revenue divided by effective delivery capacity at realized rates.",
            util36,
            f"'Revenue'!{last_col}{ctx.ref_row('Revenue', 'utilization_pct') + 1}",
            "pct",
            key="utilization_illustrative",
        ),
        ScenarioKPI(
            "Implied Revenue at Month 36 (approx.)",
            "Approximate month-36 recognized revenue, constrained by the lower of bookings and delivery capacity.",
            revenue36,
            f"'Revenue'!{last_col}{ctx.ref_row('Revenue', 'total_revenue') + 1}",
            "num",
            key="implied_revenue_36",
        ),
        ScenarioKPI(
            "Project Gross Margin % (illustrative, Month 36)",
            "1 - (delivery people + subcontractors + AI tools) / approximate month-36 revenue.",
            gm36,
            f"'COGS & GM'!{last_col}{ctx.ref_row('COGS & GM', 'gross_margin_pct') + 1}",
            "pct",
            key="gm_illustrative",
        ),
        ScenarioKPI(
            "Month-1 Net Burn (illustrative)",
            "Month-1 people cost + variable delivery costs + operating programs - recognized revenue.",
            burn1,
            f"'Cash & Runway'!{first_col}{ctx.ref_row('Cash & Runway', 'monthly_burn') + 1}",
            "num",
            key="burn1_illustrative",
        ),
        ScenarioKPI(
            "Runway (illustrative, months)",
            "Starting cash divided by illustrative month-1 burn; 999 means cash-flow positive / effectively infinite.",
            runway1,
            f"'Cash & Runway'!{last_col}{ctx.ref_row('Cash & Runway', 'runway_months') + 1}",
            "months",
            key="runway_illustrative",
        ),
    ]


def _visuals(ctx: WorkbookContext):
    g = ctx.grid
    last_col = col_letter(g.month_col(g.n_months - 1))
    date_cat = (
        f"'Revenue'!${col_letter(g.month_start_col)}${TIMELINE_DATE_ROW + 1}:"
        f"${col_letter(g.month_end_col)}${TIMELINE_DATE_ROW + 1}"
    )

    def rng(sheet, key):
        return range_ref(sheet, ctx.ref_row(sheet, key), g.month_start_col, g.month_end_col)

    cards = [
        KPICard("Revenue (Month 36)", f"'Revenue'!{last_col}{ctx.ref_row('Revenue', 'total_revenue') + 1}", "num"),
        KPICard("Ending Backlog (Month 36)", f"'Revenue'!{last_col}{ctx.ref_row('Revenue', 'ending_backlog') + 1}", "num"),
        KPICard("Project Gross Margin %", f"'COGS & GM'!{last_col}{ctx.ref_row('COGS & GM', 'gross_margin_pct') + 1}", "pct"),
        KPICard("Utilization %", f"'Revenue'!{last_col}{ctx.ref_row('Revenue', 'utilization_pct') + 1}", "pct"),
        KPICard("Runway (months)", f"'Cash & Runway'!{last_col}{ctx.ref_row('Cash & Runway', 'runway_months') + 1}", "months"),
        KPICard("AI productivity uplift", f"'Revenue'!{last_col}{ctx.ref_row('Revenue', 'ai_productivity_uplift') + 1}", "pct"),
    ]

    charts = [
        ChartSpec(
            "Revenue, Bookings & Backlog",
            "line",
            date_cat,
            [
                ChartSeries("Revenue", rng("Revenue", "total_revenue")),
                ChartSeries("New Bookings", rng("Revenue", "new_bookings")),
                ChartSeries("Ending Backlog", rng("Revenue", "ending_backlog")),
            ],
            y_axis_name="$",
        ),
        ChartSpec(
            "Project Gross Margin %",
            "line",
            date_cat,
            [ChartSeries("Project Gross Margin %", rng("COGS & GM", "gross_margin_pct"))],
            y_axis_name="%",
        ),
        ChartSpec(
            "Cash & Runway",
            "line",
            date_cat,
            [
                ChartSeries("Ending Cash", rng("Cash & Runway", "ending_cash")),
                ChartSeries("Monthly Burn", rng("Cash & Runway", "monthly_burn")),
            ],
            y_axis_name="$",
        ),
        ChartSpec(
            "Headcount by Month",
            "column",
            date_cat,
            [ChartSeries("Total Headcount", rng("Headcount", "total_headcount"))],
            y_axis_name="FTE",
        ),
        ChartSpec(
            "Scenario Comparison — Implied Revenue at Month 36",
            "column",
            None,
            [ChartSeries("Base/Upside/Downside", scenario_kpi_range(ctx, "implied_revenue_36"))],
        ),
        ChartSpec(
            "Delivery Efficiency",
            "line",
            date_cat,
            [
                ChartSeries("Utilization %", rng("Revenue", "utilization_pct")),
                ChartSeries("Realization %", rng("Revenue", "realization_pct")),
            ],
            y_axis_name="%",
        ),
    ]
    return cards, charts


def _append_post_build_kpis(ctx: WorkbookContext) -> None:
    ws = ctx.sheets["COGS & GM"]
    g = ctx.grid
    fmt = ctx.fmt
    row = max(ctx.refs["COGS & GM"].values()) + 2
    row = section_banner(ctx, ws, row, "Cash Conversion")
    row += 1

    cfo_row = ctx.ref_row("Cash Flow", "cfo")
    ni_row = ctx.ref_row("P&L", "net_income")

    def cash_conversion_formula(m):
        col = col_letter(g.month_col(m))
        ni = f"'P&L'!{col}{ni_row + 1}"
        cfo = f"'Cash Flow'!{col}{cfo_row + 1}"
        return f"IF(ABS({ni})<1,0,{cfo}/{ni})"

    row = write_row_series(ctx, ws, row, "Cash conversion (CFO / Net Income)", cash_conversion_formula,
                            note="Monthly cash from operations divided by net income; 0 when net income is ~0",
                            fmt=fmt.mult, aggregation="avg")
    ctx.set_ref("COGS & GM", "cash_conversion", row)


def _readme_sections():
    return [
        (
            "Business model",
            "This workbook models an AI-enabled professional services business where a sales pipeline converts into signed project bookings, signed work accumulates in backlog, and backlog converts into recognized revenue as delivery teams complete the work. Revenue is constrained both by average project duration and by delivery capacity.",
        ),
        (
            "Key KPIs",
            "Headline operating metrics include new bookings, ending backlog, backlog coverage in months, utilization, realization, revenue per delivery FTE, contribution margin per delivery FTE, project gross margin, burn, and runway. AI productivity uplift is explicitly modeled as an increase in effective delivery capacity.",
        ),
        (
            "Modeling notes",
            "Backlog is the primary signed-but-undelivered work tracker; deferred revenue is kept small and only captures limited cash collected in advance. Delivery management / solutions roles are classified in COGS to reflect direct project support. AI tool/API spend is modeled per delivery FTE rather than as a pure % of revenue so cost-to-serve scales with staffed delivery capacity.",
        ),
    ]


def build(output_path: str) -> WorkbookContext:
    ctx = WorkbookContext(output_path, MODEL_NAME, MODEL_SHORT)

    build_readme_sheet(
        ctx,
        overview=(
            "A 36-month, formula-driven financial model for an AI-enabled services company. Start on the "
            "Assumptions tab, pick Base/Upside/Downside, and the model flows from sales pipeline to bookings, "
            "backlog, recognized revenue, gross margin, cash flow, and runway."
        ),
        sections=_readme_sections(),
    )
    build_assumptions_sheet(
        ctx,
        _assumption_sections(),
        company_note="Tip: backlog and delivery-capacity assumptions drive revenue timing more than signed bookings alone.",
    )
    build_headcount_sheet(ctx, _headcount_roles())
    _build_revenue_sheet(ctx)
    _build_cogs_sheet(ctx)
    build_opex_sheet(ctx, DEPARTMENTS, _opex_extra_lines(ctx))
    build_working_capital_sheet(
        ctx,
        WCConfig(
            dso_days_key="dso_days",
            dpo_days_key="dpo_days",
            deferred_rev_months_key="deferred_rev_months",
            capex_pct_revenue_key="capex_pct_revenue",
            useful_life_months_key="useful_life_months",
            other_current_assets_pct_revenue_key="other_current_assets_pct_revenue",
            interest_rate_key="interest_rate_annual",
            debt_draw_key="debt_draw_amount",
            debt_draw_month=8,
            debt_monthly_repayment_key="debt_monthly_repayment",
            debt_repayment_start_month=18,
            equity_rounds=[
                (3, "seed_extension_amount", "Seed extension"),
                (18, "growth_equity_amount", "Growth equity"),
            ],
        ),
    )
    build_pnl_sheet(ctx, PnLConfig(departments=DEPARTMENTS, tax_rate_key="tax_rate"))
    build_cash_flow_sheet(ctx, CashFlowConfig(starting_cash_key="starting_cash"))
    build_balance_sheet(
        ctx,
        BalanceSheetConfig(
            starting_cash_key="starting_cash",
            starting_paid_in_capital_key="starting_paid_in_capital",
        ),
    )
    build_cash_runway_sheet(ctx)
    _append_post_build_kpis(ctx)
    build_scenarios_sheet(ctx, _scenario_kpis(ctx))
    cards, charts = _visuals(ctx)
    build_visuals_sheet(
        ctx,
        cards,
        charts,
        intro="Bookings, backlog, delivery efficiency, gross margin, cash, and runway for the AI-Enabled Services model.",
    )
    build_checks_sheet(ctx)

    ctx.close()
    return ctx
