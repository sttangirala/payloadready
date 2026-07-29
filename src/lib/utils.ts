import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { differenceInCalendarDays, format, isPast, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string, fmt = "MMM d, yyyy") {
  try {
    return format(parseISO(iso), fmt);
  } catch {
    return iso;
  }
}

export function daysUntil(iso: string): number {
  return differenceInCalendarDays(parseISO(iso), new Date());
}

export function isOverdue(iso: string): boolean {
  return isPast(parseISO(iso)) && daysUntil(iso) < 0;
}

export function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
