"use client";

import type { AccessEvent } from "@/lib/types";

export function formatTime(ts: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
}

export function formatDateTime(ts: string) {
  const date = new Date(ts);
  return `${date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} - ${formatTime(ts)}`;
}

export function relative(ts: string) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 45) return "just now";
  if (diff < 90) return "1 min ago";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 7200) return "1 hr ago";
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return formatDateTime(ts);
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export type IconName =
  | "arrowRight"
  | "arrowUpRight"
  | "check"
  | "x"
  | "bell"
  | "radio"
  | "signal"
  | "scan"
  | "car"
  | "user"
  | "users"
  | "shield"
  | "shieldCheck"
  | "dashboard"
  | "queue"
  | "gate"
  | "map"
  | "phone"
  | "refresh"
  | "bolt"
  | "clock"
  | "chevronRight"
  | "chevronDown"
  | "antenna"
  | "settings"
  | "alertTriangle"
  | "history"
  | "logIn"
  | "logOut"
  | "mapPin"
  | "plus";

const ICONS: Record<IconName, string> = {
  arrowRight: `<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>`,
  arrowUpRight: `<path d="M7 7h10v10"/><path d="M7 17 17 7"/>`,
  check: `<path d="M20 6 9 17l-5-5"/>`,
  x: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
  bell: `<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>`,
  radio: `<circle cx="12" cy="12" r="2"/><path d="M4.9 4.9a10 10 0 0 0 0 14.2"/><path d="M19.1 4.9a10 10 0 0 1 0 14.2"/><path d="M8.5 8.5a5 5 0 0 0 0 7.1"/><path d="M15.5 8.5a5 5 0 0 1 0 7.1"/>`,
  signal: `<path d="M2 20h2"/><path d="M6 20v-4"/><path d="M10 20v-8"/><path d="M14 20v-12"/><path d="M18 20v-16"/>`,
  scan: `<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>`,
  car: `<path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>`,
  user: `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  users: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  shield: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
  shieldCheck: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>`,
  dashboard: `<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>`,
  queue: `<path d="M3 6h18"/><path d="M3 12h12"/><path d="M3 18h18"/>`,
  gate: `<path d="M3 20h18"/><path d="M5 20V8l7-4 7 4v12"/><path d="M9 20v-6h6v6"/>`,
  map: `<path d="M9 20 3 18V6l6 2 6-2 6 2v12l-6-2-6 2z"/><path d="M9 2v16"/><path d="M15 4v16"/>`,
  phone: `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>`,
  refresh: `<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>`,
  bolt: `<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>`,
  clock: `<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>`,
  chevronRight: `<path d="m9 6 6 6-6 6"/>`,
  chevronDown: `<path d="m6 9 6 6 6-6"/>`,
  antenna: `<path d="M12 22V10"/><path d="M5 10c0-3.9 3.1-7 7-7s7 3.1 7 7"/><path d="M8.5 10c0-1.9 1.6-3.5 3.5-3.5s3.5 1.6 3.5 3.5"/><circle cx="12" cy="10" r="1.25"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 4.2 16.96l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`,
  alertTriangle: `<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>`,
  history: `<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>`,
  logIn: `<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/>`,
  logOut: `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>`,
  mapPin: `<path d="M20 10c0 7-8 12-8 12s-8-5-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>`,
  plus: `<path d="M12 5v14"/><path d="M5 12h14"/>`,
};

export function Icon({
  name,
  size = 16,
}: {
  name: IconName;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}

export function badgeClassForStatus(status: AccessEvent["status"]) {
  if (status === "allowed") return "success";
  if (status === "denied") return "danger";
  return "warn";
}

export function badgeLabelForStatus(status: AccessEvent["status"]) {
  if (status === "allowed") return "Allowed";
  if (status === "denied") return "Denied";
  return "Needs review";
}

export function badgeClassForKind(kind: string) {
  if (kind === "resident") return "brand";
  if (kind === "worker") return "success";
  if (kind === "guest") return "info";
  if (kind === "denied") return "danger";
  if (kind === "unknown") return "warn";
  return "neutral";
}

export function avatarClassForKind(kind: string) {
  if (kind === "denied") return "denied";
  if (kind === "unknown") return "review";
  if (kind === "guest") return "guest";
  if (kind === "worker") return "worker";
  return "";
}

