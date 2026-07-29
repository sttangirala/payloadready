"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 border-b border-border", className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "relative px-3 py-2 text-[13px] font-medium transition-colors",
            value === t.value ? "text-navy-950" : "text-slate-500 hover:text-navy-800"
          )}
        >
          <span className="flex items-center gap-1.5">
            {t.label}
            {typeof t.count === "number" && (
              <span className="rounded-full bg-surface-muted px-1.5 py-px text-[11px] text-slate-500">{t.count}</span>
            )}
          </span>
          {value === t.value && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-navy-900" />}
        </button>
      ))}
    </div>
  );
}
