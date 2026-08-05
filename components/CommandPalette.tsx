"use client";

import React, { useState, useEffect, useRef } from "react";
import { VaultItem } from "@/app/actions/vault";
import {
  Command,
  Search,
  Hash,
  AtSign,
  FileText,
  Key,
  Folder,
  Lock,
  Sparkles,
  Layers,
  Download,
  Maximize2,
  Trash2,
  HelpCircle,
  X,
  ChevronRight,
} from "lucide-react";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: VaultItem[];
  onSelectItem: (item: VaultItem) => void;
  onRunAction: (actionId: string) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  items,
  onSelectItem,
  onRunAction,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // System actions list for `>` mode
  const systemActions = [
    { id: "lock", label: "Quick Lock Vault (Cmd/Ctrl + L)", icon: <Lock className="h-4 w-4 text-emerald-600" /> },
    { id: "zen", label: "Toggle Zen / Focus Mode (Cmd/Ctrl + Shift + Z)", icon: <Maximize2 className="h-4 w-4 text-emerald-600" /> },
    { id: "theme-glass", label: "Switch Theme: Glassmorphism", icon: <Sparkles className="h-4 w-4 text-emerald-600" /> },
    { id: "theme-neo", label: "Switch Theme: Neomorphism", icon: <Layers className="h-4 w-4 text-emerald-600" /> },
    { id: "theme-clay", label: "Switch Theme: Claymorphism", icon: <Layers className="h-4 w-4 text-emerald-600" /> },
    { id: "cheatsheet", label: "Open Keyboard Shortcuts Cheatsheet (?)", icon: <HelpCircle className="h-4 w-4 text-emerald-600" /> },
    { id: "export", label: "Export Vault Metadata & Audit Log", icon: <Download className="h-4 w-4 text-emerald-600" /> },
  ];

  // Parse mode & prefix
  let mode: "all" | "command" | "tag" | "symbol" | "line" = "all";
  let searchStr = query.trim();

  if (query.startsWith(">")) {
    mode = "command";
    searchStr = query.substring(1).trim();
  } else if (query.startsWith("#")) {
    mode = "tag";
    searchStr = query.substring(1).trim();
  } else if (query.startsWith("@")) {
    mode = "symbol";
    searchStr = query.substring(1).trim();
  } else if (query.startsWith(":")) {
    mode = "line";
    searchStr = query.substring(1).trim();
  }

  // Filter items based on mode
  let filteredResults: Array<{ id: string; type: string; title: string; subtitle?: string; raw?: any }> = [];

  if (mode === "command") {
    filteredResults = systemActions
      .filter((a) => a.label.toLowerCase().includes(searchStr.toLowerCase()))
      .map((a) => ({ id: a.id, type: "action", title: a.label, raw: a }));
  } else if (mode === "tag") {
    // Search items matching tag in notes or title
    filteredResults = items
      .filter((item) => {
        const text = `${item.title} ${item.notes || ""}`;
        return text.toLowerCase().includes(`#${searchStr.toLowerCase()}`) || text.toLowerCase().includes(searchStr.toLowerCase());
      })
      .map((item) => ({ id: item.id, type: item.type, title: item.title, subtitle: `Tag match • ${item.type}`, raw: item }));
  } else if (mode === "symbol") {
    // Heading symbol search
    filteredResults = items
      .filter((item) => item.title.toLowerCase().includes(searchStr.toLowerCase()))
      .map((item) => ({ id: item.id, type: "symbol", title: `@ ${item.title}`, subtitle: `Jump to heading in ${item.title}`, raw: item }));
  } else if (mode === "line") {
    // Line number jump
    const lineNo = parseInt(searchStr, 10) || 1;
    filteredResults = [
      { id: "jump-line", type: "line", title: `Jump to Line ${lineNo}`, subtitle: "Navigate directly to line number in active editor", raw: lineNo },
    ];
  } else {
    // Default Vault Item Search
    filteredResults = items
      .filter((item) => {
        const str = `${item.title} ${item.file_name || ""} ${item.username || ""} ${item.notes || ""}`.toLowerCase();
        return str.includes(searchStr.toLowerCase());
      })
      .slice(0, 15)
      .map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        subtitle: item.type === "document" ? item.file_name || "Document" : item.type === "password" ? item.username || "Password" : "Secret Note",
        raw: item,
      }));

    // Add top system commands at end of default search if query matches
    const matchingActions = systemActions.filter((a) => a.label.toLowerCase().includes(searchStr.toLowerCase()));
    matchingActions.forEach((a) => {
      filteredResults.push({ id: a.id, type: "action", title: a.label, raw: a });
    });
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredResults.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredResults.length) % Math.max(1, filteredResults.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredResults.length > 0 && selectedIndex < filteredResults.length) {
        const item = filteredResults[selectedIndex];
        if (item.type === "action") {
          onRunAction(item.id);
        } else {
          onSelectItem(item.raw);
        }
        onClose();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const getItemIcon = (type: string) => {
    if (type === "folder") return <Folder className="h-4 w-4 text-emerald-600" />;
    if (type === "password" || type === "credential") return <Key className="h-4 w-4 text-amber-600" />;
    if (type === "action") return <Command className="h-4 w-4 text-sky-600" />;
    if (type === "symbol") return <AtSign className="h-4 w-4 text-indigo-600" />;
    if (type === "line") return <Hash className="h-4 w-4 text-emerald-600" />;
    return <FileText className="h-4 w-4 text-emerald-700" />;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 bg-emerald-950/40 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-2xl glass-panel border border-emerald-200/80 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search Input Field */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-emerald-100 bg-white">
          {mode === "command" ? (
            <Command className="h-5 w-5 text-sky-600 animate-pulse" />
          ) : mode === "tag" ? (
            <Hash className="h-5 w-5 text-amber-600" />
          ) : mode === "symbol" ? (
            <AtSign className="h-5 w-5 text-indigo-600" />
          ) : mode === "line" ? (
            <Hash className="h-5 w-5 text-emerald-600" />
          ) : (
            <Search className="h-5 w-5 text-emerald-600" />
          )}

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search... ('>' command, '#' tag, '@' heading, ':' line)"
            className="w-full bg-transparent text-sm font-semibold text-emerald-950 placeholder-emerald-800/40 outline-none"
          />

          <button onClick={onClose} className="p-1 text-emerald-700 hover:text-emerald-950 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Badges */}
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-50/60 border-b border-emerald-100 text-[11px] font-bold text-emerald-800">
          <span className="text-emerald-900 font-extrabold uppercase tracking-wider text-[10px]">Prefixes:</span>
          <button onClick={() => setQuery("> ")} className={`px-2 py-0.5 rounded border transition ${mode === "command" ? "bg-sky-600 text-white border-sky-600" : "bg-white border-emerald-200 hover:bg-emerald-100"}`}>
            &gt; Commands
          </button>
          <button onClick={() => setQuery("# ")} className={`px-2 py-0.5 rounded border transition ${mode === "tag" ? "bg-amber-600 text-white border-amber-600" : "bg-white border-emerald-200 hover:bg-emerald-100"}`}>
            # Tags
          </button>
          <button onClick={() => setQuery("@ ")} className={`px-2 py-0.5 rounded border transition ${mode === "symbol" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-emerald-200 hover:bg-emerald-100"}`}>
            @ Headings
          </button>
          <button onClick={() => setQuery(": ")} className={`px-2 py-0.5 rounded border transition ${mode === "line" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-emerald-200 hover:bg-emerald-100"}`}>
            : Line
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-emerald-50/50">
          {filteredResults.length === 0 ? (
            <div className="p-8 text-center text-xs font-medium text-emerald-800/70">
              No matching items or commands found. Try <code className="bg-emerald-100 px-1 rounded">&gt; theme</code> or <code className="bg-emerald-100 px-1 rounded">#secret</code>.
            </div>
          ) : (
            filteredResults.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                onClick={() => {
                  if (item.type === "action") {
                    onRunAction(item.id);
                  } else {
                    onSelectItem(item.raw);
                  }
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition text-xs font-semibold ${
                  selectedIndex === idx ? "bg-emerald-700 text-white shadow-md shadow-emerald-700/20" : "hover:bg-emerald-50 text-emerald-950"
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg border shrink-0 ${selectedIndex === idx ? "bg-emerald-600 border-emerald-500 text-white" : "bg-emerald-50 border-emerald-100"}`}>
                    {getItemIcon(item.type)}
                  </div>
                  <div className="truncate">
                    <p className="truncate font-bold">{item.title}</p>
                    {item.subtitle && <p className={`text-[10px] truncate ${selectedIndex === idx ? "text-emerald-200" : "text-emerald-800/70"}`}>{item.subtitle}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <ChevronRight className={`h-4 w-4 ${selectedIndex === idx ? "text-emerald-200" : "text-emerald-400"}`} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-emerald-50/80 border-t border-emerald-100 text-[11px] text-emerald-800 font-medium flex items-center justify-between">
          <span>
            Use <kbd className="px-1.5 py-0.5 bg-white border border-emerald-200 rounded font-mono text-[10px] font-bold">↑</kbd> <kbd className="px-1.5 py-0.5 bg-white border border-emerald-200 rounded font-mono text-[10px] font-bold">↓</kbd> to navigate, <kbd className="px-1.5 py-0.5 bg-white border border-emerald-200 rounded font-mono text-[10px] font-bold">Enter</kbd> to select
          </span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-emerald-200 rounded font-mono text-[10px] font-bold">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
