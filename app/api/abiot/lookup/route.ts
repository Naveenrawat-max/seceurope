import { NextResponse } from "next/server";
import { abiotConfig } from "@/lib/config";
import { findRegistrationByEpc } from "@/lib/events-store";

type Registration = NonNullable<Awaited<ReturnType<typeof findRegistrationByEpc>>>;

function registrationState(status: string | null): string {
  if (status === "allowed" || status === "denied" || status === "review") {
    return status;
  }
  return "allowed";
}

function synthesizeLookupFromRegistration(epc: string, registration: Registration) {
  return {
    success: true,
    found: true,
    source: "local-registry",
    data: {
      uhf_epc_hex: epc,
      uhf_tid: registration.tid,
      label: registration.label,
      state: registrationState(registration.status),
      website: {
        plate: registration.plate,
        kind: registration.kind,
        notes: registration.subjectMeta,
      },
    },
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const epc = (searchParams.get("uhf_epc_hex") || searchParams.get("epc") || "").trim().toUpperCase();

  if (!epc) {
    return NextResponse.json({ success: false, found: false, error: "uhf_epc_hex is required" }, { status: 400 });
  }

  const localRegistration = await findRegistrationByEpc(epc);
  if (localRegistration) {
    return NextResponse.json(synthesizeLookupFromRegistration(epc, localRegistration));
  }

  if (!abiotConfig.lookupUrl) {
    return NextResponse.json({ success: false, found: false, error: "ABIOT lookup is not configured on this server" }, { status: 503 });
  }

  try {
    const url = new URL(abiotConfig.lookupUrl);
    url.searchParams.set("uhf_epc_hex", epc);

    const response = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return NextResponse.json({ success: false, found: false });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: false, found: false, error: "ABIOT lookup unavailable" });
  }
}
