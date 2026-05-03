"""
Daily Report Generator
Orchestrates all data fetchers and analytics to produce the
complete daily report JSON matching the PRD schema.
"""

import logging
from datetime import datetime, date
from typing import Optional

from app.services.data_ingestion.nse_fetcher import nse_fetcher
from app.services.data_ingestion.global_fetcher import global_fetcher
from app.services.data_ingestion.vix_fetcher import vix_fetcher
from app.services.analytics.pcr_calculator import pcr_calculator
from app.services.analytics.max_pain import max_pain_calculator
from app.services.analytics.support_resistance import sr_calculator

logger = logging.getLogger(__name__)


class ReportGenerator:
    """
    Assembles the complete daily report by orchestrating:
    1. Global market cues
    2. NSE index data
    3. Options chain analytics (PCR, Max Pain, S/R)
    4. FII/DII flows
    5. India VIX analysis
    6. Trading plan generation
    """

    def generate(self, report_date: date = None) -> dict:
        """
        Generate the full daily report.

        Returns:
            Complete report JSON matching PRD schema with sections:
            market_overview, index_analysis, options_chain,
            stocks, strategies, fii_dii, volatility, trading_plan
        """
        if report_date is None:
            report_date = date.today()

        logger.info(f"Generating daily report for {report_date}")
        start_time = datetime.now()
        
        # Check cache first for today's report
        from app.db.cache import cache
        cache_key = f"report_{report_date.isoformat()}"
        cached_report = cache.get(cache_key)
        if cached_report:
            logger.info("Serving report from local cache")
            return cached_report

        # 1. Fetch global cues
        global_cues = self._fetch_global_cues()

        # 2. Fetch NSE index data + options analytics
        index_analysis = self._analyze_indices()

        # 3. Options chain summary
        options_summary = self._analyze_options_chain()

        # 4. FII/DII flows
        fii_dii = self._fetch_fii_dii()

        # 5. VIX analysis
        volatility = self._analyze_volatility(index_analysis)

        # 6. Build opening bias
        opening_bias = self._determine_bias(
            global_cues, fii_dii, volatility
        )

        # 7. Trading plan
        trading_plan = self._build_trading_plan(
            index_analysis, options_summary, volatility
        )

        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"Report generated in {elapsed:.2f}s")

        report_data = {
            "report_date": report_date.isoformat(),
            "generated_at": datetime.now().isoformat(),
            "generation_time_seconds": round(elapsed, 2),
            "market_overview": {
                "global_markets": global_cues,
                "india_opening_bias": opening_bias,
                "macro_factors": self._extract_macro_factors(global_cues),
            },
            "index_analysis": index_analysis,
            "options_chain": options_summary,
            "stocks": [],  # Phase 2: stock picks engine
            "strategies": [],  # Phase 2: strategy suggestions
            "fii_dii": fii_dii,
            "volatility": volatility,
            "trading_plan": trading_plan,
        }
        
        # Save to cache with 5 minutes TTL
        from app.db.cache import cache
        cache_key = f"report_{report_date.isoformat()}"
        cache.set(cache_key, report_data, ttl=300)
        
        return report_data

    def _fetch_global_cues(self) -> dict:
        """Fetch all global market data."""
        try:
            return global_fetcher.get_all_global_cues()
        except Exception as e:
            logger.error(f"Global cues fetch failed: {e}")
            return {"status": "data not available", "error": str(e)}

    def _analyze_indices(self) -> dict:
        """Fetch and analyze major NSE indices."""
        result = {}
        index_map = {
            "NIFTY 50": "NIFTY",
            "NIFTY BANK": "BANKNIFTY",
            "NIFTY FIN SERVICE": "FINNIFTY",
        }

        for index_name, oc_symbol in index_map.items():
            try:
                # Get index quote
                quote = nse_fetcher.get_index_quote(index_name)

                # Get OI data for analytics
                oi_data = nse_fetcher.get_oi_data(oc_symbol)

                # Calculate S/R from OI
                sr = sr_calculator.calculate(oi_data) if oi_data else None

                # Calculate PCR
                pcr = pcr_calculator.calculate(oi_data) if oi_data else None

                # Calculate Max Pain
                mp = max_pain_calculator.calculate(oi_data) if oi_data else None

                # Determine trend
                trend = self._determine_trend(quote) if quote else "Unknown"

                # Determine intraday bias from OI
                bias = "Neutral"
                if sr and sr.get("oi_change_bias"):
                    bias = sr["oi_change_bias"]

                result[index_name] = {
                    "quote": quote or {"status": "data not available"},
                    "trend": trend,
                    "support": sr["support"] if sr else [],
                    "resistance": sr["resistance"] if sr else [],
                    "PCR": pcr["pcr_oi"] if pcr else None,
                    "max_pain": mp["max_pain"] if mp else None,
                    "OI_build_up": sr["oi_change_detail"] if sr else None,
                    "intraday_bias": bias,
                }
            except Exception as e:
                logger.error(f"Index analysis failed for {index_name}: {e}")
                result[index_name] = {"status": "data not available"}

        return result

    def _analyze_options_chain(self) -> dict:
        """Generate options chain summary for the report."""
        try:
            oi_data = nse_fetcher.get_oi_data("NIFTY")
            if not oi_data:
                return {"status": "data not available"}

            mp = max_pain_calculator.calculate(oi_data)
            pcr = pcr_calculator.calculate(oi_data)

            highest_ce = (
                mp["highest_ce_oi_strikes"][:3] if mp else []
            )
            highest_pe = (
                mp["highest_pe_oi_strikes"][:3] if mp else []
            )

            ce_zone = (
                f"Strikes ~{highest_ce[0]['strike']}–{highest_ce[-1]['strike']}"
                if len(highest_ce) >= 2
                else "data not available"
            )
            pe_zone = (
                f"Strikes ~{highest_pe[0]['strike']}–{highest_pe[-1]['strike']}"
                if len(highest_pe) >= 2
                else "data not available"
            )

            return {
                "highest_call_OI": f"{ce_zone} (resistance zone)",
                "highest_put_OI": f"{pe_zone} (support zone)",
                "max_pain": mp["max_pain"] if mp else None,
                "pcr": pcr["pcr_oi"] if pcr else None,
                "pcr_interpretation": (
                    pcr["interpretation"] if pcr else "data not available"
                ),
                "OI_change": (
                    pcr["bias"] if pcr else "data not available"
                ),
            }
        except Exception as e:
            logger.error(f"Options chain analysis failed: {e}")
            return {"status": "data not available"}

    def _fetch_fii_dii(self) -> dict:
        """Fetch FII/DII flow data."""
        try:
            data = nse_fetcher.get_fii_dii()
            if not data:
                return {"status": "data not available"}

            fii_net = data.get("fii", {}).get("net", 0)
            dii_net = data.get("dii", {}).get("net", 0)

            if fii_net < 0 and abs(fii_net) > abs(dii_net):
                analysis = (
                    f"FIIs sold ~₹{abs(fii_net):.0f}cr. "
                    f"DIIs bought ₹{dii_net:.0f}cr. "
                    "Net selling pressure."
                )
            elif fii_net > 0:
                analysis = (
                    f"FIIs bought ~₹{fii_net:.0f}cr. "
                    f"DIIs at ₹{dii_net:.0f}cr. "
                    "Positive FII flow — bullish signal."
                )
            else:
                analysis = (
                    f"FII net: ₹{fii_net:.0f}cr, "
                    f"DII net: ₹{dii_net:.0f}cr. "
                    "Mixed signals."
                )

            return {
                "net_FII": fii_net,
                "net_DII": dii_net,
                "fii_detail": data.get("fii", {}),
                "dii_detail": data.get("dii", {}),
                "analysis": analysis,
            }
        except Exception as e:
            logger.error(f"FII/DII fetch failed: {e}")
            return {"status": "data not available"}

    def _analyze_volatility(self, index_analysis: dict) -> dict:
        """Analyze India VIX and compute expected range."""
        try:
            vix_data = vix_fetcher.get_india_vix()
            if not vix_data:
                return {"status": "data not available"}

            # Get NIFTY price for range calculation
            nifty = index_analysis.get("NIFTY 50", {})
            nifty_quote = nifty.get("quote", {})
            nifty_price = nifty_quote.get("last", 0) if nifty_quote else 0

            expected_range = {}
            if nifty_price and vix_data.get("value"):
                expected_range = vix_fetcher.get_expected_nifty_range(
                    vix_data["value"], nifty_price
                )

            return {
                "India_VIX": vix_data.get("value"),
                "change": f"{vix_data.get('changePercent', 0):+.2f}%",
                "regime": vix_data.get("regime"),
                "interpretation": vix_data.get("interpretation"),
                "expected_range": expected_range.get("range_string", ""),
            }
        except Exception as e:
            logger.error(f"VIX analysis failed: {e}")
            return {"status": "data not available"}

    def _determine_bias(
        self, global_cues: dict, fii_dii: dict, volatility: dict
    ) -> str:
        """Determine opening market bias from all signals."""
        score = 0

        # Global cues
        us = global_cues.get("us_indices", {})
        for idx_data in us.values():
            if isinstance(idx_data, dict):
                chg = idx_data.get("changePercent", 0)
                if chg > 0.5:
                    score += 1
                elif chg < -0.5:
                    score -= 1

        # FII/DII
        fii_net = fii_dii.get("net_FII", 0)
        if isinstance(fii_net, (int, float)):
            if fii_net > 500:
                score += 1
            elif fii_net < -500:
                score -= 1

        # VIX
        vix_val = volatility.get("India_VIX", 0)
        if isinstance(vix_val, (int, float)):
            if vix_val > 22:
                score -= 1
            elif vix_val < 14:
                score += 1

        if score >= 2:
            return "Bullish"
        elif score <= -2:
            return "Bearish"
        else:
            return "Neutral"

    def _determine_trend(self, quote: dict) -> str:
        """Determine index trend from quote data."""
        if not quote:
            return "Unknown"
        change_pct = quote.get("changePercent", 0)
        try:
            change_pct = float(change_pct)
        except (TypeError, ValueError):
            return "Unknown"

        if change_pct > 1.0:
            return "Strong Uptrend"
        elif change_pct > 0.3:
            return "Uptrend"
        elif change_pct > -0.3:
            return "Range-bound"
        elif change_pct > -1.0:
            return "Downtrend"
        else:
            return "Strong Downtrend"

    def _extract_macro_factors(self, global_cues: dict) -> list:
        """Extract notable macro factors from global data."""
        factors = []

        # Oil prices
        commodities = global_cues.get("commodities", {})
        crude = commodities.get("Brent Crude", {})
        if isinstance(crude, dict) and crude.get("price"):
            factors.append(
                f"Brent Crude at ${crude['price']:.1f} "
                f"({crude.get('changePercent', 0):+.1f}%)"
            )

        # Forex
        forex = global_cues.get("forex", {})
        usd_inr = forex.get("USD/INR", {})
        if isinstance(usd_inr, dict) and usd_inr.get("price"):
            factors.append(f"USD/INR at ₹{usd_inr['price']:.2f}")

        return factors

    def _build_trading_plan(
        self, index_analysis: dict, options: dict, volatility: dict
    ) -> dict:
        """Build best/worst/no-trade scenarios."""
        nifty = index_analysis.get("NIFTY 50", {})
        support = nifty.get("support", [])
        resistance = nifty.get("resistance", [])
        nifty_quote = nifty.get("quote", {})
        last = nifty_quote.get("last", 0) if isinstance(nifty_quote, dict) else 0

        best_case = []
        worst_case = []
        no_trade = []

        if resistance:
            best_case.append(
                f"Nifty holds above {last:.0f} and rallies "
                f"to ~{resistance[0]} (resistance breakout)."
            )
        if support:
            worst_case.append(
                f"Nifty breaks below {support[0]} "
                f"falling to ~{support[-1] if len(support) > 1 else support[0] - 100}."
            )

        if support and resistance:
            no_trade.append(
                f"Nifty trades in {support[0]}–{resistance[0]} range — "
                "avoid new bets until breakout."
            )

        return {
            "best_case": best_case or ["Bullish continuation above current levels"],
            "worst_case": worst_case or ["Support breach leads to correction"],
            "no_trade_zone": no_trade or ["Narrow range — wait for direction"],
            "summary": (
                f"{nifty.get('trend', 'Range-bound')} bias; "
                "trade with defined risk."
            ),
        }


# Module-level singleton
report_generator = ReportGenerator()
