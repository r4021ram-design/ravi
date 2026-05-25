"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "../lib/config";

type TimeRange = "1M" | "3M" | "6M" | "1Y";
type Indicator = "SMA" | "RSI" | "MACD";

interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma_20?: number | null;
  sma_50?: number | null;
  sma_200?: number | null;
  rsi?: number | null;
  macd_line?: number | null;
  macd_signal?: number | null;
  macd_hist?: number | null;
  atr?: number | null;
}

interface TechData {
  symbol: string;
  count: number;
  ohlcv: OHLCVBar[];
  current: {
    close: number;
    sma_20: number | null;
    sma_50: number | null;
    sma_200: number | null;
    rsi: number | null;
    atr: number | null;
    macd_line: number | null;
    macd_signal: number | null;
    trend: string;
    pivots: { pp: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number };
  };
}

const RANGE_DAYS: Record<TimeRange, number> = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365 };

export function CHART({ symbol }: { symbol: string }) {
  const [data, setData] = useState<TechData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>("3M");
  const [indicators, setIndicators] = useState<Set<Indicator>>(new Set(["SMA"]));

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/chart/${symbol}/technicals?days=${RANGE_DAYS[range]}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        if (!ignore) {
          setData(await res.json());
          setError(null);
        }
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "Failed to fetch chart data");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchData();
    return () => { ignore = true; };
  }, [symbol, range]);

  function toggleIndicator(ind: Indicator) {
    setIndicators(prev => {
      const next = new Set(prev);
      if (next.has(ind)) next.delete(ind);
      else next.add(ind);
      return next;
    });
  }

  if (loading) return <div className="p-4 text-amber-500 font-mono text-sm animate-pulse">LOADING CHART FOR {symbol}...</div>;
  if (error) return <div className="p-4 text-red-500 font-mono text-sm">ERROR: {error}</div>;
  if (!data || !data.ohlcv.length) return <div className="p-4 text-gray-500 font-mono text-sm">NO CHART DATA AVAILABLE</div>;

  const { ohlcv, current } = data;
  const showRSI = indicators.has("RSI");
  const showMACD = indicators.has("MACD");
  const showSMA = indicators.has("SMA");

  return (
    <div className="flex flex-col h-full overflow-hidden text-gray-300 font-mono text-sm md:text-base">
      {/* Header */}
      <div className="bg-[#0a0e1a] border-b border-white/10 p-3 shrink-0 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-amber-500 flex items-center gap-3">
            {symbol} <span className="text-base md:text-lg bg-blue-500/20 text-blue-400 px-3 py-0.5 rounded font-bold">CHART</span>
          </h2>
          <div className="flex flex-wrap items-center gap-6 text-sm md:text-base font-bold">
            <span>CLOSE: <span className="text-white text-lg md:text-xl">{current.close}</span></span>
            <span>TREND: <span className={
              current.trend === "Bullish" ? "text-emerald-400" :
              current.trend === "Bearish" ? "text-red-400" : "text-amber-400"
            }>{current.trend}</span></span>
            {current.rsi != null && <span>RSI: <span className={
              current.rsi > 70 ? "text-red-400" : current.rsi < 30 ? "text-emerald-400" : "text-white"
            }>{current.rsi.toFixed(1)}</span></span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 justify-end">
          {/* Time Range */}
          <div className="flex gap-1.5 bg-white/5 p-1.5 rounded-lg">
            {(["1M", "3M", "6M", "1Y"] as TimeRange[]).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-4 py-2 rounded-md text-sm md:text-base font-bold transition-all ${
                  range === r ? "bg-blue-600 text-white shadow-xl shadow-blue-600/30" : "text-gray-500 hover:text-gray-300"
                }`}>{r}</button>
            ))}
          </div>
          <div className="hidden md:block w-px h-8 bg-white/10" />
          {/* Indicators */}
          <div className="flex gap-2.5">
            {(["SMA", "RSI", "MACD"] as Indicator[]).map(ind => (
              <button key={ind} onClick={() => toggleIndicator(ind)}
                className={`px-4 py-2 rounded-md border-2 text-sm md:text-base font-black transition-all ${
                  indicators.has(ind) ? "bg-amber-500/20 border-amber-500 text-amber-400 shadow-xl shadow-amber-500/20" : "border-white/10 text-gray-600 hover:text-gray-400"
                }`}>{ind}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 overflow-auto custom-scrollbar p-3 flex flex-col gap-2">
        <PriceChart ohlcv={ohlcv} showSMA={showSMA} />
        {showRSI && <RSIChart ohlcv={ohlcv} />}
        {showMACD && <MACDChart ohlcv={ohlcv} />}
      </div>

      {/* Pivot Points Footer */}
      {current.pivots && (
        <div className="bg-[#0a0e1a] border-t border-white/10 p-4 text-sm md:text-base flex flex-wrap justify-between px-6 text-gray-400 shrink-0 gap-y-3">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <span className="text-red-500 font-black">R3: {current.pivots.r3}</span>
            <span className="text-red-400 font-bold">R2: {current.pivots.r2}</span>
            <span className="text-red-400/70 font-bold">R1: {current.pivots.r1}</span>
            <span className="text-amber-500 font-black scale-110 px-2 bg-amber-500/10 rounded">PP: {current.pivots.pp}</span>
            <span className="text-emerald-400/70 font-bold">S1: {current.pivots.s1}</span>
            <span className="text-emerald-400 font-bold">S2: {current.pivots.s2}</span>
            <span className="text-emerald-500 font-black">S3: {current.pivots.s3}</span>
          </div>
          <div className="flex gap-3">
            {current.sma_20 != null && <span>SMA20: <span className="text-blue-400">{current.sma_20}</span></span>}
            {current.sma_50 != null && <span>SMA50: <span className="text-purple-400">{current.sma_50}</span></span>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Price Chart (Candlestick + SMA overlays) ── */
function PriceChart({ ohlcv, showSMA }: { ohlcv: OHLCVBar[]; showSMA: boolean }) {
  const chartH = 220;
  const barW = Math.max(3, Math.min(8, 900 / ohlcv.length));
  const chartW = ohlcv.length * barW;
  const allPrices = ohlcv.flatMap(b => [b.high, b.low]);
  const maxP = Math.max(...allPrices);
  const minP = Math.min(...allPrices);
  const priceRange = maxP - minP || 1;
  const pad = 10;

  function yPos(price: number): number {
    return pad + (1 - (price - minP) / priceRange) * (chartH - 2 * pad);
  }

  // SMA lines
  const sma20Points = ohlcv
    .map((b, i) => b.sma_20 != null ? `${i * barW + barW / 2},${yPos(b.sma_20)}` : null)
    .filter(Boolean).join(' ');
  const sma50Points = ohlcv
    .map((b, i) => b.sma_50 != null ? `${i * barW + barW / 2},${yPos(b.sma_50)}` : null)
    .filter(Boolean).join(' ');

  return (
    <div className="bg-white/2 rounded border border-white/5 p-3 overflow-x-auto custom-scrollbar">
      <div className="text-[12px] md:text-[14px] text-gray-500 mb-2 font-bold uppercase tracking-wider">PRICE (OHLC)</div>
      <svg width={chartW} height={chartH} className="overflow-visible">
        {/* Horizontal grid */}
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map(pct => {
          const price = minP + priceRange * (1 - pct);
          const y = pad + pct * (chartH - 2 * pad);
          return (
            <g key={pct}>
              <line x1={0} y1={y} x2={chartW} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
              <text x={2} y={y - 4} fontSize="11" fontWeight="bold" fill="#718096">{price.toFixed(0)}</text>
            </g>
          );
        })}

        {/* Candlesticks */}
        {ohlcv.map((bar, i) => {
          const x = i * barW;
          const isGreen = bar.close >= bar.open;
          const color = isGreen ? "#10b981" : "#ef4444";
          const bodyTop = yPos(Math.max(bar.open, bar.close));
          const bodyBot = yPos(Math.min(bar.open, bar.close));
          const bodyH = Math.max(1, bodyBot - bodyTop);
          return (
            <g key={i}>
              {/* Wick */}
              <line x1={x + barW / 2} y1={yPos(bar.high)} x2={x + barW / 2} y2={yPos(bar.low)}
                stroke={color} strokeWidth="0.5" />
              {/* Body */}
              <rect x={x + 0.5} y={bodyTop} width={Math.max(1, barW - 1)} height={bodyH}
                fill={color} rx="0.5" />
            </g>
          );
        })}

        {/* SMA overlays */}
        {showSMA && sma20Points && (
          <polyline points={sma20Points} fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.7" />
        )}
        {showSMA && sma50Points && (
          <polyline points={sma50Points} fill="none" stroke="#8b5cf6" strokeWidth="1" opacity="0.7" />
        )}

        {/* X-axis date labels */}
        {ohlcv.map((bar, i) => {
          const step = Math.max(1, Math.floor(ohlcv.length / 8));
          if (i % step !== 0) return null;
          const label = bar.date.substring(5, 10); // MM-DD
          return (
            <text key={i} x={i * barW + barW / 2} y={chartH + 15} textAnchor="middle" fontSize="10" fill="#718096" fontWeight="bold">
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

/* ── RSI Chart ── */
function RSIChart({ ohlcv }: { ohlcv: OHLCVBar[] }) {
  const chartH = 70;
  const barW = Math.max(3, Math.min(8, 900 / ohlcv.length));
  const chartW = ohlcv.length * barW;

  const points = ohlcv
    .map((b, i) => b.rsi != null ? `${i * barW + barW / 2},${chartH - (b.rsi / 100) * (chartH - 10)}` : null)
    .filter(Boolean).join(' ');

  return (
    <div className="bg-white/2 rounded border border-white/5 p-3 overflow-x-auto custom-scrollbar">
      <div className="text-[12px] md:text-[14px] text-gray-500 mb-2 font-bold uppercase tracking-wider">RSI (14)</div>
      <svg width={chartW} height={chartH} className="overflow-visible">
        {/* Overbought / Oversold lines */}
        <line x1={0} y1={chartH - 70 / 100 * (chartH - 10)} x2={chartW} y2={chartH - 70 / 100 * (chartH - 10)}
          stroke="rgba(239,68,68,0.3)" strokeWidth="0.5" strokeDasharray="3,3" />
        <line x1={0} y1={chartH - 30 / 100 * (chartH - 10)} x2={chartW} y2={chartH - 30 / 100 * (chartH - 10)}
          stroke="rgba(16,185,129,0.3)" strokeWidth="0.5" strokeDasharray="3,3" />
        <line x1={0} y1={chartH - 50 / 100 * (chartH - 10)} x2={chartW} y2={chartH - 50 / 100 * (chartH - 10)}
          stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />

        {/* Labels */}
        <text x={2} y={chartH - 70 / 100 * (chartH - 10) - 4} fontSize="10" fontWeight="bold" fill="#ef4444">70</text>
        <text x={2} y={chartH - 30 / 100 * (chartH - 10) - 4} fontSize="10" fontWeight="bold" fill="#10b981">30</text>

        {/* RSI line */}
        {points && <polyline points={points} fill="none" stroke="#f59e0b" strokeWidth="1" />}
      </svg>
    </div>
  );
}

/* ── MACD Chart ── */
function MACDChart({ ohlcv }: { ohlcv: OHLCVBar[] }) {
  const chartH = 70;
  const barW = Math.max(3, Math.min(8, 900 / ohlcv.length));
  const chartW = ohlcv.length * barW;

  const macdValues = ohlcv.flatMap(b => [b.macd_hist, b.macd_line, b.macd_signal]).filter((v): v is number => v != null);
  const maxMacd = Math.max(...macdValues.map(Math.abs), 0.01);

  const macdPoints = ohlcv
    .map((b, i) => b.macd_line != null ? `${i * barW + barW / 2},${chartH / 2 - (b.macd_line / maxMacd) * (chartH / 2 - 5)}` : null)
    .filter(Boolean).join(' ');

  const signalPoints = ohlcv
    .map((b, i) => b.macd_signal != null ? `${i * barW + barW / 2},${chartH / 2 - (b.macd_signal / maxMacd) * (chartH / 2 - 5)}` : null)
    .filter(Boolean).join(' ');

  return (
    <div className="bg-white/2 rounded border border-white/5 p-3 overflow-x-auto custom-scrollbar">
      <div className="text-[12px] md:text-[14px] text-gray-500 mb-2 font-bold uppercase tracking-wider">MACD (12, 26, 9)</div>
      <svg width={chartW} height={chartH} className="overflow-visible">
        {/* Zero line */}
        <line x1={0} y1={chartH / 2} x2={chartW} y2={chartH / 2}
          stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

        {/* Histogram bars */}
        {ohlcv.map((bar, i) => {
          const val = bar.macd_hist ?? 0;
          if (val === 0) return null;
          const h = Math.abs(val / maxMacd) * (chartH / 2 - 5);
          const y = val > 0 ? chartH / 2 - h : chartH / 2;
          return (
            <rect key={i} x={i * barW + 0.5} y={y} width={Math.max(1, barW - 1)} height={h}
              fill={val > 0 ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"} />
          );
        })}

        {/* MACD line */}
        {macdPoints && <polyline points={macdPoints} fill="none" stroke="#3b82f6" strokeWidth="1" />}
        {/* Signal line */}
        {signalPoints && <polyline points={signalPoints} fill="none" stroke="#ef4444" strokeWidth="0.7" strokeDasharray="2,2" />}
      </svg>
    </div>
  );
}
