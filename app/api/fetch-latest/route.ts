import { NextResponse } from "next/server";
import { syncLatestRegistrations } from "@/lib/events-store";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const surface = body?.surface === "tablet" ? "tablet" : "manager";
    const gateId = typeof body?.gateId === "string" && body.gateId.trim() ? body.gateId.trim() : undefined;
    const payload = await syncLatestRegistrations(surface, gateId);
    return NextResponse.json({
      ok: true,
      synced: payload.synced,
      events: payload.events,
      counters: payload.counters,
      generatedAt: payload.generatedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch latest registrations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
