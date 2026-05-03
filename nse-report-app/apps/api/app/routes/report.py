"""
Report API Routes
Endpoints for daily report generation and retrieval.
"""

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.services.report_generator import report_generator

router = APIRouter()


@router.get("/daily")
async def get_daily_report(
    report_date: Optional[str] = Query(
        None,
        description="Report date in YYYY-MM-DD format. Defaults to today.",
        example="2026-05-01",
    ),
):
    """
    Generate or retrieve the daily market report.

    Returns the complete report with:
    - market_overview (global cues, opening bias, macro factors)
    - index_analysis (NIFTY, BANKNIFTY, FINNIFTY with S/R, PCR, Max Pain)
    - options_chain (OI summary, smart money signals)
    - fii_dii (FII/DII net flows with analysis)
    - volatility (India VIX, expected range)
    - trading_plan (best/worst/no-trade scenarios)
    """
    try:
        if report_date:
            try:
                parsed_date = date.fromisoformat(report_date)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid date format. Use YYYY-MM-DD.",
                )
        else:
            parsed_date = date.today()

        report = report_generator.generate(parsed_date)
        return report

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Report generation failed: {str(e)}",
        )


@router.get("/latest")
async def get_latest_report():
    """Get the most recently generated report (today's)."""
    try:
        report = report_generator.generate(date.today())
        return report
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Report generation failed: {str(e)}",
        )
