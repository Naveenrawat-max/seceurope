import { NextResponse } from "next/server";
import { insertManualRawScan, upsertVehicleRegistration } from "@/lib/events-store";

function pick(params: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

async function createEventFromParams(params: URLSearchParams) {
  const epc = pick(params, ["uhf_epc_hex", "epc", "uhf_epc"]);
  if (!epc) {
    return NextResponse.json({ error: "uhf_epc_hex is required" }, { status: 400 });
  }

  const tid = pick(params, ["uhf_tid", "tid"]) || null;
  const readerId = pick(params, ["reader_id", "readerId", "scanner_id"]) || undefined;
  const mode = pick(params, ["mode"]).toLowerCase() === "antenna" ? "antenna" : "handheld";
  const gateId = pick(params, ["gate_id", "gateId"]) || undefined;
  const direction = pick(params, ["direction"]).toLowerCase() === "exit" ? "exit" : "entry";
  const plate = pick(params, ["plate", "plate_number", "license_plate"]) || null;
  const status = pick(params, ["status"]) || null;
  const kind = pick(params, ["kind"]) || null;
  const subjectName = pick(params, ["subject_name", "subjectName", "label"]) || null;
  const subjectMeta = pick(params, ["subject_meta", "subjectMeta", "details"]) || null;
  const reason = pick(params, ["reason"]) || null;

  if (subjectName) {
    const registration = await upsertVehicleRegistration({
      epc,
      tid,
      label: subjectName,
      status,
      kind,
      subjectMeta,
      plate,
      reason,
      readerId,
      mode,
      gateId,
      direction,
    });

    return NextResponse.json({
      ok: true,
      mirrored: true,
      registration: registration?.registration ?? null,
      event: registration?.event ?? null,
    });
  }

  const event = await insertManualRawScan({
    epc,
    tid,
    readerId,
    mode,
    gateId,
    direction,
    plate,
    status,
    kind,
    subjectName,
    subjectMeta,
    reason,
  });

  return NextResponse.json({
    ok: true,
    event,
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    return await createEventFromParams(searchParams);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to ingest ABIOT scan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(json)) {
      if (value !== null && value !== undefined) {
        searchParams.set(key, String(value));
      }
    }
    return await createEventFromParams(searchParams);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to ingest ABIOT scan via POST";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
