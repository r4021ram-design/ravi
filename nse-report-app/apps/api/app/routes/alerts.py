"""
Alerts API Routes
Endpoints for managing alert rules.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.alert_engine import alert_engine, AlertRule

router = APIRouter()


class AlertCreate(BaseModel):
    """Request body for creating an alert."""
    symbol: str
    alert_type: str = "breakout"  # breakout, vix_threshold
    threshold: float
    direction: str = "above"  # above, below


class AlertResponse(BaseModel):
    """Response for alert operations."""
    rule_id: str
    symbol: str
    alert_type: str
    threshold: float
    direction: str
    is_active: bool


@router.post("", response_model=AlertResponse)
async def create_alert(body: AlertCreate):
    """Create a new alert rule."""
    rule = AlertRule(
        rule_id=str(uuid.uuid4())[:8],
        user_id="default",  # TODO: Get from auth
        symbol=body.symbol,
        alert_type=body.alert_type,
        threshold=body.threshold,
        direction=body.direction,
    )
    alert_engine.add_rule(rule)
    return AlertResponse(
        rule_id=rule.rule_id,
        symbol=rule.symbol,
        alert_type=rule.alert_type,
        threshold=rule.threshold,
        direction=rule.direction,
        is_active=rule.is_active,
    )


@router.get("")
async def list_alerts():
    """List all active alert rules."""
    rules = alert_engine.get_active_rules()
    return [
        AlertResponse(
            rule_id=r.rule_id,
            symbol=r.symbol,
            alert_type=r.alert_type,
            threshold=r.threshold,
            direction=r.direction,
            is_active=r.is_active,
        )
        for r in rules
    ]


@router.delete("/{rule_id}")
async def delete_alert(rule_id: str):
    """Delete an alert rule."""
    removed = alert_engine.remove_rule(rule_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    return {"status": "deleted", "rule_id": rule_id}


@router.post("/check")
async def check_alerts_now():
    """Manually trigger alert check (for testing)."""
    triggered = alert_engine.check_all()
    return {"triggered_count": len(triggered), "alerts": triggered}
