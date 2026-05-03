"""
PCR (Put-Call Ratio) Calculator
Computes OI-based and Volume-based PCR with trend interpretation.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


class PCRCalculator:
    """
    Calculates Put-Call Ratio from options chain data.
    Provides OI PCR, Volume PCR, and market bias interpretation.
    """

    # PCR interpretation thresholds
    THRESHOLDS = {
        "extremely_bearish": (0, 0.5),
        "bearish": (0.5, 0.7),
        "slightly_bearish": (0.7, 0.85),
        "neutral": (0.85, 1.15),
        "slightly_bullish": (1.15, 1.3),
        "bullish": (1.3, 1.5),
        "extremely_bullish": (1.5, 10),
    }

    def calculate(self, oi_data: dict) -> Optional[dict]:
        """
        Calculate PCR from structured OI data.

        Args:
            oi_data: Output from nse_fetcher.get_oi_data()

        Returns:
            PCR analysis with OI PCR, volume PCR, and interpretation.
        """
        if not oi_data or not oi_data.get("strikes"):
            return None

        total_ce_oi = 0
        total_pe_oi = 0
        total_ce_vol = 0
        total_pe_vol = 0

        for strike in oi_data["strikes"]:
            ce = strike.get("CE", {})
            pe = strike.get("PE", {})

            total_ce_oi += ce.get("oi", 0)
            total_pe_oi += pe.get("oi", 0)
            total_ce_vol += ce.get("volume", 0)
            total_pe_vol += pe.get("volume", 0)

        pcr_oi = round(total_pe_oi / total_ce_oi, 3) if total_ce_oi > 0 else None
        pcr_vol = (
            round(total_pe_vol / total_ce_vol, 3) if total_ce_vol > 0 else None
        )

        bias = self._interpret(pcr_oi) if pcr_oi else "data not available"

        return {
            "symbol": oi_data.get("symbol"),
            "pcr_oi": pcr_oi,
            "pcr_volume": pcr_vol,
            "total_ce_oi": total_ce_oi,
            "total_pe_oi": total_pe_oi,
            "total_ce_volume": total_ce_vol,
            "total_pe_volume": total_pe_vol,
            "bias": bias,
            "interpretation": self._detailed_interpretation(pcr_oi, pcr_vol),
        }

    def _interpret(self, pcr: float) -> str:
        """Classify PCR into market bias."""
        for bias, (low, high) in self.THRESHOLDS.items():
            if low <= pcr < high:
                return bias
        return "neutral"

    def _detailed_interpretation(
        self, pcr_oi: Optional[float], pcr_vol: Optional[float]
    ) -> str:
        """Generate detailed interpretation text."""
        if pcr_oi is None:
            return "PCR data not available"

        if pcr_oi > 1.3:
            return (
                f"PCR {pcr_oi:.2f} — Bullish signal. "
                "High put writing indicates market support. "
                "Writers expect the market to hold or move up."
            )
        elif pcr_oi > 1.0:
            return (
                f"PCR {pcr_oi:.2f} — Slightly bullish. "
                "More puts than calls traded. Mild support building."
            )
        elif pcr_oi > 0.7:
            return (
                f"PCR {pcr_oi:.2f} — Neutral to slightly bearish. "
                "Call-put activity relatively balanced."
            )
        else:
            return (
                f"PCR {pcr_oi:.2f} — Bearish signal. "
                "Heavy call writing signals resistance overhead. "
                "Market expected to face selling pressure."
            )


# Module-level singleton
pcr_calculator = PCRCalculator()
