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

const FALLBACK_ANALYSIS = {
  verdict: "NEUTRAL",
  insights: ["Trend analysis is unavailable for the current dataset."],
  pcr_trend: "stable",
  oi_bias: "neutral",
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatNumber(value: number | null, digits = 2) {
  return isFiniteNumber(value) ? value.toFixed(digits) : "--";
}

function sanitizePoint(point: unknown): TrendPoint | null {
  if (!point || typeof point !== "object") return null;
  const candidate = point as Record<string, unknown>;
  if (typeof candidate.date !== "string" || !candidate.date) return null;

  return {
    date: candidate.date,
    pcr_oi: isFiniteNumber(candidate.pcr_oi) ? candidate.pcr_oi : null,
    total_ce_oi: isFiniteNumber(candidate.total_ce_oi) ? candidate.total_ce_oi : null,
    total_pe_oi: isFiniteNumber(candidate.total_pe_oi) ? candidate.total_pe_oi : null,
    net_oi: isFiniteNumber(candidate.net_oi) ? candidate.net_oi : null,
    atm_iv: isFiniteNumber(candidate.atm_iv) ? candidate.atm_iv : null,
    spot: isFiniteNumber(candidate.spot) ? candidate.spot : null,
    max_pain: isFiniteNumber(candidate.max_pain) ? candidate.max_pain : null,
  };
}

function sanitizeTrendData(payload: unknown): TrendData | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.symbol !== "string") return null;

  const points = Array.isArray(candidate.data)
    ? candidate.data.map(sanitizePoint).filter((point): point is TrendPoint => point !== null)
    : [];

  const sortedPoints = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const rawAnalysis = candidate.analysis && typeof candidate.analysis === "object"
    ? candidate.analysis as Record<string, unknown>
    : null;

  return {
    symbol: candidate.symbol,
    days: isFiniteNumber(candidate.days) ? candidate.days : sortedPoints.length,
    count: isFiniteNumber(candidate.count) ? candidate.count : sortedPoints.length,
    data: sortedPoints,
    analysis: rawAnalysis ? {
      verdict: typeof rawAnalysis.verdict === "string" ? rawAnalysis.verdict : FALLBACK_ANALYSIS.verdict,
      insights: Array.isArray(rawAnalysis.insights)
        ? rawAnalysis.insights.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : FALLBACK_ANALYSIS.insights,
      pcr_trend: typeof rawAnalysis.pcr_trend === "string" ? rawAnalysis.pcr_trend : FALLBACK_ANALYSIS.pcr_trend,
      oi_bias: typeof rawAnalysis.oi_bias === "string" ? rawAnalysis.oi_bias : FALLBACK_ANALYSIS.oi_bias,
    } : undefined,
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
          const payload = sanitizeTrendData(await res.json());
          if (!payload) throw new Error("Invalid trend data received from API");
          setData(payload);
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

  const points = [...data.data].sort((a, b) => a.date.localeCompare(b.date));
  const current = points[points.length - 1];
  const analysis = data.analysis ?? FALLBACK_ANALYSIS;

  return (
    <div className="flex flex-col h-full overflow-hidden text-gray-300 font-mono text-xs">
      {/* Header */}
      <div className="bg-[#0a0e1a] border-b border-white/10 p-3 shrink-0 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
            {data.symbol} <span className="text-[10px] bg-rose-500/10 text-rose-400 px-1 rounded">TREND</span>
          </h2>
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span>SPOT: <span className="text-white">{formatNumber(current.spot)}</span></span>
            {current.pcr_oi != null && <span>PCR: <span className={current.pcr_oi > 1 ? "text-emerald-400" : "text-red-400"}>{formatNumber(current.pcr_oi, 2)}</span></span>}
            {current.atm_iv != null && <span>ATM IV: <span className="text-white">{formatNumber(current.atm_iv, 2)}%</span></span>}
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
        {analysis && (
          <div className="w-full lg:w-72 shrink-0 bg-rose-500/5 rounded border border-rose-500/10 p-3 flex flex-col gap-3">
            <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex justify-between">
              <span>Trend Intelligence</span>
              <span className={
                analysis.verdict === "BULLISH" ? "text-emerald-400" :
                analysis.verdict === "BEARISH" ? "text-red-400" : "text-amber-400"
              }>{analysis.verdict}</span>
            </div>
            
            <div className="space-y-3 mt-2">
              {analysis.insights.map((insight, i) => (
                <div key={i} className="text-[11px] text-gray-400 leading-snug border-l-2 border-rose-500/20 pl-2 py-0.5">
                  {insight}
                </div>
              ))}
            </div>

            <div className="mt-auto space-y-2 border-t border-white/5 pt-3">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">PCR TREND</span>
                <span className={`capitalize ${
                  analysis.pcr_trend === 'rising' ? 'text-emerald-400' :
                  analysis.pcr_trend === 'falling' ? 'text-red-400' : 'text-amber-400'
                }`}>
                  {analysis.pcr_trend}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">OI BIAS</span>
                <span className="text-white capitalize">{analysis.oi_bias}</span>
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
  const validPoints = points.filter(p => p.pcr_oi != null);
  if (validPoints.length < 2) return <div className="text-gray-500 p-4">Insufficient PCR data</div>;

  const pcrValues = validPoints.map(p => p.pcr_oi as number);
  const maxVal = Math.max(...pcrValues, 1.5);
  const minVal = Math.min(...pcrValues, 0.5);
  const range = maxVal - minVal || 1;
  const chartH = 200;
  const chartW = Math.max(300, validPoints.length * 18);
  const stepX = chartW / Math.max(1, validPoints.length - 1);

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
        {validPoints.map((p, i) => {
          if (i % Math.max(1, Math.floor(validPoints.length / 10)) !== 0 && i !== validPoints.length - 1) return null;
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
  if (maxVal <= 0) return <div className="text-gray-500 p-4">Insufficient OI data</div>;

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
  const validPoints = points.filter(p => p.atm_iv != null && p.atm_iv > 0);
  if (validPoints.length < 2) return <div className="text-gray-500 p-4">Insufficient IV data</div>;

  const ivValues = validPoints.map(p => p.atm_iv as number);
  const maxVal = Math.max(...ivValues, 20);
  const minVal = Math.min(...ivValues, 10);
  const range = maxVal - minVal || 1;
  const chartH = 200;
  const chartW = Math.max(300, validPoints.length * 18);
  const stepX = chartW / Math.max(1, validPoints.length - 1);

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
        {validPoints.map((p, i) => {
          if (i % Math.max(1, Math.floor(validPoints.length / 10)) !== 0 && i !== validPoints.length - 1) return null;
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
