"""
NSE Report App - Configuration
Environment-based settings using Pydantic BaseSettings.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    # App
    APP_NAME: str = "NSE Daily Report App"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # API Keys
    ALPHA_VANTAGE_API_KEY: Optional[str] = None
    FMP_API_KEY: Optional[str] = None

    # Database
    DATABASE_URL: str = "sqlite:///./nse_report.db"

    # Redis / Caching
    # Using local dict cache for MVP to avoid strict Redis dependency
    REDIS_URL: str = "redis://localhost:6379/0"
    USE_LOCAL_CACHE: bool = True

    # Cache TTLs (seconds)
    CACHE_TTL_LIVE: int = 60        # Live market data: 1 minute
    CACHE_TTL_EOD: int = 86400      # End-of-day data: 24 hours
    CACHE_TTL_REPORT: int = 3600    # Generated report: 1 hour

    # NSE Settings
    NSE_BASE_URL: str = "https://www.nseindia.com"
    NSE_RATE_LIMIT: float = 0.35    # Min seconds between NSE requests
    NSE_MAX_RETRIES: int = 3
    NSE_TIMEOUT: int = 15

    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 30
    WS_MAX_CONNECTIONS: int = 1000

    # Report Generation
    REPORT_SCHEDULE_IST: str = "08:00"  # Pre-market report time
    POST_MARKET_SCHEDULE_IST: str = "16:00"

    # Notification
    SENDGRID_API_KEY: Optional[str] = None
    TWILIO_SID: Optional[str] = None
    TWILIO_TOKEN: Optional[str] = None

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
