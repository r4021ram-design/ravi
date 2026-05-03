"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { API_BASE } from "../../lib/config";
import { ReportData } from "../../lib/types";

function Section({ title, icon, children, defaultOpen = true }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card mb-4 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <h3 className="font-bold text-lg">{title}</h3>
        </div>
        <span className={`text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      {open && <div className="px-5 pb-5 border-t border-white/5 pt-4">{children}</div>}
    </div>
  );
}

function DataRow({ label, value, color }: { label: string; value: string | number | null | undefined; color?: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm font-mono font-medium ${color || "text-gray-200"}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

export default function ReportPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);

  async function fetchReport(dateStr: string) {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/report/daily?report_date=${dateStr}`);
      if (!res.ok) throw new Error(`API ${res.status}`);
      setReport(await res.json());
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchReport(selectedDate); }, [selectedDate]);

  return (
    <div className="max-w-[1000px] mx-auto px-4 py-6">
      {/* Nav */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Dashboard</Link>
        <input
          type="date"
          title="Select report date"
          placeholder="YYYY-MM-DD"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
        />
      </div>

      <h1 className="text-2xl font-bold mb-1">
        <span className="gradient-text">Daily Market Report</span>
      </h1>
      <p className="text-sm text-gray-500 mb-6">{selectedDate}</p>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : !report ? (
        <div className="glass-card p-10 text-center">
          <p className="text-gray-400">No report available for this date.</p>
        </div>
      ) : (
        <>
          {/* 1. Market Overview */}
          <Section title="Market Overview" icon="🌍">
            <div className="mb-4">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Opening Bias</span>
              <div className="mt-1">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  (report.market_overview.india_opening_bias as string) === "Bullish"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : (report.market_overview.india_opening_bias as string) === "Bearish"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-amber-500/20 text-amber-400"
                }`}>
                  {report.market_overview.india_opening_bias as string}
                </span>
              </div>
            </div>

            {/* Global Markets */}
            <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2 mt-4">Global Markets</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {!!report.market_overview.global_markets &&
                Object.entries(
                  (report.market_overview.global_markets as Record<string, unknown>).us_indices as Record<string, Record<string, unknown>> || {}
                ).map(([key, val]) => (
                  <div key={key} className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500">{val.symbol as string}</div>
                    <div className="text-sm font-bold font-mono">{(val.price as number)?.toLocaleString() || "—"}</div>
                    <div className={`text-xs ${((val.changePercent as number) || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {((val.changePercent as number) || 0) >= 0 ? "+" : ""}{(val.changePercent as number)?.toFixed(2)}%
                    </div>
                  </div>
                ))
              }
            </div>

            {/* Macro Factors */}
            {(report.market_overview.macro_factors as string[])?.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Macro Factors</h4>
                <ul className="space-y-1">
                  {(report.market_overview.macro_factors as string[]).map((f, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {/* 2. Index Analysis */}
          <Section title="Index Analysis" icon="📊">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(report.index_analysis).map(([name, data]) => {
                const d = data as Record<string, unknown>;
                const quote = d.quote as Record<string, unknown> || {};
                return (
                  <div key={name} className="bg-white/5 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold text-sm">{name}</h4>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        d.intraday_bias === "Bullish" ? "bg-emerald-500/20 text-emerald-400"
                          : d.intraday_bias === "Bearish" ? "bg-red-500/20 text-red-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}>{d.intraday_bias as string}</span>
                    </div>
                    <DataRow label="Trend" value={d.trend as string} />
                    <DataRow label="Support" value={(d.support as number[])?.join(" / ") || "—"} color="text-emerald-400" />
                    <DataRow label="Resistance" value={(d.resistance as number[])?.join(" / ") || "—"} color="text-red-400" />
                    <DataRow label="PCR" value={d.PCR != null ? String(d.PCR) : "—"} />
                    <DataRow label="Max Pain" value={d.max_pain != null ? String(d.max_pain) : "—"} />
                  </div>
                );
              })}
            </div>
          </Section>

          {/* 3. Options Chain */}
          <Section title="Options Chain Insights" icon="🔗">
            {Object.entries(report.options_chain || {}).map(([key, val]) => (
              <DataRow key={key} label={key.replace(/_/g, " ")} value={String(val)} />
            ))}
          </Section>

          {/* 4. FII/DII */}
          <Section title="FII / DII Activity" icon="🏦">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <div className="text-xs text-gray-500 mb-1">FII Net</div>
                <div className={`text-2xl font-bold font-mono ${
                  ((report.fii_dii.net_FII as number) || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                }`}>
                  ₹{((report.fii_dii.net_FII as number) || 0).toLocaleString()} Cr
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <div className="text-xs text-gray-500 mb-1">DII Net</div>
                <div className={`text-2xl font-bold font-mono ${
                  ((report.fii_dii.net_DII as number) || 0) >= 0 ? "text-emerald-400" : "text-red-400"
                }`}>
                  ₹{((report.fii_dii.net_DII as number) || 0).toLocaleString()} Cr
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-400">{report.fii_dii.analysis as string}</p>
          </Section>

          {/* 5. Volatility */}
          <Section title="Volatility (India VIX)" icon="📈">
            <div className="flex items-baseline gap-4 mb-3">
              <span className="text-4xl font-bold">
                {(report.volatility.India_VIX as number)?.toFixed(2) || "—"}
              </span>
              <span className={`text-sm font-medium ${
                ((report.volatility.change as string) || "").includes("+") ? "text-red-400" : "text-emerald-400"
              }`}>
                {report.volatility.change as string}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs ${
                (report.volatility.regime as string) === "Low" ? "bg-emerald-500/20 text-emerald-400"
                  : (report.volatility.regime as string) === "Moderate" ? "bg-amber-500/20 text-amber-400"
                  : "bg-red-500/20 text-red-400"
              }`}>{report.volatility.regime as string}</span>
            </div>
            <p className="text-sm text-gray-400 mb-2">{report.volatility.interpretation as string}</p>
            {!!report.volatility.expected_range && (
              <DataRow label="Expected Nifty Range" value={report.volatility.expected_range as string} color="text-blue-400" />
            )}
          </Section>

          {/* 6. Trading Plan */}
          <Section title="Trading Plan" icon="🎯">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-400">Best Case</span>
                </div>
                {(report.trading_plan.best_case as string[]).map((s, i) => (
                  <p key={i} className="text-sm text-gray-300 pl-5 mb-1">{s}</p>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm font-semibold text-red-400">Worst Case</span>
                </div>
                {(report.trading_plan.worst_case as string[]).map((s, i) => (
                  <p key={i} className="text-sm text-gray-300 pl-5 mb-1">{s}</p>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-sm font-semibold text-amber-400">No-Trade Zone</span>
                </div>
                {(report.trading_plan.no_trade_zone as string[]).map((s, i) => (
                  <p key={i} className="text-sm text-gray-300 pl-5 mb-1">{s}</p>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-sm text-gray-500 italic">{report.trading_plan.summary as string}</p>
            </div>
          </Section>

          {/* Export */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url;
                a.download = `nse-report-${selectedDate}.json`; a.click();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium"
            >
              📥 Download JSON
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-gray-300"
            >
              🖨️ Print Report
            </button>
          </div>
        </>
      )}
    </div>
  );
}
