"""
Strategies API Routes
Endpoints for options strategy calculation and simulation.
"""

from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any

router = APIRouter()

@router.post("/simulate")
async def simulate_strategy(payload: Dict[str, Any]):
    """
    Simulate payoff for a given options strategy.
    Accepts current spot price, lot size, and leg definitions.
    Returns calculated P/L data points.
    """
    try:
        spot = payload.get("spot", 0)
        lot_size = payload.get("lot_size", 1)
        legs = payload.get("legs", [])

        if not legs or not spot:
            raise ValueError("Invalid strategy simulation payload.")

        step = 100 if spot > 40000 else 50
        range_val = step * 20
        points = []

        # Generate P/L points for the range
        for p in range(int(spot - range_val), int(spot + range_val + step), step):
            pnl = 0
            for leg in legs:
                direction = 1 if leg.get("action") == "BUY" else -1
                intrinsic = 0
                if leg.get("type") == "CE":
                    intrinsic = max(0, p - leg.get("strike", 0))
                else:
                    intrinsic = max(0, leg.get("strike", 0) - p)
                
                leg_pnl = (intrinsic - leg.get("premium", 0)) * direction * leg.get("lots", 1) * lot_size
                pnl += leg_pnl
            
            points.append({"price": p, "pnl": round(pnl, 2)})

        max_profit = max(pt["pnl"] for pt in points)
        max_loss = min(pt["pnl"] for pt in points)

        return {
            "status": "success",
            "spot": spot,
            "max_profit": max_profit,
            "max_loss": max_loss,
            "data": points
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Strategy simulation failed: {str(e)}",
        )
