"""Unit tests for the rental property analysis engine.

Pure-Python, no database required.
"""

from app.services.analysis_engine import analyze, PropertyInputs


def _base_inputs() -> PropertyInputs:
    return PropertyInputs(
        purchase_price=300000.0,
        rental_income=2500.0,
        down_payment=60000.0,
        loan_term_years=30,
        interest_rate=6.5,
        property_tax_annual=4200.0,
        insurance_annual=1800.0,
        misc_opex_annual=3000.0,
    )


def test_cash_flow_positive():
    m = analyze(_base_inputs())
    loan = 300000 - 60000
    monthly_rate = 6.5 / 100 / 12
    n = 30 * 12
    monthly_mortgage = loan * (monthly_rate * (1 + monthly_rate) ** n) / ((1 + monthly_rate) ** n - 1)
    monthly_expenses = monthly_mortgage + 4200 / 12 + 1800 / 12 + 3000 / 12
    expected_monthly = 2500 - monthly_expenses
    assert abs(m.monthly_cash_flow - expected_monthly) < 0.01
    assert abs(m.annual_cash_flow - expected_monthly * 12) < 0.01
    assert m.monthly_cash_flow > 0


def test_cap_rate():
    m = analyze(_base_inputs())
    gross = 2500 * 12
    opex = 4200 + 1800 + 3000
    noi = gross - opex
    expected_cap = noi / 300000 * 100
    assert abs(m.cap_rate - expected_cap) < 0.01
    assert m.noi_annual == noi


def test_cash_on_cash_return():
    m = analyze(_base_inputs())
    gross = 2500 * 12
    opex = 4200 + 1800 + 3000
    noi = gross - opex
    monthly_rate = 6.5 / 100 / 12
    n = 30 * 12
    loan = 240000
    monthly_mortgage = loan * (monthly_rate * (1 + monthly_rate) ** n) / ((1 + monthly_rate) ** n - 1)
    monthly_expenses = monthly_mortgage + 4200 / 12 + 1800 / 12 + 3000 / 12
    annual_cf = (2500 - monthly_expenses) * 12
    expected_coc = annual_cf / 60000 * 100
    assert abs(m.cash_on_cash_return - expected_coc) < 0.01


def test_total_return_roi_equals_coc_mvp():
    m = analyze(_base_inputs())
    assert m.total_return_roi == m.cash_on_cash_return


def test_negative_cash_flow_turns_red_signals():
    # High expenses relative to rent -> negative cash flow
    inputs = _base_inputs()
    inputs.rental_income = 500.0
    m = analyze(inputs)
    assert m.monthly_cash_flow < 0
    assert m.annual_cash_flow < 0
    assert m.cash_on_cash_return < 0


def test_zero_down_payment_cash_on_cash_zero():
    inputs = _base_inputs()
    inputs.down_payment = 0.0
    m = analyze(inputs)
    assert m.cash_on_cash_return == 0.0


def test_zero_interest_rate():
    inputs = _base_inputs()
    inputs.interest_rate = 0.0
    m = analyze(inputs)
    expected = round((300000 - 60000) / (30 * 12), 2)
    assert m.monthly_mortgage == expected


def test_inputs_stored_and_rounded():
    m = analyze(_base_inputs())
    assert isinstance(m.monthly_cash_flow, float)
    assert isinstance(m.loan_amount, float)
    assert m.loan_amount == 240000.0
