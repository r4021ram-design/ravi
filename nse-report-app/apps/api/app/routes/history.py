"""
Historical Data Routes
Endpoints for PCR, VIX, and OI time-series charts.
"""

from statistics import mean
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta
from typing import List

from app.db.database import get_db
from app.db import models
from app.tasks.snapshot_task import capture_daily_snapshot

router = APIRouter()


def _safe_pct_change(start: float | int | None, end: float | int | None) -> float | None:
    """Return percentage change when both values are present and start is positive."""
    if start is None or end is None or start <= 0:
        return None
    return ((end - start) / start) * 100.0


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

    # If no records exist, try to capture a live snapshot once.
    if not records:
        capture_daily_snapshot(symbol)
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
        return {
            "verdict": "NEUTRAL",
            "insights": ["Insufficient historical data for trend analysis."],
            "pcr_trend": "stable",
            "oi_bias": "neutral",
        }

    recent = [
        p for p in points[-5:]
        if p.get("pcr_oi") is not None
        and p.get("total_ce_oi") is not None
        and p.get("total_pe_oi") is not None
    ]
    if len(recent) < 2:
        return {
            "verdict": "NEUTRAL",
            "insights": ["Recent snapshots are incomplete; trend analysis is neutral."],
            "pcr_trend": "stable",
            "oi_bias": "neutral",
        }

    pcr_trend = "stable"
    pcr_values = [p["pcr_oi"] for p in recent if p.get("pcr_oi") is not None]
    first_pcr = pcr_values[0] if pcr_values else None
    last_pcr = pcr_values[-1] if pcr_values else None
    avg_pcr = mean(pcr_values) if pcr_values else None
    pcr_change_pct = _safe_pct_change(first_pcr, last_pcr)
    if pcr_change_pct is not None:
        if pcr_change_pct >= 8:
            pcr_trend = "rising"
        elif pcr_change_pct <= -8:
            pcr_trend = "falling"

    oi_bias = "neutral"
    first_ce_oi = recent[0]["total_ce_oi"]
    last_ce_oi = recent[-1]["total_ce_oi"]
    first_pe_oi = recent[0]["total_pe_oi"]
    last_pe_oi = recent[-1]["total_pe_oi"]
    ce_change = last_ce_oi - first_ce_oi
    pe_change = last_pe_oi - first_pe_oi
    ce_change_pct = _safe_pct_change(first_ce_oi, last_ce_oi)
    pe_change_pct = _safe_pct_change(first_pe_oi, last_pe_oi)
    if (
        pe_change > 0
        and pe_change_pct is not None
        and (ce_change_pct is None or pe_change_pct >= ce_change_pct + 5)
    ):
        oi_bias = "bullish build-up"
    elif (
        ce_change > 0
        and ce_change_pct is not None
        and (pe_change_pct is None or ce_change_pct >= pe_change_pct + 5)
    ):
        oi_bias = "bearish build-up"

    insights = []
    if pcr_trend == "rising":
        insights.append("PCR is rising; this usually supports bullish positioning unless it reaches an extreme.")
    elif pcr_trend == "falling":
        insights.append("PCR is falling; this usually points to weaker put support or stronger call-side pressure.")
    else:
        insights.append("PCR is stable; no strong directional signal from recent PCR movement.")
    
    if avg_pcr is not None:
        insights.append(f"Average PCR across the recent 5-session window is {avg_pcr:.2f}.")

    if oi_bias != "neutral":
        insights.append(f"Detected {oi_bias} in the recent open interest shifts.")
    else:
        insights.append("Call and put open-interest changes are balanced; no dominant build-up signal is present.")
    
    last_iv = recent[-1].get("atm_iv")
    recent_ivs = [p["atm_iv"] for p in recent if p.get("atm_iv") is not None and p["atm_iv"] > 0]
    recent_avg_iv = mean(recent_ivs) if recent_ivs else None
    if last_iv is not None and recent_avg_iv is not None:
        if last_iv >= recent_avg_iv * 1.12:
            insights.append("IV is elevated versus the recent average; option premiums are relatively expensive.")
        elif last_iv <= recent_avg_iv * 0.88:
            insights.append("IV is compressed versus the recent average; options are relatively cheap.")

    verdict = "NEUTRAL"
    score = 0
    if pcr_trend == "rising":
        score += 1
    elif pcr_trend == "falling":
        score -= 1

    if "bullish" in oi_bias:
        score += 1
    elif "bearish" in oi_bias:
        score -= 1

    if avg_pcr is not None:
        if avg_pcr >= 1.15:
            score += 1
        elif avg_pcr <= 0.85:
            score -= 1

    if score >= 2:
        verdict = "BULLISH"
    elif score <= -2:
        verdict = "BEARISH"

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
