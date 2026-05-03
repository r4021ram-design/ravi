import math
from typing import Dict, Optional

class GreeksCalculator:
    """
    Calculates Option Greeks using the Black-Scholes-Merton model.
    """
    
    @staticmethod
    def _norm_cdf(x: float) -> float:
        """Cumulative distribution function for standard normal distribution."""
        return (1.0 + math.erf(x / math.sqrt(2.0))) / 2.0
        
    @staticmethod
    def _norm_pdf(x: float) -> float:
        """Probability density function for standard normal distribution."""
        return math.exp(-x * x / 2.0) / math.sqrt(2.0 * math.pi)

    @classmethod
    def calculate_greeks(
        cls, 
        spot: float, 
        strike: float, 
        time_to_expiry_years: float, 
        implied_volatility: float, 
        risk_free_rate: float = 0.10,
        dividend_yield: float = 0.0
    ) -> Dict[str, Dict[str, float]]:
        """
        Calculate Greeks for both Call and Put options.
        
        Args:
            spot: Underlying asset price
            strike: Option strike price
            time_to_expiry_years: Time to expiration in years (e.g., days/365)
            implied_volatility: Implied volatility as a decimal (e.g., 0.20 for 20%)
            risk_free_rate: Risk free interest rate as a decimal (default 10% for NSE standard)
            dividend_yield: Continuous dividend yield (default 0)
            
        Returns:
            Dict containing 'CE' and 'PE' with their respective greeks.
            If T <= 0 or IV <= 0, returns 0.0 for all greeks.
        """
        if time_to_expiry_years <= 0 or implied_volatility <= 0 or spot <= 0 or strike <= 0:
            zero_greeks = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "rho": 0.0}
            return {"CE": zero_greeks.copy(), "PE": zero_greeks.copy()}
            
        S = spot
        K = strike
        T = time_to_expiry_years
        r = risk_free_rate
        q = dividend_yield
        v = implied_volatility
        
        # Calculate d1 and d2
        d1 = (math.log(S / K) + (r - q + (v * v) / 2.0) * T) / (v * math.sqrt(T))
        d2 = d1 - v * math.sqrt(T)
        
        # Normal CDF and PDF
        nd1 = cls._norm_cdf(d1)
        nd2 = cls._norm_cdf(d2)
        n_d1 = cls._norm_cdf(-d1)
        n_d2 = cls._norm_cdf(-d2)
        pdf_d1 = cls._norm_pdf(d1)
        
        # Calculate Greeks
        # 1. Delta
        call_delta = math.exp(-q * T) * nd1
        put_delta = math.exp(-q * T) * (nd1 - 1.0)
        
        # 2. Gamma (same for call and put)
        gamma = (math.exp(-q * T) * pdf_d1) / (S * v * math.sqrt(T))
        
        # 3. Theta (per day, dividing by 365)
        theta_common = -(S * v * math.exp(-q * T) * pdf_d1) / (2.0 * math.sqrt(T))
        call_theta = (theta_common - r * K * math.exp(-r * T) * nd2 + q * S * math.exp(-q * T) * nd1) / 365.0
        put_theta = (theta_common + r * K * math.exp(-r * T) * n_d2 - q * S * math.exp(-q * T) * n_d1) / 365.0
        
        # 4. Vega (per 1% change in volatility, dividing by 100)
        vega = (S * math.exp(-q * T) * math.sqrt(T) * pdf_d1) / 100.0
        
        # 5. Rho (per 1% change in interest rate, dividing by 100)
        call_rho = (K * T * math.exp(-r * T) * nd2) / 100.0
        put_rho = (-K * T * math.exp(-r * T) * n_d2) / 100.0
        
        return {
            "CE": {
                "delta": round(call_delta, 4),
                "gamma": round(gamma, 4),
                "theta": round(call_theta, 4),
                "vega": round(vega, 4),
                "rho": round(call_rho, 4)
            },
            "PE": {
                "delta": round(put_delta, 4),
                "gamma": round(gamma, 4),
                "theta": round(put_theta, 4),
                "vega": round(vega, 4),
                "rho": round(put_rho, 4)
            }
        }

greeks_calculator = GreeksCalculator()
