import { NextResponse } from "next/server";
import { resolveEvent } from "@/lib/events-store";
import type { ResolutionInput } from "@/lib/types";

function isValidStatus(value: unknown): value is ResolutionInput["status"] {
  return value === "allowed" || value === "review" || value === "denied";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ eventKey: string }> },
) {
  const { eventKey } = await context.params;

  let payload: ResolutionInput;
  try {
    const body = await request.json();
    if (!isValidStatus(body?.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (typeof body?.outcome !== "string" || body.outcome.trim().length === 0) {
      return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
    }
    if (typeof body?.resolvedBy !== "string" || body.resolvedBy.trim().length === 0) {
      return NextResponse.json({ error: "Invalid resolvedBy" }, { status: 400 });
    }
    payload = {
      status: body.status,
      outcome: body.outcome.trim(),
      note: typeof body.note === "string" ? body.note : undefined,
      resolvedBy: body.resolvedBy.trim(),
    };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const event = await resolveEvent(eventKey, payload);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

