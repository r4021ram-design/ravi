"""
NSE Data Fetcher — Real-Time Trading Terminal Core
Fetches indices, options chain, FII/DII flows from NSE India.
Uses jugaad-data for reliable data fetching without getting blocked.
"""

import time
import json
import logging
from datetime import datetime, date
from typing import Any, Optional

from jugaad_data.nse import NSELive
import requests

from app.config import settings

logger = logging.getLogger(__name__)


class NSEFetcher:
    """
    Real-time NSE data fetcher using jugaad-data.
    Handles rate limiting and graceful fallbacks.
    """

    def __init__(self):
        self._n = NSELive()
        self._last_request_time: float = 0

    def _rate_limit(self) -> None:
        """Enforce rate limiting between NSE requests."""
        elapsed = time.time() - self._last_request_time
        if elapsed < settings.NSE_RATE_LIMIT:
            time.sleep(settings.NSE_RATE_LIMIT - elapsed)
        self._last_request_time = time.time()

    # ----- Index Data -----

    def get_all_indices(self) -> Optional[dict]:
        """Fetch all NSE indices (NIFTY 50, BANK NIFTY, FINNIFTY, etc.)."""
        self._rate_limit()
        try:
            return self._n.all_indices()
        except Exception as e:
            logger.error(f"Failed to fetch indices: {e}")
            return None

    def get_index_quote(self, symbol: str = "NIFTY 50") -> Optional[dict]:
        """
        Get detailed quote for a specific index.
        Returns: open, high, low, close, change, changePercent, volume
        """
        data = self.get_all_indices()
        if not data or "data" not in data:
            return None

        for index in data["data"]:
            if index.get("index") == symbol:
                return {
                    "symbol": symbol,
                    "last": index.get("last"),
                    "open": index.get("open"),
                    "high": index.get("high"),
                    "low": index.get("low"),
                    "previousClose": index.get("previousClose"),
                    "change": index.get("variation"),
                    "changePercent": index.get("percentChange"),
                    "timestamp": datetime.now().isoformat(),
                }

        logger.warning(f"Index not found: {symbol}")
        return None

    def get_major_indices(self) -> dict:
        """Get NIFTY 50, BANK NIFTY, FINNIFTY quotes in one call."""
        result = {}
        for symbol in ["NIFTY 50", "NIFTY BANK", "NIFTY FIN SERVICE"]:
            quote = self.get_index_quote(symbol)
            if quote:
                result[symbol] = quote
            else:
                result[symbol] = {"symbol": symbol, "status": "data not available"}
        return result

    # ----- Options Chain -----

    def get_option_chain(self, symbol: str = "NIFTY", expiry: str = None) -> Optional[dict]:
        """
        Fetch full options chain for an index or equity.
        Optionally filter by expiry date at the fetch level.
        """
        self._rate_limit()
        try:
            if symbol in ("NIFTY", "BANKNIFTY", "FINNIFTY"):
                data = self._n.index_option_chain(symbol, expiry=expiry)
            else:
                data = self._n.equities_option_chain(symbol, expiry=expiry)

            if not data or "records" not in data:
                return None

            return {
                "symbol": symbol,
                "underlying_value": data["records"].get("underlyingValue"),
                "expiry_dates": data["records"].get("expiryDates", []),
                "strikePrices": data["records"].get("strikePrices", []),
                "data": data["records"].get("data", []),
                "filtered": data.get("filtered", {}),
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            logger.error(f"Failed to fetch option chain for {symbol}: {e}")
            return None

    def get_oi_data(self, symbol: str = "NIFTY", expiry: str = None) -> Optional[dict]:
        """
        Extract structured OI data from option chain.
        Returns: per-strike CE/PE OI, total OI, PCR data.
        """
        chain = self.get_option_chain(symbol, expiry=expiry)
        if not chain:
            return None

        strikes = []
        total_ce_oi = 0
        total_pe_oi = 0

        # Normalize filter expiry if provided
        filter_expiry_date = None
        if expiry:
            try:
                # Try common formats
                for fmt in ["%d-%b-%Y", "%d-%m-%Y"]:
                    try:
                        filter_expiry_date = datetime.strptime(expiry, fmt).date()
                        break
                    except ValueError:
                        continue
            except Exception:
                filter_expiry_date = None

        for record in chain["data"]:
            record_expiry_str = record.get("expiryDate") or record.get("CE", {}).get("expiryDate") or record.get("PE", {}).get("expiryDate")
            if filter_expiry_date and record_expiry_str:
                try:
                    record_expiry_date = None
                    for fmt in ["%d-%b-%Y", "%d-%m-%Y"]:
                        try:
                            record_expiry_date = datetime.strptime(record_expiry_str, fmt).date()
                            break
                        except ValueError:
                            continue
                    
                    if record_expiry_date != filter_expiry_date:
                        continue
                except Exception:
                    # If parsing fails, fall back to string comparison
                    if record_expiry_str != expiry:
                        continue
            elif expiry and record_expiry_str != expiry:
                continue

            strike_data = {
                "strikePrice": record.get("strikePrice"),
                "expiryDate": record_expiry_str
            }

            if "CE" in record:
                ce = record["CE"]
                strike_data["CE"] = {
                    "oi": ce.get("openInterest", 0),
                    "oiChange": ce.get("changeinOpenInterest", 0),
                    "volume": ce.get("totalTradedVolume", 0),
                    "iv": ce.get("impliedVolatility", 0),
                    "ltp": ce.get("lastPrice", 0),
                    "change": ce.get("change", 0),
                }
                total_ce_oi += ce.get("openInterest", 0)

            if "PE" in record:
                pe = record["PE"]
                strike_data["PE"] = {
                    "oi": pe.get("openInterest", 0),
                    "oiChange": pe.get("changeinOpenInterest", 0),
                    "volume": pe.get("totalTradedVolume", 0),
                    "iv": pe.get("impliedVolatility", 0),
                    "ltp": pe.get("lastPrice", 0),
                    "change": pe.get("change", 0),
                }
                total_pe_oi += pe.get("openInterest", 0)

            strikes.append(strike_data)

        pcr = round(total_pe_oi / total_ce_oi, 2) if total_ce_oi > 0 else None

        return {
            "symbol": symbol,
            "underlying_value": chain["underlying_value"],
            "expiry_dates": chain["expiry_dates"],
            "strikes": strikes,
            "total_ce_oi": total_ce_oi,
            "total_pe_oi": total_pe_oi,
            "pcr": pcr,
            "timestamp": chain["timestamp"],
        }

    # ----- FII/DII Flows -----

    def get_fii_dii(self) -> Optional[dict]:
        """
        Fetch FII/DII trading activity.
        Note: jugaad-data doesn't have a direct method, using requests fallback or returning mock/unavailable.
        """
        # Hard to get FII/DII directly without proper cookies. Returning none to let the system handle "unavailable" gracefully.
        return None

    # ----- Market Status -----

    def get_market_status(self) -> Optional[dict]:
        """Get current market status (Pre-Open, Open, Closed)."""
        self._rate_limit()
        try:
            data = self._n.market_status()
            if not data or "marketState" not in data:
                return None

            states = {}
            for market in data["marketState"]:
                states[market.get("market", "Unknown")] = {
                    "status": market.get("marketStatus", "Unknown"),
                    "tradeDate": market.get("tradeDate"),
                    "index": market.get("index"),
                    "last": market.get("last"),
                    "variation": market.get("variation"),
                    "percentChange": market.get("percentChange"),
                }
            return states
        except Exception as e:
            logger.error(f"Failed to fetch market status: {e}")
            return None

    def close(self):
        """Close method for compatibility."""
        pass


# Module-level singleton
nse_fetcher = NSEFetcher()
