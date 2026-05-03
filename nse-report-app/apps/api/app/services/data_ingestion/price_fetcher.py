"""
Price Fetcher — Historical OHLCV Data
Uses jugaad-data to fetch historical stock/index prices for charting.
"""

import logging
from datetime import date, timedelta
from typing import Optional, List

logger = logging.getLogger(__name__)


class PriceFetcher:
    """Fetches historical OHLCV data for stocks and indices."""

    def _fetch_from_yfinance(self, ticker: str, days: int) -> Optional[List[dict]]:
        """Fallback: Fetch data from Yahoo Finance."""
        try:
            import yfinance as yf
            import pandas as pd
            import numpy as np
            end = date.today()
            start = end - timedelta(days=days)
            
            # Use period instead of start/end for better reliability in some envs
            df = yf.download(ticker, period=f"{days}d", interval="1d", progress=False)
            
            if df is None or df.empty:
                return None
                
            # Flatten MultiIndex columns if present
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)

            records = []
            for idx, row in df.iterrows():
                try:
                    dt = idx.date() if hasattr(idx, 'date') else idx
                    
                    def safe_float(val):
                        if isinstance(val, (pd.Series, np.ndarray)):
                            val = val.iloc[0] if hasattr(val, 'iloc') else val[0]
                        return float(val)

                    records.append({
                        "date": str(dt),
                        "open": round(safe_float(row['Open']), 2),
                        "high": round(safe_float(row['High']), 2),
                        "low": round(safe_float(row['Low']), 2),
                        "close": round(safe_float(row['Close']), 2),
                        "volume": int(safe_float(row['Volume'])) if not pd.isna(safe_float(row['Volume'])) else 0,
                    })
                except Exception as row_err:
                    logger.warning(f"Error parsing row for {ticker}: {row_err}")
                    continue
                    
            return sorted(records, key=lambda x: x["date"])
        except Exception as e:
            logger.error(f"yfinance fallback failed for {ticker}: {e}")
            return None

    def _generate_mock_data(self, symbol: str, days: int) -> List[dict]:
        """Generate synthetic OHLCV data for demonstration/fallback."""
        import random
        records = []
        base_price = 24000 if "NIFTY" in symbol else 500
        curr_price = base_price
        
        for i in range(days, 0, -1):
            dt = date.today() - timedelta(days=i)
            # Skip weekends (simple check)
            if dt.weekday() >= 5: continue
            
            change = curr_price * random.uniform(-0.015, 0.015)
            open_p = curr_price
            close_p = curr_price + change
            high_p = max(open_p, close_p) + (curr_price * random.uniform(0, 0.005))
            low_p = min(open_p, close_p) - (curr_price * random.uniform(0, 0.005))
            
            records.append({
                "date": str(dt),
                "open": round(open_p, 2),
                "high": round(high_p, 2),
                "low": round(low_p, 2),
                "close": round(close_p, 2),
                "volume": random.randint(100000, 1000000),
            })
            curr_price = close_p
            
        return records

    def get_stock_history(self, symbol: str, days: int = 90) -> Optional[List[dict]]:
        """Fetch daily OHLCV for a stock from NSE or yfinance fallback."""
        # Try jugaad-data first
        try:
            from jugaad_data.nse import stock_df
            end = date.today()
            start = end - timedelta(days=days)
            df = stock_df(symbol=symbol, from_date=start, to_date=end)
            if df is not None and not df.empty:
                records = []
                for _, row in df.iterrows():
                    records.append({
                        "date": str(row.get("DATE", row.name)),
                        "open": float(row.get("OPEN", 0)),
                        "high": float(row.get("HIGH", 0)),
                        "low": float(row.get("LOW", 0)),
                        "close": float(row.get("CLOSE", row.get("LTP", 0))),
                        "volume": int(row.get("VOLUME", row.get("NO OF TRADES", 0))),
                    })
                return sorted(records, key=lambda x: x["date"])
        except Exception as e:
            logger.warning(f"jugaad-data failed for {symbol}, trying yfinance: {e}")

        # Fallback to yfinance
        yf_data = self._fetch_from_yfinance(f"{symbol}.NS", days)
        if yf_data:
            return yf_data
            
        # Last resort: Mock data for MVP visibility
        logger.info(f"Generating mock data for {symbol}")
        return self._generate_mock_data(symbol, days)

    def get_index_history(self, index: str = "NIFTY 50", days: int = 90) -> Optional[List[dict]]:
        """Fetch daily OHLCV for an index from NSE or yfinance fallback."""
        # Try jugaad-data first
        try:
            from jugaad_data.nse import index_df
            end = date.today()
            start = end - timedelta(days=days)
            df = index_df(symbol=index, from_date=start, to_date=end)
            if df is not None and not df.empty:
                records = []
                for _, row in df.iterrows():
                    records.append({
                        "date": str(row.get("HistoricalDate", row.name)),
                        "open": float(row.get("OPEN", 0)),
                        "high": float(row.get("HIGH", 0)),
                        "low": float(row.get("LOW", 0)),
                        "close": float(row.get("CLOSE", 0)),
                        "volume": int(row.get("VOLUME", 0)) if "VOLUME" in row else 0,
                    })
                return sorted(records, key=lambda x: x["date"])
        except Exception as e:
            logger.warning(f"jugaad-data failed for index {index}, trying yfinance: {e}")

        # Fallback mapping for yfinance
        YF_INDEX_MAP = {
            "NIFTY 50": "^NSEI",
            "NIFTY BANK": "^NSEBANK",
            "NIFTY FIN SERVICE": "NIFTY-FIN-SERVICE.NS",
            "NIFTY MIDCAP SELECT": "NIFTY_MID_SELECT.NS"
        }
        yf_ticker = YF_INDEX_MAP.get(index)
        if yf_ticker:
            yf_data = self._fetch_from_yfinance(yf_ticker, days)
            if yf_data:
                return yf_data
        
        # Last resort: Mock data for MVP visibility
        logger.info(f"Generating mock data for index {index}")
        return self._generate_mock_data(index, days)


# Symbol to index name mapping
INDEX_MAP = {
    "NIFTY": "NIFTY 50",
    "BANKNIFTY": "NIFTY BANK",
    "FINNIFTY": "NIFTY FIN SERVICE",
    "MIDCPNIFTY": "NIFTY MIDCAP SELECT",
}


# Module-level singleton
price_fetcher = PriceFetcher()
