"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "../lib/config";

type ViewMode = "CE" | "PE" | "NET";

interface HeatmapPoint {
  expiry: string;
  strike: number;
  ce_oi: number;
  pe_oi: number;
  net_oi: number;
}

interface HeatmapData {
  symbol: string;
  underlying: number;
  expiries: string[];
  strikes: number[];
  data: HeatmapPoint[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function inferStrikeStep(strikes: number[]) {
  const diffs = strikes
    .slice(1)
    .map((strike, index) => strike - strikes[index])
    .filter((diff) => diff > 0);
  return diffs.length ? Math.min(...diffs) : 50;
}

function sanitizeHeatmapData(payload: unknown): HeatmapData | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.symbol !== "string") return null;

  const strikes = Array.isArray(candidate.strikes)
    ? candidate.strikes.filter((item): item is number => isFiniteNumber(item)).sort((a, b) => a - b)
    : [];
  const expiries = Array.isArray(candidate.expiries)
    ? candidate.expiries.filter((item): item is string => typeof item === "string")
    : [];
  const heatmapPoints = Array.isArray(candidate.data)
    ? candidate.data.map((point) => {
        if (!point || typeof point !== "object") return null;
        const item = point as Record<string, unknown>;
        if (typeof item.expiry !== "string" || !isFiniteNumber(item.strike)) return null;
        return {
          expiry: item.expiry,
          strike: item.strike,
          ce_oi: isFiniteNumber(item.ce_oi) ? item.ce_oi : 0,
          pe_oi: isFiniteNumber(item.pe_oi) ? item.pe_oi : 0,
          net_oi: isFiniteNumber(item.net_oi) ? item.net_oi : 0,
        };
      }).filter((point): point is HeatmapPoint => point !== null)
    : [];

  return {
    symbol: candidate.symbol,
    underlying: isFiniteNumber(candidate.underlying) ? candidate.underlying : 0,
    expiries,
    strikes,
    data: heatmapPoints,
  };
}

export function OIHEAT({ symbol }: { symbol: string }) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("CE");

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/options/${symbol}/oi-heatmap`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        if (!ignore) {
          const payload = sanitizeHeatmapData(await res.json());
          if (!payload) throw new Error("Invalid OI heatmap data received from API");
          setData(payload);
          setError(null);
        }
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "Failed to fetch OI heatmap");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchData();
    return () => { ignore = true; };
  }, [symbol]);

  if (loading) return <div className="p-4 text-amber-500 font-mono text-sm animate-pulse">LOADING OI HEATMAP FOR {symbol}...</div>;
  if (error) return <div className="p-4 text-red-500 font-mono text-sm">ERROR: {error}</div>;
  if (!data) return <div className="p-4 text-gray-500 font-mono text-sm">NO HEATMAP DATA</div>;

  // Compute max OI for color scaling
  const allValues = data.data.map(d => {
    if (view === "CE") return d.ce_oi;
    if (view === "PE") return d.pe_oi;
    return Math.abs(d.net_oi);
  });
  const maxVal = Math.max(...allValues, 1);

  function oiColor(value: number, mode: ViewMode): string {
    if (value === 0) return "rgba(255,255,255,0.02)";
    const t = Math.min(1, Math.abs(value) / maxVal);
    if (mode === "NET") {
      // Net: positive (PE > CE) = green, negative = red
      if (value > 0) return `rgba(16, 185, 129, ${0.1 + t * 0.6})`;
      return `rgba(239, 68, 68, ${0.1 + t * 0.6})`;
    }
    if (mode === "CE") {
      return `rgba(239, 68, 68, ${0.05 + t * 0.55})`;
    }
    return `rgba(16, 185, 129, ${0.05 + t * 0.55})`;
  }

  function formatOI(val: number): string {
    if (Math.abs(val) >= 10000000) return (val / 10000000).toFixed(1) + "Cr";
    if (Math.abs(val) >= 100000) return (val / 100000).toFixed(1) + "L";
    if (Math.abs(val) >= 1000) return (val / 1000).toFixed(0) + "K";
    return val.toString();
  }

  // Filter strikes near ATM for better view
  const step = inferStrikeStep(data.strikes);
  const nearStrikes = data.strikes.filter(s => Math.abs(s - data.underlying) <= step * 12);
  const heatmapIndex = new Map(data.data.map((point) => [`${point.expiry}_${point.strike}`, point]));


  return (
    <div className="flex flex-col h-full overflow-hidden text-gray-300 font-mono text-xs">
      {/* Header */}
      <div className="bg-[#0a0e1a] border-b border-white/10 p-3 shrink-0 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
            {data.symbol} <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-1 rounded">OIHEAT</span>
          </h2>
          <div className="text-[10px] text-gray-500">
            SPOT: <span className="text-white">{data.underlying.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="ml-3">EXPIRIES: {data.expiries.length}</span>
            <span className="ml-3">STRIKES: {nearStrikes.length}</span>
          </div>
        </div>
        <div className="flex gap-1">
          {(["CE", "PE", "NET"] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setView(m)}
              className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                view === m
                  ? m === "CE" ? "bg-red-500/10 border-red-500/50 text-red-400"
                  : m === "PE" ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400"
                  : "bg-blue-500/10 border-blue-500/50 text-blue-400"
                  : "border-white/10 text-gray-500 hover:bg-white/5"
              }`}>{m === "NET" ? "NET (PE-CE)" : `${m} OI`}</button>
          ))}
        </div>
      </div>

      {/* Heatmap Table */}
      <div className="flex-1 overflow-auto custom-scrollbar p-2">
        <table className="text-[10px] border-collapse w-full">
          <thead className="sticky top-0 bg-[#050810] z-10">
            <tr>
              <th className="p-1.5 text-right text-gray-500 sticky left-0 bg-[#050810] z-20 border-b border-white/10">Strike</th>
              {data.expiries.map(e => (
                <th key={e} className="p-1.5 text-center text-gray-500 border-b border-white/10 min-w-[70px]">
                  {e.replace(/-20\d\d$/, '')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nearStrikes.map(strike => {
              const isAtm = Math.abs(strike - data.underlying) < step / 2;
              return (
                <tr key={strike} className={isAtm ? "bg-blue-500/5" : ""}>
                  <td className={`p-1 text-right sticky left-0 bg-[#050810] z-10 border-r border-white/5 ${
                    isAtm ? 'text-amber-500 font-bold' : 'text-gray-400'
                  }`}>
                    {strike}
                  </td>
                  {data.expiries.map(exp => {
                    const point = heatmapIndex.get(`${exp}_${strike}`);
                    const val = point ? (view === "CE" ? point.ce_oi : view === "PE" ? point.pe_oi : point.net_oi) : 0;
                    return (
                      <td key={exp} className="p-0.5">
                        <div
                          className="w-full rounded-sm text-center font-mono py-0.5"
                          style={{ backgroundColor: oiColor(val, view) }}
                          title={`Strike: ${strike} | Expiry: ${exp} | ${view}: ${val.toLocaleString()}`}
                        >
                          {val !== 0 ? formatOI(val) : ''}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="bg-[#0a0e1a] border-t border-white/10 p-2 text-[10px] flex justify-between px-4 text-gray-500 shrink-0">
        <div className="flex gap-4">
          <div>VIEW: <span className={
            view === "CE" ? "text-red-400" : view === "PE" ? "text-emerald-400" : "text-blue-400"
          }>{view === "NET" ? "NET OI (PE - CE)" : `${view} OPEN INTEREST`}</span></div>
        </div>
        <div className="text-gray-700">MULTI-EXPIRY OI HEATMAP</div>
      </div>
    </div>
  );
}
