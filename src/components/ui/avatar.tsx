import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

export function Avatar({ user, size = "md", className }: { user?: Pick<User, "initials" | "avatarColor" | "name">; size?: "sm" | "md"; className?: string }) {
  if (!user) {
    return <div className={cn("rounded-full bg-surface-muted", size === "sm" ? "h-6 w-6" : "h-8 w-8", className)} />;
  }
  return (
    <div
      title={user.name}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-[11px]",
        user.avatarColor,
        className
      )}
    >
      {user.initials}
    </div>
  );
}
