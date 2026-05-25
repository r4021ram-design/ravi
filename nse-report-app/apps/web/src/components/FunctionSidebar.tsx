"use client";

import { useWorkspaceStore, FunctionCode } from "../store/workspaceStore";
import { 
  BarChart2, 
  Activity, 
  Layers, 
  Grid, 
  TrendingUp, 
  Zap,
  Layout,
  ChevronLeft,
  ChevronRight,
  Database
} from "lucide-react";

const FUNCTIONS: { code: FunctionCode; label: string; icon: any }[] = [
  { code: 'CHART', label: 'CHART', icon: BarChart2 },
  { code: 'INTEL', label: 'INTEL', icon: Zap },
  { code: 'IVSURF', label: 'IVSURF', icon: Activity },
  { code: 'OIHEAT', label: 'OIHEAT', icon: Grid },
  { code: 'OMON', label: 'OMON', icon: Layers },
  { code: 'SPREAD', label: 'SPREAD', icon: Database },
  { code: 'TREND', label: 'TREND', icon: TrendingUp },
];

export function FunctionSidebar() {
  const { tabs, activeTabId, addTab, isSidebarOpen, toggleSidebar } = useWorkspaceStore();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const symbol = activeTab?.symbol;

  if (!symbol) return null;

  return (
    <div className={`flex flex-col border-r border-gray-800 bg-[#0a0e1a] transition-all duration-300 ease-in-out relative ${isSidebarOpen ? 'w-48' : 'w-12'}`}>
      {/* Toggle Button */}
      <button 
        onClick={toggleSidebar}
        className="absolute -right-3 top-10 bg-blue-600 text-white rounded-full p-0.5 z-50 hover:bg-blue-500 transition-colors border border-blue-400/50 shadow-lg"
      >
        {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      <div className="p-3 border-b border-gray-800 flex items-center justify-center overflow-hidden h-14 shrink-0">
        <span className={`font-black text-amber-500 truncate transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100 text-base' : 'opacity-0 w-0'}`}>
          {symbol}
        </span>
        {!isSidebarOpen && <span className="text-amber-500 text-xs font-bold">{symbol.substring(0, 1)}</span>}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
        {FUNCTIONS.map((func) => {
          const isActive = activeTab?.type === func.code;
          const Icon = func.icon;

          return (
            <button
              key={func.code}
              onClick={() => addTab(func.code, symbol)}
              className={`w-full flex items-center gap-3 px-3 py-3 transition-all group relative ${
                isActive 
                  ? 'bg-blue-600/10 text-blue-400 border-r-2 border-blue-500' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <div className={`shrink-0 ${isActive ? 'text-blue-400' : 'group-hover:text-blue-400 transition-colors'}`}>
                <Icon size={20} />
              </div>
              
              <span className={`text-[15px] md:text-[16px] font-black tracking-widest transition-all duration-200 ${
                isSidebarOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'
              }`}>
                {func.label}
              </span>

              {/* Tooltip for collapsed state */}
              {!isSidebarOpen && (
                <div className="absolute left-14 bg-[#1e1e1e] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-100 whitespace-nowrap border border-gray-700 shadow-xl">
                  {func.label}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-2 border-t border-gray-800 shrink-0">
        <div className={`bg-[#1a1a1a] rounded p-2 flex flex-col items-center justify-center gap-1 transition-all ${isSidebarOpen ? 'h-auto' : 'h-10'}`}>
          <Layout size={14} className="text-gray-600" />
          {isSidebarOpen && <span className="text-[9px] text-gray-600 font-bold">TERMINAL v2.0</span>}
        </div>
      </div>
    </div>
  );
}
