"use client";

import React from "react";
import { Command, Keyboard, X, Sparkles, Terminal, Code, Lock } from "lucide-react";

interface CheatsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CheatsheetModal({ isOpen, onClose }: CheatsheetModalProps) {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: "Global Navigation & Command Palette",
      icon: <Command className="h-4 w-4 text-emerald-600" />,
      items: [
        { keys: ["Cmd/Ctrl", "K"], label: "Open Command Palette / Quick Open" },
        { keys: ["Cmd/Ctrl", "Shift", "F"], label: "Global Codebase & Vault Search" },
        { keys: ["Cmd/Ctrl", "B"], label: "Toggle Sidebar Collapse / Expand" },
        { keys: ["Cmd/Ctrl", "\\"], label: "Split Editor View (Side-by-Side Spec)" },
        { keys: ["Ctrl", "Tab"], label: "Quick Switcher (Recent Notes Cycle)" },
        { keys: ["Cmd/Ctrl", "L"], label: "Quick Lock Cloud Vault" },
        { keys: ["Cmd/Ctrl", "Shift", "Z"], label: "Toggle Zen / Focus Mode" },
      ],
    },
    {
      title: "Command Palette Prefixes (Inside Cmd+K)",
      icon: <Terminal className="h-4 w-4 text-emerald-600" />,
      items: [
        { keys: [">"], label: "Run System Commands (Theme, Lock, Export)" },
        { keys: ["#"], label: "Filter Vault by Tag (e.g. #api, #secret)" },
        { keys: ["@"], label: "Jump to Heading / Symbol in current document" },
        { keys: [":"], label: "Jump directly to Line Number (e.g. :42)" },
      ],
    },
    {
      title: "IDE Editor & Micro-Interactions",
      icon: <Code className="h-4 w-4 text-emerald-600" />,
      items: [
        { keys: ["Alt", "Up / Down"], label: "Move Line Up / Down" },
        { keys: ["Alt", "Shift", "Up / Down"], label: "Duplicate Line Above / Below" },
        { keys: ["Cmd/Ctrl", "D"], label: "Multi-Cursor / Select Next Match" },
        { keys: ["Cmd/Ctrl", "/"], label: "Toggle Code / Comment" },
        { keys: ["Cmd/Ctrl", "Shift", "V"], label: "Paste as Plain Unformatted Text" },
        { keys: ["[["], label: "Bi-directional Note Link Autocomplete" },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-emerald-950/40 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-2xl glass-panel p-6 space-y-5 border border-emerald-200 bg-white shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200">
              <Keyboard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-emerald-950">Keyboard Shortcuts Cheatsheet</h3>
              <p className="text-xs text-emerald-800/70">Master keyboard-first vault productivity</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-950 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shortcutGroups.map((group, idx) => (
            <div key={idx} className={`rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3 ${idx === 0 ? "md:col-span-2" : ""}`}>
              <div className="flex items-center gap-2 font-bold text-xs text-emerald-950 border-b border-emerald-100/80 pb-2">
                {group.icon}
                <span>{group.title}</span>
              </div>
              <div className="space-y-2">
                {group.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-emerald-900">
                    <span className="font-medium">{item.label}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {item.keys.map((k, ki) => (
                        <kbd key={ki} className="rounded-md border border-emerald-200 bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-950 shadow-xs">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-emerald-100 text-xs text-emerald-800/70">
          <span>Press <kbd className="px-1.5 py-0.5 bg-emerald-100 border border-emerald-200 rounded font-mono text-[10px] font-bold">Esc</kbd> or <kbd className="px-1.5 py-0.5 bg-emerald-100 border border-emerald-200 rounded font-mono text-[10px] font-bold">?</kbd> to close</span>
          <button
            onClick={onClose}
            className="rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
