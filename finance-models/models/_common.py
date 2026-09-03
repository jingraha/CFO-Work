"""Utilities shared by every model module (kept out of core/ because they
encode *modeling conventions*, e.g. how a scenario headline KPI is
approximated, rather than pure workbook mechanics).
"""
from __future__ import annotations

from core.context import WorkbookContext
from core.sheets.assumptions import active_ref


def cost_of_role_month1(ctx: WorkbookContext, start_key: str, cost_key: str, which=None):
    """Illustrative month-1 fully-loaded cost for a role, for Scenario-tab approximations."""
    if which is None:
        start_ref = active_ref(ctx, start_key)
        cost_ref = active_ref(ctx, cost_key)
    else:
        from core.sheets.scenarios import scenario_col_ref
        start_ref = scenario_col_ref(ctx, start_key, which)
        cost_ref = scenario_col_ref(ctx, cost_key, which)
    return f"{start_ref}*{cost_ref}"


def scenario_kpi_range(ctx: WorkbookContext, key: str) -> str:
    """Range across the Base/Upside/Downside columns for a registered Scenario-tab KPI row."""
    row = ctx.ref_row("Scenarios", key)
    return f"'Scenarios'!$C${row+1}:$E${row+1}"
