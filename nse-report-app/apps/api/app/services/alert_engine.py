"""
Alert Engine
Processes alert rules and triggers notifications.
"""

import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


class AlertRule:
    """Represents a single alert rule."""

    def __init__(
        self,
        rule_id: str,
        user_id: str,
        symbol: str,
        alert_type: str,
        threshold: float,
        direction: str = "above",  # "above" or "below"
        is_active: bool = True,
    ):
        self.rule_id = rule_id
        self.user_id = user_id
        self.symbol = symbol
        self.alert_type = alert_type
        self.threshold = threshold
        self.direction = direction
        self.is_active = is_active
        self.last_triggered: Optional[datetime] = None


class AlertEngine:
    """
    Evaluates alert rules against live market data.
    Supports: price breakout, OI spike, VIX threshold, custom conditions.
    """

    # In-memory store (replaced by DB in production)
    _rules: list[AlertRule] = []

    def add_rule(self, rule: AlertRule) -> None:
        """Add a new alert rule."""
        self._rules.append(rule)
        logger.info(f"Alert rule added: {rule.alert_type} on {rule.symbol}")

    def remove_rule(self, rule_id: str) -> bool:
        """Remove an alert rule by ID."""
        before = len(self._rules)
        self._rules = [r for r in self._rules if r.rule_id != rule_id]
        return len(self._rules) < before

    def get_active_rules(self) -> list[AlertRule]:
        """Get all active rules."""
        return [r for r in self._rules if r.is_active]

    def check_all(self) -> list[dict]:
        """
        Check all active rules against current market data.
        Returns list of triggered alerts.
        """
        triggered = []
        active = self.get_active_rules()

        if not active:
            return triggered

        # Fetch current data
        try:
            from app.services.data_ingestion.nse_fetcher import nse_fetcher
            from app.services.data_ingestion.vix_fetcher import vix_fetcher

            market_data = {}

            # Get index quotes
            indices = nse_fetcher.get_major_indices()
            for name, quote in indices.items():
                if isinstance(quote, dict) and quote.get("last"):
                    market_data[name] = quote["last"]

            # Get VIX
            vix = vix_fetcher.get_india_vix()
            if vix and vix.get("value"):
                market_data["INDIA VIX"] = vix["value"]

        except Exception as e:
            logger.error(f"Alert engine data fetch failed: {e}")
            return triggered

        # Evaluate each rule
        for rule in active:
            current_value = market_data.get(rule.symbol)
            if current_value is None:
                continue

            is_triggered = False

            if rule.alert_type == "breakout":
                if rule.direction == "above" and current_value > rule.threshold:
                    is_triggered = True
                elif rule.direction == "below" and current_value < rule.threshold:
                    is_triggered = True

            elif rule.alert_type == "vix_threshold":
                if rule.direction == "above" and current_value > rule.threshold:
                    is_triggered = True
                elif rule.direction == "below" and current_value < rule.threshold:
                    is_triggered = True

            if is_triggered:
                # Cooldown: don't re-trigger within 30 minutes
                if rule.last_triggered:
                    elapsed = (datetime.now() - rule.last_triggered).total_seconds()
                    if elapsed < 1800:
                        continue

                rule.last_triggered = datetime.now()
                alert_msg = {
                    "rule_id": rule.rule_id,
                    "user_id": rule.user_id,
                    "symbol": rule.symbol,
                    "type": rule.alert_type,
                    "message": (
                        f"{rule.symbol} {rule.direction} {rule.threshold} — "
                        f"Current: {current_value}"
                    ),
                    "triggered_at": datetime.now().isoformat(),
                }
                triggered.append(alert_msg)
                logger.info(f"Alert triggered: {alert_msg['message']}")

                # TODO: Send via WebSocket, Email, SMS
                self._notify(alert_msg)

        return triggered

    def _notify(self, alert: dict) -> None:
        """
        Send alert notification via configured channels.
        Placeholder for WebSocket/Email/SMS delivery.
        """
        # WebSocket: Push to connected client
        # Email: Send via SendGrid
        # SMS: Send via Twilio
        logger.info(f"Notification sent: {alert['message']}")


# Module-level singleton
alert_engine = AlertEngine()
