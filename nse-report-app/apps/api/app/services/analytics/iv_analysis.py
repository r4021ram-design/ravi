"""
IV Analysis Service
Provides IV skew, surface, and term structure analytics for options.
"""

import logging
from statistics import mean
from typing import Optional
from datetime import datetime

from app.services.data_ingestion.nse_fetcher import nse_fetcher

logger = logging.getLogger(__name__)


class IVAnalyzer:
    """
    Analyzes Implied Volatility across strikes and expiries.
    """

    @staticmethod
    def _extract_iv(leg: dict) -> float:
        """Read IV consistently across NSE payload variants."""
        if not isinstance(leg, dict):
            return 0.0

        raw_iv = leg.get("impliedVolatility")
        if raw_iv is None:
            raw_iv = leg.get("iv", 0)

        try:
            iv = float(raw_iv)
        except (TypeError, ValueError):
            return 0.0

        return iv if iv > 0 else 0.0

    def calculate_iv_skew(self, oi_data: dict) -> Optional[dict]:
        """
        Calculate IV skew metrics for a single expiry's option chain.

        Returns:
            - atm_iv_ce / atm_iv_pe: IV at the ATM strike
            - otm_put_iv: avg IV of OTM puts (5 strikes below ATM)
            - otm_call_iv: avg IV of OTM calls (5 strikes above ATM)
            - skew_ratio: otm_put_iv / otm_call_iv (>1 = put skew / fear)
            - smile_data: [{strike, ce_iv, pe_iv}, ...] for charting
        """
        if not oi_data or not oi_data.get("strikes"):
            return None

        underlying = oi_data.get("underlying_value", 0)
        strikes = oi_data["strikes"]

        if not underlying or not strikes:
            return None

        # Build smile data (strikes with valid IV)
        smile_data = []
        for s in strikes:
            ce_iv = self._extract_iv(s.get("CE", {}))
            pe_iv = self._extract_iv(s.get("PE", {}))
            if ce_iv > 0 or pe_iv > 0:
                smile_data.append({
                    "strike": s["strikePrice"],
                    "ce_iv": ce_iv,
                    "pe_iv": pe_iv,
                })

        if len(smile_data) < 5:
            return None

        # Find ATM strike (closest to underlying)
        sorted_by_dist = sorted(smile_data, key=lambda x: abs(x["strike"] - underlying))
        atm = sorted_by_dist[0]

        # OTM Calls = strikes above ATM, OTM Puts = strikes below ATM
        otm_calls = sorted(
            [s for s in smile_data if s["strike"] > underlying and s["ce_iv"] > 0],
            key=lambda s: s["strike"],
        )[:5]
        otm_puts = sorted(
            [s for s in smile_data if s["strike"] < underlying and s["pe_iv"] > 0],
            key=lambda s: s["strike"],
            reverse=True,
        )[:5]

        otm_call_iv = (
            sum(s["ce_iv"] for s in otm_calls) / len(otm_calls)
            if otm_calls else 0
        )
        otm_put_iv = (
            sum(s["pe_iv"] for s in otm_puts) / len(otm_puts)
            if otm_puts else 0
        )

        skew_ratio = (
            round(otm_put_iv / otm_call_iv, 3)
            if otm_call_iv > 0 and len(otm_calls) >= 3 and len(otm_puts) >= 3
            else None
        )

        # Skew interpretation
        if skew_ratio is not None:
            if skew_ratio > 1.15:
                skew_bias = "Put Skew (Fear/Hedging)"
            elif skew_ratio < 0.85:
                skew_bias = "Call Skew (Greed/Speculation)"
            else:
                skew_bias = "Symmetric (Balanced)"
        elif len(otm_calls) < 3 or len(otm_puts) < 3:
            skew_bias = "Insufficient OTM IV Data"
        else:
            skew_bias = "Insufficient Data"

        return {
            "symbol": oi_data.get("symbol"),
            "underlying": underlying,
            "atm_strike": atm["strike"],
            "atm_ce_iv": atm["ce_iv"],
            "atm_pe_iv": atm["pe_iv"],
            "otm_call_iv": round(otm_call_iv, 2),
            "otm_put_iv": round(otm_put_iv, 2),
            "skew_ratio": skew_ratio,
            "skew_bias": skew_bias,
            "smile_data": smile_data,
        }

    def calculate_iv_surface(self, symbol: str) -> Optional[dict]:
        """
        Build IV surface across multiple expiries.
        Fetches option chain for the symbol and groups IV by expiry + strike.

        Returns:
            - surface: [{expiry, strike, ce_iv, pe_iv, days_to_expiry}, ...]
            - expiries: [str, ...]
            - atm_term_structure: [{expiry, days, atm_ce_iv, atm_pe_iv}, ...]
        """
        chain = nse_fetcher.get_option_chain(symbol)
        if not chain or not chain.get("data"):
            return None

        underlying = chain.get("underlying_value", 0)
        expiry_dates = chain.get("expiry_dates", [])
        now = datetime.now()

        surface_points = []
        term_structure = []

        for expiry in expiry_dates[:6]:  # Limit to first 6 expiries
            try:
                expiry_date = datetime.strptime(expiry, "%d-%b-%Y")
                days_to_expiry = max(1, (expiry_date - now).days)
            except (ValueError, TypeError):
                days_to_expiry = 0

            expiry_strikes = []

            for record in chain["data"]:
                # Robust expiry check
                record_exp = record.get("expiryDate") or record.get("CE", {}).get("expiryDate") or record.get("PE", {}).get("expiryDate")
                
                # Normalize both to check match
                if not record_exp:
                    continue
                
                # Try parsing if formats differ (e.g., 07-May-2026 vs 07-05-2026)
                match = False
                if record_exp == expiry:
                    match = True
                else:
                    try:
                        # Try to normalize record_exp to match expiry string format
                        for fmt in ["%d-%b-%Y", "%d-%m-%Y"]:
                            try:
                                if datetime.strptime(record_exp, fmt).strftime("%d-%b-%Y") == expiry:
                                    match = True
                                    break
                            except: continue
                    except: pass
                
                if not match:
                    continue

                sp = record.get("strikePrice", 0)
                ce_iv = self._extract_iv(record.get("CE", {}))
                pe_iv = self._extract_iv(record.get("PE", {}))

                if ce_iv > 0 or pe_iv > 0:
                    point = {
                        "expiry": expiry,
                        "strike": sp,
                        "ce_iv": ce_iv,
                        "pe_iv": pe_iv,
                        "days_to_expiry": days_to_expiry,
                    }
                    surface_points.append(point)
                    expiry_strikes.append(point)

            # Find ATM for this expiry's term structure
            if expiry_strikes:
                atm_point = min(expiry_strikes, key=lambda x: abs(x["strike"] - underlying))
                atm_avg_iv = mean(
                    [iv for iv in [atm_point["ce_iv"], atm_point["pe_iv"]] if iv > 0]
                ) if (atm_point["ce_iv"] > 0 or atm_point["pe_iv"] > 0) else 0
                term_structure.append({
                    "expiry": expiry,
                    "days": days_to_expiry,
                    "atm_ce_iv": atm_point["ce_iv"],
                    "atm_pe_iv": atm_point["pe_iv"],
                    "atm_avg_iv": round(atm_avg_iv, 2),
                })

        if not surface_points:
            logger.info(f"No IV surface points available for {symbol}")
            return {
                "symbol": symbol,
                "underlying": underlying,
                "expiries": expiry_dates[:6],
                "surface": [],
                "term_structure": [],
                "term_shape": "Insufficient Data",
                "analysis": {
                    "summary": ["IV surface data is unavailable for the selected symbol right now."],
                    "verdict": "NEUTRAL",
                    "sentiment": "Neutral",
                    "action": "Wait for clearer volatility data",
                },
            }

        # Determine term structure shape
        if len(term_structure) >= 2:
            near_iv = term_structure[0].get("atm_avg_iv", 0)
            far_iv = term_structure[-1].get("atm_avg_iv", 0)
            if far_iv > near_iv * 1.05:
                term_shape = "Contango (Normal)"
            elif near_iv > far_iv * 1.05:
                term_shape = "Backwardation (Event Risk)"
            else:
                term_shape = "Flat"
        else:
            term_shape = "Insufficient Data"

        skew_ratio = self._calculate_surface_skew_ratio(surface_points, underlying)

        # Detailed Analysis Report
        analysis = self._generate_analysis_report(symbol, skew_ratio, term_shape, term_structure)

        return {
            "symbol": symbol,
            "underlying": underlying,
            "expiries": expiry_dates[:6],
            "surface": surface_points,
            "term_structure": term_structure,
            "term_shape": term_shape,
            "analysis": analysis
        }

    def _calculate_surface_skew_ratio(self, surface_points: list, underlying: float) -> Optional[float]:
        """Estimate put/call IV skew from the nearest expiry in the surface."""
        if not surface_points or not underlying:
            return None

        nearest_days = min(p["days_to_expiry"] for p in surface_points)
        nearest_points = [p for p in surface_points if p["days_to_expiry"] == nearest_days]
        if len(nearest_points) < 5:
            return None

        otm_calls = sorted(
            [p for p in nearest_points if p["strike"] > underlying and p["ce_iv"] > 0],
            key=lambda p: p["strike"],
        )[:5]
        otm_puts = sorted(
            [p for p in nearest_points if p["strike"] < underlying and p["pe_iv"] > 0],
            key=lambda p: p["strike"],
            reverse=True,
        )[:5]

        if len(otm_calls) < 3 or len(otm_puts) < 3:
            return None

        call_iv = sum(p["ce_iv"] for p in otm_calls) / len(otm_calls)
        put_iv = sum(p["pe_iv"] for p in otm_puts) / len(otm_puts)
        return round(put_iv / call_iv, 3) if call_iv > 0 else None

    def _generate_analysis_report(self, symbol, skew_ratio, term_shape, term_structure) -> dict:
        """Generates verbal insights based on IV metrics."""
        summary = []
        verdict = "NEUTRAL"
        
        # Skew Insight
        if skew_ratio is None:
            summary.append("Skew data is incomplete, so directional volatility bias is neutral.")
        elif skew_ratio > 1.15:
            summary.append("Aggressive Put Skew detected. Markets are pricing in significant tail-risk or hedging for a downside move.")
            verdict = "BEARISH"
        elif skew_ratio > 1.05:
            summary.append("Moderate Put Skew. Normal defensive positioning by institutional players.")
        elif skew_ratio < 0.90:
            summary.append("Call Skew detected. Markets are pricing in an upside breakout or 'FOMO' buying.")
            verdict = "BULLISH"
        else:
            summary.append("Balanced Skew. No significant directional bias in the options volatility space.")

        # Term Structure Insight
        if "Backwardation" in term_shape:
            summary.append("Term Structure is in BACKWARDATION. Near-term uncertainty is extremely high; usually seen before major events or during crashes.")
        elif "Contango" in term_shape:
            summary.append("Term Structure is in normal CONTANGO. Market expects volatility to mean-revert or stay stable in the long run.")

        return {
            "summary": summary,
            "verdict": verdict,
            "sentiment": "Risk-Off" if verdict == "BEARISH" else "Risk-On" if verdict == "BULLISH" else "Neutral",
            "action": "Avoid fresh longs" if verdict == "BEARISH" else "Look for dips" if verdict == "BULLISH" else "Range-bound play"
        }

# Module-level singleton
iv_analyzer = IVAnalyzer()
