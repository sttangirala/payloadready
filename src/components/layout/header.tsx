"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Check } from "lucide-react";
import { formatDate, daysUntil, cn } from "@/lib/utils";
import { useStore, useActiveMission, useUserById } from "@/lib/store";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function Header() {
  const router = useRouter();
  const mission = useActiveMission();
  const missions = useStore((s) => s.missions);
  const setActiveMission = useStore((s) => s.setActiveMission);
  const notifications = useStore((s) => s.notifications);
  const markAllNotificationsRead = useStore((s) => s.markAllNotificationsRead);
  const markNotificationRead = useStore((s) => s.markNotificationRead);
  const signOut = useStore((s) => s.signOut);
  const currentUser = useUserById(useStore((s) => s.currentUserId));

  const [missionMenu, setMissionMenu] = useState(false);
  const [notifMenu, setNotifMenu] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMissionMenu(false);
        setNotifMenu(false);
        setUserMenu(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!mission) return null;

  const unread = notifications.filter((n) => !n.read).length;
  const daysToIntegration = daysUntil(mission.integrationDate);

  return (
    <header ref={ref} className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-5 print:hidden">
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            onClick={() => setMissionMenu((v) => !v)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13.5px] font-semibold text-navy-950 hover:bg-surface-muted"
          >
            {mission.name}
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
          {missionMenu && (
            <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-md border border-border bg-surface py-1 shadow-lg">
              {missions.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setActiveMission(m.id);
                    setMissionMenu(false);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-surface-muted"
                >
                  <span>
                    <span className="block font-medium text-navy-950">{m.name}</span>
                    <span className="block text-[11.5px] text-slate-500">{m.payloadName}</span>
                  </span>
                  {m.id === mission.id && <Check className="h-3.5 w-3.5 text-navy-800" />}
                </button>
              ))}
              <div className="mt-1 border-t border-border pt-1">
                <a href="/onboarding" className="block px-3 py-2 text-[13px] font-medium text-navy-800 hover:bg-surface-muted">
                  + New mission
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="hidden items-center gap-3 border-l border-border pl-4 md:flex">
          <div className="text-[12.5px]">
            <span className="text-slate-500">Integration </span>
            <span className="font-medium text-navy-900">{formatDate(mission.integrationDate)}</span>
            <span className={cn("ml-1", daysToIntegration <= 14 ? "text-red-600" : daysToIntegration <= 30 ? "text-amber-700" : "text-slate-400")}>
              ({daysToIntegration}d)
            </span>
          </div>
          <Badge tone="blue">{mission.phase}</Badge>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setNotifMenu((v) => !v)}
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-surface-muted hover:text-navy-800"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-600" />}
          </button>
          {notifMenu && (
            <div className="absolute right-0 top-full z-30 mt-1 w-80 rounded-md border border-border bg-surface shadow-lg">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-[12.5px] font-semibold text-navy-950">Notifications</span>
                {unread > 0 && (
                  <button onClick={markAllNotificationsRead} className="text-[11.5px] font-medium text-navy-800 hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 && <p className="px-3 py-6 text-center text-[12.5px] text-slate-400">No notifications</p>}
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markNotificationRead(n.id)}
                    className={cn("flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left last:border-0 hover:bg-surface-muted", !n.read && "bg-blue-100/40")}
                  >
                    <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-blue-600")} />
                    <span className="text-[12.5px] leading-snug text-navy-900">{n.message}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setUserMenu((v) => !v)} className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-surface-muted">
            <Avatar user={currentUser} size="sm" />
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
          {userMenu && (
            <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-md border border-border bg-surface py-1 shadow-lg">
              <div className="border-b border-border px-3 py-2">
                <div className="text-[13px] font-medium text-navy-950">{currentUser?.name}</div>
                <div className="text-[11.5px] text-slate-500">{currentUser?.title}</div>
              </div>
              <a href="/settings" className="block px-3 py-2 text-[13px] hover:bg-surface-muted">
                Settings
              </a>
              <button
                onClick={() => {
                  signOut();
                  router.push("/sign-in");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-red-700 hover:bg-red-100/60"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
