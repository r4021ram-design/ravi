"""
Database Models for Historical Data Snapshots.
Stores daily PCR, VIX, and Options OI data.
"""

from sqlalchemy import Column, Integer, Float, String, DateTime
from app.db.database import Base
from datetime import datetime


class DailySnapshot(Base):
    __tablename__ = "daily_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True)
    date = Column(String, index=True)  # Format: YYYY-MM-DD
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Put Call Ratios
    pcr_oi = Column(Float, nullable=True)
    pcr_volume = Column(Float, nullable=True)

    # Volatility
    india_vix = Column(Float, nullable=True)
    atm_iv = Column(Float, nullable=True)

    # Open Interest Totals
    total_ce_oi = Column(Integer, nullable=True)
    total_pe_oi = Column(Integer, nullable=True)

    # Price / Support / Resistance
    underlying_value = Column(Float, nullable=True)
    max_pain = Column(Float, nullable=True)
    support_level = Column(Float, nullable=True)
    resistance_level = Column(Float, nullable=True)


class StrikeSnapshot(Base):
    __tablename__ = "strike_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True)
    date = Column(String, index=True)
    expiry = Column(String, index=True)
    strike_price = Column(Float, index=True)
    
    ce_oi = Column(Integer, default=0)
    pe_oi = Column(Integer, default=0)
    ce_iv = Column(Float, default=0)
    pe_iv = Column(Float, default=0)
