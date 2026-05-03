"use client";

import { useState, useEffect } from "react";
import { generateIntel, IntelResult } from "../lib/signals";
import { ReportData } from "../lib/types";
import { API_BASE } from "../lib/config";

export function INTEL({ symbol }: { symbol: string }) {
  const [intelResult, setIntelResult] = useState<IntelResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        setLoading(true);
        const upperSymbol = symbol.toUpperCase();
        
        // 1. Fetch daily report to get VIX & FII macro data, and maybe index data
        let reportData: ReportData | null = null;
        try {
          const resReport = await fetch(`${API_BASE}/api/report/latest`);
          if (resReport.ok) {
            reportData = await resReport.json();
          }
        } catch {
          console.warn("Could not fetch daily report for macro data.");
        }

        let indexData: any = reportData?.index_analysis?.[upperSymbol];

        // 2. If it's a stock (not NIFTY/BANKNIFTY), fetch on-demand options technicals
        if (!indexData) {
          const resOpt = await fetch(`${API_BASE}/api/options/${upperSymbol}`);
          if (!resOpt.ok) throw new Error(`Symbol ${upperSymbol} not found or options data unavailable.`);
          const optData = await resOpt.json();
          const t = optData.technicals;
          
          indexData = {
            trend: t.intraday_bias || "Neutral",
            PCR: t.PCR,
            max_pain: t.max_pain,
            intraday_bias: t.intraday_bias,
            OI_build_up: t.OI_build_up
          };
        }

        // 3. Generate Scorecard
        const intel = generateIntel(
          upperSymbol,
          indexData,
          reportData?.volatility,
          reportData?.fii_dii
        );

        if (!ignore) {
          setIntelResult(intel);
          setError(null);
        }

      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "Failed to generate INTEL");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchData();
    return () => { ignore = true; };
  }, [symbol]);

  if (loading) return <div className="p-4 text-amber-500 font-mono text-sm animate-pulse">EVALUATING INTELLIGENCE FOR {symbol}...</div>;
  if (error) return <div className="p-4 text-red-500 font-mono text-sm">ERROR: {error}</div>;
  if (!intelResult) return null;

  const intel = intelResult;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-[#050810] text-gray-300 font-mono text-sm">
      <div className="flex justify-between items-end border-b border-white/10 pb-2 mb-4">
        <div>
          <h1 className="text-xl text-amber-500 font-bold tracking-tight">INTEL - SCORECARD</h1>
          <div className="text-gray-500 mt-1">ASSET: {intel.symbol}</div>
        </div>
      </div>

      <div className="border border-white/10 bg-white/5 p-4 rounded mb-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1">
          <div className="text-gray-500 mb-1">INTELLIGENCE VERDICT</div>
          <div className={`text-3xl font-bold ${
            intel.overallVerdict === 'BULLISH' ? 'text-emerald-500' :
            intel.overallVerdict === 'BEARISH' ? 'text-red-500' : 'text-amber-500'
          }`}>
            {intel.overallVerdict}
          </div>
        </div>
        <div className="flex gap-4">
          <div className="text-center">
            <div className="text-3xl text-emerald-500 font-bold">{intel.bullishCount}</div>
            <div className="text-xs text-gray-500">BULLISH</div>
          </div>
          <div className="text-center">
            <div className="text-3xl text-amber-500 font-bold">{intel.neutralCount}</div>
            <div className="text-xs text-gray-500">NEUTRAL</div>
          </div>
          <div className="text-center">
            <div className="text-3xl text-red-500 font-bold">{intel.bearishCount}</div>
            <div className="text-xs text-gray-500">BEARISH</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {['TECHNICAL', 'OPTIONS', 'MACRO'].map(category => {
          const categorySignals = intel.signals.filter(s => s.category === category);
          return (
            <div key={category} className="border border-white/10 bg-white/5 p-3 rounded">
              <div className="text-amber-500 font-bold mb-3">{category}</div>
              {categorySignals.length === 0 ? (
                <div className="text-gray-600 italic">No signals</div>
              ) : (
                <div className="space-y-2">
                  {categorySignals.map((sig, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                        sig.verdict === 'BULLISH' ? 'bg-emerald-500' :
                        sig.verdict === 'BEARISH' ? 'bg-red-500' : 'bg-amber-500'
                      }`} />
                      <span className="text-gray-300">{sig.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
