"use client";

import React, { useEffect, useRef, useState } from "react";
import { GitBranch, RefreshCw, AlertCircle } from "lucide-react";

interface MermaidViewerProps {
  chart: string;
}

export function MermaidViewer({ chart }: MermaidViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function renderMermaid() {
      try {
        setLoading(true);
        setError(null);
        // Dynamically import mermaid on the client
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default;

        mermaid.initialize({
          startOnLoad: false,
          theme: "forest",
          securityLevel: "loose",
          fontFamily: "monospace",
        });

        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);

        if (isMounted) {
          setSvgContent(svg);
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to render Mermaid diagram");
          setLoading(false);
        }
      }
    }

    if (chart) {
      renderMermaid();
    }

    return () => {
      isMounted = false;
    };
  }, [chart]);

  return (
    <div className="my-4 rounded-xl border border-emerald-200 bg-emerald-950/5 p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-emerald-200/50 pb-2 mb-3">
        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
          <GitBranch className="h-4 w-4 text-emerald-600" />
          <span>Live Architecture Diagram (Mermaid)</span>
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8 text-xs font-bold text-emerald-800 gap-2">
          <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
          <span>Rendering Architecture Chart...</span>
        </div>
      ) : error ? (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-mono flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="flex justify-center overflow-x-auto p-2"
          dangerouslySetInnerHTML={{ __html: svgContent || "" }}
        />
      )}
    </div>
  );
}
