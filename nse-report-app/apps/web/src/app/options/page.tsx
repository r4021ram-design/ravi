"use client";

import { useState, useEffect, useRef, useLayoutEffect } from "react";
import Link from "next/link";
import { API_BASE } from "../../lib/config";

interface StrikeData {
  strikePrice: number;
  CE?: { oi: number; oiChange: number; volume: number; iv: number; ltp: number; change: number };
  PE?: { oi: number; oiChange: number; volume: number; iv: number; ltp: number; change: number };
}

interface OIData {
  symbol: string;
  underlying_value: number;
  expiry_dates: string[];
  strikes: StrikeData[];
  total_ce_oi: number;
  total_pe_oi: number;
  pcr: number | null;
  timestamp: string;
}

function formatOI(n: number): string {
  if (n >= 10000000) return (n / 10000000).toFixed(2) + " Cr";
  if (n >= 100000) return (n / 100000).toFixed(2) + " L";
  if (n >= 1000) return (n / 1000).toFixed(1) + " K";
  return n.toString();
}

export default function OptionsPage() {
  const [symbol, setSymbol] = useState("NIFTY");
  const [data, setData] = useState<OIData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strikesRange, setStrikesRange] = useState(15);

  const symbols = ["NIFTY", "BANKNIFTY", "FINNIFTY", "RELIANCE", "HDFCBANK", "INFY", "TCS", "ICICIBANK"];

  async function fetchChain() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/options/${symbol}`);
      if (!res.ok) throw new Error(`Symbol ${symbol} not found or options data unavailable.`);
      const optData = await res.json();
      
      setData({
        symbol: optData.symbol,
        underlying_value: optData.underlying_value,
        expiry_dates: optData.expiry_dates,
        strikes: optData.chain.strikes,
        total_ce_oi: optData.chain.total_ce_oi,
        total_pe_oi: optData.chain.total_pe_oi,
        pcr: optData.technicals.PCR,
        timestamp: optData.timestamp,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch options data. Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchChain(); }, [symbol]);

  // Filter strikes around ATM based on range
  const filteredStrikes = data ? data.strikes.filter(s => {
    const atm = data.underlying_value;
    const step = atm > 10000 ? 100 : atm > 2000 ? 50 : 20;
    return Math.abs(s.strikePrice - atm) <= (strikesRange * step);
  }).sort((a, b) => a.strikePrice - b.strikePrice) : [];

  const maxOI = Math.max(...filteredStrikes.map(s => Math.max(s.CE?.oi || 0, s.PE?.oi || 0)), 1);

  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const bars = containerRef.current.querySelectorAll<HTMLDivElement>('.oi-bar-ce, .oi-bar-pe');
    bars.forEach(bar => {
      const width = bar.getAttribute('data-width');
      if (width) bar.style.width = `${width}%`;
    });
  }, [filteredStrikes]);

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Terminal Workspace</Link>
        {data?.timestamp && (
          <span className="text-[10px] text-gray-600 font-mono">LTS: {new Date(data.timestamp).toLocaleTimeString()}</span>
        )}
      </div>

      <h1 className="text-2xl font-bold mb-1">
        <span className="gradient-text">Options Terminal</span>
      </h1>
      <p className="text-sm text-gray-500 mb-6">Real-time OI analysis for {symbol}</p>

      {/* Controls */}
      <div className="glass-card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap gap-2">
            {symbols.map(s => (
              <button key={s} onClick={() => setSymbol(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  symbol === s
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}>{s}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400 ml-auto md:ml-0">
            <label htmlFor="strike-range" className="sr-only">Strike Range</label>
            <span>Range:</span>
            <select 
              id="strike-range"
              title="Select number of strikes to display"
              value={strikesRange} 
              onChange={e => setStrikesRange(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs outline-none focus:border-blue-500/50">
              <option value={10}>±10 Strikes</option>
              <option value={15}>±15 Strikes</option>
              <option value={20}>±20 Strikes</option>
              <option value={50}>Full Chain</option>
            </select>
          </div>
          {data?.pcr != null && (
            <div className="ml-auto flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">PCR:</span>
              <span className={`font-bold font-mono text-sm ${
                data.pcr > 1.2 ? "text-emerald-400" : data.pcr < 0.8 ? "text-red-400" : "text-amber-400"
              }`}>{data.pcr.toFixed(3)}</span>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-xs text-gray-500 font-mono">FETCHING LIVE DATA...</span>
        </div>
      ) : error ? (
        <div className="glass-card p-12 text-center">
          <div className="text-red-400 mb-2">FAILED TO LOAD OPTIONS DATA</div>
          <div className="text-gray-500 text-sm mb-6">{error}</div>
          <button onClick={fetchChain} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded text-xs transition-colors">Retry Connection</button>
        </div>
      ) : (
        <>
          {/* OI Heatmap Table */}
          <div className="glass-card overflow-hidden mb-6 border-white/5" ref={containerRef}>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10">
                    <th colSpan={5} className="py-3 text-center text-emerald-400 bg-emerald-500/5 font-semibold tracking-wider">
                      CALL OPTIONS (CE)
                    </th>
                    <th className="py-3 px-4 text-center font-semibold text-gray-300 bg-white/5">Strike</th>
                    <th colSpan={5} className="py-3 text-center text-red-400 bg-red-500/5 font-semibold tracking-wider">
                      PUT OPTIONS (PE)
                    </th>
                  </tr>
                  <tr className="border-b border-white/10 text-[10px] text-gray-500 uppercase">
                    <th className="py-2 px-2 text-right">OI</th>
                    <th className="py-2 px-2 text-right">Chg</th>
                    <th className="py-2 px-2 text-right">Vol</th>
                    <th className="py-2 px-2 text-right">IV</th>
                    <th className="py-2 px-2 text-right">LTP</th>
                    <th className="py-2 px-4 text-center bg-white/5"></th>
                    <th className="py-2 px-2 text-left">LTP</th>
                    <th className="py-2 px-2 text-left">IV</th>
                    <th className="py-2 px-2 text-left">Vol</th>
                    <th className="py-2 px-2 text-left">Chg</th>
                    <th className="py-2 px-2 text-left">OI</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-[11px]">
                  {filteredStrikes.map((strike) => {
                    const underlying = data?.underlying_value || 0;
                    const isATM = Math.abs(strike.strikePrice - underlying) < (underlying > 10000 ? 50 : 25);
                    const isITMCE = strike.strikePrice < underlying;
                    const isITMPE = strike.strikePrice > underlying;
                    const ceOIWidth = ((strike.CE?.oi || 0) / maxOI) * 100;
                    const peOIWidth = ((strike.PE?.oi || 0) / maxOI) * 100;

                    return (
                      <tr key={strike.strikePrice}
                        className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                          isATM ? "bg-blue-500/10" : ""
                        }`}>
                        {/* CE side */}
                        <td className={`py-2 px-2 text-right relative ${isITMCE ? "bg-emerald-500/5" : ""}`}>
                          <div 
                            className="absolute inset-0 right-0 bg-emerald-500/10 pointer-events-none oi-bar-ce" 
                            data-width={ceOIWidth}
                          />
                          <span className="relative text-emerald-400/80">{formatOI(strike.CE?.oi || 0)}</span>
                        </td>
                        <td className={`py-2 px-2 text-right ${
                          (strike.CE?.oiChange || 0) > 0 ? "text-emerald-500" : "text-red-500"
                        }`}>{formatOI(strike.CE?.oiChange || 0)}</td>
                        <td className="py-2 px-2 text-right text-gray-500">{formatOI(strike.CE?.volume || 0)}</td>
                        <td className="py-2 px-2 text-right text-gray-400">{(strike.CE?.iv || 0).toFixed(1)}</td>
                        <td className="py-2 px-2 text-right font-medium text-white">{(strike.CE?.ltp || 0).toFixed(1)}</td>

                        {/* Strike */}
                        <td className={`py-2 px-4 text-center font-bold bg-white/5 border-x border-white/5 ${
                          isATM ? "text-amber-500 text-sm" : "text-gray-400"
                        }`}>
                          {strike.strikePrice}
                        </td>

                        {/* PE side */}
                        <td className={`py-2 px-2 text-left font-medium text-white ${isITMPE ? "bg-red-500/5" : ""}`}>
                          {(strike.PE?.ltp || 0).toFixed(1)}
                        </td>
                        <td className="py-2 px-2 text-left text-gray-400">{(strike.PE?.iv || 0).toFixed(1)}</td>
                        <td className="py-2 px-2 text-left text-gray-500">{formatOI(strike.PE?.volume || 0)}</td>
                        <td className={`py-2 px-2 text-left ${
                          (strike.PE?.oiChange || 0) > 0 ? "text-emerald-500" : "text-red-500"
                        }`}>{formatOI(strike.PE?.oiChange || 0)}</td>
                        <td className="py-2 px-2 text-left relative">
                          <div 
                            className="absolute inset-0 left-0 bg-red-500/10 pointer-events-none oi-bar-pe" 
                            data-width={peOIWidth}
                          />
                          <span className="relative text-red-400/80">{formatOI(strike.PE?.oi || 0)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend & Stats */}
          <div className="flex flex-wrap items-center gap-6 text-[10px] text-gray-500 px-2 uppercase tracking-tight">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-emerald-500/20 border border-emerald-500/40" /> ITM Calls</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded bg-red-500/20 border border-red-500/40" /> ITM Puts</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> ATM Strike</span>
            <div className="ml-auto flex gap-4 text-gray-600">
              <span>Total CE OI: <span className="text-emerald-400/60 font-mono">{data ? formatOI(data.total_ce_oi) : '0'}</span></span>
              <span>Total PE OI: <span className="text-red-400/60 font-mono">{data ? formatOI(data.total_pe_oi) : '0'}</span></span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

