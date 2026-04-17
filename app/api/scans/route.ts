import { NextResponse } from "next/server";
import { insertManualRawScan } from "@/lib/events-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const epc = typeof body.epc === "string" ? body.epc.trim() : "";
    if (!epc) {
      return NextResponse.json({ error: "epc is required" }, { status: 400 });
    }

    const event = await insertManualRawScan({
      epc,
      tid: typeof body.tid === "string" ? body.tid : null,
      readerId: typeof body.readerId === "string" ? body.readerId : undefined,
      mode: body.mode === "antenna" ? "antenna" : "handheld",
      gateId: typeof body.gateId === "string" ? body.gateId : undefined,
      direction: body.direction === "exit" ? "exit" : "entry",
      plate: typeof body.plate === "string" ? body.plate : null,
    });

    return NextResponse.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to insert scan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

