import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { convertPendingRawRows } from "@/lib/events-store";
import { broadcastLiveMessage } from "@/lib/live-updates";

function isAuthorized(request: Request): boolean {
  if (!appConfig.internalConvertToken) {
    return true;
  }
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return false;
  }
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token === appConfig.internalConvertToken;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await convertPendingRawRows();
    if (result.upserted > 0) {
      broadcastLiveMessage({
        type: "conversion-updated",
        source: "convert-route",
        message: `${result.upserted} access events were refreshed from raw EPC rows.`,
      });
    }
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run conversion";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
