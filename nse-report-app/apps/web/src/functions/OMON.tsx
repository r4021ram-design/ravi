"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "../lib/config";

interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

interface StrikeData {
  strikePrice: number;
  CE?: { 
    oi: number; 
    oiChange: number; 
    volume: number; 
    iv: number; 
    ltp: number; 
    change: number; 
    greeks?: Greeks;
  };
  PE?: { 
    oi: number; 
    oiChange: number; 
    volume: number; 
    iv: number; 
    ltp: number; 
    change: number; 
    greeks?: Greeks;
  };
}

interface OptionsData {
  symbol: string;
  underlying_value: number;
  timestamp: string;
  expiry_dates: string[];
  technicals: {
    PCR: number | null;
    pcr_bias: string | null;
    max_pain: number | null;
    support: number[];
    resistance: number[];
    OI_build_up: string | null;
    intraday_bias: string | null;
  };
  chain: {
    total_ce_oi: number;
    total_pe_oi: number;
    strikes: StrikeData[];
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatNumber(value: number | null | undefined, digits = 0) {
  return isFiniteNumber(value)
    ? value.toLocaleString("en-IN", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : "N/A";
}

function formatDecimal(value: number | null | undefined, digits = 2) {
  return isFiniteNumber(value) ? value.toFixed(digits) : "--";
}

function inferStrikeStep(strikes: number[]) {
  const diffs = strikes
    .slice(1)
    .map((strike, index) => strike - strikes[index])
    .filter((diff) => diff > 0);
  return diffs.length ? Math.min(...diffs) : 50;
}

function sanitizeGreeks(payload: unknown): Greeks | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const candidate = payload as Record<string, unknown>;
  return {
    delta: isFiniteNumber(candidate.delta) ? candidate.delta : 0,
    gamma: isFiniteNumber(candidate.gamma) ? candidate.gamma : 0,
    theta: isFiniteNumber(candidate.theta) ? candidate.theta : 0,
    vega: isFiniteNumber(candidate.vega) ? candidate.vega : 0,
    rho: isFiniteNumber(candidate.rho) ? candidate.rho : 0,
  };
}

function sanitizeLeg(payload: unknown): StrikeData["CE"] | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const candidate = payload as Record<string, unknown>;
  return {
    oi: isFiniteNumber(candidate.oi) ? candidate.oi : 0,
    oiChange: isFiniteNumber(candidate.oiChange) ? candidate.oiChange : 0,
    volume: isFiniteNumber(candidate.volume) ? candidate.volume : 0,
    iv: isFiniteNumber(candidate.iv) ? candidate.iv : 0,
    ltp: isFiniteNumber(candidate.ltp) ? candidate.ltp : 0,
    change: isFiniteNumber(candidate.change) ? candidate.change : 0,
    greeks: sanitizeGreeks(candidate.greeks),
  };
}

function sanitizeOptionsData(payload: unknown): OptionsData | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.symbol !== "string") return null;

  const technicals = candidate.technicals && typeof candidate.technicals === "object"
    ? candidate.technicals as Record<string, unknown>
    : {};
  const chain = candidate.chain && typeof candidate.chain === "object"
    ? candidate.chain as Record<string, unknown>
    : {};

  const strikes: StrikeData[] = Array.isArray(chain.strikes)
    ? chain.strikes.map((strike): StrikeData | null => {
        if (!strike || typeof strike !== "object") return null;
        const item = strike as Record<string, unknown>;
        if (!isFiniteNumber(item.strikePrice)) return null;
        return {
          strikePrice: item.strikePrice,
          CE: sanitizeLeg(item.CE),
          PE: sanitizeLeg(item.PE),
        };
      }).filter((strike) => strike !== null).sort((a, b) => a.strikePrice - b.strikePrice)
    : [];

  return {
    symbol: candidate.symbol,
    underlying_value: isFiniteNumber(candidate.underlying_value) ? candidate.underlying_value : 0,
    timestamp: typeof candidate.timestamp === "string" ? candidate.timestamp : "",
    expiry_dates: Array.isArray(candidate.expiry_dates)
      ? candidate.expiry_dates.filter((item): item is string => typeof item === "string")
      : [],
    technicals: {
      PCR: isFiniteNumber(technicals.PCR) ? technicals.PCR : null,
      pcr_bias: typeof technicals.pcr_bias === "string" ? technicals.pcr_bias : null,
      max_pain: isFiniteNumber(technicals.max_pain) ? technicals.max_pain : null,
      support: Array.isArray(technicals.support) ? technicals.support.filter((item): item is number => isFiniteNumber(item)) : [],
      resistance: Array.isArray(technicals.resistance) ? technicals.resistance.filter((item): item is number => isFiniteNumber(item)) : [],
      OI_build_up: typeof technicals.OI_build_up === "string" ? technicals.OI_build_up : null,
      intraday_bias: typeof technicals.intraday_bias === "string" ? technicals.intraday_bias : null,
    },
    chain: {
      total_ce_oi: isFiniteNumber(chain.total_ce_oi) ? chain.total_ce_oi : 0,
      total_pe_oi: isFiniteNumber(chain.total_pe_oi) ? chain.total_pe_oi : 0,
      strikes,
    },
  };
}

const LOT_SIZES: Record<string, number> = {
  NIFTY: 25, BANKNIFTY: 15, FINNIFTY: 25, MIDCPNIFTY: 50,
  RELIANCE: 250, HDFCBANK: 550, INFY: 300, TCS: 175,
  ICICIBANK: 700, SBIN: 750, TATAMOTORS: 575, ITC: 1600,
  BAJFINANCE: 125, LT: 375, AXISBANK: 625,
};

export function OMON({ symbol }: { symbol: string }) {
  const [data, setData] = useState<OptionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGreeks, setShowGreeks] = useState(true);
  const [selectedExpiry, setSelectedExpiry] = useState<string>("");

  useEffect(() => {
    let ignore = false;
    async function fetchOptionsData() {
      try {
        setLoading(true);
        const expiryParam = selectedExpiry ? `?expiry=${encodeURIComponent(selectedExpiry)}` : '';
        const res = await fetch(`${API_BASE}/api/options/${symbol}${expiryParam}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json = sanitizeOptionsData(await res.json());
        if (!json) throw new Error("Invalid options data received from API");
        if (!ignore) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "Failed to fetch options data");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchOptionsData();
    return () => { ignore = true; };
  }, [symbol, selectedExpiry]);

  if (loading) return <div className="p-4 text-amber-500 font-mono text-sm animate-pulse">LOADING OMON FOR {symbol}...</div>;
  if (error) return <div className="p-4 text-red-500 font-mono text-sm">ERROR: {error}</div>;
  if (!data) return null;

  const t = data.technicals;
  const sortedStrikes = data.chain.strikes;
  const strikeStep = inferStrikeStep(sortedStrikes.map((strike) => strike.strikePrice));
  const timestampLabel = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : "--";
  const lotSize = LOT_SIZES[data.symbol] ?? 0;
  const lotValue = lotSize > 0 ? lotSize * data.underlying_value : null;

  return (
    <div className="flex flex-col h-full overflow-hidden text-gray-300 font-mono text-xs">
      {/* Header Panel */}
      <div className="bg-[#0a0e1a] border-b border-white/10 p-3 shrink-0 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
            {data.symbol} <span className="text-[10px] bg-amber-500/10 px-1 rounded">OMON</span>
            <span className="text-[9px] text-gray-600 font-normal ml-2">LOT: {lotSize || '?'} | VAL: {lotValue != null ? `INR ${formatNumber(lotValue)}` : 'N/A'}</span>
          </h2>
          <div className="flex items-center gap-3 text-[10px]">
            <span>SPOT: <span className="text-white">{formatNumber(data.underlying_value, 2)}</span></span>
            <span>TREND: <span className={t.intraday_bias === 'Bullish' ? 'text-emerald-400' : t.intraday_bias === 'Bearish' ? 'text-red-400' : 'text-blue-400'}>{t.intraday_bias}</span></span>
            <span className="text-gray-600">TS: {timestampLabel}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-right">
            <div>PCR: <span className={(t.PCR ?? 1) > 1.0 ? "text-emerald-400" : "text-red-400"}>{t.PCR != null ? formatDecimal(t.PCR, 3) : 'N/A'}</span></div>
            <div>MAX PAIN: <span className="text-white">{t.max_pain != null ? formatNumber(t.max_pain) : 'N/A'}</span></div>
            <div>SUP: <span className="text-emerald-400">{t.support[0] != null ? formatNumber(t.support[0]) : 'N/A'}</span></div>
            <div>RES: <span className="text-red-400">{t.resistance[0] != null ? formatNumber(t.resistance[0]) : 'N/A'}</span></div>
          </div>
          <button 
            onClick={() => setShowGreeks(!showGreeks)}
            className={`px-2 py-1 rounded border text-[10px] transition-colors ${showGreeks ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : 'border-white/10 text-gray-500 hover:bg-white/5'}`}
          >
            GREEKS: {showGreeks ? 'ON' : 'OFF'}
          </button>
          {/* Expiry Selector */}
          {data.expiry_dates && data.expiry_dates.length > 0 && (
            <select
              title="Select expiry date"
              value={selectedExpiry}
              onChange={e => setSelectedExpiry(e.target.value)}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] text-gray-400 outline-none focus:border-blue-500/50"
            >
              <option value="">ALL EXPIRIES</option>
              {data.expiry_dates.map((e: string) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Option Chain Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-right border-collapse">
          <thead className="sticky top-0 bg-[#050810] border-b border-white/20 text-[10px] text-gray-500 z-10 shadow-lg">
            <tr>
              {/* Call Side */}
              <th className="p-1.5 font-normal">OI</th>
              <th className="p-1.5 font-normal">CHG</th>
              <th className="p-1.5 font-normal">VOL</th>
              <th className="p-1.5 font-normal">IV</th>
              {showGreeks && (
                <>
                  <th className="p-1.5 font-normal text-amber-500/70">Δ</th>
                  <th className="p-1.5 font-normal text-amber-500/70">Γ</th>
                  <th className="p-1.5 font-normal text-amber-500/70">Θ</th>
                  <th className="p-1.5 font-normal text-amber-500/70">ν</th>
                  <th className="p-1.5 font-normal text-amber-500/70">ρ</th>
                </>
              )}
              <th className="p-1.5 font-normal">LTP</th>
              {/* Strike */}
              <th className="p-1.5 font-bold text-center bg-white/5 w-20">STRIKE</th>
              {/* Put Side */}
              <th className="p-1.5 font-normal text-left">LTP</th>
              {showGreeks && (
                <>
                  <th className="p-1.5 font-normal text-left text-amber-500/70">Δ</th>
                  <th className="p-1.5 font-normal text-left text-amber-500/70">Γ</th>
                  <th className="p-1.5 font-normal text-left text-amber-500/70">Θ</th>
                  <th className="p-1.5 font-normal text-left text-amber-500/70">ν</th>
                  <th className="p-1.5 font-normal text-left text-amber-500/70">ρ</th>
                </>
              )}
              <th className="p-1.5 font-normal text-left">IV</th>
              <th className="p-1.5 font-normal text-left">VOL</th>
              <th className="p-1.5 font-normal text-left">CHG</th>
              <th className="p-1.5 font-normal text-left">OI</th>
            </tr>
          </thead>
          <tbody className="text-[10px]">
            {sortedStrikes.map((s) => {
              const ce = s.CE;
              const pe = s.PE;
              const isAtm = Math.abs(s.strikePrice - data.underlying_value) < strikeStep / 2;

              // Skip empty rows
              if (!ce?.oi && !pe?.oi) return null;

              return (
                <tr key={s.strikePrice} className={`border-b border-white/5 hover:bg-white/10 transition-colors ${isAtm ? 'bg-blue-500/10' : ''}`}>
                  {/* Call Side */}
                  <td className="p-1.5 text-red-400/80 font-mono">{formatNumber(ce?.oi)}</td>
                  <td className={`p-1.5 font-mono ${ce?.oiChange && ce.oiChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {ce?.oiChange ? `${ce.oiChange > 0 ? '+' : ''}${formatNumber(ce.oiChange)}` : '-'}
                  </td>
                  <td className="p-1.5 text-gray-500 font-mono">{formatNumber(ce?.volume)}</td>
                  <td className="p-1.5 text-gray-400 font-mono">{formatDecimal(ce?.iv, 1)}</td>
                  {showGreeks && (
                    <>
                      <td className="p-1.5 text-amber-500/60 font-mono">{ce?.greeks ? formatDecimal(ce.greeks.delta, 3) : "--"}</td>
                      <td className="p-1.5 text-amber-500/60 font-mono">{ce?.greeks ? formatDecimal(ce.greeks.gamma, 4) : "--"}</td>
                      <td className="p-1.5 text-amber-500/60 font-mono">{ce?.greeks ? formatDecimal(ce.greeks.theta, 2) : "--"}</td>
                      <td className="p-1.5 text-amber-500/60 font-mono">{ce?.greeks ? formatDecimal(ce.greeks.vega, 2) : "--"}</td>
                      <td className="p-1.5 text-amber-500/60 font-mono">{ce?.greeks ? formatDecimal(ce.greeks.rho, 2) : "--"}</td>
                    </>
                  )}
                  <td className="p-1.5 font-bold text-white font-mono">{ce?.ltp ? formatNumber(ce.ltp, 2) : '-'}</td>
                  
                  {/* Strike */}
                  <td className={`p-1.5 text-center font-bold bg-white/5 ${isAtm ? 'text-amber-500' : 'text-gray-400'}`}>
                    {s.strikePrice}
                  </td>
                  
                  {/* Put Side */}
                  <td className="p-1.5 text-left font-bold text-white font-mono">{pe?.ltp ? formatNumber(pe.ltp, 2) : '-'}</td>
                  {showGreeks && (
                    <>
                      <td className="p-1.5 text-left text-amber-500/60 font-mono">{pe?.greeks ? formatDecimal(pe.greeks.delta, 3) : "--"}</td>
                      <td className="p-1.5 text-left text-amber-500/60 font-mono">{pe?.greeks ? formatDecimal(pe.greeks.gamma, 4) : "--"}</td>
                      <td className="p-1.5 text-left text-amber-500/60 font-mono">{pe?.greeks ? formatDecimal(pe.greeks.theta, 2) : "--"}</td>
                      <td className="p-1.5 text-left text-amber-500/60 font-mono">{pe?.greeks ? formatDecimal(pe.greeks.vega, 2) : "--"}</td>
                      <td className="p-1.5 text-left text-amber-500/60 font-mono">{pe?.greeks ? formatDecimal(pe.greeks.rho, 2) : "--"}</td>
                    </>
                  )}
                  <td className="p-1.5 text-left text-gray-400 font-mono">{formatDecimal(pe?.iv, 1)}</td>
                  <td className="p-1.5 text-left text-gray-500 font-mono">{formatNumber(pe?.volume)}</td>
                  <td className={`p-1.5 text-left font-mono ${pe?.oiChange && pe.oiChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pe?.oiChange ? `${pe.oiChange > 0 ? '+' : ''}${formatNumber(pe.oiChange)}` : '-'}
                  </td>
                  <td className="p-1.5 text-left text-emerald-400/80 font-mono">{formatNumber(pe?.oi)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* IV Skew Panel */}
      {(() => {
        const strikes = sortedStrikes.filter(s => s.CE?.iv && s.PE?.iv && s.CE.oi > 0 && s.PE.oi > 0);
        if (strikes.length < 3) return null;
        const validIvs = strikes.flatMap(s => [s.CE?.iv || 0, s.PE?.iv || 0]).filter(iv => iv > 0);
        const maxIV = Math.max(...validIvs);
        const minIV = Math.min(...validIvs);
        const ivRange = maxIV - minIV || 1;
        return (
          <div className="bg-[#0a0e1a] border-t border-white/10 p-2 px-4 shrink-0">
            <div className="text-[9px] text-gray-600 mb-1">IV SKEW (CE ─ PE ---)</div>
            <svg width="100%" height="40" viewBox={`0 0 ${strikes.length} 40`} preserveAspectRatio="none" className="overflow-visible">
              {/* CE IV line */}
              <polyline
                points={strikes.map((s, i) => `${i},${40 - (((s.CE?.iv || minIV) - minIV) / ivRange) * 36}`).join(' ')}
                fill="none" stroke="#10b981" strokeWidth="0.5" opacity="0.8"
              />
              {/* PE IV line */}
              <polyline
                points={strikes.map((s, i) => `${i},${40 - (((s.PE?.iv || minIV) - minIV) / ivRange) * 36}`).join(' ')}
                fill="none" stroke="#ef4444" strokeWidth="0.5" opacity="0.8" strokeDasharray="1,1"
              />
              {/* ATM marker */}
              {(() => {
                const atmIdx = strikes.findIndex(s => Math.abs(s.strikePrice - data.underlying_value) < strikeStep / 2);
                if (atmIdx >= 0) return <line x1={atmIdx} y1={0} x2={atmIdx} y2={40} stroke="#f59e0b" strokeWidth="0.3" strokeDasharray="1,1" />;
                return null;
              })()}
            </svg>
          </div>
        );
      })()}

      {/* Footer Totals */}
      <div className="bg-[#0a0e1a] border-t border-white/10 p-2 text-[10px] flex justify-between px-4 text-gray-500 shrink-0">
        <div className="flex gap-4">
          <div>CE OI: <span className="text-red-400/80">{formatNumber(data.chain.total_ce_oi)}</span></div>
          <div>PE OI: <span className="text-emerald-400/80">{formatNumber(data.chain.total_pe_oi)}</span></div>
          <div>LOT: <span className="text-white">{LOT_SIZES[data.symbol] || '?'}</span></div>
        </div>
        <div className="text-gray-700">TERMINAL MODE - NSE REALTIME CLONE</div>
      </div>
    </div>
  );
}
