import * as React from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "navy";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-muted text-slate-500 border-border-strong",
  green: "bg-green-100 text-green-700 border-green-700/20",
  amber: "bg-amber-100 text-amber-700 border-amber-700/20",
  red: "bg-red-100 text-red-700 border-red-700/20",
  blue: "bg-blue-100 text-navy-800 border-navy-800/10",
  navy: "bg-navy-900 text-white border-navy-900",
};

export function Badge({
  tone = "neutral",
  className,
  dot,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-medium leading-normal whitespace-nowrap",
        toneClasses[tone],
        className
      )}
      {...props}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColor(tone))} />}
      {children}
    </span>
  );
}

function dotColor(tone: Tone) {
  switch (tone) {
    case "green":
      return "bg-green-600";
    case "amber":
      return "bg-amber-600";
    case "red":
      return "bg-red-600";
    case "blue":
      return "bg-blue-600";
    case "navy":
      return "bg-white";
    default:
      return "bg-slate-400";
  }
}
