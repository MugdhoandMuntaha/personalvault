"use client";

import React, { useEffect, useState } from "react";
import { toast, ToastMessage } from "@/lib/toast";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsubscribe = toast.subscribe((newToast) => {
      setToasts((prev) => [...prev, newToast]);

      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, newToast.duration || 3000);

      return () => clearTimeout(timer);
    });

    return unsubscribe;
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-10 right-5 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-xl backdrop-blur-md transition duration-200 animate-in fade-in slide-in-from-bottom-5 text-xs font-medium ${
            t.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-100"
              : t.type === "error"
              ? "bg-rose-950/90 border-rose-500/40 text-rose-100"
              : t.type === "warning"
              ? "bg-amber-950/90 border-amber-500/40 text-amber-100"
              : "bg-slate-900/90 border-slate-700/50 text-slate-100"
          }`}
        >
          <div className="mt-0.5 shrink-0">
            {t.type === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            {t.type === "error" && <AlertCircle className="h-4 w-4 text-rose-400" />}
            {t.type === "warning" && <AlertTriangle className="h-4 w-4 text-amber-400" />}
            {t.type === "info" && <Info className="h-4 w-4 text-sky-400" />}
          </div>

          <div className="flex-1 space-y-0.5">
            {t.title && <p className="font-bold text-xs leading-none">{t.title}</p>}
            <p className="opacity-90">{t.message}</p>
          </div>

          <button
            onClick={() => removeToast(t.id)}
            className="opacity-60 hover:opacity-100 transition shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
