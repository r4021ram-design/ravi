"""
Technical Analysis Calculator
Computes SMA, RSI, MACD, Pivot Points, and ATR from OHLCV data.
All calculations are pure Python — no external TA library needed.
"""

import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


class TechnicalAnalyzer:
    """Calculates common technical indicators from OHLCV data."""

    def calculate(self, ohlcv: List[dict]) -> Optional[dict]:
        """
        Calculate all technical indicators from OHLCV data.

        Args:
            ohlcv: List of {date, open, high, low, close, volume} dicts,
                   sorted by date ascending.

        Returns:
            Dict containing computed indicators and the enriched OHLCV data.
        """
        if not ohlcv or len(ohlcv) < 20:
            return None

        closes = [d["close"] for d in ohlcv]
        highs = [d["high"] for d in ohlcv]
        lows = [d["low"] for d in ohlcv]

        # Moving Averages
        sma_20 = self._sma(closes, 20)
        sma_50 = self._sma(closes, 50)
        sma_200 = self._sma(closes, 200)

        # RSI (14-period)
        rsi_values = self._rsi(closes, 14)

        # MACD (12, 26, 9)
        macd_data = self._macd(closes, 12, 26, 9)

        # ATR (14-period)
        atr_values = self._atr(highs, lows, closes, 14)

        # Pivot Points (using last candle)
        last = ohlcv[-1]
        pivots = self._pivot_points(last["high"], last["low"], last["close"])

        # Enrich OHLCV with indicator values
        enriched = []
        for i, bar in enumerate(ohlcv):
            entry = {**bar}
            if i < len(sma_20):
                entry["sma_20"] = sma_20[i]
            if i < len(sma_50):
                entry["sma_50"] = sma_50[i]
            if i < len(sma_200):
                entry["sma_200"] = sma_200[i]
            if i < len(rsi_values):
                entry["rsi"] = rsi_values[i]
            if macd_data and i < len(macd_data["line"]):
                entry["macd_line"] = macd_data["line"][i]
                entry["macd_signal"] = macd_data["signal"][i] if i < len(macd_data["signal"]) else None
                entry["macd_hist"] = macd_data["histogram"][i] if i < len(macd_data["histogram"]) else None
            if i < len(atr_values):
                entry["atr"] = atr_values[i]
            enriched.append(entry)

        # Current values (latest)
        current = {
            "close": closes[-1],
            "sma_20": sma_20[-1] if sma_20 else None,
            "sma_50": sma_50[-1] if sma_50 else None,
            "sma_200": sma_200[-1] if sma_200 else None,
            "rsi": rsi_values[-1] if rsi_values else None,
            "atr": atr_values[-1] if atr_values else None,
            "macd_line": macd_data["line"][-1] if macd_data else None,
            "macd_signal": macd_data["signal"][-1] if macd_data and macd_data["signal"] else None,
            "pivots": pivots,
        }

        # Trend determination
        if sma_20 and sma_50:
            if sma_20[-1] > sma_50[-1] and closes[-1] > sma_20[-1]:
                trend = "Bullish"
            elif sma_20[-1] < sma_50[-1] and closes[-1] < sma_20[-1]:
                trend = "Bearish"
            else:
                trend = "Sideways"
        else:
            trend = "Insufficient Data"

        current["trend"] = trend

        return {
            "ohlcv": enriched,
            "current": current,
        }

    @staticmethod
    def _sma(data: List[float], period: int) -> List[Optional[float]]:
        """Simple Moving Average."""
        result = [None] * len(data)
        if len(data) < period:
            return result
        for i in range(period - 1, len(data)):
            result[i] = round(sum(data[i - period + 1:i + 1]) / period, 2)
        return result

    @staticmethod
    def _ema(data: List[float], period: int) -> List[float]:
        """Exponential Moving Average."""
        if len(data) < period:
            return []
        multiplier = 2.0 / (period + 1)
        ema = [sum(data[:period]) / period]
        for i in range(period, len(data)):
            ema.append((data[i] - ema[-1]) * multiplier + ema[-1])
        # Pad with None to align with original data
        result = [None] * (period - 1) + [round(v, 2) for v in ema]
        return result

    @staticmethod
    def _rsi(data: List[float], period: int = 14) -> List[Optional[float]]:
        """Relative Strength Index (Wilder's smoothing)."""
        if len(data) < period + 1:
            return [None] * len(data)

        deltas = [data[i] - data[i - 1] for i in range(1, len(data))]
        gains = [max(0, d) for d in deltas]
        losses = [max(0, -d) for d in deltas]

        # Initial averages
        avg_gain = sum(gains[:period]) / period
        avg_loss = sum(losses[:period]) / period

        result = [None] * (period)

        if avg_loss == 0:
            result.append(100.0)
        else:
            rs = avg_gain / avg_loss
            result.append(round(100 - 100 / (1 + rs), 2))

        # Wilder's smoothing
        for i in range(period, len(deltas)):
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period

            if avg_loss == 0:
                result.append(100.0)
            else:
                rs = avg_gain / avg_loss
                result.append(round(100 - 100 / (1 + rs), 2))

        return result

    def _macd(self, data: List[float], fast: int = 12, slow: int = 26, signal_period: int = 9) -> Optional[dict]:
        """MACD: fast EMA - slow EMA, signal = EMA of MACD line."""
        if len(data) < slow + signal_period:
            return None

        ema_fast = self._ema(data, fast)
        ema_slow = self._ema(data, slow)

        # MACD line = fast EMA - slow EMA
        macd_line = []
        for i in range(len(data)):
            if ema_fast[i] is not None and ema_slow[i] is not None:
                macd_line.append(round(ema_fast[i] - ema_slow[i], 2))
            else:
                macd_line.append(None)

        # Signal line = EMA(9) of MACD values
        valid_macd = [v for v in macd_line if v is not None]
        if len(valid_macd) < signal_period:
            return {"line": macd_line, "signal": [None] * len(data), "histogram": [None] * len(data)}

        signal_ema = self._ema(valid_macd, signal_period)
        # Align signal with original data
        offset = len(data) - len(signal_ema)
        signal_line = [None] * offset + signal_ema

        # Histogram = MACD - Signal
        histogram = []
        for i in range(len(data)):
            if macd_line[i] is not None and i < len(signal_line) and signal_line[i] is not None:
                histogram.append(round(macd_line[i] - signal_line[i], 2))
            else:
                histogram.append(None)

        return {
            "line": macd_line,
            "signal": signal_line,
            "histogram": histogram,
        }

    @staticmethod
    def _atr(highs: List[float], lows: List[float], closes: List[float], period: int = 14) -> List[Optional[float]]:
        """Average True Range."""
        if len(highs) < period + 1:
            return [None] * len(highs)

        true_ranges = [highs[0] - lows[0]]
        for i in range(1, len(highs)):
            tr = max(
                highs[i] - lows[i],
                abs(highs[i] - closes[i - 1]),
                abs(lows[i] - closes[i - 1]),
            )
            true_ranges.append(tr)

        result = [None] * (period - 1)
        atr = sum(true_ranges[:period]) / period
        result.append(round(atr, 2))

        for i in range(period, len(true_ranges)):
            atr = (atr * (period - 1) + true_ranges[i]) / period
            result.append(round(atr, 2))

        return result

    @staticmethod
    def _pivot_points(high: float, low: float, close: float) -> dict:
        """Classic Pivot Points."""
        pp = round((high + low + close) / 3, 2)
        r1 = round(2 * pp - low, 2)
        s1 = round(2 * pp - high, 2)
        r2 = round(pp + (high - low), 2)
        s2 = round(pp - (high - low), 2)
        r3 = round(high + 2 * (pp - low), 2)
        s3 = round(low - 2 * (high - pp), 2)
        return {"pp": pp, "r1": r1, "r2": r2, "r3": r3, "s1": s1, "s2": s2, "s3": s3}


# Module-level singleton
technical_analyzer = TechnicalAnalyzer()
