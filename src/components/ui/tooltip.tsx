"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Tooltip({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-xs -translate-x-1/2 rounded-md bg-navy-950 px-2.5 py-1.5 text-[12px] leading-snug text-white shadow-lg"
        >
          {label}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-navy-950" />
        </span>
      )}
    </span>
  );
}
