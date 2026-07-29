"use client";

import Link from "next/link";
import { Plus, Rocket } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { calculateReadiness } from "@/lib/readiness";
import { formatDate, daysUntil } from "@/lib/utils";

export default function MissionsPage() {
  const missions = useStore((s) => s.missions);
  const checklistItems = useStore((s) => s.checklistItems);
  const setActiveMission = useStore((s) => s.setActiveMission);

  return (
    <div>
      <PageHeader
        title="Missions"
        description={`${missions.length} mission${missions.length === 1 ? "" : "s"} in this workspace`}
        actions={
          <a href="/onboarding">
            <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-navy-900 bg-navy-900 px-3.5 text-sm font-medium text-white hover:bg-navy-800">
              <Plus className="h-3.5 w-3.5" /> New mission
            </span>
          </a>
        }
      />
      <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
        {missions.map((m) => {
          const items = checklistItems.filter((i) => i.missionId === m.id);
          const readiness = calculateReadiness(items);
          return (
            <Link key={m.id} href={`/missions/${m.id}`} onClick={() => setActiveMission(m.id)}>
              <Card className="h-full p-4 transition-colors hover:border-border-strong">
                <div className="flex items-start justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-100">
                    <Rocket className="h-4 w-4 text-navy-800" />
                  </div>
                  <Badge tone={readiness.score >= 80 ? "green" : readiness.score >= 55 ? "amber" : "red"}>{readiness.score}% ready</Badge>
                </div>
                <div className="mt-3 text-[14.5px] font-semibold text-navy-950">{m.name}</div>
                <div className="text-[12.5px] text-slate-500">
                  {m.payloadName} · {m.formFactor ?? m.missionType}
                </div>
                <div className="mt-3 space-y-1 text-[12px] text-slate-500">
                  <div>
                    Integration <span className="font-medium text-navy-800">{formatDate(m.integrationDate)}</span> ({daysUntil(m.integrationDate)}d)
                  </div>
                  <div>Phase: {m.phase}</div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
