"""
Celery Configuration & Scheduled Tasks
Handles automated data fetching and report generation on schedule.
"""

import os
from celery import Celery
from celery.schedules import crontab

# Celery app (falls back to in-memory broker if Redis unavailable)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "nse_report",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Kolkata",
    enable_utc=False,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

# Beat schedule — automated data pipeline
celery_app.conf.beat_schedule = {
    # Pre-market report at 8:00 AM IST
    "pre-market-report": {
        "task": "app.tasks.scheduled_fetch.generate_pre_market_report",
        "schedule": crontab(hour=8, minute=0),
        "options": {"queue": "reports"},
    },
    # Live data fetch every 1 min during market hours (9:15-15:30 IST)
    "live-index-fetch": {
        "task": "app.tasks.scheduled_fetch.fetch_live_data",
        "schedule": 60.0,  # every 60 seconds
        "options": {"queue": "data"},
    },
    # OI analytics every 5 min during market hours
    "oi-analytics": {
        "task": "app.tasks.scheduled_fetch.compute_oi_analytics",
        "schedule": 300.0,  # every 5 minutes
        "options": {"queue": "analytics"},
    },
    # Alert check every 15 min
    "alert-check": {
        "task": "app.tasks.scheduled_fetch.check_alerts",
        "schedule": 900.0,  # every 15 minutes
        "options": {"queue": "alerts"},
    },
    # Post-market report at 4:00 PM IST
    "post-market-report": {
        "task": "app.tasks.scheduled_fetch.generate_post_market_report",
        "schedule": crontab(hour=16, minute=0),
        "options": {"queue": "reports"},
    },
    # FII/DII data at 6:00 PM IST (after NSE publishes)
    "fii-dii-fetch": {
        "task": "app.tasks.scheduled_fetch.fetch_fii_dii",
        "schedule": crontab(hour=18, minute=0),
        "options": {"queue": "data"},
    },
}
