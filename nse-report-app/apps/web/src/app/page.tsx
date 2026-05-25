"use client";

import { useWorkspaceStore } from "../store/workspaceStore";
import { CommandBar } from "../components/CommandBar";
import { WorkspaceTabs } from "../components/WorkspaceTabs";
import { FunctionSidebar } from "../components/FunctionSidebar";
import { MobileNav } from "../components/MobileNav";

// Functions
import { CC } from "../functions/CC";
import { INTEL } from "../functions/INTEL";
import { OMON } from "../functions/OMON";
import { IVSURF } from "../functions/IVSURF";
import { CHART } from "../functions/CHART";
import { OIHEAT } from "../functions/OIHEAT";
import { TREND } from "../functions/TREND";
import { SPREAD } from "../functions/SPREAD";

export default function TerminalWorkspace() {
  const { tabs, activeTabId } = useWorkspaceStore();

  const activeTab = tabs.find(t => t.id === activeTabId);

  const renderActiveFunction = () => {
    if (!activeTab) {
      return (
        <div className="flex-1 flex items-center justify-center text-gray-500 font-mono text-sm">
          <div className="text-center">
            <div className="text-lg text-amber-500 mb-2">NSE TERMINAL</div>
            <div className="mb-4">TYPE A COMMAND IN THE BAR ABOVE</div>
            <div className="text-[10px] text-gray-600 space-y-1">
              <div>CC — Command Center (Market Overview)</div>
              <div>NIFTY OMON — Options Monitor</div>
              <div>NIFTY INTEL — Intelligence Scorecard</div>
              <div>NIFTY IVSURF — IV Surface &amp; Skew</div>
              <div>NIFTY CHART — Price Chart with Technicals</div>
              <div>NIFTY OIHEAT — OI Heatmap (Multi-Expiry)</div>
              <div>NIFTY TREND — Historical Trends (PCR/OI/IV)</div>
              <div>NIFTY SPREAD — Ratio Spread Matrix (Excel Style)</div>
            </div>
          </div>
        </div>
      );
    }

    switch (activeTab.type) {
      case 'CC':
        return <CC />;
      case 'INTEL':
        return <INTEL symbol={activeTab.symbol || 'NIFTY'} />;
      case 'OMON':
        return <OMON symbol={activeTab.symbol || 'NIFTY'} />;
      case 'IVSURF':
        return <IVSURF symbol={activeTab.symbol || 'NIFTY'} />;
      case 'CHART':
        return <CHART symbol={activeTab.symbol || 'NIFTY'} />;
      case 'OIHEAT':
        return <OIHEAT symbol={activeTab.symbol || 'NIFTY'} />;
      case 'TREND':
        return <TREND symbol={activeTab.symbol || 'NIFTY'} />;
      case 'SPREAD':
        return <SPREAD symbol={activeTab.symbol || 'NIFTY'} />;
      default:
        return <div className="p-4 text-gray-500 font-mono">FUNCTION [{activeTab.type}] NOT IMPLEMENTED YET.</div>;
    }
  };

  return (
    <div className="flex flex-col min-h-svh w-full bg-[#050810] text-gray-300 pb-16 md:pb-0">
      <CommandBar />
      <div className="hidden md:block">
        <WorkspaceTabs />
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="hidden md:block">
          <FunctionSidebar />
        </div>
        <main className="flex-1 overflow-y-auto md:overflow-hidden flex flex-col relative bg-[#0a0e1a]">
          {renderActiveFunction()}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

