"use client";

import type { EventsResponse, ResolutionInput, VehicleRegistrationInput } from "@/lib/types";

export async function fetchEventsFromApi(surface: "manager" | "tablet", gateId?: string) {
  const params = new URLSearchParams({ surface });
  if (gateId) {
    params.set("gateId", gateId);
  }
  const response = await fetch(`/api/events?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch events (${response.status})`);
  }
  return (await response.json()) as EventsResponse;
}

export async function resolveEventViaApi(eventKey: string, payload: ResolutionInput) {
  const response = await fetch(`/api/events/${encodeURIComponent(eventKey)}/resolve`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Failed to resolve event (${response.status})`);
  }
  return response.json() as Promise<{ event: unknown }>;
}

export async function createScanViaApi(payload: {
  epc: string;
  tid?: string | null;
  readerId?: string;
  mode?: "handheld" | "antenna";
  gateId?: string;
  direction?: "entry" | "exit";
  plate?: string | null;
}) {
  const response = await fetch("/api/scans", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Failed to create scan (${response.status})`);
  }
  return response.json() as Promise<{ event: unknown }>;
}

export async function syncLatestViaApi(surface: "manager" | "tablet", gateId?: string) {
  const response = await fetch("/api/fetch-latest", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      surface,
      gateId,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch latest registrations (${response.status})`);
  }
  return (await response.json()) as EventsResponse & { ok: boolean; synced: number };
}

export async function registerVehicleViaApi(payload: VehicleRegistrationInput) {
  const response = await fetch("/api/abiot/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data?.error === "string" ? data.error : `Failed to register vehicle (${response.status})`);
  }

  return response.json() as Promise<{
    ok: boolean;
    event: unknown;
    registration: unknown;
    resolvedTid: string;
    sourceEventKey: string | null;
    refreshedFromLookup: boolean;
  }>;
}
