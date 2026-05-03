"""
Max Pain Calculator
Computes the strike price where option writers incur minimum total loss.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


class MaxPainCalculator:
    """
    Calculates Max Pain (point of maximum pain for option buyers)
    = strike where total intrinsic value paid by writers is minimized.
    """

    def calculate(self, oi_data: dict) -> Optional[dict]:
        """
        Calculate Max Pain from OI data.

        Method: For each possible expiry price (strike), calculate the total
        loss for all CE and PE writers. Max Pain = strike with minimum loss.

        Args:
            oi_data: Output from nse_fetcher.get_oi_data()

        Returns:
            Max Pain strike, OI distribution, and chart data.
        """
        if not oi_data or not oi_data.get("strikes"):
            return None

        strikes = oi_data["strikes"]
        strike_prices = [s["strikePrice"] for s in strikes if "strikePrice" in s]

        if not strike_prices:
            return None

        # Build OI map: {strike: {ce_oi, pe_oi}}
        oi_map = {}
        for s in strikes:
            sp = s.get("strikePrice")
            if sp is None:
                continue
            oi_map[sp] = {
                "ce_oi": s.get("CE", {}).get("oi", 0),
                "pe_oi": s.get("PE", {}).get("oi", 0),
            }

        # Calculate total pain at each strike price
        pain_values = {}

        for test_price in strike_prices:
            total_pain = 0

            for strike, oi in oi_map.items():
                # CE writers' loss if price > strike
                if test_price > strike:
                    total_pain += (test_price - strike) * oi["ce_oi"]

                # PE writers' loss if price < strike
                if test_price < strike:
                    total_pain += (strike - test_price) * oi["pe_oi"]

            pain_values[test_price] = total_pain

        # Max Pain = strike with minimum total pain
        max_pain_strike = min(pain_values, key=pain_values.get)

        # Top OI strikes for chart
        sorted_ce = sorted(
            oi_map.items(),
            key=lambda x: x[1]["ce_oi"],
            reverse=True,
        )[:10]
        sorted_pe = sorted(
            oi_map.items(),
            key=lambda x: x[1]["pe_oi"],
            reverse=True,
        )[:10]

        return {
            "symbol": oi_data.get("symbol"),
            "max_pain": max_pain_strike,
            "underlying_value": oi_data.get("underlying_value"),
            "distance_from_spot": (
                round(
                    max_pain_strike - oi_data.get("underlying_value", 0), 1
                )
                if oi_data.get("underlying_value")
                else None
            ),
            "highest_ce_oi_strikes": [
                {"strike": s, "oi": d["ce_oi"]} for s, d in sorted_ce
            ],
            "highest_pe_oi_strikes": [
                {"strike": s, "oi": d["pe_oi"]} for s, d in sorted_pe
            ],
            "pain_chart_data": [
                {"strike": s, "pain": p}
                for s, p in sorted(pain_values.items())
            ],
        }


# Module-level singleton
max_pain_calculator = MaxPainCalculator()
