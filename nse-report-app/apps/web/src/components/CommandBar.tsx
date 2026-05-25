"use client";

import { useState, useEffect, useRef } from "react";
import { useWorkspaceStore } from "../store/workspaceStore";
import { Terminal } from "lucide-react";

export function CommandBar() {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [placeholder, setPlaceholder] = useState("ENTER COMMAND (e.g., NIFTY INTEL, CC, HELP) or press / to focus");
  
  const { executeCommand, commandHistory, setCommandBarFocused } = useWorkspaceStore();
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Set placeholder on mount to avoid hydration mismatch
  useEffect(() => {
    if (window.innerWidth < 768) {
      setPlaceholder("SEARCH...");
    }
  }, []);

  // Global shortcut to focus command bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (input.trim()) {
        executeCommand(input);
        setInput("");
        setHistoryIndex(-1);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const nextIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
        setHistoryIndex(nextIndex);
        setInput(commandHistory[nextIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIndex = historyIndex - 1;
        setHistoryIndex(nextIndex);
        setInput(commandHistory[nextIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput("");
      }
    } else if (e.key === "Escape") {
      inputRef.current?.blur();
      setCommandBarFocused(false);
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[#050810] border-b border-white/10 shrink-0">
      <Terminal size={18} className="text-amber-500" />
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          id="terminal-input"
          name="terminal-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          onFocus={() => setCommandBarFocused(true)}
          onBlur={() => setCommandBarFocused(false)}
          placeholder={placeholder}
          className="w-full bg-transparent text-amber-500 font-mono text-base md:text-lg placeholder:text-gray-600 outline-none uppercase py-2 md:py-3"
          autoComplete="off"
          spellCheck="false"
        />
      </div>
      <div className="text-xs text-gray-600 font-mono">
        NSE-INTEL
      </div>
    </div>
  );
}
