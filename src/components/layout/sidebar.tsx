"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Rocket,
  ListChecks,
  FolderCheck,
  AlertTriangle,
  GitPullRequestArrow,
  FileText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMissionChecklist, useMissionIssues } from "@/lib/store";
import { overdueItems } from "@/lib/readiness";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/missions", label: "Missions", icon: Rocket },
  { href: "/checklist", label: "Readiness Checklist", icon: ListChecks },
  { href: "/evidence", label: "Evidence", icon: FolderCheck },
  { href: "/issues", label: "Issues", icon: AlertTriangle },
  { href: "/decisions", label: "Decisions", icon: GitPullRequestArrow },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const items = useMissionChecklist();
  const issues = useMissionIssues();
  const overdueCount = overdueItems(items).length;
  const criticalIssueCount = issues.filter((i) => i.severity === "critical" && i.state !== "resolved").length;

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border bg-navy-950 text-white print:hidden">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/20">
          <Rocket className="h-3.5 w-3.5 text-blue-400" />
        </div>
        <span className="text-[14px] font-semibold tracking-tight">PayloadReady</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const badge =
            href === "/checklist" && overdueCount > 0
              ? overdueCount
              : href === "/issues" && criticalIssueCount > 0
              ? criticalIssueCount
              : undefined;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
            >
              <span className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </span>
              {badge !== undefined && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-3">
        <p className="text-[11px] leading-snug text-white/35">
          Coordination &amp; readiness tracking only. Not a certification of flightworthiness or launch approval.
        </p>
      </div>
    </aside>
  );
}
