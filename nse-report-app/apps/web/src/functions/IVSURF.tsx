"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "../lib/config";

type ViewMode = "SURFACE" | "SKEW" | "TERM";

interface SurfacePoint {
  expiry: string;
  strike: number;
  ce_iv: number;
  pe_iv: number;
  days_to_expiry: number;
}

interface TermPoint {
  expiry: string;
  days: number;
  atm_ce_iv: number;
  atm_pe_iv: number;
}

interface IVSurfaceData {
  symbol: string;
  underlying: number;
  expiries: string[];
  surface: SurfacePoint[];
  term_structure: TermPoint[];
  term_shape: string;
  analysis?: {
    summary: string[];
    verdict: string;
    sentiment: string;
    action: string;
  };
}

interface IVSkewData {
  symbol: string;
  underlying: number;
  atm_strike: number;
  atm_ce_iv: number;
  atm_pe_iv: number;
  otm_call_iv: number;
  otm_put_iv: number;
  skew_ratio: number | null;
  skew_bias: string;
  smile_data: { strike: number; ce_iv: number; pe_iv: number }[];
}

export function IVSURF({ symbol }: { symbol: string }) {
  const [surfaceData, setSurfaceData] = useState<IVSurfaceData | null>(null);
  const [skewData, setSkewData] = useState<IVSkewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("SKEW");

  useEffect(() => {
    let ignore = false;
    async function fetchData() {
      try {
        setLoading(true);
        const [surfRes, skewRes] = await Promise.all([
          fetch(`${API_BASE}/api/options/${symbol}/iv-surface`),
          fetch(`${API_BASE}/api/options/${symbol}/iv-skew`),
        ]);

        if (!ignore) {
          const nextSurfaceData = surfRes.ok ? await surfRes.json() : null;
          const nextSkewData = skewRes.ok ? await skewRes.json() : null;

          setSurfaceData(nextSurfaceData);
          setSkewData(nextSkewData);
          setError(
            !nextSurfaceData && !nextSkewData
              ? `IV data unavailable (surface: ${surfRes.status}, skew: ${skewRes.status})`
              : null
          );
        }
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "Failed to fetch IV data");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchData();
    return () => { ignore = true; };
  }, [symbol]);

  if (loading) return <div className="p-4 text-amber-500 font-mono text-sm animate-pulse">LOADING IVSURF FOR {symbol}...</div>;
  if (error) return <div className="p-4 text-red-500 font-mono text-sm">ERROR: {error}</div>;
  if (!surfaceData && !skewData) return <div className="p-4 text-gray-500 font-mono text-sm">NO IV DATA AVAILABLE</div>;

  return (
    <div className="flex flex-col h-full overflow-hidden text-gray-300 font-mono text-xs">
      {/* Header */}
      <div className="bg-[#0a0e1a] border-b border-white/10 p-3 shrink-0 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
            {symbol} <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1 rounded">IVSURF</span>
          </h2>
          <div className="flex items-center gap-3 text-[10px]">
            {skewData && (
              <>
                <span>ATM IV: <span className="text-white">{skewData.atm_ce_iv.toFixed(1)}%</span></span>
                <span>SKEW: <span className={
                  (skewData.skew_ratio || 1) > 1.1 ? "text-red-400" :
                  (skewData.skew_ratio || 1) < 0.9 ? "text-emerald-400" : "text-amber-400"
                }>{skewData.skew_ratio?.toFixed(3) || 'N/A'}</span></span>
                <span className="text-gray-600">{skewData.skew_bias}</span>
              </>
            )}
            {surfaceData && (
              <span>TERM: <span className={
                surfaceData.term_shape.includes("Contango") ? "text-emerald-400" :
                surfaceData.term_shape.includes("Backwardation") ? "text-red-400" : "text-amber-400"
              }>{surfaceData.term_shape}</span></span>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          {(["SKEW", "SURFACE", "TERM"] as ViewMode[]).map(m => (
            <button key={m} onClick={() => setView(m)}
              className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                view === m
                  ? "bg-purple-500/10 border-purple-500/50 text-purple-400"
                  : "border-white/10 text-gray-500 hover:bg-white/5"
              }`}>{m}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-3 p-3">
        <div className="flex-1 overflow-auto custom-scrollbar bg-white/2 rounded border border-white/5 p-3">
          {view === "SKEW" && skewData && <SkewView data={skewData} />}
          {view === "SURFACE" && surfaceData && <SurfaceView data={surfaceData} />}
          {view === "TERM" && surfaceData && <TermView data={surfaceData} />}
        </div>
        
        {/* Analysis Report Panel */}
        {surfaceData?.analysis && (
          <div className="w-full lg:w-72 shrink-0 bg-blue-500/5 rounded border border-blue-500/10 p-3 flex flex-col gap-3">
            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex justify-between">
              <span>Volatility Report</span>
              <span className={
                surfaceData.analysis.verdict === "BULLISH" ? "text-emerald-400" :
                surfaceData.analysis.verdict === "BEARISH" ? "text-red-400" : "text-amber-400"
              }>{surfaceData.analysis.verdict}</span>
            </div>
            
            <div className="space-y-2">
              {surfaceData.analysis.summary.map((s, i) => (
                <div key={i} className="text-[11px] text-gray-400 leading-relaxed border-l border-white/10 pl-2">
                  {s}
                </div>
              ))}
            </div>

            <div className="mt-auto pt-3 border-t border-white/5 space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-500">SENTIMENT</span>
                <span className="text-white">{surfaceData.analysis.sentiment}</span>
              </div>
              <div className="bg-white/5 p-2 rounded">
                <div className="text-[9px] text-gray-500 uppercase mb-1">Recommended Action</div>
                <div className="text-[11px] text-amber-500 font-bold">{surfaceData.analysis.action}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-[#0a0e1a] border-t border-white/10 p-2 text-[10px] flex justify-between px-4 text-gray-500 shrink-0">
        <div className="flex gap-4">
          {skewData && (
            <>
              <div>OTM PUT IV: <span className="text-red-400/80">{skewData.otm_put_iv}%</span></div>
              <div>OTM CALL IV: <span className="text-emerald-400/80">{skewData.otm_call_iv}%</span></div>
            </>
          )}
        </div>
        <div className="text-gray-700">IMPLIED VOLATILITY ANALYSIS</div>
      </div>
    </div>
  );
}

/* ── Skew View: IV vs Strike line chart ── */
function SkewView({ data }: { data: IVSkewData }) {
  const smile = data.smile_data;
  if (smile.length < 3) return <div className="text-gray-500 p-4">Insufficient smile data</div>;

  const maxIV = Math.max(...smile.map(s => Math.max(s.ce_iv, s.pe_iv)));
  const validIVs = smile.flatMap(s => [s.ce_iv, s.pe_iv]).filter(iv => iv > 0);
  if (validIVs.length < 2 || maxIV <= 0) return <div className="text-gray-500 p-4">Insufficient IV smile data</div>;

  const minIV = Math.min(...validIVs);
  const ivRange = maxIV - minIV || 1;
  const chartH = 200;
  const chartW = smile.length;

  return (
    <div>
      <div className="text-[10px] text-gray-600 mb-2">IV SMILE / SKEW — CE (green) vs PE (red dashed) — ATM marker (amber)</div>
      <svg width="100%" height={chartH + 30} viewBox={`0 0 ${chartW} ${chartH + 30}`} preserveAspectRatio="none" className="overflow-visible">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => (
          <line key={pct} x1={0} y1={chartH * pct} x2={chartW} y2={chartH * pct}
            stroke="rgba(255,255,255,0.05)" strokeWidth="0.2" />
        ))}

        {/* CE IV line */}
        <polyline
          points={smile.map((s, i) => `${i},${chartH - ((s.ce_iv - minIV) / ivRange) * (chartH - 20)}`).join(' ')}
          fill="none" stroke="#10b981" strokeWidth="0.8" opacity="0.9"
        />
        {/* PE IV line */}
        <polyline
          points={smile.map((s, i) => `${i},${chartH - ((s.pe_iv - minIV) / ivRange) * (chartH - 20)}`).join(' ')}
          fill="none" stroke="#ef4444" strokeWidth="0.8" opacity="0.9" strokeDasharray="2,1"
        />

        {/* ATM marker */}
        {(() => {
          const atmIdx = smile.findIndex(s => s.strike === data.atm_strike);
          if (atmIdx >= 0) return (
            <line x1={atmIdx} y1={0} x2={atmIdx} y2={chartH}
              stroke="#f59e0b" strokeWidth="0.3" strokeDasharray="2,2" />
          );
          return null;
        })()}

        {/* X-axis labels (every ~10 strikes) */}
        {smile.map((s, i) => (i % Math.max(1, Math.floor(smile.length / 8)) === 0) ? (
          <text key={i} x={i} y={chartH + 15} textAnchor="middle" fontSize="3" fill="#64748b">
            {s.strike}
          </text>
        ) : null)}
      </svg>

      {/* Legend & Stats */}
      <div className="flex gap-6 mt-3 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-px bg-emerald-500 inline-block" /> CE IV
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-0 inline-block border-t border-dashed border-red-500" /> PE IV
        </div>
        <div className="ml-auto text-gray-500">
          ATM: {data.atm_strike} | CE IV: {data.atm_ce_iv.toFixed(1)}% | PE IV: {data.atm_pe_iv.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

/* ── Surface View: Heatmap (strike × expiry → IV color) ── */
function SurfaceView({ data }: { data: IVSurfaceData }) {
  const { surface, expiries, underlying } = data;
  if (surface.length < 5) return <div className="text-gray-500 p-4">Insufficient surface data</div>;

  // Get unique sorted strikes near ATM
  const allStrikes = [...new Set(surface.map(s => s.strike))].sort((a, b) => a - b);
  const step = underlying > 10000 ? 100 : 50;
  const nearStrikes = allStrikes.filter(s => Math.abs(s - underlying) <= step * 15);

  const validIVs = surface.flatMap(s => [s.ce_iv, s.pe_iv]).filter(iv => iv > 0);
  if (validIVs.length < 2) return <div className="text-gray-500 p-4">Insufficient surface IV values</div>;

  const maxIV = Math.max(...validIVs);
  const minIV = Math.min(...validIVs);
  const ivRange = maxIV - minIV || 1;

  const cellW = Math.max(60, 800 / expiries.length);

  // Color: low IV = blue, high IV = red
  function ivColor(iv: number): string {
    if (iv <= 0) return "rgba(255,255,255,0.03)";
    const t = Math.min(1, Math.max(0, (iv - minIV) / ivRange));
    const h = (1 - t) * 220; // 220 (blue) → 0 (red)
    return `hsl(${h}, 75%, ${20 + t * 30}%)`;
  }

  return (
    <div>
      <div className="text-[10px] text-gray-600 mb-2">IV SURFACE (CE IMPLIED VOLATILITY) — Blue = Low IV → Red = High IV</div>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="text-[10px] border-collapse">
          <thead>
            <tr>
              <th className="p-1 text-right text-gray-500 sticky left-0 bg-[#050810] z-10">Strike</th>
              {expiries.map(e => (
                <th key={e} className="p-1 text-center text-gray-500" style={{ minWidth: cellW }}>
                  {e.replace(/-20\d\d$/, '')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nearStrikes.map(strike => {
              const isAtm = Math.abs(strike - underlying) < step / 2;
              return (
                <tr key={strike}>
                  <td className={`p-1 text-right sticky left-0 bg-[#050810] z-10 ${isAtm ? 'text-amber-500 font-bold' : 'text-gray-400'}`}>
                    {strike}
                  </td>
                  {expiries.map(exp => {
                    const point = surface.find(s => s.strike === strike && s.expiry === exp);
                    const iv = point?.ce_iv || 0;
                    return (
                      <td key={exp} className="p-0.5">
                        <div
                          className="w-full h-4 rounded-sm text-center text-[9px] font-mono"
                          style={{ backgroundColor: ivColor(iv) }}
                          title={`Strike: ${strike} | Expiry: ${exp} | IV: ${iv.toFixed(1)}%`}
                        >
                          {iv > 0 ? iv.toFixed(1) : ''}
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
    </div>
  );
}

/* ── Term Structure View: ATM IV across expiries ── */
function TermView({ data }: { data: IVSurfaceData }) {
  const points = data.term_structure;
  if (points.length < 2) return <div className="text-gray-500 p-4">Need at least 2 expiries for term structure</div>;

  const maxIV = Math.max(...points.map(p => Math.max(p.atm_ce_iv, p.atm_pe_iv)));
  const minIV = Math.min(...points.map(p => Math.min(p.atm_ce_iv, p.atm_pe_iv)));
  const ivRange = maxIV - minIV || 1;
  const chartH = 180;
  const chartW = points.length;

  return (
    <div>
      <div className="text-[10px] text-gray-600 mb-2">ATM IV TERM STRUCTURE — CE (green) vs PE (red) across expiries</div>
      <svg width="100%" height={chartH + 40} viewBox={`0 0 ${chartW + 0.5} ${chartH + 40}`} preserveAspectRatio="none" className="overflow-visible">
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => (
          <line key={pct} x1={0} y1={chartH * pct} x2={chartW} y2={chartH * pct}
            stroke="rgba(255,255,255,0.05)" strokeWidth="0.15" />
        ))}

        {/* CE ATM IV */}
        <polyline
          points={points.map((p, i) => `${i},${chartH - ((p.atm_ce_iv - minIV) / ivRange) * (chartH - 20)}`).join(' ')}
          fill="none" stroke="#10b981" strokeWidth="1.5"
        />
        {/* PE ATM IV */}
        <polyline
          points={points.map((p, i) => `${i},${chartH - ((p.atm_pe_iv - minIV) / ivRange) * (chartH - 20)}`).join(' ')}
          fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3,2"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={i} cy={chartH - ((p.atm_ce_iv - minIV) / ivRange) * (chartH - 20)}
              r="1.5" fill="#10b981" />
            <circle cx={i} cy={chartH - ((p.atm_pe_iv - minIV) / ivRange) * (chartH - 20)}
              r="1.5" fill="#ef4444" />
            {/* X label */}
            <text x={i} y={chartH + 15} textAnchor="middle" fontSize="3.5" fill="#64748b">
              {p.expiry.replace(/-20\d\d$/, '')}
            </text>
            <text x={i} y={chartH + 25} textAnchor="middle" fontSize="2.5" fill="#4a5568">
              {p.days}d
            </text>
          </g>
        ))}
      </svg>

      {/* Stats */}
      <div className="flex gap-4 mt-3 text-[10px]">
        <span className="text-gray-500">Shape: <span className={
          data.term_shape.includes("Contango") ? "text-emerald-400" :
          data.term_shape.includes("Backwardation") ? "text-red-400" : "text-amber-400"
        }>{data.term_shape}</span></span>
        <span className="text-gray-500">Near IV: <span className="text-white">{points[0]?.atm_ce_iv.toFixed(1)}%</span></span>
        <span className="text-gray-500">Far IV: <span className="text-white">{points[points.length - 1]?.atm_ce_iv.toFixed(1)}%</span></span>
      </div>
    </div>
  );
}
