"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 transition-opacity ${open ? "opacity-100 pointer-events-auto" : "pointer-events-none opacity-0"}`}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-navy-950/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`absolute right-0 top-0 h-full w-full max-w-xl border-l border-border bg-surface shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</div>}
            <div className="mt-0.5 truncate text-[15px] font-semibold text-navy-950">{title}</div>
          </div>
          <button onClick={onClose} aria-label="Close panel" className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-surface-muted hover:text-navy-800">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-[calc(100%-57px-1px)] overflow-y-auto px-5 py-4 pb-24">{children}</div>
        {footer && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
