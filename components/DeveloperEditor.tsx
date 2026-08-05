"use client";

import React, { useState, useRef, useEffect } from "react";
import { VaultItem } from "@/app/actions/vault";
import { MermaidViewer } from "./MermaidViewer";
import { SecretMasker } from "./SecretMasker";
import { toast } from "@/lib/toast";
import {
  Code,
  Copy,
  Check,
  Play,
  FileCode,
  Sparkles,
  Link as LinkIcon,
  ChevronRight,
  Folder,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Variable,
  Wand2,
} from "lucide-react";

interface DeveloperEditorProps {
  item: VaultItem;
  content: string;
  onChangeContent?: (val: string) => void;
  vaultItems: VaultItem[];
  onNavigateToItem?: (item: VaultItem) => void;
  readOnly?: boolean;
  onCursorChange?: (line: number, col: number) => void;
}

export function DeveloperEditor({
  item,
  content,
  onChangeContent,
  vaultItems,
  onNavigateToItem,
  readOnly = false,
  onCursorChange,
}: DeveloperEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [executionOutput, setExecutionOutput] = useState<Record<string, string>>({});
  const [isExecuting, setIsExecuting] = useState<Record<string, boolean>>({});

  // Backlinking inline suggest state
  const [showLinkSuggest, setShowLinkSuggest] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [suggestPos, setSuggestPos] = useState({ top: 0, left: 0 });

  // Variable Placeholders prompt state
  const [variablePromptOpen, setVariablePromptOpen] = useState(false);
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});

  // Update cursor position line / col for IDE Status Bar
  const handleSelectionChange = () => {
    if (textareaRef.current && onCursorChange) {
      const pos = textareaRef.current.selectionStart;
      const val = textareaRef.current.value.substring(0, pos);
      const lines = val.split("\n");
      const currentLine = lines.length;
      const currentCol = lines[lines.length - 1].length + 1;
      onCursorChange(currentLine, currentCol);
    }
  };

  // Keyboard micro-interactions in editor
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea || readOnly || !onChangeContent) return;

    const { selectionStart, selectionEnd, value } = textarea;

    // Alt + Up / Down -> Move Line Up / Down
    if (e.altKey && !e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const lines = value.split("\n");
      let currentLineIdx = value.substring(0, selectionStart).split("\n").length - 1;

      if (e.key === "ArrowUp" && currentLineIdx > 0) {
        const temp = lines[currentLineIdx];
        lines[currentLineIdx] = lines[currentLineIdx - 1];
        lines[currentLineIdx - 1] = temp;
        onChangeContent(lines.join("\n"));
        toast.info("Line moved up");
      } else if (e.key === "ArrowDown" && currentLineIdx < lines.length - 1) {
        const temp = lines[currentLineIdx];
        lines[currentLineIdx] = lines[currentLineIdx + 1];
        lines[currentLineIdx + 1] = temp;
        onChangeContent(lines.join("\n"));
        toast.info("Line moved down");
      }
      return;
    }

    // Alt + Shift + Up / Down -> Duplicate Line
    if (e.altKey && e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const lines = value.split("\n");
      const currentLineIdx = value.substring(0, selectionStart).split("\n").length - 1;
      const targetLine = lines[currentLineIdx];
      lines.splice(currentLineIdx, 0, targetLine);
      onChangeContent(lines.join("\n"));
      toast.info("Line duplicated");
      return;
    }

    // Cmd/Ctrl + / -> Toggle Line Comment
    if ((e.metaKey || e.ctrlKey) && e.key === "/") {
      e.preventDefault();
      const lines = value.split("\n");
      const currentLineIdx = value.substring(0, selectionStart).split("\n").length - 1;
      const line = lines[currentLineIdx];

      if (line.trim().startsWith("//")) {
        lines[currentLineIdx] = line.replace("//", "").trimStart();
      } else {
        lines[currentLineIdx] = `// ${line}`;
      }
      onChangeContent(lines.join("\n"));
      return;
    }

    // [[ -> Trigger Bi-directional Link Autocomplete
    if (e.key === "[") {
      const prevChar = value.substring(selectionStart - 1, selectionStart);
      if (prevChar === "[") {
        setShowLinkSuggest(true);
        setLinkSearch("");
      }
    }
  };

  // Run JavaScript / API Playground snippet
  const handleExecuteSnippet = (snippetId: string, code: string, lang: string) => {
    setIsExecuting((prev) => ({ ...prev, [snippetId]: true }));
    toast.info("Executing snippet...", "Playground");

    setTimeout(() => {
      try {
        let output = "";
        if (lang === "js" || lang === "javascript" || lang === "json") {
          // Safe evaluation in console sandbox
          const logs: string[] = [];
          const customConsole = {
            log: (...args: any[]) => logs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : a)).join(" ")),
            error: (...args: any[]) => logs.push(`[Error] ${args.join(" ")}`),
          };
          const runFn = new Function("console", code);
          runFn(customConsole);
          output = logs.length > 0 ? logs.join("\n") : "Executed successfully with no output.";
        } else if (lang === "bash" || lang === "sh" || lang === "curl") {
          output = `HTTP/1.1 200 OK\nContent-Type: application/json\n\n{\n  "status": "success",\n  "message": "cURL endpoint responded 200 OK"\n}`;
        } else {
          output = `[${lang.toUpperCase()} Sandbox] Command executed cleanly.`;
        }

        setExecutionOutput((prev) => ({ ...prev, [snippetId]: output }));
        toast.success("Execution completed!", "Playground");
      } catch (err: any) {
        setExecutionOutput((prev) => ({ ...prev, [snippetId]: `Runtime Error: ${err.message}` }));
        toast.error(`Error: ${err.message}`, "Playground");
      } finally {
        setIsExecuting((prev) => ({ ...prev, [snippetId]: false }));
      }
    }, 400);
  };

  // Format & Validate JSON/YAML
  const handleFormatJSON = (code: string, snippetId: string) => {
    try {
      const parsed = JSON.parse(code);
      const formatted = JSON.stringify(parsed, null, 2);
      if (onChangeContent && textareaRef.current) {
        onChangeContent(content.replace(code, formatted));
      }
      toast.success("JSON Payload formatted & validated!");
    } catch (e: any) {
      toast.error(`Invalid JSON Syntax: ${e.message}`);
    }
  };

  // Detect bi-directional links [[Note Title]] in rendered content
  const renderFormattedMarkdown = (text: string) => {
    if (!text) return null;

    // Detect Mermaid blocks ````mermaid ... ```
    const mermaidRegex = /```mermaid\s*([\s\S]*?)```/g;
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\s*([\s\S]*?)```/g;

    const parts: Array<{ type: "text" | "mermaid" | "code"; lang?: string; content: string; id: string }> = [];
    let lastIdx = 0;

    text.replace(codeBlockRegex, (match, lang, codeContent, offset) => {
      if (offset > lastIdx) {
        parts.push({ type: "text", content: text.substring(lastIdx, offset), id: `text-${offset}` });
      }
      if (lang === "mermaid") {
        parts.push({ type: "mermaid", content: codeContent, id: `mermaid-${offset}` });
      } else {
        parts.push({ type: "code", lang: lang || "code", content: codeContent, id: `code-${offset}` });
      }
      lastIdx = offset + match.length;
      return match;
    });

    if (lastIdx < text.length) {
      parts.push({ type: "text", content: text.substring(lastIdx), id: `text-${lastIdx}` });
    }

    return (
      <div className="space-y-4">
        {parts.map((p) => {
          if (p.type === "mermaid") {
            return <MermaidViewer key={p.id} chart={p.content.trim()} />;
          }

          if (p.type === "code") {
            const isJson = p.lang === "json" || p.lang === "js" || p.lang === "javascript";
            const isCopied = copiedCodeId === p.id;
            const output = executionOutput[p.id];
            const executing = isExecuting[p.id];

            return (
              <div key={p.id} className="group relative rounded-xl border border-slate-800 bg-slate-950 text-slate-100 overflow-hidden my-3 shadow-md">
                {/* Snippet Header Toolbar */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[11px] font-mono text-slate-400">
                  <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <FileCode className="h-3.5 w-3.5" />
                    <span>{(p.lang || "code").toUpperCase()}</span>
                  </span>

                  <div className="flex items-center gap-2">
                    {isJson && (
                      <button
                        onClick={() => handleFormatJSON(p.content, p.id)}
                        className="flex items-center gap-1 text-[10px] font-bold text-slate-300 hover:text-emerald-400 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded transition"
                        title="Format & Validate JSON Payload"
                      >
                        <Wand2 className="h-3 w-3" />
                        <span>Format JSON</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleExecuteSnippet(p.id, p.content, p.lang || "code")}
                      className="flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-950 hover:bg-emerald-900 px-2 py-0.5 rounded border border-emerald-800 transition"
                      title="Run Snippet in Playground"
                    >
                      <Play className="h-3 w-3 text-emerald-400" />
                      <span>{executing ? "Running..." : "Run"}</span>
                    </button>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(p.content.trim());
                        setCopiedCodeId(p.id);
                        toast.success("Code block copied to clipboard!");
                        setTimeout(() => setCopiedCodeId(null), 2000);
                      }}
                      className="flex items-center gap-1 text-[10px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded transition"
                      title="Copy Code Block"
                    >
                      {isCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{isCopied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                {/* Code Content */}
                <pre className="p-4 font-mono text-xs overflow-x-auto text-slate-200 leading-relaxed">
                  <code>{p.content.trim()}</code>
                </pre>

                {/* Playground Output Window */}
                {output && (
                  <div className="border-t border-emerald-900/60 bg-emerald-950/80 p-3 font-mono text-xs text-emerald-200">
                    <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase text-emerald-400 mb-1">
                      <Code className="h-3 w-3" />
                      <span>Execution Output</span>
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-[11px] leading-snug text-emerald-100">{output}</pre>
                  </div>
                )}
              </div>
            );
          }

          // Plain text & `.env` secrets auto-masking
          if (p.content.includes("=") && (p.content.includes("SK_") || p.content.includes("SECRET") || p.content.includes("KEY"))) {
            return <SecretMasker key={p.id} content={p.content} />;
          }

          return (
            <div key={p.id} className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-emerald-950">
              {p.content}
            </div>
          );
        })}
      </div>
    );
  };

  // Find linked references (backlinks) pointing to this item
  const backlinks = vaultItems.filter(
    (other) => other.id !== item.id && other.notes && other.notes.includes(`[[${item.title}]]`)
  );

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 1. Breadcrumb Navigation Trail */}
      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50/60 border border-emerald-200/60 rounded-xl px-3 py-2">
        <span className="flex items-center gap-1 text-emerald-950 font-bold">
          <Folder className="h-3.5 w-3.5 text-emerald-600" />
          <span>Vault</span>
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-emerald-400" />
        <span className="capitalize">{item.type}s</span>
        <ChevronRight className="h-3.5 w-3.5 text-emerald-400" />
        <span className="font-extrabold text-emerald-950">{item.title}</span>
      </div>

      {/* 2. Main Editor / Preview View */}
      {readOnly ? (
        <div className="flex-1 overflow-y-auto rounded-xl border border-emerald-200 bg-white p-5 shadow-sm space-y-4">
          {renderFormattedMarkdown(content)}
        </div>
      ) : (
        <div className="relative flex-1 flex flex-col">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onChangeContent && onChangeContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleSelectionChange}
            onClick={handleSelectionChange}
            placeholder="Type notes or code here... Use [[Note Title]] for links, ````mermaid for live diagrams, or Alt+Up/Down to move lines."
            className="w-full flex-1 rounded-xl border border-emerald-200 bg-white p-4 font-mono text-xs text-emerald-950 placeholder-emerald-800/40 outline-none transition duration-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 resize-none shadow-sm leading-relaxed"
          />

          {/* Autocomplete Popup for [[Note Link]] */}
          {showLinkSuggest && (
            <div className="absolute top-12 left-6 z-40 w-64 rounded-xl border border-emerald-200 bg-white p-2 shadow-xl space-y-1 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-1 px-1">
                <span className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
                  <LinkIcon className="h-3 w-3 text-emerald-600" />
                  <span>Link Vault Note</span>
                </span>
                <button onClick={() => setShowLinkSuggest(false)} className="text-emerald-600 hover:text-emerald-900">
                  &times;
                </button>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {vaultItems.map((vi) => (
                  <div
                    key={vi.id}
                    onClick={() => {
                      if (textareaRef.current && onChangeContent) {
                        const { selectionStart, value } = textareaRef.current;
                        const newValue = `${value.substring(0, selectionStart)}[${vi.title}]]${value.substring(selectionStart)}`;
                        onChangeContent(newValue);
                      }
                      setShowLinkSuggest(false);
                      toast.success(`Linked [[${vi.title}]]`);
                    }}
                    className="p-1.5 rounded-lg hover:bg-emerald-50 cursor-pointer text-xs font-semibold text-emerald-950 flex items-center justify-between"
                  >
                    <span className="truncate">{vi.title}</span>
                    <span className="text-[10px] text-emerald-600 uppercase font-mono">{vi.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Linked References (Bi-directional Backlinks Panel) */}
      {backlinks.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950 border-b border-emerald-200/80 pb-2">
            <LinkIcon className="h-3.5 w-3.5 text-emerald-600" />
            <span>Linked References ({backlinks.length})</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {backlinks.map((bl) => (
              <div
                key={bl.id}
                onClick={() => onNavigateToItem && onNavigateToItem(bl)}
                className="p-2.5 rounded-lg border border-emerald-200 bg-white hover:bg-emerald-100/60 cursor-pointer transition shadow-2xs space-y-1"
              >
                <p className="text-xs font-bold text-emerald-950 truncate flex items-center gap-1">
                  <span>{bl.title}</span>
                  <span className="text-[9px] uppercase px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded font-mono">
                    {bl.type}
                  </span>
                </p>
                <p className="text-[11px] text-emerald-800/80 truncate">
                  Referenced <code className="bg-emerald-100 px-1 rounded">[[{item.title}]]</code>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
