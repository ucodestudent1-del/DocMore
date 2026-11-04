"""API routes: rental property analysis (calc + save)."""

import uuid
from typing import Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import PropertyAnalysis
from app.services.analysis_engine import analyze, PropertyInputs, PropertyMetrics

router = APIRouter(tags=["analysis"])


class AnalysisIn(BaseModel):
    purchase_price: float = Field(..., gt=0)
    rental_income: float = Field(..., gt=0)
    down_payment: float = Field(..., ge=0)
    loan_term_years: int = Field(..., gt=0, le=50)
    interest_rate: float = Field(..., ge=0, le=30)
    property_tax_annual: float = Field(..., ge=0)
    insurance_annual: float = Field(..., ge=0)
    misc_opex_annual: float = Field(..., ge=0)


class AnalysisOut(BaseModel):
    id: str
    purchase_price: float
    rental_income: float
    down_payment: float
    loan_term_years: int
    interest_rate: float
    property_tax_annual: float
    insurance_annual: float
    misc_opex_annual: float
    monthly_cash_flow: float
    annual_cash_flow: float
    cap_rate: float
    cash_on_cash_return: float
    total_return_roi: float
    monthly_mortgage: float
    monthly_expenses: float
    noi_annual: float
    loan_amount: float
    created_at: str


@router.post("/analyze", response_model=AnalysisOut)
async def run_analysis(
    payload: AnalysisIn,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    inputs = PropertyInputs(
        purchase_price=payload.purchase_price,
        rental_income=payload.rental_income,
        down_payment=payload.down_payment,
        loan_term_years=payload.loan_term_years,
        interest_rate=payload.interest_rate,
        property_tax_annual=payload.property_tax_annual,
        insurance_annual=payload.insurance_annual,
        misc_opex_annual=payload.misc_opex_annual,
    )
    metrics = analyze(inputs)

    record = PropertyAnalysis(
        id=uuid.uuid4().hex,
        user_id=current_user["username"],
        purchase_price=payload.purchase_price,
        rental_income=payload.rental_income,
        down_payment=payload.down_payment,
        loan_term_years=payload.loan_term_years,
        interest_rate=payload.interest_rate,
        property_tax_annual=payload.property_tax_annual,
        insurance_annual=payload.insurance_annual,
        misc_opex_annual=payload.misc_opex_annual,
        monthly_cash_flow=metrics.monthly_cash_flow,
        annual_cash_flow=metrics.annual_cash_flow,
        cap_rate=metrics.cap_rate,
        cash_on_cash_return=metrics.cash_on_cash_return,
        total_return_roi=metrics.total_return_roi,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return _to_out(record, metrics)


@router.get("/analyses", response_model=list[AnalysisOut])
async def list_analyses(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(
        select(PropertyAnalysis)
        .where(PropertyAnalysis.user_id == current_user["username"])
        .order_by(desc(PropertyAnalysis.created_at))
    )
    records = result.scalars().all()
    return [_to_out(r, None) for r in records]


def _to_out(record: PropertyAnalysis, metrics: Any | None) -> AnalysisOut:
    if metrics is None:
        metrics = PropertyMetrics(
            monthly_cash_flow=float(record.monthly_cash_flow),
            annual_cash_flow=float(record.annual_cash_flow),
            cap_rate=float(record.cap_rate),
            cash_on_cash_return=float(record.cash_on_cash_return),
            total_return_roi=float(record.total_return_roi),
            monthly_mortgage=0.0,
            monthly_expenses=0.0,
            noi_annual=0.0,
            loan_amount=float(record.purchase_price - record.down_payment),
        )
    return AnalysisOut(
        id=record.id,
        purchase_price=float(record.purchase_price),
        rental_income=float(record.rental_income),
        down_payment=float(record.down_payment),
        loan_term_years=record.loan_term_years,
        interest_rate=float(record.interest_rate),
        property_tax_annual=float(record.property_tax_annual),
        insurance_annual=float(record.insurance_annual),
        misc_opex_annual=float(record.misc_opex_annual),
        monthly_cash_flow=metrics.monthly_cash_flow,
        annual_cash_flow=metrics.annual_cash_flow,
        cap_rate=metrics.cap_rate,
        cash_on_cash_return=metrics.cash_on_cash_return,
        total_return_roi=metrics.total_return_roi,
        monthly_mortgage=metrics.monthly_mortgage,
        monthly_expenses=metrics.monthly_expenses,
        noi_annual=metrics.noi_annual,
        loan_amount=metrics.loan_amount,
        created_at=record.created_at.isoformat(),
    )
