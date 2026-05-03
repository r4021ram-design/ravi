"""
Scheduled Fetch Tasks
Celery tasks for automated data pipeline operations.
"""

import logging
from datetime import datetime, time

from celeryconfig import celery_app

logger = logging.getLogger(__name__)

# IST market hours
MARKET_OPEN = time(9, 15)
MARKET_CLOSE = time(15, 30)


def is_market_hours() -> bool:
    """Check if current IST time is within NSE market hours."""
    now = datetime.now().time()
    return MARKET_OPEN <= now <= MARKET_CLOSE


def is_trading_day() -> bool:
    """Check if today is a trading day (Mon-Fri, not a holiday)."""
    today = datetime.now()
    return today.weekday() < 5  # Mon=0 to Fri=4


@celery_app.task(name="app.tasks.scheduled_fetch.generate_pre_market_report")
def generate_pre_market_report():
    """
    Generate pre-market report at 8:00 AM IST.
    Fetches global cues, previous day FII/DII, and assembles report.
    """
    if not is_trading_day():
        logger.info("Skipping pre-market report — not a trading day")
        return {"status": "skipped", "reason": "non-trading day"}

    logger.info("Generating pre-market report...")
    try:
        from app.services.report_generator import report_generator
        report = report_generator.generate()
        logger.info(f"Pre-market report generated in {report['generation_time_seconds']}s")
        # TODO: Store in database
        # TODO: Send email/SMS notifications
        return {"status": "success", "report_date": report["report_date"]}
    except Exception as e:
        logger.error(f"Pre-market report failed: {e}")
        return {"status": "error", "error": str(e)}


@celery_app.task(name="app.tasks.scheduled_fetch.fetch_live_data")
def fetch_live_data():
    """
    Fetch live index quotes and options chain every 1 minute.
    Only runs during market hours on trading days.
    """
    if not is_trading_day() or not is_market_hours():
        return {"status": "skipped", "reason": "outside market hours"}

    logger.info("Fetching live market data...")
    try:
        from app.services.data_ingestion.nse_fetcher import nse_fetcher
        indices = nse_fetcher.get_major_indices()
        # TODO: Push via WebSocket to connected clients
        # TODO: Store in time-series DB
        return {"status": "success", "indices": list(indices.keys())}
    except Exception as e:
        logger.error(f"Live data fetch failed: {e}")
        return {"status": "error", "error": str(e)}


@celery_app.task(name="app.tasks.scheduled_fetch.compute_oi_analytics")
def compute_oi_analytics():
    """
    Compute PCR, Max Pain, S/R levels every 5 minutes.
    Only runs during market hours.
    """
    if not is_trading_day() or not is_market_hours():
        return {"status": "skipped"}

    logger.info("Computing OI analytics...")
    try:
        from app.services.data_ingestion.nse_fetcher import nse_fetcher
        from app.services.analytics.pcr_calculator import pcr_calculator
        from app.services.analytics.max_pain import max_pain_calculator

        results = {}
        for symbol in ["NIFTY", "BANKNIFTY"]:
            oi_data = nse_fetcher.get_oi_data(symbol)
            if oi_data:
                results[symbol] = {
                    "pcr": pcr_calculator.calculate(oi_data),
                    "max_pain": max_pain_calculator.calculate(oi_data),
                }
        # TODO: Cache results in Redis
        # TODO: Push via WebSocket
        return {"status": "success", "symbols": list(results.keys())}
    except Exception as e:
        logger.error(f"OI analytics failed: {e}")
        return {"status": "error", "error": str(e)}


@celery_app.task(name="app.tasks.scheduled_fetch.check_alerts")
def check_alerts():
    """
    Check all active alert rules and trigger notifications.
    Runs every 15 minutes during market hours.
    """
    if not is_trading_day() or not is_market_hours():
        return {"status": "skipped"}

    logger.info("Checking alert rules...")
    try:
        from app.services.alert_engine import alert_engine
        triggered = alert_engine.check_all()
        return {"status": "success", "triggered": len(triggered)}
    except Exception as e:
        logger.error(f"Alert check failed: {e}")
        return {"status": "error", "error": str(e)}


@celery_app.task(name="app.tasks.scheduled_fetch.generate_post_market_report")
def generate_post_market_report():
    """Generate post-market report at 4:00 PM IST with EOD data."""
    if not is_trading_day():
        return {"status": "skipped"}

    logger.info("Generating post-market report...")
    try:
        from app.services.report_generator import report_generator
        report = report_generator.generate()
        # TODO: Update existing report with EOD data
        # TODO: Send post-market email
        return {"status": "success", "report_date": report["report_date"]}
    except Exception as e:
        logger.error(f"Post-market report failed: {e}")
        return {"status": "error", "error": str(e)}


@celery_app.task(name="app.tasks.scheduled_fetch.fetch_fii_dii")
def fetch_fii_dii():
    """Fetch FII/DII data after market close (published ~6 PM)."""
    if not is_trading_day():
        return {"status": "skipped"}

    logger.info("Fetching FII/DII data...")
    try:
        from app.services.data_ingestion.nse_fetcher import nse_fetcher
        data = nse_fetcher.get_fii_dii()
        # TODO: Store in fii_dii_flows table
        return {"status": "success", "data": data}
    except Exception as e:
        logger.error(f"FII/DII fetch failed: {e}")
        return {"status": "error", "error": str(e)}
