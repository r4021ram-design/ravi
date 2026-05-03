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
        const json = await res.json();
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

  return (
    <div className="flex flex-col h-full overflow-hidden text-gray-300 font-mono text-xs">
      {/* Header Panel */}
      <div className="bg-[#0a0e1a] border-b border-white/10 p-3 shrink-0 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
            {data.symbol} <span className="text-[10px] bg-amber-500/10 px-1 rounded">OMON</span>
            <span className="text-[9px] text-gray-600 font-normal ml-2">LOT: {LOT_SIZES[data.symbol] || '?'} | VAL: ₹{((LOT_SIZES[data.symbol] || 0) * data.underlying_value).toLocaleString('en-IN')}</span>
          </h2>
          <div className="flex items-center gap-3 text-[10px]">
            <span>SPOT: <span className="text-white">{data.underlying_value}</span></span>
            <span>TREND: <span className={t.intraday_bias === 'Bullish' ? 'text-emerald-400' : t.intraday_bias === 'Bearish' ? 'text-red-400' : 'text-blue-400'}>{t.intraday_bias}</span></span>
            <span className="text-gray-600">TS: {new Date(data.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-right">
            <div>PCR: <span className={Number(t.PCR) > 1.0 ? "text-emerald-400" : "text-red-400"}>{t.PCR || 'N/A'}</span></div>
            <div>MAX PAIN: <span className="text-white">{t.max_pain || 'N/A'}</span></div>
            <div>SUP: <span className="text-emerald-400">{t.support?.[0] || 'N/A'}</span></div>
            <div>RES: <span className="text-red-400">{t.resistance?.[0] || 'N/A'}</span></div>
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
            {data.chain.strikes.map((s) => {
              const ce = s.CE;
              const pe = s.PE;
              const isAtm = Math.abs(s.strikePrice - data.underlying_value) < 25; // Closer ATM highlighting for indices

              // Skip empty rows
              if (!ce?.oi && !pe?.oi) return null;

              return (
                <tr key={s.strikePrice} className={`border-b border-white/5 hover:bg-white/10 transition-colors ${isAtm ? 'bg-blue-500/10' : ''}`}>
                  {/* Call Side */}
                  <td className="p-1.5 text-red-400/80 font-mono">{(ce?.oi || 0).toLocaleString()}</td>
                  <td className={`p-1.5 font-mono ${ce?.oiChange && ce.oiChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {ce?.oiChange ? (ce.oiChange > 0 ? '+' : '') + ce.oiChange.toLocaleString() : '-'}
                  </td>
                  <td className="p-1.5 text-gray-500 font-mono">{(ce?.volume || 0).toLocaleString()}</td>
                  <td className="p-1.5 text-gray-400 font-mono">{(ce?.iv || 0).toFixed(1)}</td>
                  {showGreeks && (
                    <>
                      <td className="p-1.5 text-amber-500/60 font-mono">{(ce?.greeks?.delta || 0).toFixed(3)}</td>
                      <td className="p-1.5 text-amber-500/60 font-mono">{(ce?.greeks?.gamma || 0).toFixed(4)}</td>
                      <td className="p-1.5 text-amber-500/60 font-mono">{(ce?.greeks?.theta || 0).toFixed(2)}</td>
                      <td className="p-1.5 text-amber-500/60 font-mono">{(ce?.greeks?.vega || 0).toFixed(2)}</td>
                      <td className="p-1.5 text-amber-500/60 font-mono">{(ce?.greeks?.rho || 0).toFixed(2)}</td>
                    </>
                  )}
                  <td className="p-1.5 font-bold text-white font-mono">{ce?.ltp || '-'}</td>
                  
                  {/* Strike */}
                  <td className={`p-1.5 text-center font-bold bg-white/5 ${isAtm ? 'text-amber-500' : 'text-gray-400'}`}>
                    {s.strikePrice}
                  </td>
                  
                  {/* Put Side */}
                  <td className="p-1.5 text-left font-bold text-white font-mono">{pe?.ltp || '-'}</td>
                  {showGreeks && (
                    <>
                      <td className="p-1.5 text-left text-amber-500/60 font-mono">{(pe?.greeks?.delta || 0).toFixed(3)}</td>
                      <td className="p-1.5 text-left text-amber-500/60 font-mono">{(pe?.greeks?.gamma || 0).toFixed(4)}</td>
                      <td className="p-1.5 text-left text-amber-500/60 font-mono">{(pe?.greeks?.theta || 0).toFixed(2)}</td>
                      <td className="p-1.5 text-left text-amber-500/60 font-mono">{(pe?.greeks?.vega || 0).toFixed(2)}</td>
                      <td className="p-1.5 text-left text-amber-500/60 font-mono">{(pe?.greeks?.rho || 0).toFixed(2)}</td>
                    </>
                  )}
                  <td className="p-1.5 text-left text-gray-400 font-mono">{(pe?.iv || 0).toFixed(1)}</td>
                  <td className="p-1.5 text-left text-gray-500 font-mono">{(pe?.volume || 0).toLocaleString()}</td>
                  <td className={`p-1.5 text-left font-mono ${pe?.oiChange && pe.oiChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pe?.oiChange ? (pe.oiChange > 0 ? '+' : '') + pe.oiChange.toLocaleString() : '-'}
                  </td>
                  <td className="p-1.5 text-left text-emerald-400/80 font-mono">{(pe?.oi || 0).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* IV Skew Panel */}
      {(() => {
        const strikes = data.chain.strikes.filter(s => s.CE?.iv && s.PE?.iv && s.CE.oi > 0 && s.PE.oi > 0);
        if (strikes.length < 3) return null;
        const maxIV = Math.max(...strikes.map(s => Math.max(s.CE?.iv || 0, s.PE?.iv || 0)));
        const minStrike = strikes[0]?.strikePrice || 0;
        const maxStrike = strikes[strikes.length - 1]?.strikePrice || 1;
        const range = maxStrike - minStrike || 1;
        return (
          <div className="bg-[#0a0e1a] border-t border-white/10 p-2 px-4 shrink-0">
            <div className="text-[9px] text-gray-600 mb-1">IV SKEW (CE ─ PE ---)</div>
            <svg width="100%" height="40" viewBox={`0 0 ${strikes.length} 40`} preserveAspectRatio="none" className="overflow-visible">
              {/* CE IV line */}
              <polyline
                points={strikes.map((s, i) => `${i},${40 - ((s.CE?.iv || 0) / maxIV) * 36}`).join(' ')}
                fill="none" stroke="#10b981" strokeWidth="0.5" opacity="0.8"
              />
              {/* PE IV line */}
              <polyline
                points={strikes.map((s, i) => `${i},${40 - ((s.PE?.iv || 0) / maxIV) * 36}`).join(' ')}
                fill="none" stroke="#ef4444" strokeWidth="0.5" opacity="0.8" strokeDasharray="1,1"
              />
              {/* ATM marker */}
              {(() => {
                const atmIdx = strikes.findIndex(s => Math.abs(s.strikePrice - data.underlying_value) < (data.underlying_value > 10000 ? 50 : 25));
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
          <div>CE OI: <span className="text-red-400/80">{data.chain.total_ce_oi.toLocaleString()}</span></div>
          <div>PE OI: <span className="text-emerald-400/80">{data.chain.total_pe_oi.toLocaleString()}</span></div>
          <div>LOT: <span className="text-white">{LOT_SIZES[data.symbol] || '?'}</span></div>
        </div>
        <div className="text-gray-700">TERMINAL MODE - NSE REALTIME CLONE</div>
      </div>
    </div>
  );
}
