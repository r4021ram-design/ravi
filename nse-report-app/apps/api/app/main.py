"""
NSE Report App - FastAPI Main Entry Point
Real-time trading terminal architecture serving daily report surfaces.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events for the trading terminal."""
    # Startup: Initialize connections
    print(f"[START] {settings.APP_NAME} v{settings.APP_VERSION} starting...")
    print("[DATA] Initializing real-time data pipeline...")
    # TODO: Initialize Redis connection pool
    # TODO: Initialize DB connection pool
    # TODO: Start WebSocket manager
    yield
    # Shutdown: Cleanup
    print("[STOP] Shutting down data pipeline...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Real-time NSE trading terminal architecture "
        "serving daily pre-market & post-market reports."
    ),
    lifespan=lifespan,
)

# CORS - allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Health Check ---
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


# --- Register Routers ---
from app.routes import report, alerts
app.include_router(report.router, prefix="/api/report", tags=["Report"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])

from app.routes import stocks, strategies, options
app.include_router(stocks.router, prefix="/api/stocks", tags=["Stocks"])
app.include_router(strategies.router, prefix="/api/strategies", tags=["Strategies"])
app.include_router(options.router, prefix="/api/options", tags=["Options"])

from app.routes import chart, history
app.include_router(chart.router, prefix="/api/chart", tags=["Chart"])
app.include_router(history.router, prefix="/api/history", tags=["History"])
