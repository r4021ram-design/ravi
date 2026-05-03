"""
Contract Specifications Service
Provides lot sizes, margin estimates, and contract metadata for F&O symbols.
"""

from typing import Optional


# NSE F&O lot sizes (updated periodically by NSE)
LOT_SIZES = {
    # Index Options
    "NIFTY": 25,
    "BANKNIFTY": 15,
    "FINNIFTY": 25,
    "MIDCPNIFTY": 50,
    # Stock Options (popular F&O stocks)
    "RELIANCE": 250,
    "HDFCBANK": 550,
    "INFY": 300,
    "TCS": 175,
    "ICICIBANK": 700,
    "SBIN": 750,
    "TATAMOTORS": 575,
    "ITC": 1600,
    "BAJFINANCE": 125,
    "LT": 375,
    "AXISBANK": 625,
    "KOTAKBANK": 400,
    "HINDUNILVR": 300,
    "MARUTI": 100,
    "WIPRO": 1500,
    "HCLTECH": 350,
    "SUNPHARMA": 700,
    "ADANIENT": 250,
    "TATASTEEL": 1100,
    "BHARTIARTL": 475,
    "ASIANPAINT": 300,
    "ULTRACEMCO": 100,
    "TITAN": 250,
    "BAJAJFINSV": 500,
    "POWERGRID": 2700,
    "NTPC": 2700,
    "ONGC": 3850,
    "COALINDIA": 2100,
    "M&M": 350,
    "JSWSTEEL": 675,
    "DRREDDY": 125,
    "CIPLA": 650,
    "DIVISLAB": 175,
    "APOLLOHOSP": 125,
    "EICHERMOT": 175,
    "GRASIM": 275,
    "TATACONSUM": 675,
    "NESTLEIND": 25,
    "TECHM": 600,
    "INDUSINDBK": 500,
}

# Approximate SPAN margin percentages (varies by symbol and volatility)
MARGIN_PCT = {
    "NIFTY": 0.12,
    "BANKNIFTY": 0.14,
    "FINNIFTY": 0.13,
}
DEFAULT_MARGIN_PCT = 0.18  # ~18% for most stock options


class ContractSpecsService:
    """Provides F&O contract metadata for any symbol."""

    def get_specs(self, symbol: str, spot: float = 0) -> Optional[dict]:
        """
        Get contract specifications for a symbol.

        Returns:
            - lot_size
            - contract_value (lot_size * spot)
            - margin_approx (estimated initial margin)
            - tick_size (0.05 for NSE options)
            - is_index (whether it's an index option)
        """
        symbol = symbol.upper()
        lot_size = LOT_SIZES.get(symbol)

        if lot_size is None:
            return None

        is_index = symbol in ("NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY")
        margin_pct = MARGIN_PCT.get(symbol, DEFAULT_MARGIN_PCT)
        contract_value = lot_size * spot if spot else 0
        margin_approx = round(contract_value * margin_pct)

        return {
            "symbol": symbol,
            "lot_size": lot_size,
            "contract_value": round(contract_value),
            "margin_approx": margin_approx,
            "margin_pct": margin_pct,
            "tick_size": 0.05,
            "is_index": is_index,
        }

    def get_lot_size(self, symbol: str) -> int:
        """Quick lookup for lot size."""
        return LOT_SIZES.get(symbol.upper(), 0)


# Module-level singleton
contract_specs = ContractSpecsService()
