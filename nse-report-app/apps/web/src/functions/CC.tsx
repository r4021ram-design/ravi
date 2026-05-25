"use client";

import { useState, useEffect } from "react";
import { ReportData } from "../lib/types";
import { API_BASE } from "../lib/config";

function formatNum(n: number | undefined | null, decimals = 2): string {
  if (n == null) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function ChangeIndicator({ change, pct }: { change?: number; pct?: number }) {
  if (change == null || pct == null) return <span className="text-gray-500">—</span>;
  const isUp = change >= 0;
  return (
    <span className={isUp ? "text-emerald-400" : "text-red-400"}>
      {isUp ? "▲" : "▼"} {formatNum(Math.abs(change))} ({pct >= 0 ? "+" : ""}{formatNum(pct)}%)
    </span>
  );
}

function BiasChip({ bias }: { bias?: string | null }) {
  const colors: Record<string, string> = {
    Bullish: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    Bearish: "bg-red-500/20 text-red-400 border-red-500/30",
    Neutral: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };
  const label = bias || "Neutral";
  return (
    <span className={`px-2 py-1 rounded text-[11px] md:text-xs font-bold uppercase border tracking-wider ${colors[label] || colors.Neutral}`}>
      {label}
    </span>
  );
}

export function CC() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function fetchReport() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/report/latest`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        if (!ignore) {
          setReport(data);
          setError(null);
        }
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "Failed to fetch report");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchReport();
    return () => { ignore = true; };
  }, []);

  if (loading) return <div className="p-4 text-amber-500 font-mono text-sm animate-pulse">LOADING COMMAND CENTER...</div>;
  if (error) return <div className="p-4 text-red-500 font-mono text-sm">ERROR: {error}</div>;
  if (!report) return null;

  const mo = report.market_overview;
  const gm = mo.global_markets;
  const globalQuotes = [
    ...Object.values(gm?.us_indices ?? {}),
    ...Object.values(gm?.commodities ?? {}),
    ...Object.values(gm?.forex ?? {}),
  ];
  const indexAnalysis = Object.fromEntries(
    Object.entries(report.index_analysis ?? {}).map(([name, data]) => [
      name,
      {
        quote: data.quote,
        trend: data.trend || "Unknown",
        support: data.support ?? [],
        resistance: data.resistance ?? [],
        PCR: data.PCR ?? null,
        max_pain: data.max_pain ?? null,
        OI_build_up: data.OI_build_up ?? null,
        intraday_bias: data.intraday_bias || "Neutral",
      },
    ])
  );

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-[#050810] text-gray-300 font-mono text-sm md:text-base">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-white/10 pb-2 mb-4">
        <div>
          <h1 className="text-2xl md:text-3xl text-amber-500 font-black tracking-tight uppercase">CC - Command Center</h1>
          <div className="text-gray-500 mt-1 text-xs md:text-sm">REPORT DATE: {report.report_date} | GENERATED IN {report.generation_time_seconds}s</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-gray-500">INDIA OPENING BIAS</div>
            <BiasChip bias={mo.india_opening_bias} />
          </div>
        </div>
      </div>

      {/* Global Cues */}
      <div className="mb-4">
        <div className="text-gray-500 mb-2 border-b border-white/5 pb-1">GLOBAL CUES</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {globalQuotes.length === 0 && (
            <div className="text-gray-600 col-span-full">GLOBAL DATA UNAVAILABLE</div>
          )}
          {globalQuotes.map((q) => (
            <div key={q.symbol} className="bg-white/5 p-2 rounded flex flex-col">
              <span className="text-gray-400 truncate">{q.symbol}</span>
              {q.status === "data not available" ? (
                <span className="text-gray-600">—</span>
              ) : (
                <>
                  <span className="text-sm font-bold">{formatNum(q.price, q.symbol.includes("/") ? 2 : 0)}</span>
                  <span className={`${(q.changePercent || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {(q.changePercent || 0) >= 0 ? "+" : ""}{formatNum(q.changePercent)}%
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Indices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {Object.entries(indexAnalysis).map(([name, data]) => (
          <div key={name} className="border border-white/10 bg-white/5 p-5 rounded">
            <div className="flex justify-between items-start mb-4">
              <div className="text-lg md:text-2xl text-amber-500 font-black uppercase">{name}</div>
              <BiasChip bias={data.intraday_bias} />
            </div>
            {data.quote?.last ? (
              <div className="mb-4">
                <div className="text-4xl md:text-5xl font-black text-white">{formatNum(data.quote.last, 0)}</div>
                <div className="text-base md:text-lg mt-1">
                  <ChangeIndicator change={data.quote.change as number} pct={data.quote.changePercent as number} />
                </div>
              </div>
            ) : (
              <div className="text-gray-600 mb-4">DATA UNAVAILABLE</div>
            )}
            
          <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-6 pb-6 border-b border-white/10 text-sm md:text-lg">
            <div className="flex justify-between"><span className="text-gray-500">SUPPORT</span><span className="text-emerald-400 font-bold">{data.support.map(formatNum).join(" / ") || "—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">RESIST</span><span className="text-red-400 font-bold">{data.resistance.map(formatNum).join(" / ") || "—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">PCR</span><span className="text-white">{data.PCR ? formatNum(data.PCR, 3) : "—"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">PAIN</span><span className="text-white">{data.max_pain ? formatNum(data.max_pain, 0) : "—"}</span></div>
          </div>
            <div className="text-gray-400"><span className="text-gray-500">TRD </span>{data.trend}</div>
            {data.OI_build_up && <div className="text-gray-400"><span className="text-gray-500">OI  </span>{data.OI_build_up}</div>}
          </div>
        ))}

        {/* VIX */}
        <div className="border border-white/10 bg-white/5 p-3 rounded">
          <div className="text-base text-amber-500 font-bold mb-2">INDIA VIX</div>
          {report.volatility.India_VIX ? (
            <>
              <div className="text-2xl font-bold mb-1">{formatNum(report.volatility.India_VIX, 2)}</div>
              <div className={`mb-3 ${report.volatility.change?.includes('+') ? 'text-red-400' : 'text-emerald-400'}`}>
                {report.volatility.change}
              </div>
              <div className="text-gray-400 mb-2"><span className="text-gray-500">RGM </span>{report.volatility.regime}</div>
              <div className="text-gray-400 mb-2"><span className="text-gray-500">RNG </span>{report.volatility.expected_range || '—'}</div>
              <div className="text-gray-400 italic mt-2">{report.volatility.interpretation}</div>
            </>
          ) : (
             <div className="text-gray-600">VIX UNAVAILABLE</div>
          )}
        </div>
      </div>

      {/* FII / Trading Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* FII */}
        <div className="border border-white/10 bg-white/5 p-3 rounded">
          <div className="text-base text-amber-500 font-bold mb-2">INSTITUTIONAL FLOW</div>
          {report.fii_dii.net_FII != null ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">FII NET</span>
                <span className={report.fii_dii.net_FII >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {report.fii_dii.net_FII >= 0 ? "+" : ""}₹{formatNum(report.fii_dii.net_FII, 0)} CR
                </span>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-gray-500">DII NET</span>
                <span className={report.fii_dii.net_DII! >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {report.fii_dii.net_DII! >= 0 ? "+" : ""}₹{formatNum(report.fii_dii.net_DII!, 0)} CR
                </span>
              </div>
              <div className="text-gray-400 italic pt-1">{report.fii_dii.analysis}</div>
            </div>
          ) : (
            <div className="text-gray-600">FLOW UNAVAILABLE</div>
          )}
        </div>

        {/* Trading Plan */}
        <div className="border border-white/10 bg-white/5 p-3 rounded">
          <div className="text-base text-amber-500 font-bold mb-2">TRADING PLAN</div>
          <div className="space-y-2">
            <div><span className="text-emerald-500">BULL: </span><span className="text-gray-400">{report.trading_plan.best_case.join(" | ")}</span></div>
            <div><span className="text-red-500">BEAR: </span><span className="text-gray-400">{report.trading_plan.worst_case.join(" | ")}</span></div>
            <div><span className="text-amber-500">WAIT: </span><span className="text-gray-400">{report.trading_plan.no_trade_zone.join(" | ")}</span></div>
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 text-gray-500 italic">{report.trading_plan.summary}</div>
        </div>
      </div>
    </div>
  );
}
