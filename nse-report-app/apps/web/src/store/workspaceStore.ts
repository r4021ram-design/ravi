import { create } from 'zustand';

export type FunctionCode = 'CC' | 'INTEL' | 'OMON' | 'IVSURF' | 'CHART' | 'OIHEAT' | 'TREND' | 'HELP' | 'REPORT' | 'STRAT' | 'SPREAD';

export interface Tab {
  id: string;
  title: string;
  type: FunctionCode;
  symbol?: string;
}

interface WorkspaceState {
  tabs: Tab[];
  activeTabId: string | null;
  commandHistory: string[];
  isCommandBarFocused: boolean;
  isSidebarOpen: boolean;
  
  // Actions
  addTab: (type: FunctionCode, symbol?: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  setCommandBarFocused: (focused: boolean) => void;
  toggleSidebar: () => void;
  executeCommand: (cmdStr: string) => void;
}

const generateTabId = (type: string, symbol?: string) => {
  return symbol ? `${symbol}_${type}` : type;
};

const getTabTitle = (type: string, symbol?: string) => {
  if (symbol) return `${symbol} ${type}`;
  if (type === 'CC') return 'Command Center';
  if (type === 'HELP') return 'Help';
  if (type === 'REPORT') return 'Full Report';
  if (type === 'STRAT') return 'Strategy Builder';
  return type;
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  tabs: [{ id: 'CC', title: 'Command Center', type: 'CC' }],
  activeTabId: 'CC',
  commandHistory: [],
  isCommandBarFocused: false,
  isSidebarOpen: true,

  addTab: (type, symbol) => {
    set((state) => {
      const id = generateTabId(type, symbol);
      const existingTabIndex = state.tabs.findIndex((t) => t.id === id);
      
      if (existingTabIndex >= 0) {
        return { activeTabId: id };
      }

      const newTab: Tab = { id, title: getTabTitle(type, symbol), type, symbol };
      return { 
        tabs: [...state.tabs, newTab],
        activeTabId: id
      };
    });
  },

  closeTab: (id) => {
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== id);
      // If we closed the last tab, maybe open CC by default or just null
      if (newTabs.length === 0) {
        return { tabs: [{ id: 'CC', title: 'Command Center', type: 'CC' }], activeTabId: 'CC' };
      }
      // If we closed the active tab, make the last tab active
      let newActiveId = state.activeTabId;
      if (state.activeTabId === id) {
        newActiveId = newTabs[newTabs.length - 1].id;
      }
      return { tabs: newTabs, activeTabId: newActiveId };
    });
  },

  setActiveTab: (id) => {
    set({ activeTabId: id });
  },

  setCommandBarFocused: (focused) => {
    set({ isCommandBarFocused: focused });
  },

  toggleSidebar: () => {
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
  },

  executeCommand: (cmdStr) => {
    const rawCmd = cmdStr.trim().toUpperCase();
    if (!rawCmd) return;

    set((state) => {
      const newHistory = [rawCmd, ...state.commandHistory.filter(c => c !== rawCmd)].slice(0, 50);
      return { commandHistory: newHistory };
    });

    const parts = rawCmd.split(/\s+/);
    
    // Parse logic:
    // If 1 word: might be a global command like "CC", "HELP" or a ticker like "NIFTY" (defaults to INTEL)
    if (parts.length === 1) {
      const word = parts[0];
      const globalCommands: FunctionCode[] = ['CC', 'HELP', 'REPORT', 'STRAT'];
      if (globalCommands.includes(word as FunctionCode)) {
        get().addTab(word as FunctionCode);
      } else {
        // Assume it's a ticker, default to INTEL
        get().addTab('INTEL', word);
      }
      return;
    }

    // If 2 words: [SYMBOL] [CMD]
    if (parts.length === 2) {
      const [symbol, cmd] = parts;
      const validCommands: FunctionCode[] = ['INTEL', 'OMON', 'IVSURF', 'CHART', 'OIHEAT', 'TREND', 'SPREAD'];
      if (validCommands.includes(cmd as FunctionCode)) {
        get().addTab(cmd as FunctionCode, symbol);
      } else {
        console.warn(`Unknown command: ${cmd}`);
      }
      return;
    }
  }
}));
