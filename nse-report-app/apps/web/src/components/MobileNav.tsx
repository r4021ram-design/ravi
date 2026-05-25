"use client";

import { useWorkspaceStore, FunctionCode } from "../store/workspaceStore";
import { 
  BarChart2, 
  Activity, 
  Layers, 
  Grid, 
  TrendingUp, 
  Zap,
  Database,
  Layout
} from "lucide-react";

const NAV_ITEMS: { code: FunctionCode; label: string; icon: any }[] = [
  { code: 'CC', label: 'Home', icon: Layout },
  { code: 'OMON', label: 'Options', icon: Layers },
  { code: 'CHART', label: 'Chart', icon: BarChart2 },
  { code: 'INTEL', label: 'Intel', icon: Zap },
  { code: 'OIHEAT', label: 'Heatmap', icon: Grid },
];

export function MobileNav() {
  const { tabs, activeTabId, addTab } = useWorkspaceStore();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const symbol = activeTab?.symbol || 'NIFTY';

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0e1a]/95 backdrop-blur-md border-t border-white/10 flex justify-around items-center h-16 px-2 z-50 pb-safe">
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab?.type === item.code;
        const Icon = item.icon;

        return (
          <button
            key={item.code}
            onClick={() => addTab(item.code, symbol)}
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${
              isActive ? 'text-blue-400' : 'text-gray-500'
            }`}
          >
            <Icon size={20} className={isActive ? 'animate-pulse' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">
              {item.label}
            </span>
            {isActive && (
              <div className="absolute bottom-0 w-8 h-1 bg-blue-500 rounded-t-full shadow-[0_-4px_12px_rgba(59,130,246,0.5)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
