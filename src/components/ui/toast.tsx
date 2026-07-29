"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
}

const ToastContext = React.createContext<{ push: (t: Omit<ToastItem, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const push = React.useCallback((t: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((cur) => [...cur, { ...t, id }]);
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "pointer-events-auto flex items-start gap-2.5 rounded-md border bg-surface p-3 shadow-lg",
                  t.kind === "success" && "border-green-700/20",
                  t.kind === "error" && "border-red-700/20",
                  t.kind === "info" && "border-border-strong"
                )}
              >
                {t.kind === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />}
                {t.kind === "error" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
                {t.kind === "info" && <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />}
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-navy-950">{t.title}</div>
                  {t.description && <div className="mt-0.5 text-[12.5px] text-slate-500">{t.description}</div>}
                </div>
                <button onClick={() => setToasts((cur) => cur.filter((x) => x.id !== t.id))} className="text-slate-400 hover:text-navy-800">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
