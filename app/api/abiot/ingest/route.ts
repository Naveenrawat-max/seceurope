import { NextResponse } from "next/server";
import { findRegistrationByEpc, insertManualRawScan, upsertVehicleRegistration } from "@/lib/events-store";

function pick(params: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function isUnknownLabel(value: string | null): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "" ||
    normalized === "unknown" ||
    normalized === "unknown vehicle" ||
    normalized === "unknown_vehicle"
  );
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
  const rawSubjectName = pick(params, ["subject_name", "subjectName", "label"]) || null;
  const subjectMeta = pick(params, ["subject_meta", "subjectMeta", "details"]) || null;
  const reason = pick(params, ["reason"]) || null;

  const scannerReportedUnknown = isUnknownLabel(rawSubjectName);
  const existingRegistration = findRegistrationByEpc(epc);
  const shouldUpsertRegistration = !scannerReportedUnknown && !existingRegistration;

  if (shouldUpsertRegistration) {
    const registration = await upsertVehicleRegistration({
      epc,
      tid,
      label: rawSubjectName as string,
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
    tid: tid || existingRegistration?.tid || null,
    readerId,
    mode,
    gateId,
    direction,
    plate: plate || existingRegistration?.plate || null,
    status,
    kind,
    subjectName: scannerReportedUnknown ? null : rawSubjectName,
    subjectMeta: scannerReportedUnknown ? null : subjectMeta,
    reason: scannerReportedUnknown ? null : reason,
  });

  return NextResponse.json({
    ok: true,
    event,
    preservedRegistration: Boolean(existingRegistration),
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
