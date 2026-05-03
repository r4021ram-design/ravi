"""
Stocks API Routes
Endpoints for technical stock signals and picks.
"""

from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.get("/signals")
async def get_stock_signals():
    """
    Get daily stock breakout/breakdown signals.
    Currently returning simulated signals for Phase 1.
    """
    try:
        # For MVP, we return a mocked set of signals.
        # Future phases will run actual technical analysis scripts over NSE equity data.
        return {
            "status": "success",
            "signals": [
                {
                    "symbol": "RELIANCE",
                    "reason": "Bullish breakout above 3000 level",
                    "levels": {"entry": 3020, "stoploss": 2950, "target": 3150},
                    "options_strategy": "Buy 3050 CE"
                },
                {
                    "symbol": "HDFCBANK",
                    "reason": "Trendline breakdown on daily timeframe",
                    "levels": {"entry": 1500, "stoploss": 1530, "target": 1420},
                    "options_strategy": "Buy 1480 PE"
                },
                {
                    "symbol": "TCS",
                    "reason": "Consolidation near all-time highs",
                    "levels": {"entry": 4000, "stoploss": 3950, "target": 4150},
                    "options_strategy": "Bull Call Spread (Buy 4000 CE, Sell 4100 CE)"
                }
            ]
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate stock signals: {str(e)}",
        )
