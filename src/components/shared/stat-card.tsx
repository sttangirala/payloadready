import * as React from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
  tooltip,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "green" | "amber" | "red";
  tooltip?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const toneText = tone === "green" ? "text-green-700" : tone === "amber" ? "text-amber-700" : tone === "red" ? "text-red-700" : "text-navy-950";
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wide text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
        {tooltip && (
          <Tooltip label={tooltip}>
            <Info className="h-3 w-3 text-slate-400" />
          </Tooltip>
        )}
      </div>
      <div className={cn("mt-1.5 text-2xl font-semibold tabular", toneText)}>{value}</div>
      {sub && <div className="mt-1 text-[12px] text-slate-500">{sub}</div>}
    </div>
  );
}
