"use client";

import React from "react";
import { GitCommit, Plus, Minus, FileText, CheckCircle } from "lucide-react";

interface GitDiffViewerProps {
  title: string;
  oldContent: string;
  newContent: string;
  onRestoreRevision?: (content: string) => void;
}

export function GitDiffViewer({
  title,
  oldContent,
  newContent,
  onRestoreRevision,
}: GitDiffViewerProps) {
  const oldLines = oldContent ? oldContent.split("\n") : [];
  const newLines = newContent ? newContent.split("\n") : [];

  // Compute diff lines
  const diffLines: Array<{ type: "add" | "delete" | "same"; text: string; lineNoOld?: number; lineNoNew?: number }> = [];

  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (oldIdx < oldLines.length && newIdx < newLines.length && oldLines[oldIdx] === newLines[newIdx]) {
      diffLines.push({ type: "same", text: oldLines[oldIdx], lineNoOld: oldIdx + 1, lineNoNew: newIdx + 1 });
      oldIdx++;
      newIdx++;
    } else if (newIdx < newLines.length && (!oldLines.includes(newLines[newIdx]) || oldIdx >= oldLines.length)) {
      diffLines.push({ type: "add", text: newLines[newIdx], lineNoNew: newIdx + 1 });
      newIdx++;
    } else if (oldIdx < oldLines.length) {
      diffLines.push({ type: "delete", text: oldLines[oldIdx], lineNoOld: oldIdx + 1 });
      oldIdx++;
    } else {
      break;
    }
  }

  const additions = diffLines.filter((l) => l.type === "add").length;
  const deletions = diffLines.filter((l) => l.type === "delete").length;

  return (
    <div className="rounded-xl border border-emerald-200 bg-white shadow-md overflow-hidden text-xs font-mono my-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-950 text-emerald-200 border-b border-emerald-900">
        <div className="flex items-center gap-2 font-bold">
          <GitCommit className="h-4 w-4 text-emerald-400" />
          <span>Git Sync Diff: {title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-emerald-400 font-bold">+{additions}</span>
          <span className="text-rose-400 font-bold">-{deletions}</span>
          {onRestoreRevision && (
            <button
              onClick={() => onRestoreRevision(oldContent)}
              className="rounded bg-emerald-700 hover:bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white transition"
            >
              Restore Previous
            </button>
          )}
        </div>
      </div>

      {/* Diff Table */}
      <div className="divide-y divide-emerald-50 max-h-80 overflow-y-auto bg-slate-950 text-slate-200 font-mono text-[11px]">
        {diffLines.map((line, i) => (
          <div
            key={i}
            className={`flex items-start px-3 py-1 font-mono transition ${
              line.type === "add"
                ? "bg-emerald-950/70 text-emerald-300 border-l-4 border-emerald-500"
                : line.type === "delete"
                ? "bg-rose-950/70 text-rose-300 border-l-4 border-rose-500 line-through opacity-80"
                : "text-slate-400 hover:bg-slate-900"
            }`}
          >
            <span className="w-8 shrink-0 text-slate-600 select-none text-right pr-2">
              {line.lineNoOld || ""}
            </span>
            <span className="w-8 shrink-0 text-slate-600 select-none text-right pr-2">
              {line.lineNoNew || ""}
            </span>
            <span className="w-6 shrink-0 font-bold select-none text-center">
              {line.type === "add" ? "+" : line.type === "delete" ? "-" : " "}
            </span>
            <span className="whitespace-pre-wrap break-all flex-1">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
