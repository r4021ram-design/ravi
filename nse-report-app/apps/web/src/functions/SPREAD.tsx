"use client";

import { useState, useEffect, useMemo } from "react";
import { API_BASE } from "../lib/config";

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

const DISTANCES = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];

export function SPREAD({ symbol }: { symbol: string }) {
  const [data, setData] = useState<OptionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string>("");

  // Dynamic Ratios State
  const [backRatios, setBackRatios] = useState<number[]>(DISTANCES.map(d => {
    if (d <= 50) return 1;
    if (d <= 150) return 2;
    return 3;
  }));

  const [frontRatios, setFrontRatios] = useState<number[]>(DISTANCES.map((d, i) => {
    const defaultRatios = [1, 3, 2.5, 3, 6, 3, 5, 2, 4, 3]; 
    return defaultRatios[i] || 3;
  }));

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
          // Set first expiry if none selected
          if (!selectedExpiry && json.expiry_dates?.length > 0) {
            setSelectedExpiry(json.expiry_dates[0]);
          }
          setError(null);
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
  }, [symbol, selectedExpiry]);

  const atmStrike = useMemo(() => {
    if (!data) return 0;
    const underlying = data.underlying_value;
    const step = underlying > 10000 ? 100 : 50;
    return Math.round(underlying / step) * step;
  }, [data]);

  const filteredStrikes = useMemo(() => {
    if (!data) return [];
    // Show 20 strikes above and 20 below ATM
    const step = data.underlying_value > 10000 ? 50 : 25;
    return data.chain.strikes.filter(s => 
      Math.abs(s.strikePrice - atmStrike) <= step * 20
    ).sort((a, b) => a.strikePrice - b.strikePrice);
  }, [data, atmStrike]);

  const handleRatioChange = (type: 'back' | 'front', index: number, value: string) => {
    const val = parseFloat(value) || 0;
    if (type === 'back') {
      const newRatios = [...backRatios];
      newRatios[index] = val;
      setBackRatios(newRatios);
    } else {
      const newRatios = [...frontRatios];
      newRatios[index] = val;
      setFrontRatios(newRatios);
    }
  };

  if (loading && !data) return <div className="p-4 text-amber-500 font-mono text-sm animate-pulse">LOADING EXCEL SPREAD MATRIX...</div>;
  if (error) return <div className="p-4 text-red-500 font-mono text-sm">ERROR: {error}</div>;
  if (!data) return null;

  return (
    <div className="flex flex-col h-full bg-[#0a0e1a] text-gray-300 font-mono text-[10px] select-none overflow-hidden">
      {/* Excel Ribbon / Header */}
      <div className="bg-[#1e1e1e] border-b border-gray-700 p-1 flex items-center gap-4 px-3 shrink-0">
        <div className="flex items-center gap-1">
          <span className="bg-emerald-600 text-white px-1 font-bold text-[9px] rounded-sm">FILE</span>
          <span className="px-1 font-bold text-[9px] text-gray-400">HOME</span>
          <span className="px-1 font-bold text-[9px] text-gray-400">INSERT</span>
          <span className="px-1 font-bold text-[9px] text-gray-400">FORMULAS</span>
          <span className="px-1 font-bold text-[9px] text-gray-400">DATA</span>
        </div>
        <div className="h-4 w-px bg-gray-700 mx-1"></div>
        <div className="flex gap-4">
          <div>MODE: <span className="text-amber-500 font-bold">DYNAMIC RATIO</span></div>
          <div className="text-gray-500">ADJUST YELLOW INPUTS TO RECALC</div>
        </div>
        <div className="flex-1"></div>
        <select
          value={selectedExpiry}
          onChange={e => setSelectedExpiry(e.target.value)}
          className="bg-[#2d2d2d] border border-gray-600 rounded px-2 py-0.5 text-[9px] outline-none"
          aria-label="Select Expiry Date"
          title="Select Expiry Date"
        >
          {data.expiry_dates.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-auto custom-scrollbar flex">
        {/* Left Panel: Options Chain */}
        <div className="shrink-0 border-r border-gray-700">
          <table className="border-collapse w-[300px]">
            <thead className="sticky top-0 bg-[#2d2d2d] z-20">
              <tr className="border-b border-gray-600">
                <th className="border-r border-gray-700 p-1 font-normal text-left">TYPE</th>
                <th className="border-r border-gray-700 p-1 font-normal text-left">STRIKE</th>
                <th className="border-r border-gray-700 p-1 font-normal text-right">LTP</th>
                <th className="border-r border-gray-700 p-1 font-normal text-right">IV</th>
                <th className="p-1 font-normal text-right text-gray-600">DIFF</th>
              </tr>
            </thead>
            <tbody>
              {filteredStrikes.map(s => {
                const isAtm = s.strikePrice === atmStrike;
                const isCEZone = s.strikePrice >= atmStrike;
                
                return (
                  <tr key={s.strikePrice} className={`border-b border-gray-800 ${isAtm ? 'bg-blue-600/30' : ''}`}>
                    <td className={`border-r border-gray-800 p-1 font-bold ${isCEZone ? 'text-emerald-500 bg-emerald-950/20' : 'text-orange-500 bg-orange-950/20'} ${isAtm ? 'bg-blue-600/40 text-white' : ''}`}>
                      {isCEZone ? 'CE' : 'PE'}
                    </td>
                    <td className={`border-r border-gray-800 p-1 font-bold ${isAtm ? 'text-white bg-blue-600/40' : ''}`}>
                      {s.strikePrice}
                    </td>
                    <td className={`border-r border-gray-800 p-1 text-right text-white ${isAtm ? 'bg-blue-600/40' : ''}`}>
                      {(isCEZone ? s.CE?.ltp : s.PE?.ltp)?.toFixed(2) || '#N/A'}
                    </td>
                    <td className={`border-r border-gray-800 p-1 text-right text-amber-500/70 ${isAtm ? 'bg-blue-600/40' : ''}`}>
                      {(isCEZone ? s.CE?.iv : s.PE?.iv)?.toFixed(1) || '0.0'}
                    </td>
                    <td className={`p-1 text-right text-gray-600 ${isAtm ? 'bg-blue-600/40' : ''}`}>
                      {Math.abs(s.strikePrice - atmStrike)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Middle Panel: Back Spread Matrix */}
        <div className="shrink-0 border-r border-gray-700 bg-[#0c0f18]">
          <table className="border-collapse">
            <thead className="sticky top-0 bg-[#2d2d2d] z-20">
              <tr className="border-b border-gray-600 bg-blue-900/10">
                <th colSpan={DISTANCES.length} className="p-1 border-r border-gray-700 text-blue-400 text-center">BACK SPREAD MATRIX (Ratio)</th>
              </tr>
              <tr className="border-b border-gray-600">
                {DISTANCES.map(d => <th key={d} className="border-r border-gray-700 p-1 font-normal w-12 text-center">{d}</th>)}
              </tr>
              <tr className="border-b border-gray-600 bg-[#1a1a1a]">
                {DISTANCES.map(d => <th key={d} className="border-r border-gray-700 p-1 font-normal text-gray-500 text-center">1</th>)}
              </tr>
              <tr className="border-b border-gray-600 bg-[#1a1a1a]">
                {DISTANCES.map((d, i) => (
                  <th key={d} className="border-r border-gray-700 p-0 text-center">
                    <input 
                      type="text" 
                      value={backRatios[i]} 
                      onChange={e => handleRatioChange('back', i, e.target.value)}
                      className="w-full bg-transparent text-amber-500 text-center font-bold outline-none border-none h-full py-1 focus:bg-amber-500/10"
                      aria-label={`Back Spread Ratio for ${d} distance`}
                      title={`Back Spread Ratio for ${d} distance`}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStrikes.map(s => {
                const isAtm = s.strikePrice === atmStrike;
                return (
                  <tr key={s.strikePrice} className={`border-b border-gray-800 ${isAtm ? 'bg-blue-600/30' : ''}`}>
                    {DISTANCES.map((d, i) => {
                      const isCE = s.strikePrice >= atmStrike;
                      const sellStrike = isCE ? s.strikePrice + d : s.strikePrice - d;
                      const sellLeg = data.chain.strikes.find(x => x.strikePrice === sellStrike);
                      const sellRatio = backRatios[i];
                      let netPremium = 0;
                      let detailText = "";
                      let isValid = false;

                      if (sellLeg && data) {
                        const buyLTP = isCE ? (s.CE?.ltp || 0) : (s.PE?.ltp || 0);
                        const sellLTP = isCE ? (sellLeg.CE?.ltp || 0) : (sellLeg.PE?.ltp || 0);
                        if (buyLTP > 0 && sellLTP > 0) {
                          isValid = true;
                          netPremium = (sellRatio * sellLTP) - (1 * buyLTP);
                          detailText = `Buy ${s.strikePrice} ${isCE ? 'CE' : 'PE'} x1 @ ${buyLTP.toFixed(2)}\nSell ${sellStrike} ${isCE ? 'CE' : 'PE'} x${sellRatio} @ ${sellLTP.toFixed(2)}\nNet: ₹${netPremium.toFixed(2)}`;
                        }
                      }
                      return (
                        <td 
                          key={d} 
                          title={detailText}
                          className={`border-r border-gray-800 p-1 text-center w-12 cursor-help transition-colors ${isValid ? (netPremium > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400') : 'text-gray-800'} ${isAtm ? 'bg-blue-600/20' : ''}`}
                        >
                          {isValid ? `₹${Math.round(netPremium)}` : '#N/A'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right Panel: Front Spread Matrix */}
        <div className="shrink-0 bg-[#0c1811]">
          <table className="border-collapse">
            <thead className="sticky top-0 bg-[#2d2d2d] z-20">
              <tr className="border-b border-gray-600 bg-emerald-900/10">
                <th colSpan={DISTANCES.length} className="p-1 border-r border-gray-700 text-emerald-400 text-center">FRONT SPREAD MATRIX (Aggressive)</th>
              </tr>
              <tr className="border-b border-gray-600">
                {DISTANCES.map(d => <th key={d} className="border-r border-gray-700 p-1 font-normal w-12 text-center">{d}</th>)}
              </tr>
              <tr className="border-b border-gray-600 bg-[#1a1a1a]">
                {DISTANCES.map(d => <th key={d} className="border-r border-gray-700 p-1 font-normal text-gray-500 text-center">1</th>)}
              </tr>
              <tr className="border-b border-gray-600 bg-[#1a1a1a]">
                {DISTANCES.map((d, i) => (
                  <th key={d} className="border-r border-gray-700 p-0 text-center">
                    <input 
                      type="text" 
                      value={frontRatios[i]} 
                      onChange={e => handleRatioChange('front', i, e.target.value)}
                      className="w-full bg-transparent text-red-500/80 text-center font-bold outline-none border-none h-full py-1 focus:bg-red-500/10"
                      aria-label={`Front Spread Ratio for ${d} distance`}
                      title={`Front Spread Ratio for ${d} distance`}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStrikes.map(s => {
                const isAtm = s.strikePrice === atmStrike;
                return (
                  <tr key={s.strikePrice} className={`border-b border-gray-800 ${isAtm ? 'bg-blue-600/30' : ''}`}>
                    {DISTANCES.map((d, i) => {
                      const isCE = s.strikePrice >= atmStrike;
                      const sellStrike = isCE ? s.strikePrice + d : s.strikePrice - d;
                      const sellLeg = data.chain.strikes.find(x => x.strikePrice === sellStrike);
                      const sellRatio = frontRatios[i];
                      let netPremium = 0;
                      let detailText = "";
                      let isValid = false;

                      if (sellLeg && data) {
                        const buyLTP = isCE ? (s.CE?.ltp || 0) : (s.PE?.ltp || 0);
                        const sellLTP = isCE ? (sellLeg.CE?.ltp || 0) : (sellLeg.PE?.ltp || 0);
                        if (buyLTP > 0 && sellLTP > 0) {
                          isValid = true;
                          netPremium = (sellRatio * sellLTP) - (1 * buyLTP);
                          detailText = `Buy ${s.strikePrice} ${isCE ? 'CE' : 'PE'} x1 @ ${buyLTP.toFixed(2)}\nSell ${sellStrike} ${isCE ? 'CE' : 'PE'} x${sellRatio} @ ${sellLTP.toFixed(2)}\nNet: ₹${netPremium.toFixed(2)}`;
                        }
                      }
                      return (
                        <td 
                          key={d} 
                          title={detailText}
                          className={`border-r border-gray-800 p-1 text-center w-12 cursor-help transition-colors ${isValid ? (netPremium > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400') : 'text-gray-800'} ${isAtm ? 'bg-blue-600/20' : ''}`}
                        >
                          {isValid ? `₹${Math.round(netPremium)}` : '#N/A'}
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

      <div className="bg-[#004b20] text-white px-2 py-0.5 text-[9px] shrink-0 flex justify-between">
        <div className="flex gap-3 items-center">
          <span className="font-bold">READY</span>
          <span className="opacity-70">|</span>
          <span>CALCULATION: AUTOMATIC</span>
          <span className="opacity-70">|</span>
          <span className="text-emerald-400 text-[8px] border border-emerald-500/30 px-1 rounded">DYNAMIC RATIOS ENABLED</span>
        </div>
        <div className="flex gap-4 items-center">
          <span>UNDERLYING: {data.underlying_value}</span>
          <div className="h-3 w-px bg-white/20"></div>
          <span>ATM: {atmStrike}</span>
          <div className="h-3 w-px bg-white/20"></div>
          <span className="font-bold bg-white/10 px-1 rounded text-[8px]">PRO-MODE</span>
        </div>
      </div>
    </div>
  );
}
