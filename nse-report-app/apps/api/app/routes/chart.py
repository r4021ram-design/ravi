"""
Chart API Routes
Endpoints for historical OHLCV data and computed technical indicators.
"""

from fastapi import APIRouter, HTTPException, Query

from app.services.data_ingestion.price_fetcher import price_fetcher, INDEX_MAP
from app.services.analytics.technicals import technical_analyzer

router = APIRouter()


@router.get("/{symbol}/ohlcv")
async def get_ohlcv(symbol: str, days: int = Query(90, ge=7, le=365)):
    """
    Get historical OHLCV data for a stock or index.
    Symbol can be a stock (RELIANCE) or index (NIFTY, BANKNIFTY).
    """
    symbol = symbol.upper()
    try:
        # Check if it's an index
        if symbol in INDEX_MAP:
            data = price_fetcher.get_index_history(INDEX_MAP[symbol], days)
        else:
            data = price_fetcher.get_stock_history(symbol, days)

        if not data:
            raise HTTPException(
                status_code=404,
                detail=f"No historical data available for {symbol}"
            )

        return {
            "symbol": symbol,
            "days": days,
            "count": len(data),
            "ohlcv": data,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/technicals")
async def get_technicals(symbol: str, days: int = Query(90, ge=20, le=365)):
    """
    Get historical OHLCV data enriched with technical indicators
    (SMA 20/50/200, RSI 14, MACD, ATR, Pivot Points).
    """
    symbol = symbol.upper()
    try:
        # Fetch OHLCV
        if symbol in INDEX_MAP:
            ohlcv = price_fetcher.get_index_history(INDEX_MAP[symbol], days)
        else:
            ohlcv = price_fetcher.get_stock_history(symbol, days)

        if not ohlcv or len(ohlcv) < 20:
            raise HTTPException(
                status_code=404,
                detail=f"Insufficient historical data for {symbol} (need at least 20 days)"
            )

        # Calculate technicals
        result = technical_analyzer.calculate(ohlcv)
        if not result:
            raise HTTPException(
                status_code=500,
                detail="Failed to compute technical indicators"
            )

        return {
            "symbol": symbol,
            "days": days,
            "count": len(result["ohlcv"]),
            **result,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
