"""Model 2: AI API / Infrastructure.

Tiered customer bridge -> request volume bridge -> blended pricing and compute
unit economics -> infra-heavy COGS -> Opex -> integrated P&L/BS/CF -> Cash &
Runway -> Scenarios -> Visuals -> Checks.
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

MODEL_NAME = "AI API / Infrastructure — 3-Year Financial Model"
MODEL_SHORT = "ai_api_infrastructure"

DEPARTMENTS = ["Sales & Marketing", "R&D / Engineering", "General & Administrative"]
TIERS = [
    ("starter", "Starter"),
    ("growth", "Growth"),
    ("enterprise", "Enterprise"),
]


def _assumption_sections():
    return [
        S("Company & Financial", [
            A("starting_cash", "Starting cash balance", "$", 5_000_000, 5_000_000, 5_000_000, "num",
              "Cash on hand at the start of month 1."),
            A("starting_paid_in_capital", "Starting paid-in capital", "$", 6_500_000, 6_500_000, 6_500_000,
              "num", "Cumulative equity raised before the modeled period."),
            A("tax_rate", "Income tax rate", "%", 0.00, 0.00, 0.00, "pct0",
              "Applied only when Earnings Before Tax is positive; no NOL schedule modeled."),
        ]),
        S("Customers & Volume", [
            A("starter_start_customers", "Starter customers at month 1 start", "#", 30, 34, 26, "int",
              "Small self-serve / startup accounts."),
            A("starter_new_customers_m1", "Starter new customers, month 1", "#", 6, 8, 4, "num",
              "New Starter logos landed in month 1."),
            A("starter_new_growth_mom", "Starter new-customer growth, month over month", "%",
              seeded_value("aiapi_starter_new_growth_base", 0.020, 0.040),
              seeded_value("aiapi_starter_new_growth_up", 0.040, 0.060),
              seeded_value("aiapi_starter_new_growth_down", 0.000, 0.015), "pct",
              "Compounding growth in monthly Starter logo adds."),
            A("starter_churn_rate_monthly", "Starter monthly churn rate", "%", 0.030, 0.020, 0.045, "pct",
              "Share of beginning Starter customers that churn each month."),
            A("starter_usage_mreq_m1", "Starter usage per customer, month 1", "M req/mo", 4.0, 4.5, 3.5, "num",
              "Average monthly inference request-equivalents per active Starter customer."),
            A("starter_usage_growth_mom", "Starter usage growth per customer, month over month", "%",
              seeded_value("aiapi_starter_usage_growth_base", 0.030, 0.050),
              seeded_value("aiapi_starter_usage_growth_up", 0.055, 0.080),
              seeded_value("aiapi_starter_usage_growth_down", 0.010, 0.030), "pct",
              "Growth in monthly usage intensity per Starter customer."),

            A("growth_start_customers", "Growth customers at month 1 start", "#", 12, 14, 10, "int",
              "Mid-market accounts on annual commits."),
            A("growth_new_customers_m1", "Growth new customers, month 1", "#", 3, 4, 2, "num",
              "New Growth customers landed in month 1."),
            A("growth_new_growth_mom", "Growth new-customer growth, month over month", "%",
              seeded_value("aiapi_growth_new_growth_base", 0.015, 0.030),
              seeded_value("aiapi_growth_new_growth_up", 0.030, 0.045),
              seeded_value("aiapi_growth_new_growth_down", -0.005, 0.010), "pct",
              "Compounding growth in monthly Growth-customer adds."),
            A("growth_churn_rate_monthly", "Growth monthly churn rate", "%", 0.015, 0.010, 0.025, "pct",
              "Share of beginning Growth customers lost each month."),
            A("growth_usage_mreq_m1", "Growth usage per customer, month 1", "M req/mo", 25.0, 28.0, 22.0, "num",
              "Average monthly inference request-equivalents per active Growth customer."),
            A("growth_usage_growth_mom", "Growth usage growth per customer, month over month", "%",
              seeded_value("aiapi_growth_usage_growth_base", 0.025, 0.040),
              seeded_value("aiapi_growth_usage_growth_up", 0.045, 0.065),
              seeded_value("aiapi_growth_usage_growth_down", 0.008, 0.020), "pct",
              "Growth in monthly usage intensity per Growth customer."),

            A("enterprise_start_customers", "Enterprise customers at month 1 start", "#", 4, 5, 3, "int",
              "Large committed customers with higher-value workloads."),
            A("enterprise_new_customers_m1", "Enterprise new customers, month 1", "#", 1.0, 1.5, 0.5, "fte",
              "New Enterprise deals landed in month 1."),
            A("enterprise_new_growth_mom", "Enterprise new-customer growth, month over month", "%",
              seeded_value("aiapi_enterprise_new_growth_base", 0.010, 0.020),
              seeded_value("aiapi_enterprise_new_growth_up", 0.020, 0.035),
              seeded_value("aiapi_enterprise_new_growth_down", -0.010, 0.005), "pct",
              "Compounding growth in monthly Enterprise wins."),
            A("enterprise_churn_rate_monthly", "Enterprise monthly churn rate", "%", 0.005, 0.003, 0.010, "pct",
              "Share of beginning Enterprise customers lost each month."),
            A("enterprise_usage_mreq_m1", "Enterprise usage per customer, month 1", "M req/mo", 120.0, 135.0, 105.0,
              "num", "Average monthly inference request-equivalents per active Enterprise customer."),
            A("enterprise_usage_growth_mom", "Enterprise usage growth per customer, month over month", "%",
              seeded_value("aiapi_enterprise_usage_growth_base", 0.020, 0.032),
              seeded_value("aiapi_enterprise_usage_growth_up", 0.035, 0.050),
              seeded_value("aiapi_enterprise_usage_growth_down", 0.005, 0.018), "pct",
              "Growth in monthly usage intensity per Enterprise customer."),
        ]),
        S("Pricing & Unit Economics", [
            A("standard_price_per_mreq", "Standard-model list price per 1M requests", "$/M req", 2_200, 2_350, 2_050,
              "num", "Realized before tier multipliers and discounting."),
            A("premium_price_per_mreq", "Premium-model list price per 1M requests", "$/M req", 5_000, 5_250, 4_750,
              "num", "Higher-value reasoning / multimodal request pricing."),
            A("premium_model_mix_start", "Premium-model mix, month 1", "%", 0.25, 0.32, 0.18, "pct",
              "Share of usage billed on premium models at the start of the model."),
            A("premium_mix_shift_mom", "Premium-model mix shift, month over month", "%",
              seeded_value("aiapi_premium_mix_shift_base", 0.002, 0.005),
              seeded_value("aiapi_premium_mix_shift_up", 0.004, 0.007),
              seeded_value("aiapi_premium_mix_shift_down", -0.001, 0.002), "pct",
              "Monthly change in premium-model mix; capped inside the model."),
            A("starter_price_multiplier", "Starter realized price multiplier", "x", 0.85, 0.88, 0.82, "mult",
              "Discounted vs blended list price due to lower ACV and promotional pricing."),
            A("growth_price_multiplier", "Growth realized price multiplier", "x", 1.00, 1.03, 0.97, "mult",
              "Mid-market customers roughly at blended list price."),
            A("enterprise_price_multiplier", "Enterprise realized price multiplier", "x", 1.18, 1.22, 1.12, "mult",
              "Premium for SLA, throughput, and higher-value workloads."),
            A("committed_discount_rate", "Committed-use / volume discount rate", "%", 0.08, 0.06, 0.12, "pct",
              "Blended discount off list price for annual commits and committed capacity."),
            A("cache_hit_rate", "Cache hit rate", "%", 0.18, 0.24, 0.10, "pct",
              "Share of gross requests satisfied by cache rather than fresh inference."),
            A("cache_billing_credit_share", "Share of cache benefit passed back to customers", "%", 0.35, 0.25, 0.45,
              "pct", "Portion of cache savings that lowers billable units / effective invoice volume."),
            A("batch_discount_rate", "Batch / async discount rate", "%", 0.07, 0.10, 0.03, "pct",
              "Effective unit reduction from customers opting into batched / async processing."),
            A("starter_platform_fee_monthly", "Starter platform fee per customer", "$/mo", 500, 600, 450, "num",
              "Base platform / support fee billed monthly per Starter account."),
            A("growth_platform_fee_monthly", "Growth platform fee per customer", "$/mo", 2_500, 2_800, 2_200, "num",
              "Base platform fee billed monthly per Growth account."),
            A("enterprise_platform_fee_monthly", "Enterprise platform fee per customer", "$/mo", 12_000, 14_000,
              10_000, "num", "Base platform / SLA fee billed monthly per Enterprise account."),
        ]),
        S("COGS & Compute Costs", [
            A("reserved_compute_cost_per_mreq", "Reserved capacity compute cost per 1M requests", "$/M req", 900, 820,
              1_020, "num", "At target utilization; actual effective cost is adjusted by utilization."),
            A("ondemand_compute_cost_per_mreq", "On-demand compute cost per 1M requests", "$/M req", 1_500, 1_380,
              1_700, "num", "Pay-as-you-go compute cost for overflow / burst workloads."),
            A("provider_api_cost_standard_per_mreq", "External model/API cost per 1M standard requests", "$/M req", 400,
              360, 470, "num", "Third-party inference / foundation-model provider cost."),
            A("provider_api_cost_premium_per_mreq", "External model/API cost per 1M premium requests", "$/M req", 1_500,
              1_350, 1_700, "num", "Higher-cost premium provider / model blend."),
            A("storage_cost_per_mreq", "Storage / vector index cost per 1M requests", "$/M req", 45, 40, 55, "num",
              "Storage, retrieval, and persistent context cost allocated by usage."),
            A("egress_cost_per_mreq", "Bandwidth / egress cost per 1M requests", "$/M req", 60, 52, 72, "num",
              "Network and delivery cost allocated by gross request volume."),
            A("reserved_capacity_share", "Reserved-capacity share of compute volume", "%", 0.65, 0.75, 0.50, "pct",
              "Share of fresh inference volume routed to reserved capacity."),
            A("utilization_rate_start", "Reserved capacity utilization, month 1", "%", 0.55, 0.62, 0.45, "pct",
              "Blended utilization of reserved GPU / inference clusters in month 1."),
            A("utilization_improvement_mom", "Utilization improvement, month over month", "%",
              seeded_value("aiapi_utilization_improvement_base", 0.003, 0.006),
              seeded_value("aiapi_utilization_improvement_up", 0.005, 0.008),
              seeded_value("aiapi_utilization_improvement_down", 0.001, 0.003), "pct",
              "Monthly utilization ramp from better scheduling and fill-rate."),
        ]),
        S("Headcount — Cost of Revenue (COGS)", [
            A("infra_start_fte", "Starting Infrastructure / SRE FTEs", "#", 5, 5, 5, "fte",
              "Team operating inference clusters, reliability, and cost optimization."),
            A("infra_hires_per_quarter", "Infrastructure / SRE net adds per quarter", "#", 1.0, 1.5, 0.5, "fte", ""),
            A("infra_monthly_cost_per_fte", "Infrastructure / SRE fully-loaded cost per FTE", "$/mo", 16_000, 16_000,
              16_000, "num", "Salary + benefits + payroll tax, monthly."),
        ]),
        S("Headcount — R&D / Engineering (Opex)", [
            A("ml_start_fte", "Starting Model Engineering / Applied Research FTEs", "#", 4, 4, 4, "fte", ""),
            A("ml_hires_per_quarter", "Model Engineering / Applied Research net adds per quarter", "#", 1.0, 1.5, 0.5,
              "fte", ""),
            A("ml_monthly_cost_per_fte", "Model Engineering / Applied Research fully-loaded cost per FTE", "$/mo",
              18_000, 18_000, 18_000, "num", ""),
        ]),
        S("Headcount — Sales & Marketing (Opex)", [
            A("sales_start_fte", "Starting GTM / Sales FTEs", "#", 3, 3, 3, "fte",
              "Quota-carrying and solutions-oriented revenue team."),
            A("sales_hires_per_quarter", "GTM / Sales net adds per quarter", "#", 1.0, 1.5, 0.5, "fte", ""),
            A("sales_monthly_cost_per_fte", "GTM / Sales fully-loaded cost per FTE", "$/mo", 15_000, 15_000, 15_000,
              "num", ""),
        ]),
        S("Headcount — G&A (Opex)", [
            A("ga_start_fte", "Starting G&A FTEs", "#", 2, 2, 2, "fte", "Finance, HR, legal, and ops."),
            A("ga_hires_per_quarter", "G&A net adds per quarter", "#", 0.5, 0.5, 0.25, "fte", ""),
            A("ga_monthly_cost_per_fte", "G&A fully-loaded cost per FTE", "$/mo", 11_000, 11_000, 11_000, "num", ""),
        ]),
        S("GTM / Opex", [
            A("sales_commission_pct_new_revenue", "Sales commissions, % of new-customer revenue", "%", 0.06, 0.05,
              0.08, "pct", "Paid on new-customer monthly revenue added in the month it lands."),
            A("partner_fee_pct_usage_revenue", "Partner / marketplace fees, % of usage revenue", "%", 0.025, 0.020,
              0.030, "pct", "App-store / reseller / marketplace fees on metered usage revenue."),
            A("marketing_pct_revenue", "Marketing programs, % of revenue", "%", 0.07, 0.09, 0.05, "pct",
              "Paid acquisition, developer marketing, events, and ecosystem spend."),
            A("software_tools_fixed_monthly", "Software / tools fixed monthly spend", "$/mo", 12_000, 12_000, 12_000,
              "num", "Monitoring, CI/CD, developer tools, analytics, and security tooling."),
            A("facilities_fixed_monthly", "Facilities / admin fixed monthly spend", "$/mo", 9_000, 9_000, 9_000,
              "num", "Office, insurance, audit, recruiting, and other overhead."),
        ]),
        S("Working Capital & Financing", [
            A("dso_days", "Days Sales Outstanding (AR)", "days", 40, 35, 48, "int", ""),
            A("dpo_days", "Days Payable Outstanding (AP)", "days", 35, 38, 30, "int", ""),
            A("deferred_rev_months", "Deferred revenue held in advance", "mo", 0.6, 0.8, 0.4, "num",
              "Reflects annual prepaid platform commits and enterprise true-ups."),
            A("capex_pct_revenue", "Capex, % of revenue", "%", 0.08, 0.06, 0.12, "pct",
              "Capitalized infrastructure, proprietary tooling, and internal platform investments."),
            A("useful_life_months", "Useful life of capitalized assets", "months", 30, 30, 24, "int", ""),
            A("other_current_assets_pct_revenue", "Other current assets, % of revenue", "%", 0.04, 0.04, 0.04, "pct",
              "Prepaids, deposits, and other small current assets."),
            A("interest_rate_annual", "Venture debt annual interest rate", "%", 0.10, 0.09, 0.12, "pct", ""),
            A("debt_draw_amount", "Venture debt draw (one-time)", "$", 2_500_000, 3_000_000, 2_000_000, "num", ""),
            A("debt_monthly_repayment", "Venture debt monthly repayment", "$/mo", 60_000, 60_000, 50_000, "num",
              ""),
            A("series_a_amount", "Growth equity raise (month 4)", "$", 10_000_000, 12_000_000, 8_000_000, "num", ""),
            A("series_b_amount", "Follow-on equity raise (month 22)", "$", 20_000_000, 24_000_000, 15_000_000,
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
        "Tiered customer bridge -> usage volume -> blended realized pricing -> usage + platform revenue.",
    )
    row = write_timeline_header(ctx, ws, row)

    cache_hit = active_ref(ctx, "cache_hit_rate")
    cache_credit = active_ref(ctx, "cache_billing_credit_share")
    batch_discount = active_ref(ctx, "batch_discount_rate")
    standard_price = active_ref(ctx, "standard_price_per_mreq")
    premium_price = active_ref(ctx, "premium_price_per_mreq")
    premium_mix_start = active_ref(ctx, "premium_model_mix_start")
    premium_mix_shift = active_ref(ctx, "premium_mix_shift_mom")
    committed_discount = active_ref(ctx, "committed_discount_rate")

    tier_rows = {}

    for tier_key, tier_label in TIERS:
        start_customers = active_ref(ctx, f"{tier_key}_start_customers")
        new_customers_m1 = active_ref(ctx, f"{tier_key}_new_customers_m1")
        new_growth = active_ref(ctx, f"{tier_key}_new_growth_mom")
        churn = active_ref(ctx, f"{tier_key}_churn_rate_monthly")
        usage_m1 = active_ref(ctx, f"{tier_key}_usage_mreq_m1")
        usage_growth = active_ref(ctx, f"{tier_key}_usage_growth_mom")

        row = section_banner(ctx, ws, row, f"{tier_label} Tier")
        row += 1

        end_row_for_bridge = row + 3

        def beg_customers_formula(m, start_customers=start_customers, end_row_for_bridge=end_row_for_bridge):
            if m == 0:
                return start_customers
            prev = col_letter(g.month_col(m - 1))
            return f"{prev}{end_row_for_bridge+1}"

        r_beg = row
        row = write_row_series(ctx, ws, row, f"{tier_label} beginning customers", beg_customers_formula,
                               fmt=fmt.fte, aggregation="end")
        row += 1

        def new_customers_formula(m, new_customers_m1=new_customers_m1, new_growth=new_growth, this_row=row):
            if m == 0:
                return new_customers_m1
            prev = col_letter(g.month_col(m - 1))
            return f"{prev}{this_row+1}*(1+{new_growth})"

        r_new = row
        row = write_row_series(ctx, ws, row, f"{tier_label} new customers", new_customers_formula,
                               fmt=fmt.fte, aggregation="sum")
        row += 1

        def churned_customers_formula(m, churn=churn, r_beg=r_beg):
            col = col_letter(g.month_col(m))
            return f"-{col}{r_beg+1}*{churn}"

        r_churn = row
        row = write_row_series(ctx, ws, row, f"{tier_label} churned customers", churned_customers_formula,
                               fmt=fmt.fte, aggregation="sum")
        row += 1

        def end_customers_formula(m, r_beg=r_beg, r_new=r_new, r_churn=r_churn):
            col = col_letter(g.month_col(m))
            return f"{col}{r_beg+1}+{col}{r_new+1}+{col}{r_churn+1}"

        r_end = row
        row = write_row_series(ctx, ws, row, f"{tier_label} ending customers", end_customers_formula,
                               fmt=fmt.fte, aggregation="end", subtotal=True)
        ctx.set_ref("Revenue", f"{tier_key}_end_customers", row)
        row += 1

        def usage_per_customer_formula(m, usage_m1=usage_m1, usage_growth=usage_growth, this_row=row):
            if m == 0:
                return usage_m1
            prev = col_letter(g.month_col(m - 1))
            return f"{prev}{this_row+1}*(1+{usage_growth})"

        r_usage_per_customer = row
        row = write_row_series(ctx, ws, row, f"{tier_label} usage per customer", usage_per_customer_formula,
                               note="Monthly inference request-equivalents in millions", fmt=fmt.num2,
                               aggregation="avg")
        row += 1

        def gross_volume_formula(m, r_end=r_end, r_usage_per_customer=r_usage_per_customer):
            col = col_letter(g.month_col(m))
            return f"{col}{r_end+1}*{col}{r_usage_per_customer+1}"

        row = write_row_series(ctx, ws, row, f"{tier_label} gross request volume", gross_volume_formula,
                               note="Active customers × usage per customer (M requests)", fmt=fmt.num,
                               aggregation="sum")
        ctx.set_ref("Revenue", f"{tier_key}_gross_volume", row)
        r_gross_volume = row
        row += 1
        row = blank_row(ctx, ws, row) + 1

        tier_rows[tier_key] = {
            "beg": r_beg,
            "new": r_new,
            "churn": r_churn,
            "end": r_end,
            "usage_per_customer": r_usage_per_customer,
            "gross_volume": r_gross_volume,
        }

    row = section_banner(ctx, ws, row, "Pricing, Volume & Revenue Bridge")
    row += 1

    def premium_mix_formula(m, premium_mix_start=premium_mix_start, premium_mix_shift=premium_mix_shift, this_row=row):
        if m == 0:
            return premium_mix_start
        prev = col_letter(g.month_col(m - 1))
        return f"MIN(0.60,MAX(0.05,{prev}{this_row+1}+{premium_mix_shift}))"

    r_premium_mix = row
    row = write_row_series(ctx, ws, row, "Premium-model mix", premium_mix_formula, fmt=fmt.pct,
                           aggregation="avg")
    ctx.set_ref("Revenue", "premium_model_mix", row)
    row += 1

    def blended_list_price_formula(m, r_premium_mix=r_premium_mix):
        col = col_letter(g.month_col(m))
        return f"({standard_price}*(1-{col}{r_premium_mix+1})+{premium_price}*{col}{r_premium_mix+1})"

    r_blended_price = row
    row = write_row_series(ctx, ws, row, "Blended list price per 1M requests", blended_list_price_formula,
                           fmt=fmt.num2, aggregation="avg")
    ctx.set_ref("Revenue", "blended_list_price", row)
    row += 1

    def billable_factor_formula(m):
        return f"(1-{cache_hit}*{cache_credit})*(1-{batch_discount})"

    r_billable_factor = row
    row = write_row_series(ctx, ws, row, "Billable-volume factor", billable_factor_formula,
                           note="Gross volume reduced for cache credits and batch discounts", fmt=fmt.pct,
                           aggregation="avg")
    ctx.set_ref("Revenue", "billable_factor", row)
    row += 1

    tier_price_rows = {}
    for tier_key, tier_label in TIERS:
        tier_multiplier = active_ref(ctx, f"{tier_key}_price_multiplier")

        def tier_net_price_formula(m, tier_multiplier=tier_multiplier, r_blended_price=r_blended_price):
            col = col_letter(g.month_col(m))
            return f"{col}{r_blended_price+1}*(1-{committed_discount})*{tier_multiplier}"

        price_row = row
        row = write_row_series(ctx, ws, row, f"{tier_label} net price per 1M requests", tier_net_price_formula,
                               fmt=fmt.num2, aggregation="avg")
        ctx.set_ref("Revenue", f"{tier_key}_net_price", row)
        tier_price_rows[tier_key] = row
        row += 1

    row = blank_row(ctx, ws, row) + 1
    component_rows = {"usage": [], "platform": [], "tier_total": [], "new_rev": []}
    for tier_key, tier_label in TIERS:
        gross_volume_row = ctx.ref_row("Revenue", f"{tier_key}_gross_volume")
        price_row = tier_price_rows[tier_key]
        fee_ref = active_ref(ctx, f"{tier_key}_platform_fee_monthly")
        end_customers_row = ctx.ref_row("Revenue", f"{tier_key}_end_customers")
        new_customers_row = tier_rows[tier_key]["new"]
        usage_per_customer_row = tier_rows[tier_key]["usage_per_customer"]

        def usage_revenue_formula(m, gross_volume_row=gross_volume_row, price_row=price_row, r_billable_factor=r_billable_factor):
            col = col_letter(g.month_col(m))
            return f"{col}{gross_volume_row+1}*{col}{r_billable_factor+1}*{col}{price_row+1}"

        row = write_row_series(ctx, ws, row, f"{tier_label} usage revenue", usage_revenue_formula,
                               fmt=fmt.num, aggregation="sum")
        ctx.set_ref("Revenue", f"{tier_key}_usage_revenue", row)
        usage_row = row
        component_rows["usage"].append(row)
        row += 1

        def platform_revenue_formula(m, fee_ref=fee_ref, end_customers_row=end_customers_row):
            col = col_letter(g.month_col(m))
            return f"{col}{end_customers_row+1}*{fee_ref}"

        row = write_row_series(ctx, ws, row, f"{tier_label} platform revenue", platform_revenue_formula,
                               fmt=fmt.num, aggregation="sum")
        ctx.set_ref("Revenue", f"{tier_key}_platform_revenue", row)
        platform_row = row
        component_rows["platform"].append(row)
        row += 1

        def tier_total_formula(m, usage_row=usage_row, platform_row=platform_row):
            col = col_letter(g.month_col(m))
            return f"{col}{usage_row+1}+{col}{platform_row+1}"

        row = write_row_series(ctx, ws, row, f"{tier_label} total revenue", tier_total_formula,
                               fmt=fmt.num_subtotal, aggregation="sum", subtotal=True)
        ctx.set_ref("Revenue", f"{tier_key}_total_revenue", row)
        component_rows["tier_total"].append(row)
        row += 1

        def new_customer_revenue_formula(m, new_customers_row=new_customers_row, usage_per_customer_row=usage_per_customer_row,
                                         r_billable_factor=r_billable_factor, price_row=price_row, fee_ref=fee_ref):
            col = col_letter(g.month_col(m))
            usage_component = f"{col}{new_customers_row+1}*{col}{usage_per_customer_row+1}*{col}{r_billable_factor+1}*{col}{price_row+1}"
            platform_component = f"{col}{new_customers_row+1}*{fee_ref}"
            return f"{usage_component}+{platform_component}"

        row = write_row_series(ctx, ws, row, f"{tier_label} new-customer revenue added", new_customer_revenue_formula,
                               note="Used for sales commission modeling", fmt=fmt.num, aggregation="sum")
        ctx.set_ref("Revenue", f"{tier_key}_new_customer_revenue", row)
        component_rows["new_rev"].append(row)
        row += 1
        row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "Revenue Totals & KPIs")
    row += 1

    def total_gross_volume_formula(m):
        col = col_letter(g.month_col(m))
        return "+".join(f"{col}{ctx.ref_row('Revenue', f'{tier_key}_gross_volume')+1}" for tier_key, _ in TIERS)

    row = write_row_series(ctx, ws, row, "Total gross request volume", total_gross_volume_formula,
                           note="Sum of tier gross volume (M requests)", fmt=fmt.num, aggregation="sum")
    ctx.set_ref("Revenue", "total_gross_volume", row)
    gross_total_row = row
    row += 1

    def total_billable_volume_formula(m, gross_total_row=gross_total_row, r_billable_factor=r_billable_factor):
        col = col_letter(g.month_col(m))
        return f"{col}{gross_total_row+1}*{col}{r_billable_factor+1}"

    row = write_row_series(ctx, ws, row, "Total billable request volume", total_billable_volume_formula,
                           note="Gross volume × billable-volume factor (M requests)", fmt=fmt.num,
                           aggregation="sum")
    ctx.set_ref("Revenue", "total_billable_volume", row)
    billable_volume_row = row
    row += 1

    def total_usage_revenue_formula(m, rows=list(component_rows["usage"])):
        col = col_letter(g.month_col(m))
        return "+".join(f"{col}{r+1}" for r in rows)

    row = write_row_series(ctx, ws, row, "Total usage revenue", total_usage_revenue_formula,
                           fmt=fmt.num, aggregation="sum")
    ctx.set_ref("Revenue", "total_usage_revenue", row)
    usage_total_row = row
    row += 1

    def total_platform_revenue_formula(m, rows=list(component_rows["platform"])):
        col = col_letter(g.month_col(m))
        return "+".join(f"{col}{r+1}" for r in rows)

    row = write_row_series(ctx, ws, row, "Total platform / subscription revenue", total_platform_revenue_formula,
                           fmt=fmt.num, aggregation="sum")
    ctx.set_ref("Revenue", "total_platform_revenue", row)
    platform_total_row = row
    row += 1

    def new_customer_revenue_total_formula(m, rows=list(component_rows["new_rev"])):
        col = col_letter(g.month_col(m))
        return "+".join(f"{col}{r+1}" for r in rows)

    row = write_row_series(ctx, ws, row, "Total new-customer revenue added", new_customer_revenue_total_formula,
                           note="Used for variable sales commissions", fmt=fmt.num, aggregation="sum")
    ctx.set_ref("Revenue", "new_customer_revenue", row)
    row += 1

    def total_revenue_formula(m, usage_total_row=usage_total_row, platform_total_row=platform_total_row):
        col = col_letter(g.month_col(m))
        return f"{col}{usage_total_row+1}+{col}{platform_total_row+1}"

    row = write_row_series(ctx, ws, row, "Total Revenue", total_revenue_formula, fmt=fmt.num_total,
                           aggregation="sum", total=True)
    ctx.set_ref("Revenue", "total_revenue", row)
    total_revenue_row = row
    row += 1
    row = blank_row(ctx, ws, row) + 1

    def total_customers_formula(m):
        col = col_letter(g.month_col(m))
        return "+".join(f"{col}{ctx.ref_row('Revenue', f'{tier_key}_end_customers')+1}" for tier_key, _ in TIERS)

    row = write_row_series(ctx, ws, row, "Total active customers", total_customers_formula, fmt=fmt.fte,
                           aggregation="end")
    ctx.set_ref("Revenue", "total_active_customers", row)
    total_customers_row = row
    row += 1

    def revenue_per_mreq_formula(m, usage_total_row=usage_total_row, billable_volume_row=billable_volume_row):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{usage_total_row+1}/{col}{billable_volume_row+1},0)"

    row = write_row_series(ctx, ws, row, "Usage revenue per billable 1M requests", revenue_per_mreq_formula,
                           fmt=fmt.num2, aggregation="avg")
    ctx.set_ref("Revenue", "revenue_per_mreq", row)
    row += 1

    def platform_mix_formula(m, total_revenue_row=total_revenue_row, platform_total_row=platform_total_row):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{platform_total_row+1}/{col}{total_revenue_row+1},0)"

    row = write_row_series(ctx, ws, row, "Platform-fee share of revenue", platform_mix_formula,
                           fmt=fmt.pct, aggregation="avg")
    row += 1

    enterprise_total_row = ctx.ref_row("Revenue", "enterprise_total_revenue")

    def enterprise_share_formula(m, enterprise_total_row=enterprise_total_row, total_revenue_row=total_revenue_row):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{enterprise_total_row+1}/{col}{total_revenue_row+1},0)"

    row = write_row_series(ctx, ws, row, "Enterprise revenue concentration", enterprise_share_formula,
                           note="Enterprise-tier revenue as % of total revenue", fmt=fmt.pct,
                           aggregation="avg")
    ctx.set_ref("Revenue", "enterprise_revenue_share", row)
    row += 1

    def average_revenue_per_customer_formula(m, total_revenue_row=total_revenue_row, total_customers_row=total_customers_row):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{total_revenue_row+1}/{col}{total_customers_row+1},0)"

    row = write_row_series(ctx, ws, row, "Average revenue per active customer", average_revenue_per_customer_formula,
                           fmt=fmt.num2, aggregation="avg")
    row += 1

    def volume_growth_formula(m, billable_volume_row=billable_volume_row):
        col = col_letter(g.month_col(m))
        if m == 0:
            return "0"
        prev = col_letter(g.month_col(m - 1))
        return f"IFERROR({col}{billable_volume_row+1}/{prev}{billable_volume_row+1}-1,0)"

    row = write_row_series(ctx, ws, row, "Billable-volume growth (month over month)", volume_growth_formula,
                           fmt=fmt.pct, aggregation="avg")
    row += 1

    def revenue_growth_formula(m, total_revenue_row=total_revenue_row):
        col = col_letter(g.month_col(m))
        if m == 0:
            return "0"
        prev = col_letter(g.month_col(m - 1))
        return f"IFERROR({col}{total_revenue_row+1}/{prev}{total_revenue_row+1}-1,0)"

    row = write_row_series(ctx, ws, row, "Revenue growth (month over month)", revenue_growth_formula,
                           fmt=fmt.pct, aggregation="avg")
    ctx.set_ref("Revenue", "revenue_growth_mom", row)
    row += 1


def _build_cogs_sheet(ctx: WorkbookContext) -> None:
    ws = ctx.add_sheet("COGS & GM")
    g = ctx.grid
    fmt = ctx.fmt
    row = setup_common_sheet(
        ctx,
        ws,
        "COGS & GM",
        "Compute, model-provider, storage, bandwidth, and infrastructure people costs tied to usage volume.",
    )
    row = write_timeline_header(ctx, ws, row)

    rev_row = ctx.ref_row("Revenue", "total_revenue")
    usage_rev_row = ctx.ref_row("Revenue", "total_usage_revenue")
    gross_volume_row = ctx.ref_row("Revenue", "total_gross_volume")
    billable_volume_row = ctx.ref_row("Revenue", "total_billable_volume")
    premium_mix_row = ctx.ref_row("Revenue", "premium_model_mix")

    reserved_compute_cost = active_ref(ctx, "reserved_compute_cost_per_mreq")
    ondemand_compute_cost = active_ref(ctx, "ondemand_compute_cost_per_mreq")
    provider_std_cost = active_ref(ctx, "provider_api_cost_standard_per_mreq")
    provider_premium_cost = active_ref(ctx, "provider_api_cost_premium_per_mreq")
    storage_cost = active_ref(ctx, "storage_cost_per_mreq")
    egress_cost = active_ref(ctx, "egress_cost_per_mreq")
    reserved_share = active_ref(ctx, "reserved_capacity_share")
    cache_hit = active_ref(ctx, "cache_hit_rate")
    batch_discount = active_ref(ctx, "batch_discount_rate")
    utilization_start = active_ref(ctx, "utilization_rate_start")
    utilization_improve = active_ref(ctx, "utilization_improvement_mom")

    row = section_banner(ctx, ws, row, "Volume Drivers & Utilization")
    row += 1

    row = write_row_series(ctx, ws, row, "Gross request volume", same_col_link("Revenue", gross_volume_row, ctx),
                           note="Linked from Revenue tab (M requests)", fmt=fmt.num, aggregation="sum")
    row += 1

    row = write_row_series(ctx, ws, row, "Billable request volume", same_col_link("Revenue", billable_volume_row, ctx),
                           note="Linked from Revenue tab (M requests)", fmt=fmt.num, aggregation="sum")
    ctx.set_ref("COGS & GM", "billable_volume", row)
    linked_billable_row = row
    row += 1

    def processed_volume_formula(m, gross_volume_row=gross_volume_row):
        gross = f"'Revenue'!{col_letter(g.month_col(m))}{gross_volume_row+1}"
        return f"{gross}*(1-{cache_hit})*(1-{batch_discount})"

    row = write_row_series(ctx, ws, row, "Fresh-inference / processed volume", processed_volume_formula,
                           note="Gross volume after cache hits and batch discounts (M requests)", fmt=fmt.num,
                           aggregation="sum")
    ctx.set_ref("COGS & GM", "processed_volume", row)
    processed_volume_row = row
    row += 1

    def utilization_formula(m, utilization_start=utilization_start, utilization_improve=utilization_improve, this_row=row):
        if m == 0:
            return utilization_start
        prev = col_letter(g.month_col(m - 1))
        return f"MIN(0.88,MAX(0.35,{prev}{this_row+1}+{utilization_improve}))"

    row = write_row_series(ctx, ws, row, "Reserved-capacity utilization", utilization_formula,
                           fmt=fmt.pct, aggregation="avg")
    ctx.set_ref("COGS & GM", "utilization_rate", row)
    utilization_row = row
    row += 1

    def effective_compute_cost_formula(m, utilization_row=utilization_row):
        col = col_letter(g.month_col(m))
        return f"({reserved_share}*{reserved_compute_cost}/MAX(0.35,{col}{utilization_row+1})+(1-{reserved_share})*{ondemand_compute_cost})"

    row = write_row_series(ctx, ws, row, "Effective compute cost per 1M requests", effective_compute_cost_formula,
                           note="Reserved cost is utilization-adjusted, then blended with on-demand", fmt=fmt.num2,
                           aggregation="avg")
    ctx.set_ref("COGS & GM", "effective_compute_cost_per_mreq", row)
    effective_compute_row = row
    row += 1

    def provider_cost_formula(m, premium_mix_row=premium_mix_row):
        col = col_letter(g.month_col(m))
        premium_mix = f"'Revenue'!{col}{premium_mix_row+1}"
        return f"({provider_std_cost}*(1-{premium_mix})+{provider_premium_cost}*{premium_mix})"

    row = write_row_series(ctx, ws, row, "Blended provider/API cost per 1M requests", provider_cost_formula,
                           note="Weighted average of standard and premium provider cost", fmt=fmt.num2,
                           aggregation="avg")
    ctx.set_ref("COGS & GM", "provider_cost_per_mreq", row)
    provider_cost_row = row
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "COGS Components")
    row += 1

    def compute_infra_formula(m, processed_volume_row=processed_volume_row, effective_compute_row=effective_compute_row):
        col = col_letter(g.month_col(m))
        return f"{col}{processed_volume_row+1}*{col}{effective_compute_row+1}"

    r_compute = row
    row = write_row_series(ctx, ws, row, "Compute infrastructure", compute_infra_formula,
                           fmt=fmt.num, aggregation="sum")
    row += 1

    def provider_formula(m, processed_volume_row=processed_volume_row, provider_cost_row=provider_cost_row):
        col = col_letter(g.month_col(m))
        return f"{col}{processed_volume_row+1}*{col}{provider_cost_row+1}"

    r_provider = row
    row = write_row_series(ctx, ws, row, "External model / API providers", provider_formula,
                           fmt=fmt.num, aggregation="sum")
    row += 1

    def storage_formula(m, gross_volume_row=gross_volume_row):
        col = col_letter(g.month_col(m))
        gross = f"'Revenue'!{col}{gross_volume_row+1}"
        return f"{gross}*{storage_cost}"

    r_storage = row
    row = write_row_series(ctx, ws, row, "Storage / vector / retrieval", storage_formula,
                           fmt=fmt.num, aggregation="sum")
    row += 1

    def egress_formula(m, gross_volume_row=gross_volume_row):
        col = col_letter(g.month_col(m))
        gross = f"'Revenue'!{col}{gross_volume_row+1}"
        return f"{gross}*{egress_cost}"

    r_egress = row
    row = write_row_series(ctx, ws, row, "Bandwidth / egress", egress_formula,
                           fmt=fmt.num, aggregation="sum")
    row += 1

    infra_people_row = ctx.ref_row("Headcount", "total_cogs_cost")
    r_people = row
    row = write_row_series(ctx, ws, row, "Infrastructure / SRE people cost",
                           same_col_link("Headcount", infra_people_row, ctx), fmt=fmt.num, aggregation="sum")
    row += 1

    def total_cogs_formula(m, rows=[r_compute, r_provider, r_storage, r_egress, r_people]):
        col = col_letter(g.month_col(m))
        return "+".join(f"{col}{r+1}" for r in rows)

    row = write_row_series(ctx, ws, row, "Total COGS", total_cogs_formula, fmt=fmt.num_total,
                           aggregation="sum", total=True)
    ctx.set_ref("COGS & GM", "total_cogs", row)
    total_cogs_row = row
    row += 1
    row = blank_row(ctx, ws, row) + 1

    row = section_banner(ctx, ws, row, "Margins & Unit-Economics KPIs")
    row += 1

    def gross_profit_formula(m, rev_row=rev_row, total_cogs_row=total_cogs_row):
        col = col_letter(g.month_col(m))
        rev = f"'Revenue'!{col}{rev_row+1}"
        return f"{rev}-{col}{total_cogs_row+1}"

    row = write_row_series(ctx, ws, row, "Gross Profit", gross_profit_formula,
                           fmt=fmt.num_subtotal, aggregation="sum", subtotal=True)
    ctx.set_ref("COGS & GM", "gross_profit", row)
    gross_profit_row = row
    row += 1

    def gross_margin_formula(m, rev_row=rev_row, gross_profit_row=gross_profit_row):
        col = col_letter(g.month_col(m))
        rev = f"'Revenue'!{col}{rev_row+1}"
        return f"IFERROR({col}{gross_profit_row+1}/{rev},0)"

    row = write_row_series(ctx, ws, row, "Gross Margin %", gross_margin_formula,
                           fmt=fmt.pct, aggregation="avg")
    ctx.set_ref("COGS & GM", "gross_margin_pct", row)
    row += 1

    def cogs_per_billable_formula(m, linked_billable_row=linked_billable_row, total_cogs_row=total_cogs_row):
        col = col_letter(g.month_col(m))
        return f"IFERROR({col}{total_cogs_row+1}/{col}{linked_billable_row+1},0)"

    row = write_row_series(ctx, ws, row, "COGS per billable 1M requests", cogs_per_billable_formula,
                           fmt=fmt.num2, aggregation="avg")
    ctx.set_ref("COGS & GM", "cogs_per_mreq", row)
    cogs_per_mreq_row = row
    row += 1

    def inference_margin_formula(m, usage_rev_row=usage_rev_row, r_compute=r_compute, r_provider=r_provider):
        col = col_letter(g.month_col(m))
        usage_rev = f"'Revenue'!{col}{usage_rev_row+1}"
        core_cost = f"{col}{r_compute+1}+{col}{r_provider+1}"
        return f"IFERROR(({usage_rev}-({core_cost}))/{usage_rev},0)"

    row = write_row_series(ctx, ws, row, "Inference margin %", inference_margin_formula,
                           note="Usage revenue less compute + provider cost, as % of usage revenue", fmt=fmt.pct,
                           aggregation="avg")
    ctx.set_ref("COGS & GM", "inference_margin_pct", row)
    inference_margin_row = row
    row += 1

    row = write_row_series(ctx, ws, row, "Reserved-capacity utilization", same_col_link("COGS & GM", utilization_row, ctx),
                           fmt=fmt.pct, aggregation="avg")
    row += 1

    def enterprise_concentration_formula(m):
        enterprise_share_row = ctx.ref_row("Revenue", "enterprise_revenue_share")
        col = col_letter(g.month_col(m))
        return f"'Revenue'!{col}{enterprise_share_row+1}"

    row = write_row_series(ctx, ws, row, "Enterprise revenue concentration", enterprise_concentration_formula,
                           fmt=fmt.pct, aggregation="avg")
    row += 1

    def burn_multiple_formula(m):
        col = col_letter(g.month_col(m))
        burn = f"INDEX('Cash & Runway'!$C:$AL,MATCH(\"Monthly Net Burn\",'Cash & Runway'!$A:$A,0),{m+1})"
        new_rev = f"'Revenue'!{col}{ctx.ref_row('Revenue', 'new_customer_revenue')+1}"
        return f"IFERROR({burn}/MAX(1,{new_rev}),999)"

    row = write_row_series(ctx, ws, row, "Burn multiple", burn_multiple_formula,
                           note="Monthly net burn ÷ new-customer revenue added", fmt=fmt.mult,
                           aggregation="avg")
    row += 1

    def runway_formula(m):
        return f"INDEX('Cash & Runway'!$C:$AL,MATCH(\"Runway (months)\",'Cash & Runway'!$A:$A,0),{m+1})"

    row = write_row_series(ctx, ws, row, "Runway (months)", runway_formula,
                           fmt=fmt.months_fmt, aggregation="end")
    ctx.set_ref("COGS & GM", "runway_months_link", row)
    row += 1


def _headcount_roles():
    return [
        Role("infra", "Infrastructure / SRE", COGS, "Cost of Revenue", "infra_start_fte",
             "infra_hires_per_quarter", "infra_monthly_cost_per_fte"),
        Role("ml", "Model Engineering / Applied Research", OPEX, "R&D / Engineering", "ml_start_fte",
             "ml_hires_per_quarter", "ml_monthly_cost_per_fte"),
        Role("sales", "GTM / Sales", OPEX, "Sales & Marketing", "sales_start_fte",
             "sales_hires_per_quarter", "sales_monthly_cost_per_fte"),
        Role("ga", "G&A (Finance / HR / Ops)", OPEX, "General & Administrative", "ga_start_fte",
             "ga_hires_per_quarter", "ga_monthly_cost_per_fte"),
    ]


def _opex_extra_lines(ctx: WorkbookContext):
    g = ctx.grid
    commission_ref = active_ref(ctx, "sales_commission_pct_new_revenue")
    partner_ref = active_ref(ctx, "partner_fee_pct_usage_revenue")
    marketing_ref = active_ref(ctx, "marketing_pct_revenue")
    software_ref = active_ref(ctx, "software_tools_fixed_monthly")
    facilities_ref = active_ref(ctx, "facilities_fixed_monthly")

    def commission_formula(m):
        new_rev_row = ctx.ref_row("Revenue", "new_customer_revenue")
        col = col_letter(g.month_col(m))
        return f"'Revenue'!{col}{new_rev_row+1}*{commission_ref}"

    def partner_formula(m):
        usage_rev_row = ctx.ref_row("Revenue", "total_usage_revenue")
        col = col_letter(g.month_col(m))
        return f"'Revenue'!{col}{usage_rev_row+1}*{partner_ref}"

    def marketing_formula(m):
        rev_row = ctx.ref_row("Revenue", "total_revenue")
        col = col_letter(g.month_col(m))
        return f"'Revenue'!{col}{rev_row+1}*{marketing_ref}"

    def software_formula(m):
        return software_ref

    def facilities_formula(m):
        return facilities_ref

    return [
        OpexLine("Sales Commissions", "Sales & Marketing", commission_formula, "% of new-customer revenue added"),
        OpexLine("Partner / Marketplace Fees", "Sales & Marketing", partner_formula, "% of usage revenue"),
        OpexLine("Marketing Programs", "Sales & Marketing", marketing_formula, "% of total revenue"),
        OpexLine("Software & Tools", "General & Administrative", software_formula, "Fixed monthly"),
        OpexLine("Facilities & Admin", "General & Administrative", facilities_formula, "Fixed monthly"),
    ]


def _scenario_kpis(ctx: WorkbookContext):
    def sc(which, key):
        return scenario_col_ref(ctx, key, which)

    def end_customers_m1(which, tier_key):
        return f"{sc(which, f'{tier_key}_start_customers')}+{sc(which, f'{tier_key}_new_customers_m1')}-{sc(which, f'{tier_key}_start_customers')}*{sc(which, f'{tier_key}_churn_rate_monthly')}"

    def gross_volume_m1(which):
        parts = []
        for tier_key, _ in TIERS:
            parts.append(f"({end_customers_m1(which, tier_key)})*{sc(which, f'{tier_key}_usage_mreq_m1')}")
        return "(" + "+".join(parts) + ")"

    def billable_factor(which):
        return f"(1-{sc(which, 'cache_hit_rate')}*{sc(which, 'cache_billing_credit_share')})*(1-{sc(which, 'batch_discount_rate')})"

    def processed_factor(which):
        return f"(1-{sc(which, 'cache_hit_rate')})*(1-{sc(which, 'batch_discount_rate')})"

    def premium_mix_m1(which):
        return sc(which, "premium_model_mix_start")

    def blended_list_price_m1(which):
        return f"({sc(which, 'standard_price_per_mreq')}*(1-{premium_mix_m1(which)})+{sc(which, 'premium_price_per_mreq')}*{premium_mix_m1(which)})"

    def net_price_m1(which, tier_key):
        return f"({blended_list_price_m1(which)})*(1-{sc(which, 'committed_discount_rate')})*{sc(which, f'{tier_key}_price_multiplier')}"

    def usage_rev_m1(which):
        parts = []
        for tier_key, _ in TIERS:
            tier_gross = f"({end_customers_m1(which, tier_key)})*{sc(which, f'{tier_key}_usage_mreq_m1')}"
            parts.append(f"({tier_gross})*({billable_factor(which)})*({net_price_m1(which, tier_key)})")
        return "(" + "+".join(parts) + ")"

    def platform_rev_m1(which):
        parts = []
        for tier_key, _ in TIERS:
            parts.append(f"({end_customers_m1(which, tier_key)})*{sc(which, f'{tier_key}_platform_fee_monthly')}")
        return "(" + "+".join(parts) + ")"

    def revenue_m1(which):
        return f"({usage_rev_m1(which)})+({platform_rev_m1(which)})"

    def revenue_runrate_m1(which):
        return f"({revenue_m1(which)})*12"

    def revenue_growth_mom(which):
        customer_growth = "+".join(sc(which, f"{tier_key}_new_growth_mom") for tier_key, _ in TIERS)
        usage_growth = "+".join(sc(which, f"{tier_key}_usage_growth_mom") for tier_key, _ in TIERS)
        churn_drag = "+".join(sc(which, f"{tier_key}_churn_rate_monthly") for tier_key, _ in TIERS)
        return (f"(({customer_growth})/3+({usage_growth})/3-({churn_drag})/3+"
                f"{sc(which, 'premium_mix_shift_mom')}*0.5)")

    def revenue_36(which):
        return f"({revenue_m1(which)})*(1+{revenue_growth_mom(which)})^35"

    def effective_compute_cost_m1(which):
        return (f"({sc(which, 'reserved_capacity_share')}*{sc(which, 'reserved_compute_cost_per_mreq')}/"
                f"MAX(0.35,{sc(which, 'utilization_rate_start')})+"
                f"(1-{sc(which, 'reserved_capacity_share')})*{sc(which, 'ondemand_compute_cost_per_mreq')})")

    def provider_cost_m1(which):
        return (f"({sc(which, 'provider_api_cost_standard_per_mreq')}*(1-{premium_mix_m1(which)})+"
                f"{sc(which, 'provider_api_cost_premium_per_mreq')}*{premium_mix_m1(which)})")

    def total_cogs_m1(which):
        gross = gross_volume_m1(which)
        processed = processed_factor(which)
        variable = (
            f"({gross})*({processed})*(({effective_compute_cost_m1(which)})+({provider_cost_m1(which)}))+"
            f"({gross})*{sc(which, 'storage_cost_per_mreq')}+({gross})*{sc(which, 'egress_cost_per_mreq')}"
        )
        people = cost_of_role_month1(ctx, "infra_start_fte", "infra_monthly_cost_per_fte", which)
        return f"({variable})+({people})"

    def gross_margin_m1(which):
        return f"IFERROR((({revenue_m1(which)})-({total_cogs_m1(which)}))/({revenue_m1(which)}),0)"

    def opex_people_m1(which):
        return "+".join([
            cost_of_role_month1(ctx, "ml_start_fte", "ml_monthly_cost_per_fte", which),
            cost_of_role_month1(ctx, "sales_start_fte", "sales_monthly_cost_per_fte", which),
            cost_of_role_month1(ctx, "ga_start_fte", "ga_monthly_cost_per_fte", which),
        ])

    def opex_extra_m1(which):
        new_customer_rev = []
        for tier_key, _ in TIERS:
            new_customer_rev.append(
                f"{sc(which, f'{tier_key}_new_customers_m1')}*{sc(which, f'{tier_key}_usage_mreq_m1')}*({billable_factor(which)})*({net_price_m1(which, tier_key)})+"
                f"{sc(which, f'{tier_key}_new_customers_m1')}*{sc(which, f'{tier_key}_platform_fee_monthly')}"
            )
        total_new_customer_rev = "(" + "+".join(new_customer_rev) + ")"
        return (
            f"({total_new_customer_rev})*{sc(which, 'sales_commission_pct_new_revenue')}+"
            f"({usage_rev_m1(which)})*{sc(which, 'partner_fee_pct_usage_revenue')}+"
            f"({revenue_m1(which)})*{sc(which, 'marketing_pct_revenue')}+"
            f"{sc(which, 'software_tools_fixed_monthly')}+{sc(which, 'facilities_fixed_monthly')}"
        )

    def burn1(which):
        return f"MAX(0,({total_cogs_m1(which)})+({opex_people_m1(which)})+({opex_extra_m1(which)})-({revenue_m1(which)}))"

    def runway1(which):
        return f"IFERROR({sc(which, 'starting_cash')}/MAX(1,{burn1(which)}),999)"

    g = ctx.grid
    first_col_letter = col_letter(g.month_col(0))
    last_col_letter = col_letter(g.month_col(g.n_months - 1))

    return [
        ScenarioKPI(
            "Starting billable volume (Month 1)",
            "Month-1 gross request volume reduced for cache credits and batch discounts.",
            lambda w: f"({gross_volume_m1(w)})*({billable_factor(w)})",
            f"'Revenue'!{first_col_letter}{ctx.ref_row('Revenue', 'total_billable_volume')+1}",
            "num",
            key="starting_billable_volume",
        ),
        ScenarioKPI(
            "Revenue run-rate (Month 1 x 12)",
            "Month-1 total revenue annualized for a simple run-rate comparison.",
            revenue_runrate_m1,
            f"'Revenue'!{first_col_letter}{ctx.ref_row('Revenue', 'total_revenue')+1}*12",
            "num",
            key="revenue_runrate_m1",
        ),
        ScenarioKPI(
            "Implied Revenue at Month 36 (approx.)",
            "Month-1 revenue compounded at an illustrative blended growth rate for 35 more months.",
            revenue_36,
            f"'Revenue'!{last_col_letter}{ctx.ref_row('Revenue', 'total_revenue')+1}",
            "num",
            key="implied_revenue_36",
        ),
        ScenarioKPI(
            "Gross Margin % (illustrative, Month 1)",
            "Month-1 revenue less compute, provider, storage, bandwidth, and infra people cost.",
            gross_margin_m1,
            f"'COGS & GM'!{first_col_letter}{ctx.ref_row('COGS & GM', 'gross_margin_pct')+1}",
            "pct",
            key="gross_margin_m1",
        ),
        ScenarioKPI(
            "Month-1 Net Burn (illustrative)",
            "Month-1 total COGS + Opex less revenue; floored at zero.",
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

    revenue_row = ctx.ref_row("Revenue", "total_revenue")
    billable_volume_row = ctx.ref_row("Revenue", "total_billable_volume")
    gross_margin_row = ctx.ref_row("COGS & GM", "gross_margin_pct")
    utilization_row = ctx.ref_row("COGS & GM", "utilization_rate")
    cogs_per_mreq_row = ctx.ref_row("COGS & GM", "cogs_per_mreq")
    inference_margin_row = ctx.ref_row("COGS & GM", "inference_margin_pct")
    headcount_row = ctx.ref_row("Headcount", "total_headcount")
    cash_row = ctx.ref_row("Cash & Runway", "ending_cash")
    burn_row = ctx.ref_row("Cash & Runway", "monthly_burn")
    runway_row = ctx.ref_row("Cash & Runway", "runway_months")

    cards = [
        KPICard("Revenue (Month 36)", f"'Revenue'!{last_col}{revenue_row+1}", "num"),
        KPICard("Billable Volume (Month 36)", f"'Revenue'!{last_col}{billable_volume_row+1}", "num"),
        KPICard("Gross Margin % (Month 36)", f"'COGS & GM'!{last_col}{gross_margin_row+1}", "pct"),
        KPICard("Utilization % (Month 36)", f"'COGS & GM'!{last_col}{utilization_row+1}", "pct"),
        KPICard("Ending Cash (Month 36)", f"'Cash & Runway'!{last_col}{cash_row+1}", "num"),
        KPICard("Runway (months)", f"'Cash & Runway'!{last_col}{runway_row+1}", "months"),
    ]

    date_cat = (
        f"'Revenue'!${col_letter(g.month_start_col)}${TIMELINE_DATE_ROW+1}:"
        f"${col_letter(g.month_end_col)}${TIMELINE_DATE_ROW+1}"
    )

    def rng(sheet, row_idx):
        return range_ref(sheet, row_idx, g.month_start_col, g.month_end_col)

    charts = [
        ChartSpec("Revenue & Billable Volume", "line", date_cat,
                  [ChartSeries("Total Revenue", rng("Revenue", revenue_row)),
                   ChartSeries("Billable Volume", rng("Revenue", billable_volume_row))],
                  y_axis_name="$ / M requests"),
        ChartSpec("Gross Margin & Inference Margin", "line", date_cat,
                  [ChartSeries("Gross Margin %", rng("COGS & GM", gross_margin_row)),
                   ChartSeries("Inference Margin %", rng("COGS & GM", inference_margin_row))],
                  y_axis_name="%"),
        ChartSpec("Cash & Burn", "line", date_cat,
                  [ChartSeries("Ending Cash", rng("Cash & Runway", cash_row)),
                   ChartSeries("Monthly Burn", rng("Cash & Runway", burn_row))], y_axis_name="$"),
        ChartSpec("Headcount by Month", "column", date_cat,
                  [ChartSeries("Total Headcount", rng("Headcount", headcount_row))], y_axis_name="FTE"),
        ChartSpec("Scenario Comparison — Implied Revenue at Month 36", "column", None,
                  [ChartSeries("Base / Upside / Downside", scenario_kpi_range(ctx, "implied_revenue_36"))]),
        ChartSpec("Utilization & COGS per 1M Requests", "line", date_cat,
                  [ChartSeries("Utilization", rng("COGS & GM", utilization_row)),
                   ChartSeries("COGS per 1M", rng("COGS & GM", cogs_per_mreq_row))], y_axis_name="% / $"),
    ]
    return cards, charts


def _readme_sections():
    return [
        ("Business model",
         "This workbook models an AI API / infrastructure company selling inference capacity across Starter, "
         "Growth, and Enterprise tiers. Revenue is built bottom-up from customer counts, monthly request volume, "
         "tier-specific platform fees, and blended request pricing driven by model mix and discounts."),
        ("Key KPIs",
         "Core outputs include gross and billable request volume, revenue per 1M requests, COGS per 1M requests, "
         "inference margin, gross margin, utilization, enterprise revenue concentration, burn, and runway. The "
         "Revenue, COGS & GM, Cash & Runway, and Scenarios tabs surface these directly."),
        ("Modeling notes",
         "Cache hits lower processed volume more than billed volume through a pass-back assumption, which is a "
         "deliberate simplification of more granular contract logic. Reserved-capacity economics are modeled as a "
         "utilization-adjusted blended unit cost, and depreciation uses the engine's rolling straight-line "
         "approximation rather than per-asset schedules."),
    ]


def build(output_path: str) -> WorkbookContext:
    ctx = WorkbookContext(output_path, MODEL_NAME, MODEL_SHORT)

    build_readme_sheet(
        ctx,
        overview=(
            "A 36-month, formula-driven financial model for an AI API / infrastructure company with tiered "
            "customers, usage-based billing, and compute-heavy cost of revenue. Start on the Assumptions tab: "
            "set your Base / Upside / Downside inputs and pick a scenario. Every downstream tab recalculates "
            "automatically."
        ),
        sections=_readme_sections(),
    )
    build_assumptions_sheet(
        ctx,
        _assumption_sections(),
        company_note="Tip: start with Base, then stress-test growth, model mix, utilization, and capex in Upside/Downside.",
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
        debt_draw_month=8,
        debt_monthly_repayment_key="debt_monthly_repayment",
        debt_repayment_start_month=18,
        equity_rounds=[(3, "series_a_amount", "Growth Equity"), (21, "series_b_amount", "Follow-on Equity")],
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
        intro="Revenue, request volume, utilization, margin, cash, and scenario trends for the AI API / Infrastructure model.",
    )
    build_checks_sheet(ctx)

    ctx.close()
    return ctx
