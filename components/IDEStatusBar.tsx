"use client";

import React from "react";
import { Terminal, FileCode, HelpCircle, ShieldCheck, Lock, Maximize2 } from "lucide-react";

interface IDEStatusBarProps {
  text: string;
  cursorPos?: { line: number; col: number };
  languageMode?: string;
  onOpenCheatsheet: () => void;
  onToggleZen: () => void;
  isZenMode: boolean;
}

export function IDEStatusBar({
  text,
  cursorPos = { line: 1, col: 1 },
  languageMode = "Markdown",
  onOpenCheatsheet,
  onToggleZen,
  isZenMode,
}: IDEStatusBarProps) {
  const words = text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const chars = text ? text.length : 0;

  return (
    <footer className="sticky bottom-0 z-50 h-7 w-full border-t border-emerald-950/40 bg-emerald-950 text-xs sm:text-sm font-mono font-bold text-emerald-300 flex items-center justify-between px-4 shrink-0 select-none shadow-lg">
      {/* Left Items */}
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1 text-emerald-400 font-bold">
          <Terminal className="h-3 w-3 text-emerald-400" />
          <span>VAULT_IDE</span>
        </span>
        <span className="hidden sm:inline-block text-emerald-500/40">|</span>
        <span className="flex items-center gap-1.5">
          <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
        </span>
        <span className="hidden sm:inline-block text-emerald-500/40">|</span>
        <span className="hidden sm:inline-block">
          {words} words &bull; {chars} chars
        </span>
      </div>

      {/* Right Items */}
      <div className="flex items-center gap-3">
        <span className="hidden md:flex items-center gap-1 text-emerald-400/90">
          <ShieldCheck className="h-3 w-3 text-emerald-400" />
          <span>AES-GCM-256</span>
        </span>
        <span className="hidden md:inline-block text-emerald-500/40">|</span>
        <span className="hidden sm:flex items-center gap-1">
          <FileCode className="h-3 w-3 text-emerald-400" />
          <span>{languageMode}</span>
        </span>
        <span className="hidden sm:inline-block text-emerald-500/40">|</span>
        <span>UTF-8 (LF)</span>

        <button
          onClick={onToggleZen}
          className={`px-1.5 py-0.5 rounded transition ${
            isZenMode ? "bg-emerald-600 text-white font-bold" : "hover:text-emerald-100 hover:bg-emerald-900/60"
          }`}
          title="Toggle Focus / Zen Mode (Cmd/Ctrl + Shift + Z)"
        >
          <Maximize2 className="h-3 w-3" />
        </button>

        <button
          onClick={onOpenCheatsheet}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:text-emerald-100 hover:bg-emerald-900/60 transition"
          title="Keyboard Shortcuts Cheatsheet (?)"
        >
          <HelpCircle className="h-3 w-3 text-emerald-400" />
          <span className="font-bold">?</span>
        </button>
      </div>
    </footer>
  );
}
