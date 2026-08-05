"use client";

import React, { useState } from "react";
import {
  FolderOpen,
  Star,
  Archive,
  Trash2,
  FileText,
  File,
  Grid,
  FileImage,
  FileCode,
  Key,
  Home,
  Folder,
  PanelLeftClose,
  PanelLeft,
  Cpu,
  Activity,
  ChevronDown,
  ChevronRight,
  Terminal,
  ShieldCheck,
} from "lucide-react";

export type ActiveSection = "vault" | "favorites" | "archive" | "trash";

interface FuturisticSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeSection: ActiveSection;
  setActiveSection: (section: ActiveSection) => void;
  filterType: any;
  setFilterType: (filter: any) => void;
  filterCounts: Record<string, number>;
  currentFolderId: string | null;
  setCurrentFolderId: (id: string | null) => void;
  allFolders: Array<{ id: string; title: string; parent_id: string | null }>;
}

export function FuturisticSidebar({
  collapsed,
  onToggleCollapse,
  activeSection,
  setActiveSection,
  filterType,
  setFilterType,
  filterCounts,
  currentFolderId,
  setCurrentFolderId,
  allFolders,
}: FuturisticSidebarProps) {
  const [categoriesExpanded, setCategoriesExpanded] = useState(true);
  const [foldersExpanded, setFoldersExpanded] = useState(true);

  return (
    <aside
      className={`hidden lg:flex flex-col shrink-0 h-full transition-all duration-300 ease-in-out relative select-none ${
        collapsed ? "w-20" : "w-72"
      }`}
    >
      {/* Main Glass Panel Container - Theme-synced via .glass-panel */}
      <div className="glass-panel flex-1 flex flex-col p-3 border border-emerald-200/80 text-emerald-950 shadow-md overflow-hidden relative group">
        {/* Header & Control Bar */}
        <div className="pb-2.5 border-b border-emerald-200/60 shrink-0">
          {!collapsed ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 shadow-2xs shrink-0">
                  <Cpu className="h-4 w-4 animate-pulse text-emerald-700" />
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-mono font-black uppercase tracking-widest text-emerald-950">
                      NODE-01
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono uppercase bg-emerald-100 text-emerald-800 font-extrabold border border-emerald-300">
                      ONLINE
                    </span>
                  </div>
                  <p className="text-xs font-bold text-emerald-800/80 truncate">PQC Zero-Knowledge</p>
                </div>
              </div>

              {/* Collapse Sidebar Button (Ctrl+B) */}
              <button
                onClick={onToggleCollapse}
                className="p-1.5 rounded-xl border border-emerald-200 bg-white/90 text-emerald-800 hover:bg-emerald-100/90 hover:border-emerald-300 transition shadow-2xs shrink-0"
                title="Collapse Sidebar (Ctrl+B)"
              >
                <PanelLeftClose className="h-4.5 w-4.5 text-emerald-700" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 w-full">
              {/* Node Badge Icon */}
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 shadow-2xs shrink-0">
                <Cpu className="h-4.5 w-4.5 animate-pulse text-emerald-700" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              </div>

              {/* Expand Sidebar Button (Ctrl+B) */}
              <button
                onClick={onToggleCollapse}
                className="h-9 w-9 flex items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-200 transition shadow-2xs shrink-0"
                title="Expand Sidebar (Ctrl+B)"
              >
                <PanelLeft className="h-4.5 w-4.5 text-emerald-800" />
              </button>
            </div>
          )}
        </div>

        {/* Hotkey Indicator Sub-bar (Expanded Only) */}
        {!collapsed && (
          <div className="my-2 py-1 px-2.5 bg-emerald-50/90 border border-emerald-200/70 rounded-xl flex items-center justify-between text-xs font-mono text-emerald-800 font-bold shadow-2xs">
            <span className="flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-emerald-600" />
              <span>IDE EXPLORER</span>
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-950 font-mono text-xs shadow-2xs font-extrabold">
              Ctrl+B
            </span>
          </div>
        )}

        {/* Screen-Fitted Navigation Body (No Scrollbars) */}
        <div className="flex-1 overflow-y-auto scrollbar-none py-1 space-y-2.5">
          {/* SECTION 1: VAULT VIEWS */}
          <div className="space-y-1">
            {!collapsed && (
              <p className="px-2 text-xs font-mono font-black uppercase tracking-widest text-emerald-950/80 mb-0.5">
                Vault Views
              </p>
            )}

            {[
              { id: "vault", label: "All Vault Items", icon: FolderOpen, color: "text-emerald-700", activeColor: "text-emerald-200" },
              { id: "favorites", label: "Starred Favorites", icon: Star, color: "text-amber-500 fill-amber-500", activeColor: "text-amber-300 fill-amber-300" },
              { id: "archive", label: "Document Archive", icon: Archive, color: "text-sky-600", activeColor: "text-sky-200" },
              { id: "trash", label: "Trash Bin", icon: Trash2, color: "text-rose-600", activeColor: "text-rose-200" },
            ].map((view) => {
              const IconComp = view.icon;
              const isActive = activeSection === view.id;

              if (collapsed) {
                return (
                  <div key={view.id} className="flex justify-center relative group">
                    <button
                      onClick={() => {
                        setActiveSection(view.id as ActiveSection);
                        if (view.id === "vault") setCurrentFolderId(null);
                      }}
                      className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all shadow-xs ${
                        isActive
                          ? "bg-emerald-800 text-white font-bold border border-emerald-700 scale-105 shadow-md"
                          : "text-emerald-900 hover:bg-emerald-100/80 hover:scale-105"
                      }`}
                    >
                      <IconComp className={`h-4.5 w-4.5 ${isActive ? view.activeColor : view.color}`} />
                    </button>
                    {/* Floating Hover Tooltip */}
                    <span className="absolute left-14 top-1.5 z-50 px-3 py-1.5 bg-emerald-950 text-white text-xs font-bold rounded-xl shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 whitespace-nowrap">
                      {view.label}
                    </span>
                  </div>
                );
              }

              return (
                <button
                  key={view.id}
                  onClick={() => {
                    setActiveSection(view.id as ActiveSection);
                    if (view.id === "vault") setCurrentFolderId(null);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-sm sm:text-base font-extrabold transition group relative ${
                    isActive
                      ? "bg-emerald-800 text-white shadow-sm"
                      : "text-emerald-950 hover:bg-emerald-100/70"
                  }`}
                >
                  <IconComp
                    className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? view.activeColor : view.color
                    }`}
                  />
                  <span className="truncate">{view.label}</span>
                </button>
              );
            })}
          </div>

          <div className="h-px bg-emerald-200/60 my-1" />

          {/* SECTION 2: FILE CATEGORIES */}
          <div className="space-y-1">
            {!collapsed ? (
              <div
                onClick={() => setCategoriesExpanded(!categoriesExpanded)}
                className="px-2 flex items-center justify-between text-xs font-mono font-black uppercase tracking-widest text-emerald-950/80 cursor-pointer hover:text-emerald-950 py-0.5"
              >
                <span>File Categories</span>
                {categoriesExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            ) : null}

            {(categoriesExpanded || collapsed) && (
              <div className="space-y-0.5">
                {[
                  { id: "all", label: "All Contents", icon: FolderOpen, count: filterCounts.all, color: "text-emerald-700" },
                  { id: "pdf", label: "PDF Documents", icon: FileText, count: filterCounts.pdf, color: "text-emerald-700" },
                  { id: "word", label: "Word Files", icon: FileText, count: filterCounts.word, color: "text-emerald-600" },
                  { id: "pptx", label: "PowerPoint", icon: File, count: filterCounts.pptx, color: "text-amber-600" },
                  { id: "excel", label: "Excel Sheets", icon: Grid, count: filterCounts.excel, color: "text-emerald-600" },
                  { id: "image", label: "Images", icon: FileImage, count: filterCounts.image, color: "text-purple-600" },
                  { id: "code", label: "Code & Scripts", icon: FileCode, count: filterCounts.code, color: "text-teal-700" },
                  { id: "password", label: "Logins & Passwords", icon: Key, count: filterCounts.password, color: "text-amber-700" },
                  { id: "note", label: "Secure Notes", icon: FileText, count: filterCounts.note, color: "text-emerald-600" },
                ].map((cat) => {
                  const IconComponent = cat.icon;
                  const isActive = filterType === cat.id;

                  if (collapsed) {
                    return (
                      <div key={cat.id} className="flex justify-center relative group">
                        <button
                          onClick={() => setFilterType(cat.id)}
                          className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all shadow-xs relative ${
                            isActive
                              ? "bg-emerald-800 text-white font-bold border border-emerald-700 scale-105 shadow-md"
                              : "text-emerald-900 hover:bg-emerald-100/80 hover:scale-105"
                          }`}
                        >
                          <IconComponent className={`h-4.5 w-4.5 ${isActive ? "text-emerald-300" : cat.color}`} />
                          {cat.count > 0 && (
                            <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-emerald-500 border border-white" />
                          )}
                        </button>
                        {/* Floating Hover Tooltip */}
                        <span className="absolute left-14 top-1.5 z-50 px-3 py-1.5 bg-emerald-950 text-white text-xs font-bold rounded-xl shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 whitespace-nowrap">
                          {cat.label} ({cat.count})
                        </span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={cat.id}
                      onClick={() => setFilterType(cat.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-extrabold transition ${
                        isActive
                          ? "bg-emerald-800 text-white shadow-xs"
                          : "text-emerald-950 hover:bg-emerald-100/70"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <IconComponent className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-emerald-300" : cat.color}`} />
                        <span className="truncate">{cat.label}</span>
                      </div>

                      <span
                        className={`text-xs font-mono font-black px-2 py-0.5 rounded-full ${
                          isActive
                            ? "bg-black/20 text-white"
                            : "bg-emerald-100/90 text-emerald-950 border border-emerald-200"
                        }`}
                      >
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="h-px bg-emerald-200/60 my-1" />

          {/* SECTION 3: DIRECTORY TREE */}
          {!collapsed && (
            <div className="space-y-1">
              <div
                onClick={() => setFoldersExpanded(!foldersExpanded)}
                className="px-2 flex items-center justify-between text-[10px] font-mono font-black uppercase tracking-widest text-emerald-950/80 cursor-pointer hover:text-emerald-950 py-0.5"
              >
                <span>Folder Navigation</span>
                {foldersExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </div>

              {foldersExpanded && (
                <div className="space-y-0.5">
                  <button
                    onClick={() => setCurrentFolderId(null)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
                      currentFolderId === null
                        ? "bg-emerald-100 text-emerald-950 font-extrabold border border-emerald-300 shadow-2xs"
                        : "text-emerald-950 hover:bg-emerald-100/70"
                    }`}
                  >
                    <Home className="h-4 w-4 text-emerald-700 shrink-0" />
                    <span className="truncate">Root Vault</span>
                  </button>

                  {allFolders.map((folder) => {
                    const isSelected = currentFolderId === folder.id;
                    return (
                      <button
                        key={folder.id}
                        onClick={() => setCurrentFolderId(folder.id)}
                        className={`w-full flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                          isSelected
                            ? "bg-emerald-100 text-emerald-950 font-extrabold border border-emerald-300 shadow-2xs"
                            : "text-emerald-900 hover:bg-emerald-100/70"
                        }`}
                      >
                        <Folder className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="truncate">{folder.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 4: SCI-FI HUD METRICS CARD (BOTTOM) */}
        {!collapsed ? (
          <div className="mt-2 p-2.5 rounded-xl border border-emerald-200/80 bg-white/80 backdrop-blur-xs text-[11px] font-mono space-y-1 shrink-0 shadow-2xs">
            <div className="flex items-center justify-between text-emerald-950 font-extrabold">
              <span className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                <span>VAULT HUD</span>
              </span>
              <span className="text-[9px] text-emerald-800/80 font-bold">v2.0</span>
            </div>

            <div className="space-y-0.5 text-[10px] text-emerald-900">
              <div className="flex justify-between">
                <span>ENCRYPTION:</span>
                <span className="font-bold text-emerald-700">AES-GCM-256</span>
              </div>
              <div className="flex justify-between">
                <span>POST-QUANTUM:</span>
                <span className="font-bold text-teal-700">ML-KEM-768</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex justify-center shrink-0">
            <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 shadow-2xs">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-700" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
