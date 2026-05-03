"""
India VIX Fetcher
Fetches India VIX from NSE and provides volatility interpretation.
"""

import math
import logging
from datetime import datetime
from typing import Optional

from app.services.data_ingestion.nse_fetcher import nse_fetcher

logger = logging.getLogger(__name__)


class VIXFetcher:
    """
    Fetches and interprets India VIX data.
    Provides volatility regime classification and expected NIFTY range.
    """

    # VIX regime thresholds
    REGIMES = {
        "Low": (0, 13),
        "Moderate": (13, 18),
        "Elevated": (18, 24),
        "High": (24, 35),
        "Extreme": (35, 100),
    }

    def get_india_vix(self) -> Optional[dict]:
        """
        Fetch current India VIX value.
        Returns VIX value, change, regime, and expected NIFTY range.
        """
        # VIX is available in the all-indices endpoint
        data = nse_fetcher.get_all_indices()
        if not data or "data" not in data:
            return None

        for index in data["data"]:
            if index.get("index") == "INDIA VIX":
                vix_value = index.get("last", 0)
                prev_close = index.get("previousClose", 0)
                change = index.get("variation", 0)
                change_pct = index.get("percentChange", 0)

                regime = self._classify_regime(vix_value)

                return {
                    "value": vix_value,
                    "previousClose": prev_close,
                    "change": change,
                    "changePercent": change_pct,
                    "regime": regime,
                    "interpretation": self._interpret(vix_value, regime),
                    "timestamp": datetime.now().isoformat(),
                }

        logger.warning("India VIX not found in indices data")
        return None

    def _classify_regime(self, vix: float) -> str:
        """Classify VIX into volatility regime."""
        for regime, (low, high) in self.REGIMES.items():
            if low <= vix < high:
                return regime
        return "Extreme"

    def _interpret(self, vix: float, regime: str) -> str:
        """Generate human-readable VIX interpretation."""
        interpretations = {
            "Low": (
                f"Low volatility (VIX {vix:.1f}). Market complacency. "
                "Good for option sellers. Watch for sudden spikes."
            ),
            "Moderate": (
                f"Moderate volatility (VIX {vix:.1f}). Normal market conditions. "
                "Balanced opportunity for buyers and sellers."
            ),
            "Elevated": (
                f"Elevated volatility (VIX {vix:.1f}). Increased uncertainty. "
                "Widen stop-losses. Consider hedging positions."
            ),
            "High": (
                f"High volatility (VIX {vix:.1f}). Significant fear in market. "
                "Avoid naked option selling. Use defined-risk strategies."
            ),
            "Extreme": (
                f"Extreme volatility (VIX {vix:.1f}). Panic/crisis levels. "
                "Reduce position sizes. Avoid new trades until VIX stabilizes."
            ),
        }
        return interpretations.get(regime, f"VIX at {vix:.1f}")

    def get_expected_nifty_range(
        self, vix: float, nifty_price: float, days: int = 1
    ) -> dict:
        """
        Calculate expected NIFTY range from VIX.
        Formula: range = NIFTY × (VIX/100) × √(days/365)
        """
        expected_move = nifty_price * (vix / 100) * math.sqrt(days / 365)
        return {
            "nifty_price": nifty_price,
            "vix": vix,
            "days": days,
            "expected_move": round(expected_move, 0),
            "upper_range": round(nifty_price + expected_move, 0),
            "lower_range": round(nifty_price - expected_move, 0),
            "range_string": (
                f"~{nifty_price - expected_move:.0f}"
                f"–{nifty_price + expected_move:.0f}"
            ),
        }


# Module-level singleton
vix_fetcher = VIXFetcher()
