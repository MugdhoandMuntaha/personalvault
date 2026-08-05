"use client";

import React, { useState } from "react";
import { Eye, EyeOff, Copy, Check, ShieldAlert } from "lucide-react";
import { toast } from "@/lib/toast";

interface SecretMaskerProps {
  content: string;
}

// Regex patterns to detect sensitive API keys, tokens, and passwords
const SECRET_REGEX = /(sk_live_[a-zA-Z0-9]{24,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|Bearer\s+[a-zA-Z0-9\-\._~\+\/]+=*|eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+|-----BEGIN[A-Z\s]+PRIVATE KEY-----[\s\S]+?-----END[A-Z\s]+PRIVATE KEY-----|[A-Z0-9_]{3,}=(?!\s*$)[^\n\r]+)/g;

export function SecretMasker({ content }: SecretMaskerProps) {
  const [revealedKeys, setRevealedKeys] = useState<Record<number, boolean>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!content) return null;

  const lines = content.split("\n");

  return (
    <div className="font-mono text-xs space-y-1 bg-slate-950 text-slate-100 p-4 rounded-xl border border-emerald-900/40 shadow-inner overflow-x-auto">
      {lines.map((line, lineIdx) => {
        const isEnvKey = line.includes("=") && !line.startsWith("#");

        if (isEnvKey) {
          const eqIdx = line.indexOf("=");
          const keyName = line.substring(0, eqIdx);
          const rawVal = line.substring(eqIdx + 1);

          const isRevealed = revealedKeys[lineIdx];

          return (
            <div key={lineIdx} className="flex items-center justify-between group hover:bg-slate-900/80 px-2 py-1 rounded transition">
              <div className="flex items-center gap-2 truncate">
                <span className="text-emerald-400 font-bold">{keyName}=</span>
                <span className="font-mono text-slate-300">
                  {isRevealed ? rawVal : "••••••••••••••••••••••••"}
                </span>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                <button
                  type="button"
                  onClick={() => setRevealedKeys((prev) => ({ ...prev, [lineIdx]: !prev[lineIdx] }))}
                  className="p-1 text-slate-400 hover:text-emerald-300 transition"
                  title={isRevealed ? "Hide Secret" : "Reveal Secret"}
                >
                  {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(rawVal);
                    setCopiedIndex(lineIdx);
                    toast.success("Secret copied to clipboard!", keyName);
                    setTimeout(() => setCopiedIndex(null), 2000);
                  }}
                  className="p-1 text-slate-400 hover:text-emerald-300 transition"
                  title="Copy Secret Value"
                >
                  {copiedIndex === lineIdx ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          );
        }

        return (
          <div key={lineIdx} className="px-2 py-0.5 text-slate-400">
            {line}
          </div>
        );
      })}
    </div>
  );
}
