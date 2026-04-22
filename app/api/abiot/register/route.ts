import { NextResponse } from "next/server";
import { lookupAbiotDirectoryDetails, updateAbiotRecord } from "@/lib/abiot-api";
import { findEventByKey, findLatestEventByEpc, findRegistrationByEpc, resolveEvent, upsertVehicleRegistration } from "@/lib/events-store";
import type { AccessEvent, VehicleRegistrationInput } from "@/lib/types";
import { buildVehicleSubjectMeta, buildVehicleWebsitePayload, eventStatusFromVehicleState, normalizeVehicleKind } from "@/lib/vehicle-registration";

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePayload(body: VehicleRegistrationInput) {
  const epc = asText(body.epc).toUpperCase();
  const label = asText(body.label);
  const state = asText(body.state) || "allowed";
  const eventKey = asText(body.eventKey);

  if (!epc) {
    throw new Error("EPC is required");
  }
  if (!label) {
    throw new Error("Vehicle label is required");
  }

  return {
    epc,
    label,
    state,
    tid: asText(body.tid) || null,
    eventKey: eventKey || null,
    ownerName: asText(body.ownerName) || null,
    vehicleName: asText(body.vehicleName) || null,
    plate: asText(body.plate) || null,
    location: asText(body.location) || null,
    vehicleKind: asText(body.vehicleKind) || null,
    details: asText(body.details) || null,
    photoUrl: asText(body.photoUrl) || null,
    websiteUrl: asText(body.websiteUrl) || null,
    readerId: asText(body.readerId) || undefined,
    mode: body.mode ? (body.mode === "antenna" ? "antenna" : "handheld") : undefined,
    gateId: asText(body.gateId) || undefined,
    direction: body.direction ? (body.direction === "exit" ? "exit" : "entry") : undefined,
    resolvedBy: asText(body.resolvedBy) || "Seceurope web",
  };
}

async function resolveRegistrationContext(input: ReturnType<typeof normalizePayload>): Promise<{
  tid: string | null;
  lookup: Awaited<ReturnType<typeof lookupAbiotDirectoryDetails>>;
  sourceEvent: AccessEvent | null;
  readerId: string;
  mode: "handheld" | "antenna";
  gateId: string;
  direction: "entry" | "exit";
}> {
  const sourceEvent = input.eventKey ? await findEventByKey(input.eventKey) : await findLatestEventByEpc(input.epc);
  const existingRegistration = await findRegistrationByEpc(input.epc);
  const lookup = await lookupAbiotDirectoryDetails(input.epc);

  const tid =
    input.tid ||
    sourceEvent?.tid ||
    existingRegistration?.tid ||
    lookup?.tid ||
    null;

  return {
    tid,
    lookup,
    sourceEvent,
    readerId: input.readerId || sourceEvent?.readerId || "Web-Portal",
    mode: (input.mode || sourceEvent?.mode || "handheld") as "handheld" | "antenna",
    gateId: input.gateId || sourceEvent?.gateId || "gate-main-entry",
    direction: (input.direction || sourceEvent?.direction || "entry") as "entry" | "exit",
  };
}

export async function POST(request: Request) {
  try {
    const rawBody = (await request.json()) as VehicleRegistrationInput;
    const input = normalizePayload(rawBody);
    const context = await resolveRegistrationContext(input);

    const website = buildVehicleWebsitePayload(input);
    let abiotSynced = false;
    let abiotSyncWarning: string | null = null;
    const deferredSyncMessage = `Saved ${input.label} to the website registry by EPC. ABIOT sync is deferred until this tag has a known TID.`;

    if (context.tid) {
      try {
        await updateAbiotRecord({
          uhf_epc_hex: input.epc,
          uhf_tid: context.tid,
          label: input.label,
          state: input.state,
          website: website ?? undefined,
        });
        abiotSynced = true;
      } catch (abiotError) {
        abiotSyncWarning = abiotError instanceof Error
          ? `ABIOT sync failed: ${abiotError.message}`
          : "ABIOT sync failed — the record was saved to the website registry only.";
      }
    }

    const status = eventStatusFromVehicleState(input.state);
    const mirrored = await upsertVehicleRegistration({
      epc: input.epc,
      tid: context.tid,
      label: input.label,
      status,
      kind: normalizeVehicleKind(input.vehicleKind),
      subjectMeta: buildVehicleSubjectMeta(input),
      plate: input.plate,
      reason: status === "allowed" ? null : input.details || `ABIOT state: ${input.state}`,
      readerId: context.readerId,
      mode: context.mode,
      gateId: context.gateId,
      direction: context.direction,
      materializeEvent: !input.eventKey,
    });

    if (input.eventKey) {
      await resolveEvent(input.eventKey, {
        status,
        outcome: abiotSynced ? "registered-in-abiot" : "registered-on-web",
        note: abiotSynced
          ? `${input.label} was registered in ABIOT from the web portal.`
          : `${input.label} was saved in the website registry. ABIOT sync is pending until a TID is captured.`,
        resolvedBy: input.resolvedBy,
      });
    }

    const message = abiotSynced
      ? `Saved ${input.label} to ABIOT and refreshed the shared vehicle registry.`
      : deferredSyncMessage;

    return NextResponse.json({
      ok: true,
      event: mirrored?.event ?? null,
      registration: mirrored?.registration ?? null,
      resolvedTid: context.tid,
      sourceEventKey: input.eventKey,
      refreshedFromLookup: Boolean(context.lookup),
      abiotSynced,
      message,
      warning: abiotSyncWarning ?? (abiotSynced ? null : deferredSyncMessage),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to register vehicle";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
