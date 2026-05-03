"""
Options API Routes
Endpoints for fetching on-demand option chains and technicals for any F&O symbol.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.services.data_ingestion.nse_fetcher import nse_fetcher
from app.services.analytics.pcr_calculator import pcr_calculator
from app.services.analytics.max_pain import max_pain_calculator
from app.services.analytics.support_resistance import sr_calculator
from app.services.analytics.greeks import greeks_calculator
from app.services.analytics.iv_analysis import iv_analyzer
from app.services.analytics.contract_specs import contract_specs
from datetime import datetime

router = APIRouter()

@router.get("/{symbol}")
async def get_options_data(symbol: str, expiry: Optional[str] = Query(None, description="Filter by expiry date (e.g., 01-May-2026)")):
    """
    Fetch the option chain and calculate technicals for a specific symbol.
    Symbol must be an NSE F&O symbol (e.g., RELIANCE, NIFTY, BANKNIFTY).
    Optionally filter by expiry date.
    """
    symbol = symbol.upper()
    try:
        # Fetch the option chain and basic OI data
        oi_data = nse_fetcher.get_oi_data(symbol, expiry=expiry)
        
        if not oi_data:
            raise HTTPException(
                status_code=404,
                detail=f"Could not fetch option chain for {symbol}. Ensure it is a valid F&O symbol."
            )

        # Run analytics
        pcr = pcr_calculator.calculate(oi_data)
        mp = max_pain_calculator.calculate(oi_data)
        sr = sr_calculator.calculate(oi_data)
        iv_skew = iv_analyzer.calculate_iv_skew(oi_data)
        specs = contract_specs.get_specs(symbol, oi_data.get("underlying_value", 0))
        
        # Calculate Greeks
        strikes = oi_data.get("strikes", [])
        spot = oi_data.get("underlying_value")
        now = datetime.now()
        
        for s in strikes:
            try:
                expiry_str = s.get("expiryDate")
                if expiry_str and spot:
                    expiry_date = datetime.strptime(expiry_str, "%d-%b-%Y")
                    # Time to expiry in years, minimum 1 day to prevent div by zero
                    days_to_expiry = (expiry_date - now).days
                    time_to_expiry_years = max(1, days_to_expiry) / 365.0
                    
                    if "CE" in s:
                        iv = s["CE"].get("iv", 0) / 100.0
                        if iv > 0:
                            greeks = greeks_calculator.calculate_greeks(spot, s["strikePrice"], time_to_expiry_years, iv)
                            s["CE"]["greeks"] = greeks["CE"]
                            
                    if "PE" in s:
                        iv = s["PE"].get("iv", 0) / 100.0
                        if iv > 0:
                            greeks = greeks_calculator.calculate_greeks(spot, s["strikePrice"], time_to_expiry_years, iv)
                            s["PE"]["greeks"] = greeks["PE"]
            except Exception:
                pass

        # Assemble the response
        response = {
            "symbol": symbol,
            "underlying_value": oi_data.get("underlying_value"),
            "timestamp": oi_data.get("timestamp"),
            "expiry_dates": oi_data.get("expiry_dates"),
            "technicals": {
                "PCR": pcr.get("pcr_oi") if pcr else None,
                "pcr_bias": pcr.get("bias") if pcr else None,
                "max_pain": mp.get("max_pain") if mp else None,
                "support": sr.get("support") if sr else [],
                "resistance": sr.get("resistance") if sr else [],
                "OI_build_up": sr.get("oi_change_detail") if sr else None,
                "intraday_bias": sr.get("oi_change_bias") if sr else "Neutral",
            },
            "iv_skew": iv_skew,
            "contract_specs": specs,
            "chain": {
                "total_ce_oi": oi_data.get("total_ce_oi"),
                "total_pe_oi": oi_data.get("total_pe_oi"),
                "strikes": oi_data.get("strikes", [])
            }
        }
        
        return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process options data for {symbol}: {str(e)}",
        )


@router.get("/{symbol}/iv-skew")
async def get_iv_skew(symbol: str, expiry: Optional[str] = Query(None)):
    """Get IV skew analysis for a symbol (optionally for a specific expiry)."""
    symbol = symbol.upper()
    try:
        oi_data = nse_fetcher.get_oi_data(symbol, expiry=expiry)
        if not oi_data:
            raise HTTPException(status_code=404, detail=f"No data for {symbol}")
        
        result = iv_analyzer.calculate_iv_skew(oi_data)
        if not result:
            raise HTTPException(status_code=404, detail="Insufficient IV data for skew analysis")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/iv-surface")
async def get_iv_surface(symbol: str):
    """Get IV surface data across all expiries for 3D visualization."""
    symbol = symbol.upper()
    try:
        result = iv_analyzer.calculate_iv_surface(symbol)
        if not result:
            raise HTTPException(status_code=404, detail=f"No IV surface data for {symbol}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/specs")
async def get_contract_specs(symbol: str):
    """Get contract specifications (lot size, margin, etc.)."""
    symbol = symbol.upper()
    try:
        oi_data = nse_fetcher.get_oi_data(symbol)
        spot = oi_data.get("underlying_value", 0) if oi_data else 0
        result = contract_specs.get_specs(symbol, spot)
        if not result:
            raise HTTPException(status_code=404, detail=f"No contract specs for {symbol}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{symbol}/oi-heatmap")
async def get_oi_heatmap(symbol: str):
    """
    OI data grouped by expiry for heatmap visualization.
    Returns a matrix of strike × expiry with CE/PE OI values.
    """
    symbol = symbol.upper()
    try:
        chain = nse_fetcher.get_option_chain(symbol)
        if not chain or not chain.get("data"):
            raise HTTPException(status_code=404, detail=f"No chain data for {symbol}")

        underlying = chain.get("underlying_value", 0)
        expiry_dates = chain.get("expiry_dates", [])[:6]

        heatmap_data = []
        strike_set = set()

        for record in chain["data"]:
            # Handle nested expiry date and format mismatch (05-05-2026 vs 05-May-2026)
            raw_exp = record.get("expiryDate") or record.get("CE", {}).get("expiryDate") or record.get("PE", {}).get("expiryDate")
            if not raw_exp:
                continue
                
            # Normalize date format if needed
            try:
                if "-" in raw_exp and not any(month in raw_exp for month in ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]):
                    # It's likely DD-MM-YYYY, convert to DD-MMM-YYYY
                    dt = datetime.strptime(raw_exp, "%d-%m-%Y")
                    exp = dt.strftime("%d-%b-%Y")
                else:
                    exp = raw_exp
            except:
                exp = raw_exp

            if exp not in expiry_dates:
                continue
            
            sp = record.get("strikePrice", 0)
            ce_oi = record.get("CE", {}).get("openInterest", 0)
            pe_oi = record.get("PE", {}).get("openInterest", 0)

            if ce_oi > 0 or pe_oi > 0:
                strike_set.add(sp)
                heatmap_data.append({
                    "expiry": exp,
                    "strike": sp,
                    "ce_oi": ce_oi,
                    "pe_oi": pe_oi,
                    "net_oi": pe_oi - ce_oi,
                })

        # Filter to strikes near ATM (±20 strikes)
        step = 100 if underlying > 10000 else 50 if underlying > 2000 else 20
        near_strikes = sorted([s for s in strike_set if abs(s - underlying) <= step * 20])

        filtered = [d for d in heatmap_data if d["strike"] in near_strikes]

        return {
            "symbol": symbol,
            "underlying": underlying,
            "expiries": expiry_dates,
            "strikes": near_strikes,
            "data": filtered,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

