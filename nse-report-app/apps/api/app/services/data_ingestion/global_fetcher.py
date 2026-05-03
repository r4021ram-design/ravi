"""
Global Market Data Fetcher
Fetches US indices, commodities (Brent/WTI), forex (USD/INR), SGX Nifty.
Uses Alpha Vantage and Yahoo Finance as data sources.
"""

import logging
from datetime import datetime
from typing import Optional

import requests

from app.config import settings

logger = logging.getLogger(__name__)

# Yahoo Finance quote endpoint (no API key needed)
YAHOO_QUOTE_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"

# Alpha Vantage endpoints
AV_BASE = "https://www.alphavantage.co/query"

# Symbol mapping for Yahoo Finance
YAHOO_SYMBOLS = {
    "S&P 500": "^GSPC",
    "Dow Jones": "^DJI",
    "NASDAQ": "^IXIC",
    "FTSE 100": "^FTSE",
    "Nikkei 225": "^N225",
    "Hang Seng": "^HSI",
    "SGX Nifty": "SGXNIFTY.NS",
    "Brent Crude": "BZ=F",
    "WTI Crude": "CL=F",
    "Gold": "GC=F",
    "USD/INR": "USDINR=X",
    "EUR/USD": "EURUSD=X",
}


class GlobalFetcher:
    """
    Fetches global market data from Yahoo Finance and Alpha Vantage.
    Provides a unified interface for US indices, commodities, and forex.
    """

    def __init__(self):
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36"
            ),
        })

    def _fetch_yahoo(self, symbol: str) -> Optional[dict]:
        """Fetch a single quote from Yahoo Finance."""
        yahoo_symbol = YAHOO_SYMBOLS.get(symbol, symbol)
        url = YAHOO_QUOTE_URL.format(symbol=yahoo_symbol)

        try:
            resp = self._session.get(
                url,
                params={"interval": "1d", "range": "2d"},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()

            chart = data.get("chart", {}).get("result", [{}])[0]
            meta = chart.get("meta", {})
            quotes = chart.get("indicators", {}).get("quote", [{}])[0]

            current = meta.get("regularMarketPrice", 0)
            prev_close = meta.get("chartPreviousClose", 0)
            change = round(current - prev_close, 2) if prev_close else 0
            change_pct = (
                round((change / prev_close) * 100, 2) if prev_close else 0
            )

            return {
                "symbol": symbol,
                "price": current,
                "previousClose": prev_close,
                "change": change,
                "changePercent": change_pct,
                "currency": meta.get("currency", "USD"),
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            logger.error(f"Yahoo fetch failed for {symbol}: {e}")
            return None

    def get_us_indices(self) -> dict:
        """Fetch S&P 500, Dow Jones, NASDAQ."""
        result = {}
        for name in ["S&P 500", "Dow Jones", "NASDAQ"]:
            quote = self._fetch_yahoo(name)
            result[name] = quote or {"symbol": name, "status": "data not available"}
        return result

    def get_commodities(self) -> dict:
        """Fetch Brent Crude, WTI Crude, Gold."""
        result = {}
        for name in ["Brent Crude", "WTI Crude", "Gold"]:
            quote = self._fetch_yahoo(name)
            result[name] = quote or {"symbol": name, "status": "data not available"}
        return result

    def get_forex(self) -> dict:
        """Fetch USD/INR, EUR/USD."""
        result = {}
        for name in ["USD/INR", "EUR/USD"]:
            quote = self._fetch_yahoo(name)
            result[name] = quote or {"symbol": name, "status": "data not available"}
        return result

    def get_sgx_nifty(self) -> Optional[dict]:
        """Fetch SGX Nifty futures."""
        return self._fetch_yahoo("SGX Nifty") or {
            "symbol": "SGX Nifty",
            "status": "data not available",
        }

    def get_all_global_cues(self) -> dict:
        """
        Fetch all global data in one call.
        Returns structured dict for the daily report market_overview section.
        """
        return {
            "us_indices": self.get_us_indices(),
            "commodities": self.get_commodities(),
            "forex": self.get_forex(),
            "sgx_nifty": self.get_sgx_nifty(),
            "timestamp": datetime.now().isoformat(),
        }

    def close(self):
        """Close the HTTP session."""
        self._session.close()


# Module-level singleton
global_fetcher = GlobalFetcher()
