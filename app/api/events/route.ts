import { NextResponse } from "next/server";
import { fetchEvents } from "@/lib/events-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const surfaceParam = searchParams.get("surface");
  const surface = surfaceParam === "tablet" ? "tablet" : "manager";
  const gateId = searchParams.get("gateId")?.trim() || undefined;

  try {
    const response = await fetchEvents(surface, gateId);
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch events";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

