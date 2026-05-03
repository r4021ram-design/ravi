"use client";

import { X } from "lucide-react";
import { useWorkspaceStore } from "../store/workspaceStore";

export function WorkspaceTabs() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useWorkspaceStore();

  return (
    <div className="flex items-center gap-1 px-2 pt-2 bg-[#050810] overflow-x-auto no-scrollbar shrink-0 border-b border-white/5">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              group flex items-center gap-2 px-3 py-1.5 text-xs font-mono border-t border-x rounded-t cursor-pointer
              transition-colors select-none whitespace-nowrap
              ${isActive 
                ? "bg-[#0a0e1a] border-white/20 text-amber-500" 
                : "bg-[#050810] border-transparent text-gray-500 hover:bg-white/5 hover:text-gray-300"
              }
            `}
          >
            <span>{tab.title}</span>
            <button
              title="Close tab"
              aria-label="Close tab"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className={`
                p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all
                ${isActive ? "opacity-100 text-amber-500/70 hover:text-amber-400" : "text-gray-500"}
              `}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
