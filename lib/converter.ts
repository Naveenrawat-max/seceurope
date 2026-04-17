import { createHash } from "node:crypto";
import { lookupAbiotDirectoryDetails, type DirectoryDetails } from "@/lib/abiot-api";
import { findRegistrationByEpc } from "@/lib/events-store";
import { GATES, DIRECTORY_BY_EPC, lookupUnknownByEpc } from "@/lib/demo-data";
import type { AccessEvent, ColumnMappingConfig, RawScanRow } from "@/lib/types";

function asString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const text = asString(value);
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTimestamp(value: unknown): string {
  const text = asString(value);
  if (!text) {
    return new Date().toISOString();
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`).join(",")}}`;
}

function deriveMode(readerId: string, rawMode: unknown): "handheld" | "antenna" {
  const mode = asString(rawMode)?.toLowerCase();
  if (mode === "antenna" || mode === "fixed") {
    return "antenna";
  }
  if (mode === "handheld") {
    return "handheld";
  }
  const normalizedReader = readerId.toLowerCase();
  return normalizedReader.includes("fm830") || normalizedReader.includes("antenna")
    ? "antenna"
    : "handheld";
}

function deriveDirection(rawDirection: unknown): "entry" | "exit" {
  const direction = asString(rawDirection)?.toLowerCase();
  if (direction === "exit" || direction === "out") {
    return "exit";
  }
  return "entry";
}

function deriveGate(rawGate: unknown): string {
  const gate = asString(rawGate);
  if (!gate) {
    return "gate-main-entry";
  }
  const byId = GATES.find((item) => item.id === gate);
  if (byId) {
    return byId.id;
  }
  const lowerGate = gate.toLowerCase();
  const byShort = GATES.find((item) => item.short.toLowerCase() === lowerGate);
  if (byShort) {
    return byShort.id;
  }
  return gate;
}

function eventKeyFromRaw(row: RawScanRow, epc: string, ts: string): string {
  const directEventKey = asString(row.event_key) || asString(row.eventKey);
  if (directEventKey) {
    return directEventKey;
  }
  const rawId = asString(row.id) || asString(row.scan_id) || asString(row.raw_id);
  if (rawId) {
    return `evt_${rawId}`;
  }
  const keyPayload = stableJson({
    epc,
    ts,
    row,
  });
  const digest = createHash("sha1").update(keyPayload).digest("hex").slice(0, 18);
  return `evt_${digest}`;
}

function titleFor(kind: string, status: string): string {
  if (status === "denied") return "Access denied - blocked vehicle";
  if (kind === "resident") return "Resident vehicle recognised";
  if (kind === "worker") return status === "allowed" ? "Worker badge recognised" : "Worker badge needs review";
  if (kind === "guest") return "Expected guest pre-authorised";
  if (kind === "registered") return "Vehicle recognised in ABIOT registry";
  return "Unrecognised RFID tag detected";
}

function deriveDemoDirectoryDetails(epc: string): DirectoryDetails {
  const record = DIRECTORY_BY_EPC[epc];
  if (record) {
    if (record.type === "resident") {
      return {
        kind: "resident",
        status: record.status,
        subjectName: record.name,
        subjectMeta: `${record.unit ?? ""} - ${record.vehicle ?? ""}`.trim().replace(/^-\s*/, ""),
        plate: record.plate ?? null,
        rssi: record.rssi ?? null,
        location: record.location ?? null,
        reason: record.reason ?? null,
      };
    }
    if (record.type === "worker") {
      return {
        kind: "worker",
        status: record.status,
        subjectName: record.name,
        subjectMeta: `${record.role ?? ""} - ${record.employer ?? ""}`.trim().replace(/^-\s*/, ""),
        plate: record.plate ?? null,
        rssi: record.rssi ?? null,
        location: record.location ?? null,
        reason: record.reason ?? null,
      };
    }
    if (record.type === "guest") {
      return {
        kind: "guest",
        status: record.status,
        subjectName: record.name,
        subjectMeta: `${record.host ?? ""} - pass ${record.passWindow ?? ""}`.trim().replace(/\s+-\s+pass\s*$/, ""),
        plate: record.plate ?? null,
        rssi: record.rssi ?? null,
        location: record.location ?? null,
        reason: record.reason ?? null,
      };
    }
    return {
      kind: "denied",
      status: "denied",
      subjectName: record.name,
      subjectMeta: record.reason ?? "Blocked vehicle",
      plate: record.plate ?? null,
      rssi: record.rssi ?? null,
      location: record.location ?? null,
      reason: record.reason ?? null,
    };
  }

  const unknown = lookupUnknownByEpc(epc);
  return {
    kind: "unknown",
    status: "review",
    subjectName: unknown?.hint ?? "Unknown vehicle",
    subjectMeta: unknown ? `${unknown.vehicle} - ${unknown.plate}` : "No resident, worker, or guest record matched",
    plate: unknown?.plate ?? null,
    rssi: unknown ? 56 : null,
    location: "Main gate approach lane",
    reason: "No matching record in directory. Needs tablet review.",
  } as const;
}

function statusAndKindFromRaw(row: RawScanRow, defaults: DirectoryDetails) {
  const rawStatus = asString(row.status)?.toLowerCase();
  const rawKind = asString(row.kind)?.toLowerCase();

  let status: "allowed" | "review" | "denied";
  if (rawStatus === "allowed" || rawStatus === "review" || rawStatus === "denied") {
    status = rawStatus;
  } else if (defaults.status === "allowed" || defaults.status === "review" || defaults.status === "denied") {
    status = defaults.status;
  } else {
    status = "review";
  }
  const kind = rawKind || defaults.kind;

  return { status, kind };
}

function outcomeForStatus(status: "allowed" | "review" | "denied"): string {
  if (status === "allowed") return "auto-allowed";
  if (status === "denied") return "denied";
  return "needs-review";
}

export function convertRawRowToAccessEvent(row: RawScanRow, map: ColumnMappingConfig): AccessEvent | null {
  const epc = asString(row[map.epc]);
  if (!epc) {
    return null;
  }

  const ts = parseTimestamp(row[map.ts]);
  const readerId = asString(row[map.readerId]) || "CW-C72-01";
  const tid = asString(row[map.tid]);
  const gateId = deriveGate(row[map.gateId]);
  const direction = deriveDirection(row[map.direction]);
  const mode = deriveMode(readerId, row.mode);
  const defaults = deriveDemoDirectoryDetails(epc);
  const { status, kind } = statusAndKindFromRaw(row, defaults);

  const subjectName = asString(row.subject_name) || defaults.subjectName;
  const subjectMeta = asString(row.subject_meta) || defaults.subjectMeta;
  const plate = asString(row.plate) || (map.plate ? asString(row[map.plate]) : null) || defaults.plate;
  const rssi = asNumber(row.rssi) ?? defaults.rssi ?? null;
  const location = asString(row.location) || defaults.location || null;
  const reason = asString(row.reason) || defaults.reason || null;

  const eventKey = eventKeyFromRaw(row, epc, ts);
  const resolvedAt = asString(row.resolved_at);
  const resolvedBy = asString(row.resolved_by);

  const notes: string[] = [];
  const rawNote = asString(row.note) || asString(row.notes);
  if (rawNote) {
    notes.push(rawNote);
  }

  const outcome = asString(row.outcome) || outcomeForStatus(status);

  return {
    eventKey,
    ts,
    epc,
    tid,
    readerId,
    mode,
    gateId,
    direction,
    status,
    outcome,
    kind,
    subjectName,
    subjectMeta,
    plate,
    rssi,
    location,
    reason,
    resolvedAt,
    resolvedBy,
    notes,
    payload: {
      ...row,
      title: titleFor(kind, status),
    },
  };
}

export async function convertRawRowToAccessEventWithLookup(row: RawScanRow, map: ColumnMappingConfig): Promise<AccessEvent | null> {
  const baseEvent = convertRawRowToAccessEvent(row, map);
  if (!baseEvent) {
    return null;
  }

  const abiotDetails = await lookupAbiotDirectoryDetails(baseEvent.epc);
  let defaults: DirectoryDetails;
  if (abiotDetails) {
    defaults = abiotDetails;
  } else {
    const registration = findRegistrationByEpc(baseEvent.epc);
    if (registration) {
      defaults = {
        kind: registration.kind || "registered",
        status: (registration.status === "allowed" || registration.status === "denied") ? registration.status : "review",
        subjectName: registration.label,
        subjectMeta: registration.subjectMeta || "Registered by ABIOT Scanner",
        plate: registration.plate,
        rssi: null,
        location: null,
        reason: registration.reason,
        tid: registration.tid,
      };
    } else {
      defaults = deriveDemoDirectoryDetails(baseEvent.epc);
    }
  }
  const { status, kind } = statusAndKindFromRaw(row, defaults);
  const tid = baseEvent.tid || defaults.tid || null;
  const subjectName = asString(row.subject_name) || defaults.subjectName;
  const subjectMeta = asString(row.subject_meta) || defaults.subjectMeta;
  const plate = asString(row.plate) || (map.plate ? asString(row[map.plate]) : null) || defaults.plate;
  const rssi = asNumber(row.rssi) ?? defaults.rssi ?? null;
  const location = asString(row.location) || defaults.location || null;
  const explicitIdentityProvided = Boolean(
    asString(row.subject_name) ||
      asString(row.subject_meta) ||
      asString(row.kind) ||
      asString(row.status),
  );
  const reason = asString(row.reason) || (explicitIdentityProvided ? null : defaults.reason || null);
  const outcome = asString(row.outcome) || outcomeForStatus(status);

  return {
    ...baseEvent,
    tid,
    status,
    outcome,
    kind,
    subjectName,
    subjectMeta,
    plate,
    rssi,
    location,
    reason,
    payload: {
      ...baseEvent.payload,
      ...(defaults.payload ? { abiot: defaults.payload } : {}),
      title: titleFor(kind, status),
    },
  };
}

export function accessEventToDbRow(event: AccessEvent) {
  return {
    event_key: event.eventKey,
    ts: event.ts,
    epc: event.epc,
    tid: event.tid,
    reader_id: event.readerId,
    mode: event.mode,
    gate_id: event.gateId,
    direction: event.direction,
    status: event.status,
    outcome: event.outcome,
    kind: event.kind,
    subject_name: event.subjectName,
    subject_meta: event.subjectMeta,
    plate: event.plate,
    rssi: event.rssi,
    location: event.location,
    reason: event.reason,
    resolved_at: event.resolvedAt,
    resolved_by: event.resolvedBy,
    notes: event.notes,
    payload: event.payload,
    updated_at: new Date().toISOString(),
  };
}
