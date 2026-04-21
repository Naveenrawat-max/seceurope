import { NextResponse } from "next/server";
import { abiotConfig } from "@/lib/config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const epc = searchParams.get("uhf_epc_hex")?.trim().toUpperCase();
  const tid = searchParams.get("uhf_tid")?.trim().toUpperCase() || undefined;

  if (!epc) {
    return NextResponse.json({ success: false, error: "uhf_epc_hex is required" }, { status: 400 });
  }

  if (!abiotConfig.updateUrl || !abiotConfig.updateToken) {
    return NextResponse.json({ success: false, error: "ABIOT update is not configured on this server" }, { status: 503 });
  }

  try {
    const url = new URL(abiotConfig.updateUrl);
    url.searchParams.set("token", abiotConfig.updateToken);
    url.searchParams.set("uhf_epc_hex", epc);
    if (tid) url.searchParams.set("uhf_tid", tid);

    const label = searchParams.get("label");
    const state = searchParams.get("state");
    const website = searchParams.get("website");
    if (label) url.searchParams.set("label", label);
    if (state) url.searchParams.set("state", state);
    if (website) url.searchParams.set("website", website);

    const response = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    const body = await response.text();
    let data: unknown;
    try { data = JSON.parse(body); } catch { data = { success: response.ok, raw: body }; }
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "ABIOT update unavailable" },
      { status: 503 },
    );
  }
}
