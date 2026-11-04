"""Rental property financial calculation engine.

Pure-Python, zero new dependencies. All monetary values in USD.
"""

from dataclasses import dataclass
from typing import Dict


@dataclass
class PropertyInputs:
    purchase_price: float
    rental_income: float          # expected monthly rent
    down_payment: float
    loan_term_years: int
    interest_rate: float          # annual percent (e.g. 6.5 for 6.5%)
    property_tax_annual: float
    insurance_annual: float
    misc_opex_annual: float


@dataclass
class PropertyMetrics:
    monthly_cash_flow: float
    annual_cash_flow: float
    cap_rate: float               # percent (e.g. 7.5 for 7.5%)
    cash_on_cash_return: float    # percent
    total_return_roi: float       # percent (cash-on-cash; no appreciation assumed in MVP)
    monthly_mortgage: float
    monthly_expenses: float
    noi_annual: float             # net operating income (excl. debt service)
    loan_amount: float


def _monthly_mortgage_payment(loan_amount: float, annual_rate_pct: float, term_years: int) -> float:
    if loan_amount <= 0:
        return 0.0
    monthly_rate = annual_rate_pct / 100.0 / 12.0
    n = term_years * 12
    if monthly_rate == 0:
        return loan_amount / n
    return loan_amount * (monthly_rate * (1 + monthly_rate) ** n) / ((1 + monthly_rate) ** n - 1)


def analyze(inputs: PropertyInputs) -> PropertyMetrics:
    loan_amount = max(inputs.purchase_price - inputs.down_payment, 0.0)
    monthly_mortgage = _monthly_mortgage_payment(loan_amount, inputs.interest_rate, inputs.loan_term_years)

    monthly_tax = inputs.property_tax_annual / 12.0
    monthly_insurance = inputs.insurance_annual / 12.0
    monthly_misc = inputs.misc_opex_annual / 12.0

    monthly_expenses = monthly_mortgage + monthly_tax + monthly_insurance + monthly_misc
    monthly_cash_flow = inputs.rental_income - monthly_expenses
    annual_cash_flow = monthly_cash_flow * 12.0

    annual_gross_rent = inputs.rental_income * 12.0
    operating_expenses_annual = inputs.property_tax_annual + inputs.insurance_annual + inputs.misc_opex_annual
    noi_annual = annual_gross_rent - operating_expenses_annual

    cap_rate = (noi_annual / inputs.purchase_price * 100.0) if inputs.purchase_price > 0 else 0.0
    cash_on_cash = (annual_cash_flow / inputs.down_payment * 100.0) if inputs.down_payment > 0 else 0.0
    total_return_roi = cash_on_cash  # MVP: no appreciation assumption; CoC == total ROI

    return PropertyMetrics(
        monthly_cash_flow=round(monthly_cash_flow, 2),
        annual_cash_flow=round(annual_cash_flow, 2),
        cap_rate=round(cap_rate, 4),
        cash_on_cash_return=round(cash_on_cash, 4),
        total_return_roi=round(total_return_roi, 4),
        monthly_mortgage=round(monthly_mortgage, 2),
        monthly_expenses=round(monthly_expenses, 2),
        noi_annual=round(noi_annual, 2),
        loan_amount=round(loan_amount, 2),
    )


def metrics_to_dict(m: PropertyMetrics) -> Dict[str, float]:
    return {
        "monthly_cash_flow": m.monthly_cash_flow,
        "annual_cash_flow": m.annual_cash_flow,
        "cap_rate": m.cap_rate,
        "cash_on_cash_return": m.cash_on_cash_return,
        "total_return_roi": m.total_return_roi,
        "monthly_mortgage": m.monthly_mortgage,
        "monthly_expenses": m.monthly_expenses,
        "noi_annual": m.noi_annual,
        "loan_amount": m.loan_amount,
    }
