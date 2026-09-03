"""Model 3: Consumer Subscription.

Channel-based top-of-funnel acquisition -> MAU bridge -> free-to-paid conversion ->
paid subscriber bridge -> subscription ARPU -> platform / inference COGS -> Opex ->
integrated P&L / BS / CF -> Cash & Runway -> Scenarios -> Visuals -> Checks.
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
from ._common import cost_of_role_month1, scenario_kpi_range

MODEL_NAME = "Consumer Subscription — 3-Year Financial Model"
MODEL_SHORT = "consumer_subscription"

DEPARTMENTS = ["Growth & Marketing", "Product & Engineering", "General & Administrative"]
CHANNELS = [
    ("paid", "Paid"),
    ("organic", "Organic / Viral"),
    ("referral", "Influencer / Referral"),
]


def _assumption_sections():
    return [
        S("Company & Financial", [
            A("starting_cash", "Starting cash balance", "$", 2_250_000, 2_250_000, 2_250_000, "num",
              "Cash on hand at the start of month 1."),
            A("starting_paid_in_capital", "Starting paid-in capital", "$", 3_000_000, 3_000_000, 3_000_000,
              "num", "Cumulative equity raised before the modeled period."),
            A("tax_rate", "Income tax rate", "%", 0.00, 0.00, 0.00, "pct0",
              "Applied only when Earnings Before Tax is positive; no NOL schedule modeled."),
        ]),
        S("Acquisition & Funnel", [
            A("starting_mau", "Starting monthly active users (MAU)", "#", 80_000, 90_000, 70_000, "int",
              "All active users at the start of month 1, including paid subscribers."),
            A("mau_churn_rate_monthly", "Monthly active-user churn rate", "%", 0.080, 0.060, 0.105, "pct",
              "Share of beginning MAU that goes inactive each month."),
            A("starting_paid_subscribers", "Starting paid subscribers", "#", 4_000, 4_500, 3_500, "int",
              "Active subscribers paying at the start of month 1."),
            A("paid_signups_m1", "Paid-channel new signups, month 1", "#", 2_500, 3_000, 2_000, "num",
              "Users acquired from paid media in month 1."),
            A("paid_signup_growth_mom", "Paid-channel signups growth, month over month", "%",
              seeded_value("consumer_paid_signup_growth_base", 0.040, 0.070),
              seeded_value("consumer_paid_signup_growth_up", 0.070, 0.100),
              seeded_value("consumer_paid_signup_growth_down", 0.010, 0.030), "pct",
              "Compounding growth in paid-media signups each month."),
            A("paid_cac_per_signup", "Paid-channel CAC per new signup", "$/user", 28, 24, 34, "num",
              "Blended paid-media acquisition cost per new user."),
            A("organic_signups_m1", "Organic / viral new signups, month 1", "#", 3_500, 4_200, 2_800, "num",
              "Users arriving via word-of-mouth, SEO, app-store discovery, and product virality."),
            A("organic_signup_growth_mom", "Organic / viral signups growth, month over month", "%",
              seeded_value("consumer_organic_signup_growth_base", 0.025, 0.045),
              seeded_value("consumer_organic_signup_growth_up", 0.045, 0.065),
              seeded_value("consumer_organic_signup_growth_down", 0.000, 0.020), "pct",
              "Organic signups often scale with awareness and product-market fit."),
            A("organic_cac_per_signup", "Organic / viral CAC equivalent per signup", "$/user", 4.0, 3.0, 5.5,
              "num", "Represents community/content/program costs allocated per organic user."),
            A("referral_signups_m1", "Influencer / referral new signups, month 1", "#", 1_200, 1_500, 900,
              "num", "Users acquired from creators, affiliate partners, and referral loops."),
            A("referral_signup_growth_mom", "Influencer / referral signups growth, month over month", "%",
              seeded_value("consumer_referral_signup_growth_base", 0.030, 0.055),
              seeded_value("consumer_referral_signup_growth_up", 0.055, 0.080),
              seeded_value("consumer_referral_signup_growth_down", 0.005, 0.025), "pct",
              "Compounding growth in creator and referral-driven acquisition."),
            A("referral_cac_per_signup", "Influencer / referral CAC per new signup", "$/user", 16, 13, 20,
              "num", "Creator fees, referral rewards, and affiliate payouts per acquired user."),
        ]),
        S("Retention & Monetization", [
            A("free_to_paid_conversion_rate", "Free-to-paid conversion rate", "%", 0.025, 0.032, 0.018, "pct",
              "Share of free MAU that converts to paid each month."),
            A("paid_subscriber_churn_rate_monthly", "Paid subscriber churn rate", "%", 0.045, 0.032, 0.060,
              "pct", "Monthly churn of beginning paid subscribers."),
            A("plus_plan_price_monthly", "Plus plan price per subscriber", "$/mo", 12, 13, 11, "num",
              "Blended realized monthly price for the standard paid tier."),
            A("premium_plan_price_monthly", "Premium / family plan price per subscriber", "$/mo", 24, 26, 22,
              "num", "Higher-value tier with more seats/features."),
            A("premium_mix_start", "Premium-tier mix, month 1", "%", 0.18, 0.24, 0.12, "pct",
              "Share of paid subscribers on the higher-value plan at the start of the model."),
            A("premium_mix_shift_mom", "Premium-tier mix shift, month over month", "%",
              seeded_value("consumer_premium_mix_shift_base", 0.002, 0.005),
              seeded_value("consumer_premium_mix_shift_up", 0.004, 0.007),
              seeded_value("consumer_premium_mix_shift_down", -0.001, 0.002), "pct",
              "Monthly change in premium-plan mix, capped inside the model."),
        ]),
        S("COGS & Platform Fees", [
            A("app_store_fee_pct_revenue", "App-store / platform fee, % of revenue", "%", 0.18, 0.15, 0.22,
              "pct", "Blended app-store take rate / merchant-of-record fee on subscription revenue."),
            A("payment_processing_pct_revenue", "Payment processing fee, % of revenue", "%", 0.030, 0.025,
              0.035, "pct", "Card and payment-processor fees on direct-web billing."),
            A("hosting_cost_per_mau", "Hosting & infra cost per MAU", "$/MAU/mo", 0.35, 0.30, 0.42, "num",
              "Storage, delivery, and core application infrastructure per active user."),
            A("ai_inference_cost_per_paid_sub", "AI inference / premium support cost per paid subscriber", "$/sub/mo",
              1.80, 1.50, 2.20, "num", "Variable AI feature cost and premium support burden per active paid subscriber."),
        ]),
        S("Headcount — Support / Community Ops (COGS)", [
            A("support_start_fte", "Starting Support / Community Ops FTEs", "#", 5, 5, 5, "fte",
              "Customer support, trust & safety, and community operations."),
            A("support_hires_per_quarter", "Support / Community Ops net adds per quarter", "#", 1.0, 1.5, 0.5,
              "fte", ""),
            A("support_monthly_cost_per_fte", "Support / Community Ops fully-loaded cost per FTE", "$/mo", 7_000,
              7_000, 7_000, "num", "Salary + benefits + payroll tax, monthly."),
        ]),
        S("Headcount — Growth / Marketing (Opex)", [
            A("growth_start_fte", "Starting Growth / Marketing FTEs", "#", 4, 4, 4, "fte",
              "Performance marketing, lifecycle CRM, and growth analytics."),
            A("growth_hires_per_quarter", "Growth / Marketing net adds per quarter", "#", 1.0, 1.5, 0.5, "fte",
              ""),
            A("growth_monthly_cost_per_fte", "Growth / Marketing fully-loaded cost per FTE", "$/mo", 10_000,
              10_000, 10_000, "num", ""),
        ]),
        S("Headcount — Product & Engineering (Opex)", [
            A("product_start_fte", "Starting Product / Engineering FTEs", "#", 8, 8, 8, "fte",
              "Engineering, product, design, and data roles building the app."),
            A("product_hires_per_quarter", "Product / Engineering net adds per quarter", "#", 2.0, 2.5, 1.0,
              "fte", ""),
            A("product_monthly_cost_per_fte", "Product / Engineering fully-loaded cost per FTE", "$/mo", 15_000,
              15_000, 15_000, "num", ""),
        ]),
        S("Headcount — G&A (Opex)", [
            A("ga_start_fte", "Starting G&A FTEs", "#", 2, 2, 2, "fte", "Finance, HR, legal, and operations."),
            A("ga_hires_per_quarter", "G&A net adds per quarter", "#", 0.5, 0.5, 0.25, "fte", ""),
            A("ga_monthly_cost_per_fte", "G&A fully-loaded cost per FTE", "$/mo", 11_000, 11_000, 11_000,
              "num", ""),
        ]),
        S("Marketing / Opex", [
            A("lifecycle_tools_fixed_monthly", "CRM / analytics / lifecycle tools", "$/mo", 10_000, 10_000,
              10_000, "num", "Braze/Iterable, attribution, mobile analytics, and experimentation tooling."),
            A("software_tools_fixed_monthly", "Product software / tools", "$/mo", 14_000, 14_000, 14_000, "num",
              "Developer tools, observability, data tooling, and collaboration software."),
            A("facilities_fixed_monthly", "Facilities / admin fixed monthly spend", "$/mo", 8_000, 8_000, 8_000,
              "num", "Office, insurance, recruiting, audit, and other overhead."),
        ]),
        S("Working Capital & Financing", [
            A("dso_days", "Days Sales Outstanding (AR)", "days", 3, 2, 5, "int",
              "Low receivables balance reflecting payment-processor / app-store settlement timing."),
            A("dpo_days", "Days Payable Outstanding (AP)", "days", 25, 28, 20, "int", ""),
            A("deferred_rev_months", "Deferred revenue held in advance", "mo", 0.30, 0.40, 0.20, "num",
              "Reflects modest annual-prepay or app-store cash received before recognition."),
            A("capex_pct_revenue", "Capex, % of revenue", "%", 0.015, 0.012, 0.020, "pct",
              "Capitalized internal tools, office equipment, and small-scale infrastructure."),
            A("useful_life_months", "Useful life of capitalized assets", "months", 24, 24, 24, "int", ""),
            A("other_current_assets_pct_revenue", "Other current assets, % of revenue", "%", 0.020, 0.020,
              0.020, "pct", "Prepaids, deposits, and other small current assets."),
            A("interest_rate_annual", "Venture debt annual interest rate", "%", 0.10, 0.09, 0.12, "pct", ""),
            A("debt_draw_amount", "Venture debt draw (one-time)", "$", 500_000, 750_000, 350_000, "num", ""),
            A("debt_monthly_repayment", "Venture debt monthly repayment", "$/mo", 20_000, 20_000, 15_000,
              "num", ""),
            A("series_a_amount", "Growth equity raise (month 6)", "$", 3_000_000, 4_000_000, 2_250_000, "num",
              ""),
            A("series_b_amount", "Follow-on equity raise (month 22)", "$", 6_000_000, 7_500_000, 4_500_000,
              "num", ""),
        ]),
    ]


def _build_revenue_sheet(ctx: WorkbookContext) -> None:
    ws = ctx.add_sheet("Revenue")
    g = ctx.grid
    fmt = ctx.fmt
    row = setup_common_sheet(
        ctx,
        ws,
        "Revenue",
        "Channel acquisition -> MAU bridge -> free-to-paid conversion -> paid subscriber bridge -> blended ARPU.",
    )
    row = write_timeline_header(ctx, ws, row)

    starting_mau = active_ref(ctx, "starting_mau")
    mau_churn = active_ref(ctx, "mau_churn_rate_monthly")
    starting_paid = active_ref(ctx, "starting_paid_subscribers")
    free_to_paid = active_ref(ctx, "free_to_paid_conversion_rate")
    paid_churn = active_ref(ctx, "paid_subscriber_churn_rate_monthly")
    plus_price = active_ref(ctx, "plus_plan_price_monthly")
    premium_price = active_ref(ctx, "premium_plan_price_monthly")
    premium_mix_start = active_ref(ctx, "premium_mix_start")
    premium_mix_shift = active_ref(ctx, "premium_mix_shift_mom")

    row = section_banner(ctx, ws, row, "Acquisition by Channel")
    row += 1

    channel_new_rows = {}
    channel_spend_rows = {}
    for channel_key, channel_label in CHANNELS:
        signups_m1 = active_ref(ctx, f"{channel_key}_signups_m1")
        growth = active_ref(ctx, f"{channel_key}_signup_growth_mom")
        cac = active_ref(ctx, f"{channel_key}_cac_per_signup")

        def signups_formula(m, signups_m1=signups_m1, growth=growth, this_row=row):
            if m == 0:
                return signups_m1
            prev = col_letter(g.month_col(m - 1))
            return f"{prev}{this_row+1}*(1+{growth})"

        row = write_row_series(ctx, ws, row, f"{channel_label} new signups", signups_formula,
                               note="Monthly new users from this channel", fmt=fmt.fte, aggregation="sum")
        channel_new_rows[channel_key] = row
        ctx.set_ref("Revenue", f"{channel_key}_new_signups", row)
        signup_row = row
        row += 1

        def spend_formula(m, signup_row=signup_row, cac=cac):
            col = col_letter(g.month_col(m))
            return f"{col}{signup_row+1}*{cac}"

        row = write_row_series(ctx, ws, row, f"{channel_label} acquisition spend", spend_formula,
                               note="New signups × CAC / signup", fmt=fmt.num, aggregation="sum")
        channel_spend_rows[channel_key] = row
        ctx.set_ref("Revenue", f"{channel_key}_acquisition_spend", row)
        row += 1

    def total_new_signups_formula(m, rows=list(channel_new_rows.values())):
        col = col_letter(g.month_col(m))
        return "+".join(f"{col}{r+1}" for r in rows)

    row = write_row_series(ctx, ws, row, "Total new signups", total_new_signups_formula,
                           note="Sum of paid, organic / viral, and influencer / referral channels",
                           fmt=fmt.fte, aggregation="sum", subtotal=True)
    ctx.set_ref("Revenue", "total_new_signups", row)
    total_new_signups_row = row
    row += 1

    def total_acq_spend_formula(m, rows=list(channel_spend_rows.values())):
        col = col_letter(g.month_col(m))
        return "+".join(f"{col}{r+1}" for r in rows)

    row = write_row_series(ctx, ws, row, "Total acquisition spend", total_acq_spend_formula,
                           note="Channel acquisition spend that flows into Growth & Marketing Opex",
                           fmt=fmt.num_subtotal, aggregation="sum", subtotal=True)
    ctx.set_ref("Revenue", "total_acquisition_spend", row)
    total_acq_spend_row = row
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "MAU & Paid Subscriber Funnel")
    row += 1

    end_mau_row = row + 3

    def beginning_mau_formula(m, starting_mau=starting_mau, end_mau_row=end_mau_row):
        if m == 0:
            return starting_mau
        prev = col_letter(g.month_col(m - 1))
        return f"{prev}{end_mau_row+1}"

    r_beginning_mau = row
    row = write_row_series(ctx, ws, row, "Beginning MAU", beginning_mau_formula,
                           note="Prior month ending MAU (or starting MAU in month 1)", fmt=fmt.fte,
                           aggregation="end")
    row += 1

    def linked_total_signups_formula(m, total_new_signups_row=total_new_signups_row):
        col = col_letter(g.month_col(m))
        return f"{col}{total_new_signups_row+1}"

    row = write_row_series(ctx, ws, row, "New signups", linked_total_signups_formula,
                           note="Linked from channel acquisition above", fmt=fmt.fte, aggregation="sum")
    r_new_signups = row
    row += 1

    def mau_churn_formula(m, mau_churn=mau_churn, r_beginning_mau=r_beginning_mau):
        col = col_letter(g.month_col(m))
        return f"-{col}{r_beginning_mau+1}*{mau_churn}"

    row = write_row_series(ctx, ws, row, "Churned / inactive MAU", mau_churn_formula,
                           note="Beginning MAU × active-user churn rate", fmt=fmt.fte, aggregation="sum")
    r_mau_churn = row
    row += 1

    def ending_mau_formula(m, r_beginning_mau=r_beginning_mau, r_new_signups=r_new_signups, r_mau_churn=r_mau_churn):
        col = col_letter(g.month_col(m))
        return f"{col}{r_beginning_mau+1}+{col}{r_new_signups+1}+{col}{r_mau_churn+1}"

    row = write_row_series(ctx, ws, row, "Ending MAU", ending_mau_formula,
                           note="Beginning MAU + new signups − MAU churn", fmt=fmt.fte, aggregation="end",
                           subtotal=True)
    ctx.set_ref("Revenue", "ending_mau", row)
    r_ending_mau = row
    row += 1

    end_paid_row = row + 6

    def beginning_paid_formula(m, starting_paid=starting_paid, end_paid_row=end_paid_row):
        if m == 0:
            return starting_paid
        prev = col_letter(g.month_col(m - 1))
        return f"{prev}{end_paid_row+1}"

    row = write_row_series(ctx, ws, row, "Beginning paid subscribers", beginning_paid_formula,
                           note="Prior month ending paid subscribers", fmt=fmt.fte, aggregation="end")
    r_beginning_paid = row
    row += 1

    def paid_churn_formula(m, paid_churn=paid_churn, r_beginning_paid=r_beginning_paid):
        col = col_letter(g.month_col(m))
        return f"-{col}{r_beginning_paid+1}*{paid_churn}"

    row = write_row_series(ctx, ws, row, "Churned paid subscribers", paid_churn_formula,
                           note="Beginning paid subscribers × paid churn", fmt=fmt.fte, aggregation="sum")
    r_paid_churn = row
    row += 1

    def retained_paid_formula(m, r_beginning_paid=r_beginning_paid, r_paid_churn=r_paid_churn):
        col = col_letter(g.month_col(m))
        return f"{col}{r_beginning_paid+1}+{col}{r_paid_churn+1}"

    row = write_row_series(ctx, ws, row, "Retained paid before new adds", retained_paid_formula,
                           note="Beginning paid subscribers net of subscriber churn", fmt=fmt.fte,
                           aggregation="end")
    r_retained_paid = row
    row += 1

    def free_pool_formula(m, r_ending_mau=r_ending_mau, r_retained_paid=r_retained_paid):
        col = col_letter(g.month_col(m))
        return f"MAX(0,{col}{r_ending_mau+1}-{col}{r_retained_paid+1})"

    row = write_row_series(ctx, ws, row, "Free MAU available to convert", free_pool_formula,
                           note="Ending MAU less retained paid subscribers", fmt=fmt.fte, aggregation="end")
    r_free_pool = row
    row += 1

    def free_to_paid_assumption_formula(m, free_to_paid=free_to_paid):
        return free_to_paid

    row = write_row_series(ctx, ws, row, "Free-to-paid conversion %", free_to_paid_assumption_formula,
                           note="Monthly free-user conversion assumption", fmt=fmt.pct, aggregation="avg")
    r_conversion_assumption = row
    row += 1

    def new_paid_adds_formula(m, r_free_pool=r_free_pool, r_conversion_assumption=r_conversion_assumption):
        col = col_letter(g.month_col(m))
        return f"{col}{r_free_pool+1}*{col}{r_conversion_assumption+1}"

    row = write_row_series(ctx, ws, row, "New paid adds", new_paid_adds_formula,
                           note="Free MAU pool × conversion %", fmt=fmt.fte, aggregation="sum")
    ctx.set_ref("Revenue", "new_paid_adds", row)
    r_new_paid_adds = row
    row += 1

    def ending_paid_formula(m, r_retained_paid=r_retained_paid, r_new_paid_adds=r_new_paid_adds):
        col = col_letter(g.month_col(m))
        return f"{col}{r_retained_paid+1}+{col}{r_new_paid_adds+1}"

    row = write_row_series(ctx, ws, row, "Ending paid subscribers", ending_paid_formula,
                           note="Retained paid subscribers + new paid adds", fmt=fmt.fte, aggregation="end",
                           subtotal=True)
    ctx.set_ref("Revenue", "ending_paid_subscribers", row)
    r_ending_paid = row
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "Plans, ARPU & Revenue")
    row += 1

    def premium_mix_formula(m, premium_mix_start=premium_mix_start, premium_mix_shift=premium_mix_shift, this_row=row):
        if m == 0:
            return premium_mix_start
        prev = col_letter(g.month_col(m - 1))
        return f"MIN(0.50,MAX(0.05,{prev}{this_row+1}+{premium_mix_shift}))"

    row = write_row_series(ctx, ws, row, "Premium-tier subscriber mix", premium_mix_formula,
                           note="Higher-value plan mix, capped inside the model", fmt=fmt.pct, aggregation="avg")
    ctx.set_ref("Revenue", "premium_mix", row)
    r_premium_mix = row
    row += 1

    def blended_arpu_formula(m, r_premium_mix=r_premium_mix):
        col = col_letter(g.month_col(m))
        return f"{plus_price}*(1-{col}{r_premium_mix+1})+{premium_price}*{col}{r_premium_mix+1}"

    row = write_row_series(ctx, ws, row, "Blended ARPU", blended_arpu_formula,
                           note="Weighted average of standard and premium plan pricing", fmt=fmt.num2,
                           aggregation="avg")
    ctx.set_ref("Revenue", "blended_arpu", row)
    r_blended_arpu = row
    row += 1

    def subscription_revenue_formula(m, r_ending_paid=r_ending_paid, r_blended_arpu=r_blended_arpu):
        col = col_letter(g.month_col(m))
        return f"{col}{r_ending_paid+1}*{col}{r_blended_arpu+1}"

    row = write_row_series(ctx, ws, row, "Subscription revenue", subscription_revenue_formula,
                           note="Ending paid subscribers × blended ARPU", fmt=fmt.num, aggregation="sum")
    ctx.set_ref("Revenue", "subscription_revenue", row)
    r_subscription_revenue = row
    row += 1

    def revenue_run_rate_formula(m, r_subscription_revenue=r_subscription_revenue):
        col = col_letter(g.month_col(m))
        return f"{col}{r_subscription_revenue+1}*12"

    row = write_row_series(ctx, ws, row, "Revenue run-rate (monthly revenue x 12)", revenue_run_rate_formula,
                           note="Illustrative ARR-equivalent for a monthly consumer subscription business",
                           fmt=fmt.num, aggregation="end")
    ctx.set_ref("Revenue", "revenue_run_rate", row)
    row += 1

    def total_revenue_formula(m, r_subscription_revenue=r_subscription_revenue):
        col = col_letter(g.month_col(m))
        return f"{col}{r_subscription_revenue+1}"

    row = write_row_series(ctx, ws, row, "Total Revenue", total_revenue_formula,
                           note="Subscription revenue only; no ads or IAP modeled", fmt=fmt.num_total,
                           aggregation="sum", total=True)
    ctx.set_ref("Revenue", "total_revenue", row)
    r_total_revenue = row
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "Consumer Subscription KPIs")
    row += 1

    def mau_growth_formula(m, r_beginning_mau=r_beginning_mau, r_ending_mau=r_ending_mau):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{r_ending_mau+1}/{col}{r_beginning_mau+1}-1,0)"

    row = write_row_series(ctx, ws, row, "MAU growth (month over month)", mau_growth_formula,
                           fmt=fmt.pct, aggregation="avg")
    ctx.set_ref("Revenue", "mau_growth_mom", row)
    row += 1

    def paid_penetration_formula(m, r_ending_paid=r_ending_paid, r_ending_mau=r_ending_mau):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{r_ending_paid+1}/{col}{r_ending_mau+1},0)"

    row = write_row_series(ctx, ws, row, "Paid subscribers as % of MAU", paid_penetration_formula,
                           fmt=fmt.pct, aggregation="avg")
    ctx.set_ref("Revenue", "paid_penetration_pct", row)
    row += 1

    def actual_conversion_formula(m, r_new_paid_adds=r_new_paid_adds, r_free_pool=r_free_pool):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{r_new_paid_adds+1}/{col}{r_free_pool+1},0)"

    row = write_row_series(ctx, ws, row, "Free-to-paid conversion %", actual_conversion_formula,
                           fmt=fmt.pct, aggregation="avg")
    ctx.set_ref("Revenue", "free_to_paid_conversion_pct", row)
    row += 1

    def paid_retention_formula(m, r_retained_paid=r_retained_paid, r_beginning_paid=r_beginning_paid):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{r_retained_paid+1}/{col}{r_beginning_paid+1},1)"

    row = write_row_series(ctx, ws, row, "Paid retention %", paid_retention_formula,
                           fmt=fmt.pct, aggregation="avg")
    ctx.set_ref("Revenue", "paid_retention_pct", row)
    row += 1

    def paid_churn_pct_formula(m, r_paid_churn=r_paid_churn, r_beginning_paid=r_beginning_paid, paid_churn=paid_churn):
        col = col_letter(g.month_col(m))
        return f"IFERROR(-{col}{r_paid_churn+1}/{col}{r_beginning_paid+1},{paid_churn})"

    row = write_row_series(ctx, ws, row, "Paid churn %", paid_churn_pct_formula,
                           fmt=fmt.pct, aggregation="avg")
    ctx.set_ref("Revenue", "paid_churn_pct", row)
    row += 1

    def blended_cac_formula(m, total_acq_spend_row=total_acq_spend_row, r_new_paid_adds=r_new_paid_adds):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{total_acq_spend_row+1}/MAX(1,{col}{r_new_paid_adds+1}),0)"

    row = write_row_series(ctx, ws, row, "Blended CAC", blended_cac_formula,
                           note="Total acquisition spend ÷ new paid adds", fmt=fmt.num2, aggregation="avg")
    ctx.set_ref("Revenue", "blended_cac", row)
    row += 1

    def revenue_per_mau_formula(m, r_total_revenue=r_total_revenue, r_ending_mau=r_ending_mau):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{r_total_revenue+1}/{col}{r_ending_mau+1},0)"

    row = write_row_series(ctx, ws, row, "Revenue per MAU", revenue_per_mau_formula,
                           fmt=fmt.num2, aggregation="avg")
    ctx.set_ref("Revenue", "revenue_per_mau", row)
    row += 1


def _build_cogs_sheet(ctx: WorkbookContext) -> None:
    ws = ctx.add_sheet("COGS & GM")
    g = ctx.grid
    fmt = ctx.fmt
    row = setup_common_sheet(
        ctx,
        ws,
        "COGS & GM",
        "App-store / payment fees, hosting, AI inference cost, and Support / Community Ops people cost.",
    )
    row = write_timeline_header(ctx, ws, row)

    rev_row = ctx.ref_row("Revenue", "total_revenue")
    mau_row = ctx.ref_row("Revenue", "ending_mau")
    paid_row = ctx.ref_row("Revenue", "ending_paid_subscribers")
    arpu_row = ctx.ref_row("Revenue", "blended_arpu")
    cac_row = ctx.ref_row("Revenue", "blended_cac")
    acq_spend_row = ctx.ref_row("Revenue", "total_acquisition_spend")
    paid_churn_pct_row = ctx.ref_row("Revenue", "paid_churn_pct")

    app_store_fee = active_ref(ctx, "app_store_fee_pct_revenue")
    payment_fee = active_ref(ctx, "payment_processing_pct_revenue")
    hosting_per_mau = active_ref(ctx, "hosting_cost_per_mau")
    ai_cost_per_paid = active_ref(ctx, "ai_inference_cost_per_paid_sub")

    row = section_banner(ctx, ws, row, "COGS Components")
    row += 1

    def app_store_formula(m):
        rev = f"'Revenue'!{col_letter(g.month_col(m))}{rev_row+1}"
        return f"{rev}*{app_store_fee}"

    row = write_row_series(ctx, ws, row, "App-store / platform fees", app_store_formula,
                           fmt=fmt.num, aggregation="sum")
    r_app_store = row
    row += 1

    def payment_formula(m):
        rev = f"'Revenue'!{col_letter(g.month_col(m))}{rev_row+1}"
        return f"{rev}*{payment_fee}"

    row = write_row_series(ctx, ws, row, "Payment processing fees", payment_formula,
                           fmt=fmt.num, aggregation="sum")
    r_payment = row
    row += 1

    def hosting_formula(m):
        mau = f"'Revenue'!{col_letter(g.month_col(m))}{mau_row+1}"
        return f"{mau}*{hosting_per_mau}"

    row = write_row_series(ctx, ws, row, "Hosting & infrastructure", hosting_formula,
                           fmt=fmt.num, aggregation="sum")
    r_hosting = row
    row += 1

    def ai_inference_formula(m):
        paid = f"'Revenue'!{col_letter(g.month_col(m))}{paid_row+1}"
        return f"{paid}*{ai_cost_per_paid}"

    row = write_row_series(ctx, ws, row, "AI inference / premium support", ai_inference_formula,
                           fmt=fmt.num, aggregation="sum")
    r_ai = row
    row += 1

    support_people_row = ctx.ref_row("Headcount", "total_cogs_cost")
    row = write_row_series(ctx, ws, row, "Support / Community Ops people cost",
                           same_col_link("Headcount", support_people_row, ctx), fmt=fmt.num, aggregation="sum")
    r_support_people = row
    row += 1

    def total_cogs_formula(m, rows=[r_app_store, r_payment, r_hosting, r_ai, r_support_people]):
        col = col_letter(g.month_col(m))
        return "+".join(f"{col}{r+1}" for r in rows)

    row = write_row_series(ctx, ws, row, "Total COGS", total_cogs_formula,
                           fmt=fmt.num_total, aggregation="sum", total=True)
    ctx.set_ref("COGS & GM", "total_cogs", row)
    r_total_cogs = row
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "Gross Profit & Unit Economics")
    row += 1

    def gross_profit_formula(m, r_total_cogs=r_total_cogs):
        col = col_letter(g.month_col(m))
        rev = f"'Revenue'!{col}{rev_row+1}"
        return f"{rev}-{col}{r_total_cogs+1}"

    row = write_row_series(ctx, ws, row, "Gross Profit", gross_profit_formula,
                           fmt=fmt.num_subtotal, aggregation="sum", subtotal=True)
    ctx.set_ref("COGS & GM", "gross_profit", row)
    r_gross_profit = row
    row += 1

    def gross_margin_formula(m, r_gross_profit=r_gross_profit):
        col = col_letter(g.month_col(m))
        rev = f"'Revenue'!{col}{rev_row+1}"
        return f"IFERROR({col}{r_gross_profit+1}/{rev},0)"

    row = write_row_series(ctx, ws, row, "Gross Margin %", gross_margin_formula,
                           fmt=fmt.pct, aggregation="avg")
    ctx.set_ref("COGS & GM", "gross_margin_pct", row)
    row += 1

    def contribution_margin_formula(m, r_gross_profit=r_gross_profit, acq_spend_row=acq_spend_row):
        col = col_letter(g.month_col(m))
        rev = f"'Revenue'!{col}{rev_row+1}"
        acq = f"'Revenue'!{col}{acq_spend_row+1}"
        return f"IFERROR(({col}{r_gross_profit+1}-{acq})/{rev},0)"

    row = write_row_series(ctx, ws, row, "Contribution Margin %", contribution_margin_formula,
                           note="(Gross profit − acquisition spend) ÷ revenue", fmt=fmt.pct,
                           aggregation="avg")
    ctx.set_ref("COGS & GM", "contribution_margin_pct", row)
    r_contribution_margin = row
    row += 1

    def ltv_formula(m, arpu_row=arpu_row, r_contribution_margin=r_contribution_margin, paid_churn_pct_row=paid_churn_pct_row):
        col = col_letter(g.month_col(m))
        arpu = f"'Revenue'!{col}{arpu_row+1}"
        churn = f"'Revenue'!{col}{paid_churn_pct_row+1}"
        return f"IF({churn}<=0,999,MAX(0,({arpu}*{col}{r_contribution_margin+1})/{churn}))"

    row = write_row_series(ctx, ws, row, "LTV", ltv_formula,
                           note="Blended ARPU × contribution margin % ÷ monthly paid churn",
                           fmt=fmt.num2, aggregation="avg")
    ctx.set_ref("COGS & GM", "ltv", row)
    r_ltv = row
    row += 1

    def ltv_cac_formula(m, r_ltv=r_ltv, cac_row=cac_row):
        col = col_letter(g.month_col(m))
        cac = f"'Revenue'!{col}{cac_row+1}"
        return f"IFERROR({col}{r_ltv+1}/{cac},0)"

    row = write_row_series(ctx, ws, row, "LTV : CAC", ltv_cac_formula,
                           fmt=fmt.mult, aggregation="avg")
    ctx.set_ref("COGS & GM", "ltv_cac", row)
    row += 1

    def cac_payback_formula(m, cac_row=cac_row, arpu_row=arpu_row, r_contribution_margin=r_contribution_margin):
        col = col_letter(g.month_col(m))
        cac = f"'Revenue'!{col}{cac_row+1}"
        arpu = f"'Revenue'!{col}{arpu_row+1}"
        contrib_dollars = f"{arpu}*{col}{r_contribution_margin+1}"
        return f"IF({contrib_dollars}<=0,999,{cac}/{contrib_dollars})"

    row = write_row_series(ctx, ws, row, "CAC payback (months)", cac_payback_formula,
                           note="Blended CAC ÷ (ARPU × contribution margin %)", fmt=fmt.months_fmt,
                           aggregation="avg")
    ctx.set_ref("COGS & GM", "cac_payback_months", row)
    row += 1

    def runway_formula(m):
        return f"INDEX('Cash & Runway'!$C:$AL,MATCH(\"Runway (months)\",'Cash & Runway'!$A:$A,0),{m+1})"

    row = write_row_series(ctx, ws, row, "Runway (months)", runway_formula,
                           note="Linked from the Cash & Runway tab", fmt=fmt.months_fmt, aggregation="end")
    ctx.set_ref("COGS & GM", "runway_months_link", row)
    row += 1



def _headcount_roles():
    return [
        Role("support", "Support / Community Ops", COGS, "Cost of Revenue", "support_start_fte",
             "support_hires_per_quarter", "support_monthly_cost_per_fte"),
        Role("growth", "Growth / Marketing", OPEX, "Growth & Marketing", "growth_start_fte",
             "growth_hires_per_quarter", "growth_monthly_cost_per_fte"),
        Role("product", "Product / Engineering", OPEX, "Product & Engineering", "product_start_fte",
             "product_hires_per_quarter", "product_monthly_cost_per_fte"),
        Role("ga", "G&A", OPEX, "General & Administrative", "ga_start_fte", "ga_hires_per_quarter",
             "ga_monthly_cost_per_fte"),
    ]



def _opex_extra_lines(ctx: WorkbookContext):
    lifecycle_tools = active_ref(ctx, "lifecycle_tools_fixed_monthly")
    software_tools = active_ref(ctx, "software_tools_fixed_monthly")
    facilities = active_ref(ctx, "facilities_fixed_monthly")

    def const_formula(ref):
        return lambda m, ref=ref: ref

    return [
        OpexLine("Paid Acquisition Spend", "Growth & Marketing",
                 same_col_link("Revenue", ctx.ref_row("Revenue", "paid_acquisition_spend"), ctx),
                 "Linked from Revenue tab: paid signups × CAC"),
        OpexLine("Organic / Viral Program Spend", "Growth & Marketing",
                 same_col_link("Revenue", ctx.ref_row("Revenue", "organic_acquisition_spend"), ctx),
                 "Linked from Revenue tab: organic signups × CAC equivalent"),
        OpexLine("Influencer / Referral Spend", "Growth & Marketing",
                 same_col_link("Revenue", ctx.ref_row("Revenue", "referral_acquisition_spend"), ctx),
                 "Linked from Revenue tab: referral signups × CAC"),
        OpexLine("CRM / Analytics / Lifecycle Tools", "Growth & Marketing", const_formula(lifecycle_tools),
                 "Fixed monthly"),
        OpexLine("Product Software & Tools", "Product & Engineering", const_formula(software_tools),
                 "Fixed monthly"),
        OpexLine("Facilities & Admin", "General & Administrative", const_formula(facilities),
                 "Fixed monthly"),
    ]


def _scenario_kpis(ctx: WorkbookContext):
    def sc(which, key):
        return scenario_col_ref(ctx, key, which)

    def new_users_m1(which):
        return "+".join(sc(which, f"{channel_key}_signups_m1") for channel_key, _ in CHANNELS)

    def acquisition_spend_m1(which):
        parts = []
        for channel_key, _ in CHANNELS:
            parts.append(f"{sc(which, f'{channel_key}_signups_m1')}*{sc(which, f'{channel_key}_cac_per_signup')}")
        return "(" + "+".join(parts) + ")"

    def mau_m1(which):
        return (f"{sc(which, 'starting_mau')}+({new_users_m1(which)})-"
                f"{sc(which, 'starting_mau')}*{sc(which, 'mau_churn_rate_monthly')}")

    def retained_paid_m1(which):
        return f"{sc(which, 'starting_paid_subscribers')}*(1-{sc(which, 'paid_subscriber_churn_rate_monthly')})"

    def free_pool_m1(which):
        return f"MAX(0,({mau_m1(which)})-({retained_paid_m1(which)}))"

    def new_paid_m1(which):
        return f"({free_pool_m1(which)})*{sc(which, 'free_to_paid_conversion_rate')}"

    def ending_paid_m1(which):
        return f"({retained_paid_m1(which)})+({new_paid_m1(which)})"

    def blended_arpu_m1(which):
        return (f"{sc(which, 'plus_plan_price_monthly')}*(1-{sc(which, 'premium_mix_start')})+"
                f"{sc(which, 'premium_plan_price_monthly')}*{sc(which, 'premium_mix_start')}")

    def revenue_m1(which):
        return f"({ending_paid_m1(which)})*({blended_arpu_m1(which)})"

    def net_growth_approx(which):
        avg_signup_growth = "(" + "+".join(
            sc(which, f"{channel_key}_signup_growth_mom") for channel_key, _ in CHANNELS
        ) + ")/3"
        return (f"({avg_signup_growth})+{sc(which, 'free_to_paid_conversion_rate')}*0.35-"
                f"{sc(which, 'paid_subscriber_churn_rate_monthly')}+{sc(which, 'premium_mix_shift_mom')}*0.5")

    def revenue_36(which):
        return f"({revenue_m1(which)})*(1+{net_growth_approx(which)})^35"

    def total_cogs_m1(which):
        revenue = revenue_m1(which)
        variable_pct = f"{sc(which, 'app_store_fee_pct_revenue')}+{sc(which, 'payment_processing_pct_revenue')}"
        support_people = cost_of_role_month1(ctx, "support_start_fte", "support_monthly_cost_per_fte", which)
        return (
            f"({revenue})*({variable_pct})+({mau_m1(which)})*{sc(which, 'hosting_cost_per_mau')}+"
            f"({ending_paid_m1(which)})*{sc(which, 'ai_inference_cost_per_paid_sub')}+({support_people})"
        )

    def gross_margin_m1(which):
        return f"IFERROR((({revenue_m1(which)})-({total_cogs_m1(which)}))/({revenue_m1(which)}),0)"

    def opex_people_m1(which):
        return "+".join([
            cost_of_role_month1(ctx, "growth_start_fte", "growth_monthly_cost_per_fte", which),
            cost_of_role_month1(ctx, "product_start_fte", "product_monthly_cost_per_fte", which),
            cost_of_role_month1(ctx, "ga_start_fte", "ga_monthly_cost_per_fte", which),
        ])

    def opex_extra_m1(which):
        return (
            f"({acquisition_spend_m1(which)})+{sc(which, 'lifecycle_tools_fixed_monthly')}+"
            f"{sc(which, 'software_tools_fixed_monthly')}+{sc(which, 'facilities_fixed_monthly')}"
        )

    def burn1(which):
        return (f"MAX(0,({total_cogs_m1(which)})+({opex_people_m1(which)})+({opex_extra_m1(which)})-"
                f"({revenue_m1(which)}))")

    def runway1(which):
        return f"IFERROR({sc(which, 'starting_cash')}/MAX(1,{burn1(which)}),999)"

    g = ctx.grid
    first_col_letter = col_letter(g.month_col(0))
    last_col_letter = col_letter(g.month_col(g.n_months - 1))

    return [
        ScenarioKPI(
            "Revenue run-rate (Month 1 x 12)",
            "Month-1 subscription revenue annualized as a simple ARR-equivalent headline.",
            lambda w: f"({revenue_m1(w)})*12",
            f"'Revenue'!{first_col_letter}{ctx.ref_row('Revenue', 'total_revenue')+1}*12",
            "num",
            key="revenue_runrate_m1",
        ),
        ScenarioKPI(
            "Paid retention % (illustrative)",
            "1 − monthly paid subscriber churn rate.",
            lambda w: f"1-{sc(w, 'paid_subscriber_churn_rate_monthly')}",
            f"'Revenue'!{first_col_letter}{ctx.ref_row('Revenue', 'paid_retention_pct')+1}",
            "pct",
            key="paid_retention_illustrative",
        ),
        ScenarioKPI(
            "Implied Revenue at Month 36 (approx.)",
            "Month-1 revenue compounded at an illustrative blended paid-user growth trend for 35 more months.",
            revenue_36,
            f"'Revenue'!{last_col_letter}{ctx.ref_row('Revenue', 'total_revenue')+1}",
            "num",
            key="implied_revenue_36",
        ),
        ScenarioKPI(
            "Gross Margin % (illustrative, Month 1)",
            "Month-1 revenue less platform fees, hosting, AI inference, and support people cost.",
            gross_margin_m1,
            f"'COGS & GM'!{first_col_letter}{ctx.ref_row('COGS & GM', 'gross_margin_pct')+1}",
            "pct",
            key="gross_margin_m1",
        ),
        ScenarioKPI(
            "Month-1 Net Burn (illustrative)",
            "Month-1 COGS + Opex less revenue; floored at zero.",
            burn1,
            f"'Cash & Runway'!{first_col_letter}{ctx.ref_row('Cash & Runway', 'monthly_burn')+1}",
            "num",
            key="burn1_illustrative",
        ),
        ScenarioKPI(
            "Runway (illustrative, months)",
            "Starting cash divided by illustrative month-1 net burn.",
            runway1,
            f"'Cash & Runway'!{last_col_letter}{ctx.ref_row('Cash & Runway', 'runway_months')+1}",
            "months",
            key="runway_illustrative",
        ),
    ]



def _visuals(ctx: WorkbookContext):
    g = ctx.grid
    last_col = col_letter(g.month_col(g.n_months - 1))

    mau_row = ctx.ref_row("Revenue", "ending_mau")
    paid_row = ctx.ref_row("Revenue", "ending_paid_subscribers")
    revenue_row = ctx.ref_row("Revenue", "total_revenue")
    conversion_row = ctx.ref_row("Revenue", "free_to_paid_conversion_pct")
    gross_margin_row = ctx.ref_row("COGS & GM", "gross_margin_pct")
    contribution_margin_row = ctx.ref_row("COGS & GM", "contribution_margin_pct")
    ltv_cac_row = ctx.ref_row("COGS & GM", "ltv_cac")
    headcount_row = ctx.ref_row("Headcount", "total_headcount")
    cash_row = ctx.ref_row("Cash & Runway", "ending_cash")
    runway_row = ctx.ref_row("Cash & Runway", "runway_months")

    cards = [
        KPICard("MAU (Month 36)", f"'Revenue'!{last_col}{mau_row+1}", "num"),
        KPICard("Paid Subs (Month 36)", f"'Revenue'!{last_col}{paid_row+1}", "num"),
        KPICard("Revenue (Month 36)", f"'Revenue'!{last_col}{revenue_row+1}", "num"),
        KPICard("Gross Margin % (Month 36)", f"'COGS & GM'!{last_col}{gross_margin_row+1}", "pct"),
        KPICard("LTV : CAC (Month 36)", f"'COGS & GM'!{last_col}{ltv_cac_row+1}", "mult"),
        KPICard("Runway (months)", f"'Cash & Runway'!{last_col}{runway_row+1}", "months"),
    ]

    date_cat = (
        f"'Revenue'!${col_letter(g.month_start_col)}${TIMELINE_DATE_ROW+1}:"
        f"${col_letter(g.month_end_col)}${TIMELINE_DATE_ROW+1}"
    )

    def rng(sheet, row_idx):
        return range_ref(sheet, row_idx, g.month_start_col, g.month_end_col)

    charts = [
        ChartSpec("MAU & Revenue", "line", date_cat,
                  [ChartSeries("Ending MAU", rng("Revenue", mau_row)),
                   ChartSeries("Total Revenue", rng("Revenue", revenue_row))],
                  y_axis_name="users / $"),
        ChartSpec("Paid Subs & Free-to-Paid Conversion", "line", date_cat,
                  [ChartSeries("Ending Paid Subs", rng("Revenue", paid_row)),
                   ChartSeries("Free-to-Paid %", rng("Revenue", conversion_row))],
                  y_axis_name="subs / %"),
        ChartSpec("Gross Margin & Contribution Margin", "line", date_cat,
                  [ChartSeries("Gross Margin %", rng("COGS & GM", gross_margin_row)),
                   ChartSeries("Contribution Margin %", rng("COGS & GM", contribution_margin_row))],
                  y_axis_name="%"),
        ChartSpec("Cash & Runway", "line", date_cat,
                  [ChartSeries("Ending Cash", rng("Cash & Runway", cash_row)),
                   ChartSeries("Runway (months)", rng("Cash & Runway", runway_row))],
                  y_axis_name="$ / months"),
        ChartSpec("Headcount by Month", "column", date_cat,
                  [ChartSeries("Total Headcount", rng("Headcount", headcount_row))],
                  y_axis_name="FTE"),
        ChartSpec("Scenario Comparison — Implied Revenue at Month 36", "column", None,
                  [ChartSeries("Base / Upside / Downside", scenario_kpi_range(ctx, "implied_revenue_36"))]),
    ]
    return cards, charts



def _readme_sections():
    return [
        ("Business model",
         "This workbook models a consumer subscription app over 36 months. Users enter through paid, organic / viral, "
         "and influencer / referral channels, become monthly active users, and a portion converts from free to paid. "
         "Paid subscribers monetize through a blended two-tier subscription ARPU."),
        ("Key KPIs",
         "Headline metrics include MAU, paid subscribers, free-to-paid conversion, paid retention and churn, blended "
         "ARPU, CAC, LTV, LTV:CAC, CAC payback, gross margin, contribution margin, burn, and runway. Revenue and "
         "COGS tabs expose these directly, and the Scenarios tab summarizes six headline comparisons."),
        ("Modeling notes",
         "MAU churn and paid churn are modeled separately: paid churned subscribers are assumed to remain in the free "
         "MAU pool unless total MAU churn removes them. Acquisition spend is derived as channel signups multiplied by "
         "channel CAC, and app-store economics are simplified into a single blended platform-fee percentage."),
    ]



def build(output_path: str) -> WorkbookContext:
    ctx = WorkbookContext(output_path, MODEL_NAME, MODEL_SHORT)

    build_readme_sheet(
        ctx,
        overview=(
            "A 36-month, formula-driven financial model for a consumer subscription business. Start on the "
            "Assumptions tab: set Base / Upside / Downside inputs and pick a scenario. Every downstream tab "
            "recalculates automatically across acquisition, MAU, paid conversion, revenue, costs, burn, and runway."
        ),
        sections=_readme_sections(),
    )
    build_assumptions_sheet(
        ctx,
        _assumption_sections(),
        company_note="Tip: start with Base, then stress-test acquisition, conversion, churn, platform fees, and burn in Upside / Downside.",
    )
    build_headcount_sheet(ctx, _headcount_roles())
    _build_revenue_sheet(ctx)
    _build_cogs_sheet(ctx)
    build_opex_sheet(ctx, DEPARTMENTS, _opex_extra_lines(ctx))
    build_working_capital_sheet(ctx, WCConfig(
        dso_days_key="dso_days",
        dpo_days_key="dpo_days",
        deferred_rev_months_key="deferred_rev_months",
        capex_pct_revenue_key="capex_pct_revenue",
        useful_life_months_key="useful_life_months",
        other_current_assets_pct_revenue_key="other_current_assets_pct_revenue",
        interest_rate_key="interest_rate_annual",
        debt_draw_key="debt_draw_amount",
        debt_draw_month=9,
        debt_monthly_repayment_key="debt_monthly_repayment",
        debt_repayment_start_month=18,
        equity_rounds=[(5, "series_a_amount", "Growth Equity"), (21, "series_b_amount", "Follow-on Equity")],
    ))
    build_pnl_sheet(ctx, PnLConfig(departments=DEPARTMENTS, tax_rate_key="tax_rate"))
    build_cash_flow_sheet(ctx, CashFlowConfig(starting_cash_key="starting_cash"))
    build_balance_sheet(ctx, BalanceSheetConfig(
        starting_cash_key="starting_cash",
        starting_paid_in_capital_key="starting_paid_in_capital",
    ))
    build_cash_runway_sheet(ctx)
    build_scenarios_sheet(ctx, _scenario_kpis(ctx))
    cards, charts = _visuals(ctx)
    build_visuals_sheet(
        ctx,
        cards,
        charts,
        intro="MAU, paid conversion, unit economics, cash, headcount, and scenario trends for the Consumer Subscription model.",
    )
    build_checks_sheet(ctx)

    desired_sheet_order = [
        "Read Me", "Assumptions", "Headcount", "Revenue", "COGS & GM", "Opex",
        "Working Capital", "P&L", "Balance Sheet", "Cash Flow", "Cash & Runway",
        "Scenarios", "Visuals", "Checks",
    ]
    ctx.wb.worksheets_objs = [ctx.sheets[name] for name in desired_sheet_order if name in ctx.sheets]

    ctx.close()
    return ctx
