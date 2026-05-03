#!/usr/bin/env python3
"""
Market Analysis Utility Functions for Environment Report

This script provides common functions for market analysis report creation.
"""

from datetime import datetime, timedelta


def get_market_session_times():
    """Returns major market trading hours"""
    return {
        "Tokyo": {"open": "09:00 JST", "close": "15:00 JST", "lunch": "11:30-12:30"},
        "Shanghai": {"open": "09:30 CST", "close": "15:00 CST", "lunch": "11:30-13:00"},
        "Hong Kong": {"open": "09:30 HKT", "close": "16:00 HKT", "lunch": "12:00-13:00"},
        "Singapore": {"open": "09:00 SGT", "close": "17:00 SGT", "lunch": "12:00-13:00"},
        "London": {"open": "08:00 GMT", "close": "16:30 GMT", "lunch": None},
        "New York": {"open": "09:30 EST", "close": "16:00 EST", "lunch": None},
        "India (NSE/BSE)": {"open": "09:15 IST", "close": "15:30 IST", "lunch": None},
    }


def format_market_report_header():
    """Format report header"""
    now = datetime.now()
    weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    return f"""
=====================================
📊 Daily Market Environment Report
=====================================
Created: {now.strftime("%Y-%m-%d")} ({weekdays[now.weekday()]}) {now.strftime("%H:%M")}
=====================================
"""


def calculate_trading_days_to_event(event_date_str):
    """Calculate trading days to event"""
    # Simple version: excludes weekends (doesn't consider holidays)
    event_date = datetime.strptime(event_date_str, "%Y-%m-%d")
    today = datetime.now().date()

    trading_days = 0
    current = today

    while current < event_date.date():
        if current.weekday() < 5:  # Monday to Friday
            trading_days += 1
        current += timedelta(days=1)

    return trading_days


def get_indian_market_indices():
    """Returns major Indian market indices"""
    return {
        "NIFTY 50": "National Stock Exchange (NSE) flagship index",
        "SENSEX": "BSE Limited (BSE) benchmark index",
        "NIFTY BANK": "Banking sector index",
        "NIFTY NEXT 50": "Next 50 blue-chip companies",
        "India VIX": "Volatility index based on NIFTY index option prices",
    }


def format_percentage_change(value):
    """Format percentage change"""
    if value >= 0:
        return f"📈 +{value:.2f}%"
    else:
        return f"📉 {value:.2f}%"


def categorize_volatility(vix_value):
    """Categorize volatility based on VIX level"""
    if vix_value < 12:
        return "Low & Stable 😌"
    elif vix_value < 20:
        return "Normal Range 📊"
    elif vix_value < 30:
        return "Elevated ⚠️"
    elif vix_value < 40:
        return "High Volatility 🔥"
    else:
        return "Extreme Volatility 🚨"


def get_market_status():
    """Determine current market status"""
    now = datetime.now()
    hour = now.hour
    minute = now.minute

    status = []

    # Simple market open determination (timezone not considered)
    # Tokyo
    if 9 <= hour < 15:
        status.append("🟢 Tokyo Market: Trading")
    elif 15 <= hour < 18:
        status.append("🔴 Tokyo Market: Closed")
    else:
        status.append("⏰ Tokyo Market: After hours")

    # India (Assuming system time is IST as per user environment)
    if (hour == 9 and minute >= 15) or (9 < hour < 15) or (hour == 15 and minute <= 30):
        status.append("🟢 Indian Market: Trading")
    elif hour == 9 and minute < 15:
        status.append("🟡 Indian Market: Pre-open Session")
    elif hour == 15 and 30 < minute < 40:
        status.append("🔴 Indian Market: Closing Session")
    elif hour == 15 and 40 <= minute <= 60:
        status.append("🟡 Indian Market: Post-closing Session")
    else:
        status.append("⏰ Indian Market: Closed/After hours")

    if 21 <= hour or hour < 4:
        status.append("🟢 US Market: Trading (previous day)")
    else:
        status.append("🔴 US Market: Closed")

    return "\n".join(status)


def generate_checklist():
    """Generate market analysis checklist"""
    return """
📋 Analysis Checklist
--------------------
□ US market status check
□ Asian market status check (Nikkei, Hang Seng)
□ Indian market status check (NIFTY 50, SENSEX)
□ European market status check (DAX, FTSE)
□ Forex rates (USD/INR, USD/JPY, EUR/USD)
□ Index futures movements (GIFT Nifty, US Futures)
□ Volatility level check (India VIX, VIX)
□ Oil & Gold prices
□ Economic calendar (RBI decisions, GDP, CPI)
□ Corporate earnings schedule
□ Central bank news (RBI, Fed, ECB)
□ Geopolitical risks
"""


if __name__ == "__main__":
    print("Market Analysis Utility - Test Run")
    print(format_market_report_header())
    print("\nCurrent Market Status:")
    print(get_market_status())
    print("\nTrading Hours:")
    for market, times in get_market_session_times().items():
        lunch = f" (Lunch break: {times['lunch']})" if times.get("lunch") else ""
        print(f"  {market}: {times['open']} - {times['close']}{lunch}")
    
    print("\nIndian Market Indices:")
    for index, desc in get_indian_market_indices().items():
        print(f"  - {index}: {desc}")

    print(generate_checklist())
