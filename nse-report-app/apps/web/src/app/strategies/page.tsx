"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

const STRATEGIES = [
  { id: "iron_condor", name: "Iron Condor", legs: 4, type: "Neutral" },
  { id: "straddle", name: "Long Straddle", legs: 2, type: "Volatile" },
  { id: "strangle", name: "Long Strangle", legs: 2, type: "Volatile" },
  { id: "bull_call", name: "Bull Call Spread", legs: 2, type: "Bullish" },
  { id: "bear_put", name: "Bear Put Spread", legs: 2, type: "Bearish" },
  { id: "covered_call", name: "Covered Call", legs: 2, type: "Neutral/Bullish" },
];

interface Leg {
  type: "CE" | "PE";
  action: "BUY" | "SELL";
  strike: number;
  premium: number;
  lots: number;
}

function getDefaultLegs(strategyId: string, spot: number): Leg[] {
  const step = spot > 40000 ? 100 : 50;
  const atm = Math.round(spot / step) * step;

  switch (strategyId) {
    case "iron_condor":
      return [
        { type: "CE", action: "SELL", strike: atm + step * 4, premium: 80, lots: 1 },
        { type: "CE", action: "BUY", strike: atm + step * 8, premium: 30, lots: 1 },
        { type: "PE", action: "SELL", strike: atm - step * 4, premium: 75, lots: 1 },
        { type: "PE", action: "BUY", strike: atm - step * 8, premium: 25, lots: 1 },
      ];
    case "straddle":
      return [
        { type: "CE", action: "BUY", strike: atm, premium: 150, lots: 1 },
        { type: "PE", action: "BUY", strike: atm, premium: 145, lots: 1 },
      ];
    case "strangle":
      return [
        { type: "CE", action: "BUY", strike: atm + step * 3, premium: 60, lots: 1 },
        { type: "PE", action: "BUY", strike: atm - step * 3, premium: 55, lots: 1 },
      ];
    case "bull_call":
      return [
        { type: "CE", action: "BUY", strike: atm, premium: 150, lots: 1 },
        { type: "CE", action: "SELL", strike: atm + step * 4, premium: 80, lots: 1 },
      ];
    case "bear_put":
      return [
        { type: "PE", action: "BUY", strike: atm, premium: 145, lots: 1 },
        { type: "PE", action: "SELL", strike: atm - step * 4, premium: 75, lots: 1 },
      ];
    case "covered_call":
      return [
        { type: "CE", action: "SELL", strike: atm + step * 3, premium: 60, lots: 1 },
        { type: "CE", action: "BUY", strike: atm, premium: 0, lots: 1 },
      ];
    default:
      return [];
  }
}

function calcPayoff(legs: Leg[], price: number, lotSize: number): number {
  let pnl = 0;
  for (const leg of legs) {
    const dir = leg.action === "BUY" ? 1 : -1;
    let intrinsic = 0;
    if (leg.type === "CE") intrinsic = Math.max(0, price - leg.strike);
    else intrinsic = Math.max(0, leg.strike - price);
    pnl += (intrinsic - leg.premium) * dir * leg.lots * lotSize;
  }
  return pnl;
}

export default function StrategiesPage() {
  const [selectedStrategy, setSelectedStrategy] = useState("iron_condor");
  const [spot, setSpot] = useState(24000);
  const [lotSize, setLotSize] = useState(25);
  const [legs, setLegs] = useState<Leg[]>(() => getDefaultLegs("iron_condor", 24000));

  const strategy = STRATEGIES.find(s => s.id === selectedStrategy)!;

  function handleStrategyChange(id: string) {
    setSelectedStrategy(id);
    setLegs(getDefaultLegs(id, spot));
  }

  function updateLeg(index: number, field: keyof Leg, value: number | string) {
    setLegs(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  }

  // Calculate payoff curve
  const payoffData = useMemo(() => {
    const step = spot > 40000 ? 100 : 50;
    const range = step * 20;
    const points = [];
    for (let p = spot - range; p <= spot + range; p += step) {
      points.push({ price: p, pnl: calcPayoff(legs, p, lotSize) });
    }
    return points;
  }, [legs, spot, lotSize]);

  const maxProfit = Math.max(...payoffData.map(p => p.pnl));
  const maxLoss = Math.min(...payoffData.map(p => p.pnl));
  const breakevens = payoffData.filter((p, i, arr) => {
    if (i === 0) return false;
    return (arr[i - 1].pnl < 0 && p.pnl >= 0) || (arr[i - 1].pnl >= 0 && p.pnl < 0);
  }).map(p => p.price);

  const netPremium = legs.reduce((sum, l) => {
    const dir = l.action === "BUY" ? -1 : 1;
    return sum + l.premium * dir * l.lots * lotSize;
  }, 0);

  // Chart scaling
  const chartHeight = 200;
  const maxAbs = Math.max(Math.abs(maxProfit), Math.abs(maxLoss), 1);

  return (
    <div className="max-w-[1100px] mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Dashboard</Link>
      </div>

      <h1 className="text-2xl font-bold mb-1">
        <span className="gradient-text">Strategy Builder</span>
      </h1>
      <p className="text-sm text-gray-500 mb-6">Simulate options strategies with interactive P/L diagrams</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Controls */}
        <div className="space-y-4">
          {/* Strategy Selector */}
          <div className="glass-card p-4">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Strategy</h3>
            <div className="grid grid-cols-2 gap-2">
              {STRATEGIES.map(s => (
                <button key={s.id} onClick={() => handleStrategyChange(s.id)}
                  className={`p-2 rounded-lg text-xs font-medium text-left transition-all ${
                    selectedStrategy === s.id
                      ? "bg-blue-600 text-white"
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                  }`}>
                  <div>{s.name}</div>
                  <div className={`text-[10px] mt-0.5 ${
                    selectedStrategy === s.id ? "text-blue-200" : "text-gray-600"
                  }`}>{s.type}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Parameters */}
          <div className="glass-card p-4">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Parameters</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Spot Price</label>
                <input type="number" value={spot} onChange={e => { setSpot(Number(e.target.value)); setLegs(getDefaultLegs(selectedStrategy, Number(e.target.value))); }}
                  className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Lot Size</label>
                <input type="number" value={lotSize} onChange={e => setLotSize(Number(e.target.value))}
                  className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>

          {/* Legs Editor */}
          <div className="glass-card p-4">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Legs</h3>
            <div className="space-y-3">
              {legs.map((leg, i) => (
                <div key={i} className="bg-white/5 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      leg.action === "BUY" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                    }`}>{leg.action}</span>
                    <span className="text-xs text-gray-400">{leg.type}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-600">Strike</label>
                      <input type="number" value={leg.strike} onChange={e => updateLeg(i, "strike", Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-600">Premium</label>
                      <input type="number" value={leg.premium} onChange={e => updateLeg(i, "premium", Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Chart + Metrics */}
        <div className="lg:col-span-2 space-y-4">
          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-card p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Max Profit</div>
              <div className="text-lg font-bold text-emerald-400 font-mono">
                ₹{maxProfit.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Max Loss</div>
              <div className="text-lg font-bold text-red-400 font-mono">
                ₹{maxLoss.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Net Premium</div>
              <div className={`text-lg font-bold font-mono ${netPremium >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                ₹{netPremium.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="glass-card p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">Breakevens</div>
              <div className="text-sm font-bold font-mono text-blue-400">
                {breakevens.length > 0 ? breakevens.map(b => b.toLocaleString()).join(" / ") : "—"}
              </div>
            </div>
          </div>

          {/* Payoff Chart (SVG) */}
          <div className="glass-card p-5">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-4">Payoff Diagram</h3>
            <div className="relative" style={{ height: chartHeight + 60 }}>
              <svg width="100%" height={chartHeight + 40} viewBox={`0 0 ${payoffData.length * 20} ${chartHeight + 40}`} className="overflow-visible">
                {/* Zero line */}
                <line x1="0" y1={chartHeight / 2 + 10} x2={payoffData.length * 20} y2={chartHeight / 2 + 10}
                  stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4" />

                {/* P/L area */}
                <path d={
                  payoffData.map((p, i) => {
                    const x = i * 20;
                    const y = (chartHeight / 2 + 10) - (p.pnl / maxAbs) * (chartHeight / 2 - 10);
                    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                  }).join(" ") +
                  ` L ${(payoffData.length - 1) * 20} ${chartHeight / 2 + 10} L 0 ${chartHeight / 2 + 10} Z`
                } fill="url(#payoff-gradient)" opacity="0.3" />

                {/* P/L line */}
                <path d={
                  payoffData.map((p, i) => {
                    const x = i * 20;
                    const y = (chartHeight / 2 + 10) - (p.pnl / maxAbs) * (chartHeight / 2 - 10);
                    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                  }).join(" ")
                } fill="none" stroke="#3b82f6" strokeWidth="2" />

                {/* Spot marker */}
                {(() => {
                  const spotIdx = payoffData.findIndex(p => p.price >= spot);
                  if (spotIdx < 0) return null;
                  const x = spotIdx * 20;
                  return (
                    <line x1={x} y1={0} x2={x} y2={chartHeight + 10}
                      stroke="#f59e0b" strokeWidth="1" strokeDasharray="4" />
                  );
                })()}

                {/* X-axis labels (every 5th) */}
                {payoffData.map((p, i) => i % 5 === 0 ? (
                  <text key={i} x={i * 20} y={chartHeight + 35} textAnchor="middle" fontSize="8" fill="#64748b">
                    {p.price}
                  </text>
                ) : null)}

                {/* Gradient definition */}
                <defs>
                  <linearGradient id="payoff-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="50%" stopColor="transparent" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 text-[10px] text-emerald-400 font-mono">
                +₹{maxProfit.toLocaleString()}
              </div>
              <div className="absolute left-0 bottom-8 text-[10px] text-red-400 font-mono">
                -₹{Math.abs(maxLoss).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Risk/Reward */}
          <div className="glass-card p-4">
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Risk / Reward Summary</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full"
                  style={{ width: `${Math.min(100, (maxProfit / (maxProfit + Math.abs(maxLoss))) * 100)}%` }} />
              </div>
              <span className="text-xs text-gray-400 font-mono whitespace-nowrap">
                R:R {maxLoss !== 0 ? (maxProfit / Math.abs(maxLoss)).toFixed(2) : "∞"}:1
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
