"""
Support & Resistance Calculator
Derives support/resistance levels from options OI data.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


class SupportResistanceCalculator:
    """
    Identifies support and resistance levels from options Open Interest.
    - Highest Put OI strikes → Support levels
    - Highest Call OI strikes → Resistance levels
    - OI change analysis → Directional bias
    """

    def calculate(
        self, oi_data: dict, num_levels: int = 3
    ) -> Optional[dict]:
        """
        Calculate S/R levels from OI data.

        Args:
            oi_data: Output from nse_fetcher.get_oi_data()
            num_levels: Number of support/resistance levels to return

        Returns:
            Support levels, resistance levels, and bias.
        """
        if not oi_data or not oi_data.get("strikes"):
            return None

        underlying = oi_data.get("underlying_value", 0)
        strikes = oi_data["strikes"]

        # Separate strikes with CE and PE data
        ce_strikes = []
        pe_strikes = []
        ce_change_strikes = []
        pe_change_strikes = []

        for s in strikes:
            sp = s.get("strikePrice", 0)
            ce = s.get("CE", {})
            pe = s.get("PE", {})

            if ce.get("oi", 0) > 0:
                ce_strikes.append({"strike": sp, "oi": ce["oi"]})
                ce_change_strikes.append({
                    "strike": sp,
                    "oiChange": ce.get("oiChange", 0),
                })

            if pe.get("oi", 0) > 0:
                pe_strikes.append({"strike": sp, "oi": pe["oi"]})
                pe_change_strikes.append({
                    "strike": sp,
                    "oiChange": pe.get("oiChange", 0),
                })

        # Sort by OI descending
        ce_sorted = sorted(ce_strikes, key=lambda x: x["oi"], reverse=True)
        pe_sorted = sorted(pe_strikes, key=lambda x: x["oi"], reverse=True)

        # Resistance = highest Call OI strikes (above spot)
        resistance = [
            s for s in ce_sorted if s["strike"] >= underlying
        ][:num_levels]

        # Support = highest Put OI strikes (below spot)
        support = [
            s for s in pe_sorted if s["strike"] <= underlying
        ][:num_levels]

        # OI Change analysis for intraday bias
        ce_change_sum = sum(s["oiChange"] for s in ce_change_strikes)
        pe_change_sum = sum(s["oiChange"] for s in pe_change_strikes)

        if pe_change_sum > 0 and pe_change_sum > max(ce_change_sum, 0) * 1.2:
            oi_bias = "Bullish"
            oi_detail = "Put OI addition > Call OI — support building"
        elif ce_change_sum > 0 and ce_change_sum > max(pe_change_sum, 0) * 1.2:
            oi_bias = "Bearish"
            oi_detail = "Call OI addition > Put OI — resistance building"
        elif pe_change_sum < 0 and ce_change_sum < 0:
            oi_bias = "Neutral"
            oi_detail = "OI unwinding on both sides - no clean directional bias"
        else:
            oi_bias = "Neutral"
            oi_detail = "Balanced OI changes — no clear directional bias"

        return {
            "symbol": oi_data.get("symbol"),
            "underlying_value": underlying,
            "support": [s["strike"] for s in support],
            "resistance": [s["strike"] for s in resistance],
            "support_detail": support,
            "resistance_detail": resistance,
            "oi_change_bias": oi_bias,
            "oi_change_detail": oi_detail,
            "total_ce_oi_change": ce_change_sum,
            "total_pe_oi_change": pe_change_sum,
        }


# Module-level singleton
sr_calculator = SupportResistanceCalculator()
