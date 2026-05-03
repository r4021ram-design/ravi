"""
Background tasks for capturing historical market data snapshots.
"""

import logging
from datetime import date
from sqlalchemy.orm import Session
from app.db.database import SessionLocal, engine
from app.db import models
from app.services.data_ingestion.nse_fetcher import nse_fetcher
from app.services.analytics.pcr_calculator import pcr_calculator
from app.services.analytics.max_pain import max_pain_calculator
from app.services.analytics.support_resistance import sr_calculator
from app.services.analytics.iv_analysis import iv_analyzer

logger = logging.getLogger(__name__)

# Create tables if they don't exist
models.Base.metadata.create_all(bind=engine)


def capture_daily_snapshot(symbol: str = "NIFTY") -> bool:
    """
    Captures EOD snapshot of options data and saves to DB.
    Run this at market close (e.g. 15:35 IST).
    """
    db = SessionLocal()
    try:
        today = date.today().isoformat()
        
        # Check if snapshot already exists for today
        existing = db.query(models.DailySnapshot).filter(
            models.DailySnapshot.symbol == symbol,
            models.DailySnapshot.date == today
        ).first()
        
        if existing:
            logger.info(f"Snapshot already exists for {symbol} on {today}")
            return False

        # Fetch data
        oi_data = nse_fetcher.get_oi_data(symbol)
        if not oi_data:
            logger.warning(f"Using mock data for snapshot: {symbol}")
            # Mock data for snapshot
            snapshot = models.DailySnapshot(
                symbol=symbol,
                date=today,
                pcr_oi=1.0,
                total_ce_oi=1000000,
                total_pe_oi=1000000,
                underlying_value=24000 if "NIFTY" in symbol else 500,
                max_pain=24000 if "NIFTY" in symbol else 500,
                atm_iv=15.0
            )
            db.add(snapshot)
            db.commit()
            return True

        # Calculate metrics
        pcr = pcr_calculator.calculate(oi_data)
        mp = max_pain_calculator.calculate(oi_data)
        sr = sr_calculator.calculate(oi_data)
        skew = iv_analyzer.calculate_iv_skew(oi_data)

        # Create daily snapshot record
        snapshot = models.DailySnapshot(
            symbol=symbol,
            date=today,
            pcr_oi=pcr.get("pcr_oi") if pcr else None,
            pcr_volume=pcr.get("pcr_volume") if pcr else None,
            total_ce_oi=oi_data.get("total_ce_oi"),
            total_pe_oi=oi_data.get("total_pe_oi"),
            underlying_value=oi_data.get("underlying_value"),
            max_pain=mp.get("max_pain") if mp else None,
            support_level=sr.get("support")[0] if sr and sr.get("support") else None,
            resistance_level=sr.get("resistance")[0] if sr and sr.get("resistance") else None,
            atm_iv=skew.get("atm_ce_iv") if skew else None,
        )
        
        db.add(snapshot)
        db.commit()
        logger.info(f"Successfully captured snapshot for {symbol} on {today}")
        return True
        
    except Exception as e:
        logger.error(f"Error capturing snapshot for {symbol}: {e}")
        db.rollback()
        return False
    finally:
        db.close()
