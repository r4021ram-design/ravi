"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "../lib/config";

type MetricMode = "PCR" | "OI" | "IV";

interface TrendPoint {
  date: string;
  pcr_oi: number | null;
  total_ce_oi: number | null;
  total_pe_oi: number | null;
  net_oi: number | null;
  atm_iv: number | null;
  spot: number | null;
  max_pain: number | null;
}

interface TrendData {
  symbol: string;
  days: number;
  count: number;
  data: TrendPoint[];
  analysis?: {
    verdict: string;
    insights: string[];
    pcr_trend: string;
    oi_bias: string;
  };
}

export function TREND({ symbol }: { symbol: string }) {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<MetricMode>("PCR");
  const [days, setDays] = useState(30);

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/history/${symbol}/trends?days=${days}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        if (!ignore) {
          setData(await res.json());
          setError(null);
        }
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "Failed to fetch trend data");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchData();
    return () => { ignore = true; };
  }, [symbol, days]);

  if (loading) return <div className="p-4 text-amber-500 font-mono text-sm animate-pulse">LOADING TREND DATA FOR {symbol}...</div>;
  if (error) return <div className="p-4 text-red-500 font-mono text-sm">ERROR: {error}</div>;
  if (!data || !data.data.length) return <div className="p-4 text-gray-500 font-mono text-sm">NO TREND DATA</div>;

  const points = data.data;
  const current = points[points.length - 1];

  return (
    <div className="flex flex-col h-full overflow-hidden text-gray-300 font-mono text-xs">
      {/* Header */}
      <div className="bg-[#0a0e1a] border-b border-white/10 p-3 shrink-0 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
            {data.symbol} <span className="text-[10px] bg-rose-500/10 text-rose-400 px-1 rounded">TREND</span>
          </h2>
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span>SPOT: <span className="text-white">{current.spot}</span></span>
            {current.pcr_oi && <span>PCR: <span className={current.pcr_oi > 1 ? "text-emerald-400" : "text-red-400"}>{current.pcr_oi}</span></span>}
            {current.atm_iv && <span>ATM IV: <span className="text-white">{current.atm_iv}%</span></span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 mr-2">
            {[10, 30, 60].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`px-2 py-1 rounded text-[10px] transition-colors ${
                  days === d ? "bg-white/10 text-white" : "text-gray-500 hover:bg-white/5"
                }`}>{d}D</button>
            ))}
          </div>
          {(["PCR", "OI", "IV"] as MetricMode[]).map(m => (
            <button key={m} onClick={() => setMetric(m)}
              className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                metric === m
                  ? "bg-rose-500/10 border-rose-500/50 text-rose-400"
                  : "border-white/10 text-gray-500 hover:bg-white/5"
              }`}>{m}</button>
          ))}
        </div>
      </div>

      {/* Chart & Analysis Area */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-3 p-4">
        <div className="flex-1 overflow-auto custom-scrollbar bg-white/2 rounded border border-white/5 p-4">
          {metric === "PCR" && <PCRChart points={points} />}
          {metric === "OI" && <OIChart points={points} />}
          {metric === "IV" && <IVChart points={points} />}
        </div>

        {/* Trend Analysis Panel */}
        {data.analysis && (
          <div className="w-full lg:w-72 shrink-0 bg-rose-500/5 rounded border border-rose-500/10 p-3 flex flex-col gap-3">
            <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex justify-between">
              <span>Trend Intelligence</span>
              <span className={
                data.analysis.verdict === "BULLISH" ? "text-emerald-400" :
                data.analysis.verdict === "BEARISH" ? "text-red-400" : "text-amber-400"
              }>{data.analysis.verdict}</span>
            </div>
            
            <div className="space-y-3 mt-2">
              {data.analysis.insights.map((insight, i) => (
                <div key={i} className="text-[11px] text-gray-400 leading-snug border-l-2 border-rose-500/20 pl-2 py-0.5">
                  {insight}
                </div>
              ))}
            </div>

            <div className="mt-auto space-y-2 border-t border-white/5 pt-3">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">PCR TREND</span>
                <span className={`capitalize ${data.analysis.pcr_trend === 'rising' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {data.analysis.pcr_trend}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">OI BIAS</span>
                <span className="text-white capitalize">{data.analysis.oi_bias}</span>
              </div>
              <div className="text-[9px] text-gray-600 mt-2 italic text-center">
                * Based on recent 5-session snapshot
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-[#0a0e1a] border-t border-white/10 p-2 text-[10px] flex justify-between px-4 text-gray-500 shrink-0">
        <div>DATA POINTS: {points.length}</div>
        <div className="text-gray-700">HISTORICAL MARKET TRENDS (EOD SNAPSHOTS)</div>
      </div>
    </div>
  );
}

/* ── PCR Chart ── */
function PCRChart({ points }: { points: TrendPoint[] }) {
  const pcrValues = points.map(p => p.pcr_oi || 1);
  const maxVal = Math.max(...pcrValues, 1.5);
  const minVal = Math.min(...pcrValues, 0.5);
  const range = maxVal - minVal || 1;
  const chartH = 200;
  const chartW = Math.max(300, points.length * 15);
  const stepX = chartW / Math.max(1, points.length - 1);

  const polyPoints = pcrValues
    .map((v, i) => `${i * stepX},${chartH - ((v - minVal) / range) * (chartH - 20) - 10}`)
    .join(' ');

  return (
    <div className="w-full overflow-x-auto custom-scrollbar">
      <div className="text-[10px] text-gray-600 mb-2">PUT-CALL RATIO (PCR) — Green &gt; 1.0 (Bullish), Red &lt; 1.0 (Bearish)</div>
      <svg width={chartW} height={chartH + 30} className="overflow-visible">
        {/* Grid and 1.0 line */}
        <line x1={0} y1={chartH - ((1.0 - minVal) / range) * (chartH - 20) - 10} x2={chartW} y2={chartH - ((1.0 - minVal) / range) * (chartH - 20) - 10}
          stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4,4" />
        
        {/* Fill gradients could go here, but using pure line for simplicity */}
        <polyline points={polyPoints} fill="none" stroke="#f43f5e" strokeWidth="2" />
        
        {/* Points */}
        {pcrValues.map((v, i) => (
          <circle key={i} cx={i * stepX} cy={chartH - ((v - minVal) / range) * (chartH - 20) - 10}
            r="3" fill={v >= 1 ? "#10b981" : "#ef4444"} />
        ))}

        {/* Labels */}
        {points.map((p, i) => {
          if (i % Math.max(1, Math.floor(points.length / 10)) !== 0 && i !== points.length - 1) return null;
          return (
            <text key={i} x={i * stepX} y={chartH + 15} textAnchor="middle" fontSize="9" fill="#64748b">
              {p.date.substring(5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/* ── OI Chart (Total CE vs PE) ── */
function OIChart({ points }: { points: TrendPoint[] }) {
  const maxVal = Math.max(
    ...points.map(p => Math.max(p.total_ce_oi || 0, p.total_pe_oi || 0))
  );
  const chartH = 200;
  const chartW = Math.max(300, points.length * 20);
  const stepX = chartW / Math.max(1, points.length);

  return (
    <div className="w-full overflow-x-auto custom-scrollbar">
      <div className="text-[10px] text-gray-600 mb-2">TOTAL OPEN INTEREST — Calls (Red) vs Puts (Green)</div>
      <svg width={chartW} height={chartH + 30} className="overflow-visible">
        {points.map((p, i) => {
          const ceH = ((p.total_ce_oi || 0) / maxVal) * (chartH - 20);
          const peH = ((p.total_pe_oi || 0) / maxVal) * (chartH - 20);
          const x = i * stepX + 5;
          const barW = Math.max(4, stepX * 0.3);

          return (
            <g key={i}>
              <rect x={x} y={chartH - ceH} width={barW} height={ceH} fill="rgba(239,68,68,0.8)" />
              <rect x={x + barW + 1} y={chartH - peH} width={barW} height={peH} fill="rgba(16,185,129,0.8)" />
              {/* Labels */}
              {(i % Math.max(1, Math.floor(points.length / 10)) === 0 || i === points.length - 1) && (
                <text x={x + barW} y={chartH + 15} textAnchor="middle" fontSize="9" fill="#64748b">
                  {p.date.substring(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── IV Chart ── */
function IVChart({ points }: { points: TrendPoint[] }) {
  const ivValues = points.map(p => p.atm_iv || 15);
  const maxVal = Math.max(...ivValues, 20);
  const minVal = Math.min(...ivValues, 10);
  const range = maxVal - minVal || 1;
  const chartH = 200;
  const chartW = Math.max(300, points.length * 15);
  const stepX = chartW / Math.max(1, points.length - 1);

  const polyPoints = ivValues
    .map((v, i) => `${i * stepX},${chartH - ((v - minVal) / range) * (chartH - 20) - 10}`)
    .join(' ');

  return (
    <div className="w-full overflow-x-auto custom-scrollbar">
      <div className="text-[10px] text-gray-600 mb-2">ATM IMPLIED VOLATILITY (IV)</div>
      <svg width={chartW} height={chartH + 30} className="overflow-visible">
        <polyline points={polyPoints} fill="none" stroke="#a855f7" strokeWidth="2" />
        {ivValues.map((v, i) => (
          <circle key={i} cx={i * stepX} cy={chartH - ((v - minVal) / range) * (chartH - 20) - 10}
            r="3" fill="#a855f7" />
        ))}
        {points.map((p, i) => {
          if (i % Math.max(1, Math.floor(points.length / 10)) !== 0 && i !== points.length - 1) return null;
          return (
            <text key={i} x={i * stepX} y={chartH + 15} textAnchor="middle" fontSize="9" fill="#64748b">
              {p.date.substring(5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
