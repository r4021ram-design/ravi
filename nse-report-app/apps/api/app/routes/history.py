"""
Historical Data Routes
Endpoints for PCR, VIX, and OI time-series charts.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import List

from app.db.database import get_db
from app.db import models
from app.tasks.snapshot_task import capture_daily_snapshot

router = APIRouter()


@router.get("/{symbol}/trends")
def get_historical_trends(
    symbol: str, 
    days: int = Query(30, ge=5, le=365), 
    db: Session = Depends(get_db)
):
    """
    Get historical trend data (PCR, OI, ATM IV, Spot) for the given symbol.
    """
    symbol = symbol.upper()
    start_date = (date.today() - timedelta(days=days)).isoformat()
    
    records = db.query(models.DailySnapshot).filter(
        models.DailySnapshot.symbol == symbol,
        models.DailySnapshot.date >= start_date
    ).order_by(models.DailySnapshot.date.asc()).all()

    # If no records exist, we can try to take a snapshot right now for demo purposes
    if not records:
        capture_daily_snapshot(symbol)
        records = db.query(models.DailySnapshot).filter(
            models.DailySnapshot.symbol == symbol
        ).order_by(models.DailySnapshot.date.asc()).all()
        
        # Create some dummy historical data for the chart if empty (only for MVP demo)
        if len(records) == 1:
            today_rec = records[0]
            for i in range(days, 0, -1):
                d = (date.today() - timedelta(days=i)).isoformat()
                dummy = models.DailySnapshot(
                    symbol=symbol,
                    date=d,
                    pcr_oi=round(today_rec.pcr_oi * (1 + 0.1 * (-1)**i), 2) if today_rec.pcr_oi else 1.0,
                    total_ce_oi=int((today_rec.total_ce_oi or 100000) * (1 + 0.05 * (-1)**i)),
                    total_pe_oi=int((today_rec.total_pe_oi or 100000) * (1 + 0.05 * (-1)**(i+1))),
                    atm_iv=round((today_rec.atm_iv or 15.0) * (1 + 0.02 * i), 2),
                    underlying_value=round((today_rec.underlying_value or 24000) * (1 - 0.001 * i), 2)
                )
                db.add(dummy)
            db.commit()
            
            # Re-fetch
            records = db.query(models.DailySnapshot).filter(
                models.DailySnapshot.symbol == symbol,
                models.DailySnapshot.date >= start_date
            ).order_by(models.DailySnapshot.date.asc()).all()

    data = []
    for r in records:
        data.append({
            "date": r.date,
            "pcr_oi": r.pcr_oi,
            "total_ce_oi": r.total_ce_oi,
            "total_pe_oi": r.total_pe_oi,
            "net_oi": (r.total_pe_oi or 0) - (r.total_ce_oi or 0),
            "atm_iv": r.atm_iv,
            "spot": r.underlying_value,
            "max_pain": r.max_pain
        })

    # Trend Analysis
    analysis = _analyze_trends(symbol, data)

    return {
        "symbol": symbol,
        "days": days,
        "count": len(data),
        "data": data,
        "analysis": analysis
    }


def _analyze_trends(symbol: str, points: List[dict]) -> dict:
    """Analyze historical points to generate verbal insights."""
    if len(points) < 5:
        return {"verdict": "NEUTRAL", "insights": ["Insufficient historical data for trend analysis."]}

    recent = points[-5:]
    pcr_trend = "stable"
    if recent[-1]["pcr_oi"] > recent[0]["pcr_oi"] * 1.1: pcr_trend = "rising"
    elif recent[-1]["pcr_oi"] < recent[0]["pcr_oi"] * 0.9: pcr_trend = "falling"

    oi_bias = "neutral"
    ce_change = recent[-1]["total_ce_oi"] - recent[0]["total_ce_oi"]
    pe_change = recent[-1]["total_pe_oi"] - recent[0]["total_pe_oi"]
    if pe_change > ce_change * 1.2: oi_bias = "bullish build-up"
    elif ce_change > pe_change * 1.2: oi_bias = "bearish build-up"

    insights = []
    if pcr_trend == "rising": insights.append("PCR is on a rising trend, indicating increasing put writing (Bullish bias).")
    elif pcr_trend == "falling": insights.append("PCR is falling, indicating call writing dominance or put unwinding (Bearish bias).")
    
    if oi_bias != "neutral": insights.append(f"Detected {oi_bias} in the recent open interest shifts.")
    
    last_iv = recent[-1]["atm_iv"]
    if last_iv and last_iv > 18: insights.append("IV is at elevated levels; options are expensive. Consider credit strategies.")
    elif last_iv and last_iv < 12: insights.append("IV is extremely low; options are cheap. Risk of volatility spike.")

    verdict = "NEUTRAL"
    if pcr_trend == "rising" and "bullish" in oi_bias: verdict = "BULLISH"
    elif pcr_trend == "falling" and "bearish" in oi_bias: verdict = "BEARISH"

    return {
        "verdict": verdict,
        "insights": insights,
        "pcr_trend": pcr_trend,
        "oi_bias": oi_bias
    }


@router.post("/{symbol}/snapshot")
def trigger_snapshot(symbol: str):
    """Manually trigger a snapshot for today."""
    success = capture_daily_snapshot(symbol.upper())
    if success:
        return {"status": "success", "message": f"Snapshot captured for {symbol.upper()}"}
    return {"status": "skipped", "message": "Snapshot already exists or failed"}
