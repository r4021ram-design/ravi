"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { API_BASE } from "../lib/config";
import { 
  Plus, 
  Minus, 
  Settings, 
  Edit2, 
  Check, 
  RefreshCw, 
  Sliders, 
  ChevronUp, 
  ChevronDown 
} from "lucide-react";

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
  chain: {
    strikes: StrikeData[];
  };
}

export function SPREAD({ symbol }: { symbol: string }) {
  const [data, setData] = useState<OptionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string>("");
  const [refreshCount, setRefreshCount] = useState(0);

  // --- Upper Controls States ---
  const [atmSource, setAtmSource] = useState<"Spot" | "Futures">("Spot");
  const [futuresSymbol, setFuturesSymbol] = useState("NSE:NIFTY28MAYFUT");
  const [manualAtmStrike, setManualAtmStrike] = useState<number | null>(null);
  const [futuresPrice, setFuturesPrice] = useState<number>(24025.20); // Fallback standard futures price

  // --- CE Controls States ---
  const [ceItmCount, setCeItmCount] = useState<number>(2);
  const [ceOtmCount, setCeOtmCount] = useState<number>(14);
  const [ceStep, setCeStep] = useState<number>(50);

  // --- PE Controls States ---
  const [peItmCount, setPeItmCount] = useState<number>(2);
  const [peOtmCount, setPeOtmCount] = useState<number>(14);
  const [peStep, setPeStep] = useState<number>(50);

  // --- Customizable Ratios State ---
  const [ratios, setRatios] = useState<number[]>([2, 4, 6, 8, 10]);
  const [editingRatios, setEditingRatios] = useState(false);
  const [newRatioInput, setNewRatioInput] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const ceAtmRowRef = useRef<HTMLTableRowElement>(null);
  const peAtmRowRef = useRef<HTMLTableRowElement>(null);

  // --- Data Fetching ---
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
          // Set first expiry if none selected
          if (!selectedExpiry && json.expiry_dates?.length > 0) {
            setSelectedExpiry(json.expiry_dates[0]);
          }
        }
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "Failed to fetch options data");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchOptionsData();
    const interval = setInterval(fetchOptionsData, 30000);
    return () => { ignore = true; clearInterval(interval); };
  }, [symbol, selectedExpiry, refreshCount]);

  // --- Dynamic Step / ATM Calculation ---
  const calculatedStep = useMemo(() => {
    if (!data || data.chain.strikes.length < 2) return 50;
    const sortedStrikes = [...data.chain.strikes].map(s => s.strikePrice).sort((a, b) => a - b);
    const diffs: Record<number, number> = {};
    for (let i = 1; i < sortedStrikes.length; i++) {
      const diff = sortedStrikes[i] - sortedStrikes[i - 1];
      if (diff > 0) diffs[diff] = (diffs[diff] || 0) + 1;
    }
    const mostCommonDiff = Object.entries(diffs).sort((a, b) => b[1] - a[1])[0];
    return mostCommonDiff ? parseInt(mostCommonDiff[0]) : 50;
  }, [data]);

  // Update step inputs when data is loaded
  useEffect(() => {
    if (calculatedStep) {
      setCeStep(calculatedStep);
      setPeStep(calculatedStep);
    }
  }, [calculatedStep]);

  const atmStrike = useMemo(() => {
    if (manualAtmStrike !== null) return manualAtmStrike;
    if (!data) return 24000;
    const baseValue = atmSource === "Spot" ? data.underlying_value : futuresPrice;
    const step = ceStep || 50;
    return Math.round(baseValue / step) * step;
  }, [data, atmSource, futuresPrice, ceStep, manualAtmStrike]);

  // Auto-scroll to ATM row when loaded
  useEffect(() => {
    if (data && ceAtmRowRef.current && containerRef.current) {
      const container = containerRef.current;
      const row = ceAtmRowRef.current;
      const top = row.offsetTop - container.clientHeight / 4;
      container.scrollTo({ top, behavior: 'smooth' });
    }
  }, [data, atmStrike]);

  // --- Distances Configuration (Multipliers of Step) ---
  const ceDistances = useMemo(() => {
    return [4, 5, 6, 7].map(m => m * ceStep); // e.g. [200, 250, 300, 350]
  }, [ceStep]);

  const peDistances = useMemo(() => {
    return [4, 5, 6, 7].map(m => m * peStep); // e.g. [200, 250, 300, 350]
  }, [peStep]);

  // --- Filtered Strikes Generation ---
  const ceStrikes = useMemo(() => {
    if (!data) return [];
    const step = ceStep;
    // ITM strikes for CE are strikes below ATM (lower price)
    // OTM strikes for CE are strikes above ATM (higher price)
    return data.chain.strikes.filter(s => {
      const diff = s.strikePrice - atmStrike;
      if (diff === 0) return true;
      if (diff < 0) return Math.abs(diff) <= ceItmCount * step;
      return diff <= ceOtmCount * step;
    }).sort((a, b) => a.strikePrice - b.strikePrice);
  }, [data, atmStrike, ceStep, ceItmCount, ceOtmCount]);

  const peStrikes = useMemo(() => {
    if (!data) return [];
    const step = peStep;
    // ITM strikes for PE are strikes above ATM (higher price)
    // OTM strikes for PE are strikes below ATM (lower price)
    return data.chain.strikes.filter(s => {
      const diff = s.strikePrice - atmStrike;
      if (diff === 0) return true;
      if (diff > 0) return diff <= peItmCount * step;
      return Math.abs(diff) <= peOtmCount * step;
    }).sort((a, b) => b.strikePrice - a.strikePrice); // Render highest strike down to lowest
  }, [data, atmStrike, peStep, peItmCount, peOtmCount]);

  // --- Ratio Management Helpers ---
  const addRatio = () => {
    const r = parseFloat(newRatioInput);
    if (!isNaN(r) && r > 0 && !ratios.includes(r)) {
      setRatios([...ratios, r].sort((a, b) => a - b));
      setNewRatioInput("");
    }
  };

  const removeRatio = (r: number) => {
    if (ratios.length > 1) {
      setRatios(ratios.filter(x => x !== r));
    }
  };

  if (loading && !data) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-[#050810] text-amber-500 font-mono gap-3 p-6">
        <RefreshCw className="animate-spin text-amber-500" size={32} />
        <span className="text-sm tracking-wider uppercase">LOADING OPTION RATIO SCREENER...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-[#050810] text-red-500 font-mono gap-3 p-6">
        <div className="border border-red-500/20 bg-red-950/20 px-6 py-4 rounded text-center">
          <span className="font-bold text-lg block mb-1">DATA ERROR</span>
          <span className="text-xs text-red-400/80">{error}</span>
          <button 
            onClick={() => setRefreshCount(c => c + 1)}
            className="mt-4 px-3 py-1 bg-red-950/40 border border-red-800/40 text-red-400 rounded text-xs hover:bg-red-900/40 transition-colors uppercase font-bold"
          >
            Retry Fetch
          </button>
        </div>
      </div>
    );
  }

  const underlyingSpot = data?.underlying_value || 24000;

  return (
    <div className="flex-grow flex flex-col h-full bg-[#050810] text-gray-300 font-mono text-xs overflow-hidden select-none">
      
      {/* ----------------- TOP RIGID CONTROLLER PANEL ----------------- */}
      <div className="bg-[#0b0e17] border-b border-white/10 p-3 shrink-0 flex flex-wrap gap-4 items-center justify-between shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-2">
          <span className="text-amber-500 font-black text-sm tracking-wider uppercase border border-amber-500/20 px-2 py-0.5 rounded bg-amber-500/5 shadow-[0_0_10px_rgba(245,158,11,0.05)]">
            RATIO SCREENER
          </span>
          <div className="h-4 w-px bg-white/10 hidden sm:block"></div>
          <span className="text-gray-500 hidden sm:inline uppercase text-[10px]">VERIFIED MULTI-EXPIRY SPREAD SHEET</span>
        </div>

        {/* Global Controls Grid */}
        <div className="flex flex-wrap gap-3 items-center text-[11px]">
          {/* ATM Source Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 uppercase">ATM Source</span>
            <select
              value={atmSource}
              onChange={e => setAtmSource(e.target.value as "Spot" | "Futures")}
              className="bg-[#141923] border border-white/10 text-white rounded px-2 py-1 outline-none focus:border-blue-500/50 hover:bg-[#1a212f] transition-all cursor-pointer font-bold"
            >
              <option value="Spot">Spot</option>
              <option value="Futures">Futures</option>
            </select>
          </div>

          {/* Futures Symbol Input */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 uppercase">Futures Symbol</span>
            <input 
              type="text" 
              value={futuresSymbol}
              onChange={e => setFuturesSymbol(e.target.value)}
              className="w-36 bg-[#141923] border border-white/10 text-white font-bold rounded px-2 py-1 outline-none text-center focus:border-blue-500/50 transition-all uppercase"
              placeholder="FUT SYMBOL"
            />
          </div>

          {/* Expiry Select */}
          {data && (
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 uppercase font-medium">Expiry</span>
              <select
                value={selectedExpiry}
                onChange={e => setSelectedExpiry(e.target.value)}
                className="bg-[#141923] border border-white/10 text-white font-bold rounded px-2 py-1 outline-none focus:border-blue-500/50 hover:bg-[#1a212f] transition-all cursor-pointer"
                title="Select option chain expiry"
              >
                {data.expiry_dates.map(e => (
                  <option key={e} value={e}>{e.toUpperCase()}</option>
                ))}
              </select>
            </div>
          )}

          {/* ATM Strike Override */}
          <div className="flex items-center gap-1.5">
            <span className="text-amber-500 font-bold uppercase">ATM Strike</span>
            <div className="flex items-center bg-[#141923] border border-white/10 rounded overflow-hidden">
              <input 
                type="number" 
                value={atmStrike}
                onChange={e => setManualAtmStrike(e.target.value ? parseInt(e.target.value) : null)}
                className="w-16 bg-transparent text-amber-400 font-black text-center outline-none border-none py-1 text-[11px]"
                title="Calculated ATM Strike. Change manually to override chain step calculations."
              />
              {manualAtmStrike !== null && (
                <button 
                  onClick={() => setManualAtmStrike(null)}
                  className="bg-red-500/10 text-red-400 text-[9px] hover:bg-red-500/20 px-1 border-l border-white/10 transition-colors uppercase font-bold"
                  title="Reset to automated index step calculation"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Refresh button */}
        <button 
          onClick={() => setRefreshCount(c => c + 1)}
          className="p-1.5 bg-[#141923] border border-white/10 hover:border-blue-500/40 text-gray-400 hover:text-white rounded transition-all cursor-pointer shadow-sm"
          title="Manually refresh live chain quotes"
        >
          <RefreshCw size={14} className={loading ? "animate-spin text-blue-400" : ""} />
        </button>
      </div>

      {/* ----------------- DYNAMIC RATIOS MANAGER BAR ----------------- */}
      <div className="bg-[#090b12] border-b border-white/5 px-4 py-1.5 shrink-0 flex flex-wrap items-center justify-between text-[11px]">
        <div className="flex items-center gap-2">
          <Sliders size={12} className="text-gray-500" />
          <span className="text-gray-500 uppercase font-black">Ratios Panel:</span>
          <div className="flex items-center gap-1">
            {ratios.map(r => (
              <span key={r} className="inline-flex items-center bg-[#141923] border border-white/10 px-2 py-0.5 rounded text-white font-bold shadow-sm">
                {r}
                {editingRatios && (
                  <button 
                    onClick={() => removeRatio(r)} 
                    className="ml-1.5 text-red-400 hover:text-red-300 font-black text-[9px] cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Ratio edit tools */}
        <div className="flex items-center gap-2 mt-1 sm:mt-0">
          {editingRatios ? (
            <div className="flex items-center gap-1.5">
              <input 
                type="number" 
                step="0.5"
                placeholder="ADD RATIO"
                value={newRatioInput}
                onChange={e => setNewRatioInput(e.target.value)}
                className="w-16 bg-[#141923] border border-white/10 text-white rounded text-[10px] px-1.5 py-0.5 outline-none font-bold"
              />
              <button 
                onClick={addRatio}
                className="bg-[#141923] hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/40 text-emerald-400 px-2 py-0.5 rounded font-black text-[10px] cursor-pointer"
              >
                + ADD
              </button>
              <button 
                onClick={() => setEditingRatios(false)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded font-black text-[10px] flex items-center gap-1 cursor-pointer"
              >
                <Check size={10} /> DONE
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setEditingRatios(true)}
              className="bg-[#141923] border border-white/10 hover:border-blue-500/40 text-amber-500 px-2 py-0.5 rounded font-black text-[10px] flex items-center gap-1 cursor-pointer hover:bg-amber-500/5 transition-colors"
            >
              <Edit2 size={10} /> EDIT RATIOS
            </button>
          )}
        </div>
      </div>

      {/* ----------------- DYNAMIC DUAL SEGMENT LAYOUT CONTAINER ----------------- */}
      <div ref={containerRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
        
        {/* ========================================================================= */}
        {/* ============================ 1. CALLS (CE) SEGMENT ====================== */}
        {/* ========================================================================= */}
        <div className="bg-[#0b0f19] border border-white/10 rounded shadow-[0_6px_20px_rgba(0,0,0,0.5)] overflow-hidden">
          
          {/* Section Header Controls */}
          <div className="bg-gradient-to-r from-emerald-950/20 to-[#0e1423] px-3 py-2 border-b border-white/10 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-black text-xs md:text-sm text-emerald-400 tracking-widest uppercase">CALL (CE)</span>
              <div className="text-[10px] text-gray-500">ATM BUY / OTM SELL Ratio Matrix</div>
            </div>

            {/* CALL Section Modifiers */}
            <div className="flex flex-wrap gap-3 items-center text-[10px]">
              {/* ITM Strikes count */}
              <div className="flex items-center gap-1 bg-[#141923] border border-white/10 rounded px-1.5 py-0.5">
                <span className="text-gray-500 uppercase">ITM (S0)</span>
                <button 
                  onClick={() => setCeItmCount(c => Math.max(1, c - 1))}
                  className="p-0.5 hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  <Minus size={10} />
                </button>
                <span className="font-bold text-white px-1 text-[11px]">{ceItmCount}</span>
                <button 
                  onClick={() => setCeItmCount(c => Math.min(10, c + 1))}
                  className="p-0.5 hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  <Plus size={10} />
                </button>
              </div>

              {/* OTM Strikes count */}
              <div className="flex items-center gap-1 bg-[#141923] border border-white/10 rounded px-1.5 py-0.5">
                <span className="text-gray-500 uppercase">OTH (S0)</span>
                <button 
                  onClick={() => setCeOtmCount(c => Math.max(1, c - 1))}
                  className="p-0.5 hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  <Minus size={10} />
                </button>
                <span className="font-bold text-white px-1 text-[11px]">{ceOtmCount}</span>
                <button 
                  onClick={() => setCeOtmCount(c => Math.min(30, c + 1))}
                  className="p-0.5 hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  <Plus size={10} />
                </button>
              </div>

              {/* Step */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 uppercase">CE Step</span>
                <input 
                  type="number" 
                  value={ceStep}
                  onChange={e => setCeStep(e.target.value ? parseInt(e.target.value) : 50)}
                  className="w-12 bg-[#141923] border border-white/10 text-white font-bold rounded px-1 text-center outline-none focus:border-blue-500/50 py-0.5"
                />
              </div>
            </div>
          </div>

          {/* Tables Outer Horizontal Grid (4 side-by-side) */}
          <div className="p-3 overflow-x-auto no-scrollbar flex gap-4 min-w-full">
            {ceDistances.map((dist, tableIdx) => {
              return (
                <div key={dist} className="flex-1 min-w-[280px] bg-[#0c0f18] border border-white/5 rounded overflow-hidden shadow-inner">
                  {/* Table Header Shield */}
                  <div className="bg-[#131926] px-2 py-1.5 border-b border-white/10 text-center font-black tracking-wider text-[11px] text-white flex justify-between items-center shadow-sm">
                    <span className="text-amber-500 font-bold uppercase">CE ATM={atmStrike}</span>
                    <span className="bg-emerald-950/40 text-emerald-400 text-[9px] border border-emerald-500/20 px-1.5 py-0.2 rounded font-black shadow-inner">
                      DIST = {dist}
                    </span>
                  </div>

                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-[9px] bg-[#090b12] text-gray-500 uppercase font-black tracking-tighter">
                        <th className="p-1 border-r border-white/5 text-center font-bold font-sans">Strike Pair</th>
                        {ratios.map(r => (
                          <th key={r} className="p-1 border-r border-white/5 text-center font-mono font-bold w-12">{r}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ceStrikes.map(s => {
                        const isAtm = s.strikePrice === atmStrike;
                        const buyStrike = s.strikePrice;
                        const sellStrike = buyStrike + dist;

                        const buyLeg = s;
                        const sellLeg = data?.chain.strikes.find(x => x.strikePrice === sellStrike);

                        const buyLTP = buyLeg.CE?.ltp || 0;
                        const sellLTP = sellLeg?.CE?.ltp || 0;

                        const isDataValid = buyLTP > 0 && sellLTP > 0;

                        return (
                          <tr 
                            key={buyStrike}
                            ref={isAtm && tableIdx === 0 ? ceAtmRowRef : null}
                            className={`border-b border-white/5 transition-all duration-150 ${isAtm ? 'bg-amber-500/10 font-bold ring-1 ring-amber-500/30' : 'hover:bg-white/2'}`}
                          >
                            {/* Strike Pair Name */}
                            <td className={`p-1 text-center font-black border-r border-white/5 text-[10px] font-sans ${isAtm ? 'text-amber-400' : 'text-gray-400'}`}>
                              {buyStrike} = {sellStrike}
                            </td>

                            {/* Ratios Columns */}
                            {ratios.map(r => {
                              let netVal = 0;
                              let isCredit = false;
                              let cellClass = "";
                              let detailTooltip = "";

                              if (isDataValid) {
                                netVal = (r * sellLTP) - buyLTP;
                                isCredit = netVal >= 0;
                                
                                if (isAtm) {
                                  // Golden highlight matching reference sheet exactly
                                  cellClass = isCredit 
                                    ? "bg-amber-500/30 text-amber-300 font-black scale-102 shadow-[0_0_12px_rgba(245,158,11,0.2)] border border-amber-500/40" 
                                    : "bg-red-500/10 text-red-400 font-bold border border-red-500/30";
                                } else {
                                  // Standard Debit vs Credit colors
                                  cellClass = isCredit 
                                    ? "bg-blue-950/20 text-blue-400 border border-blue-900/10 font-semibold" 
                                    : "bg-red-950/20 text-red-400 border border-red-900/10 font-medium";
                                }
                                
                                detailTooltip = `CE SPREAD DETS:\nBuy 1x [${buyStrike} CE] @ ${buyLTP.toFixed(2)}\nSell ${r}x [${sellStrike} CE] @ ${sellLTP.toFixed(2)}\nNet Points: ${netVal.toFixed(2)} (${isCredit ? 'Credit' : 'Debit'})`;
                              } else {
                                cellClass = "text-gray-800 font-normal";
                                detailTooltip = "Spread parameters invalid or options contracts are illiquid/unlisted.";
                              }

                              return (
                                <td 
                                  key={r}
                                  title={detailTooltip}
                                  className={`p-1.5 text-center font-mono border-r border-white/5 cursor-help transition-all ${cellClass}`}
                                >
                                  {isDataValid ? netVal.toFixed(2) : "#N/A"}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ============================ 2. PUTS (PE) SEGMENT ======================= */}
        {/* ========================================================================= */}
        <div className="bg-[#0b0f19] border border-white/10 rounded shadow-[0_6px_20px_rgba(0,0,0,0.5)] overflow-hidden">
          
          {/* Section Header Controls */}
          <div className="bg-gradient-to-r from-orange-950/20 to-[#0e1423] px-3 py-2 border-b border-white/10 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-black text-xs md:text-sm text-orange-400 tracking-widest uppercase">PUT (PE)</span>
              <div className="text-[10px] text-gray-500">ATM BUY / OTM SELL Ratio Matrix</div>
            </div>

            {/* PUT Section Modifiers */}
            <div className="flex flex-wrap gap-3 items-center text-[10px]">
              {/* ITM Strikes count */}
              <div className="flex items-center gap-1 bg-[#141923] border border-white/10 rounded px-1.5 py-0.5">
                <span className="text-gray-500 uppercase">ITM (S0)</span>
                <button 
                  onClick={() => setPeItmCount(c => Math.max(1, c - 1))}
                  className="p-0.5 hover:text-orange-400 transition-colors cursor-pointer"
                >
                  <Minus size={10} />
                </button>
                <span className="font-bold text-white px-1 text-[11px]">{peItmCount}</span>
                <button 
                  onClick={() => setPeItmCount(c => Math.min(10, c + 1))}
                  className="p-0.5 hover:text-orange-400 transition-colors cursor-pointer"
                >
                  <Plus size={10} />
                </button>
              </div>

              {/* OTM Strikes count */}
              <div className="flex items-center gap-1 bg-[#141923] border border-white/10 rounded px-1.5 py-0.5">
                <span className="text-gray-500 uppercase">OTH (S0)</span>
                <button 
                  onClick={() => setPeOtmCount(c => Math.max(1, c - 1))}
                  className="p-0.5 hover:text-orange-400 transition-colors cursor-pointer"
                >
                  <Minus size={10} />
                </button>
                <span className="font-bold text-white px-1 text-[11px]">{peOtmCount}</span>
                <button 
                  onClick={() => setPeOtmCount(c => Math.min(30, c + 1))}
                  className="p-0.5 hover:text-orange-400 transition-colors cursor-pointer"
                >
                  <Plus size={10} />
                </button>
              </div>

              {/* Step */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 uppercase">PE Step</span>
                <input 
                  type="number" 
                  value={peStep}
                  onChange={e => setPeStep(e.target.value ? parseInt(e.target.value) : 50)}
                  className="w-12 bg-[#141923] border border-white/10 text-white font-bold rounded px-1 text-center outline-none focus:border-blue-500/50 py-0.5"
                />
              </div>
            </div>
          </div>

          {/* Tables Outer Horizontal Grid (4 side-by-side) */}
          <div className="p-3 overflow-x-auto no-scrollbar flex gap-4 min-w-full">
            {peDistances.map((dist, tableIdx) => {
              return (
                <div key={dist} className="flex-1 min-w-[280px] bg-[#0c0f18] border border-white/5 rounded overflow-hidden shadow-inner">
                  {/* Table Header Shield */}
                  <div className="bg-[#131926] px-2 py-1.5 border-b border-white/10 text-center font-black tracking-wider text-[11px] text-white flex justify-between items-center shadow-sm">
                    <span className="text-amber-500 font-bold uppercase">PE ATM={atmStrike}</span>
                    <span className="bg-orange-950/40 text-orange-400 text-[9px] border border-orange-500/20 px-1.5 py-0.2 rounded font-black shadow-inner">
                      DIST = {dist}
                    </span>
                  </div>

                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-[9px] bg-[#090b12] text-gray-500 uppercase font-black tracking-tighter">
                        <th className="p-1 border-r border-white/5 text-center font-bold font-sans">Strike Pair</th>
                        {ratios.map(r => (
                          <th key={r} className="p-1 border-r border-white/5 text-center font-mono font-bold w-12">{r}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {peStrikes.map(s => {
                        const isAtm = s.strikePrice === atmStrike;
                        const buyStrike = s.strikePrice;
                        const sellStrike = buyStrike - dist; // For PUT, lower strikes are further OTM

                        const buyLeg = s;
                        const sellLeg = data?.chain.strikes.find(x => x.strikePrice === sellStrike);

                        const buyLTP = buyLeg.PE?.ltp || 0;
                        const sellLTP = sellLeg?.PE?.ltp || 0;

                        const isDataValid = buyLTP > 0 && sellLTP > 0;

                        return (
                          <tr 
                            key={buyStrike}
                            ref={isAtm && tableIdx === 0 ? peAtmRowRef : null}
                            className={`border-b border-white/5 transition-all duration-150 ${isAtm ? 'bg-amber-500/10 font-bold ring-1 ring-amber-500/30' : 'hover:bg-white/2'}`}
                          >
                            {/* Strike Pair Name */}
                            <td className={`p-1 text-center font-black border-r border-white/5 text-[10px] font-sans ${isAtm ? 'text-amber-400' : 'text-gray-400'}`}>
                              {buyStrike} = {sellStrike}
                            </td>

                            {/* Ratios Columns */}
                            {ratios.map(r => {
                              let netVal = 0;
                              let isCredit = false;
                              let cellClass = "";
                              let detailTooltip = "";

                              if (isDataValid) {
                                netVal = (r * sellLTP) - buyLTP;
                                isCredit = netVal >= 0;
                                
                                if (isAtm) {
                                  // Golden highlight matching reference sheet exactly
                                  cellClass = isCredit 
                                    ? "bg-amber-500/30 text-amber-300 font-black scale-102 shadow-[0_0_12px_rgba(245,158,11,0.2)] border border-amber-500/40" 
                                    : "bg-red-500/10 text-red-400 font-bold border border-red-500/30";
                                } else {
                                  // Standard Debit vs Credit colors
                                  cellClass = isCredit 
                                    ? "bg-blue-950/20 text-blue-400 border border-blue-900/10 font-semibold" 
                                    : "bg-red-950/20 text-red-400 border border-red-900/10 font-medium";
                                }
                                
                                detailTooltip = `PE SPREAD DETS:\nBuy 1x [${buyStrike} PE] @ ${buyLTP.toFixed(2)}\nSell ${r}x [${sellStrike} PE] @ ${sellLTP.toFixed(2)}\nNet Points: ${netVal.toFixed(2)} (${isCredit ? 'Credit' : 'Debit'})`;
                              } else {
                                cellClass = "text-gray-800 font-normal";
                                detailTooltip = "Spread parameters invalid or options contracts are illiquid/unlisted.";
                              }

                              return (
                                <td 
                                  key={r}
                                  title={detailTooltip}
                                  className={`p-1.5 text-center font-mono border-r border-white/5 cursor-help transition-all ${cellClass}`}
                                >
                                  {isDataValid ? netVal.toFixed(2) : "#N/A"}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ----------------- RETRO STATUS FOOTER ----------------- */}
      <div className="bg-[#004b20] text-white px-3 py-1 text-[10px] md:text-[11px] shrink-0 flex justify-between overflow-x-auto no-scrollbar font-bold border-t border-emerald-600/30 shadow-inner">
        <div className="flex gap-3 items-center shrink-0">
          <span className="bg-white/10 px-1.5 py-0.2 rounded text-[9px] animate-pulse">ACTIVE FEED</span>
          <span className="opacity-50">|</span>
          <span>ATM MODE: {atmSource.toUpperCase()}</span>
          <span className="opacity-50">|</span>
          <span className="text-emerald-300">CALCULATIONS: VERIFIED (POINTS)</span>
        </div>
        <div className="flex gap-4 items-center shrink-0 ml-4">
          <span>UNDERLYING SPOT: <span className="text-white font-black">{underlyingSpot.toFixed(2)}</span></span>
          <div className="h-3 w-px bg-white/20"></div>
          <span>ATM STRIKE: <span className="text-amber-300 font-black">{atmStrike}</span></span>
          <div className="h-3 w-px bg-white/20"></div>
          <span className="bg-[#050810]/50 border border-emerald-500/20 px-1.5 rounded text-[9px] text-emerald-300">SPREADSHEET RETRO MODE</span>
        </div>
      </div>
    </div>
  );
}
