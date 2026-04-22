import { appConfig, columnMappingConfig } from "@/lib/config";
import { accessEventToDbRow, convertRawRowToAccessEventWithLookup } from "@/lib/converter";
import { PRESETS } from "@/lib/demo-data";
import { broadcastLiveMessage } from "@/lib/live-updates";
import { getSupabaseServerClient } from "@/lib/supabase";
import type { AccessEvent, ConversionResult, EventCounters, EventsResponse, RawScanRow, ResolutionInput } from "@/lib/types";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

interface ResolutionRow {
  event_key: string;
  status: string;
  outcome: string;
  note: string | null;
  resolved_by: string;
  resolved_at: string;
}

interface RegistrationRow {
  epc: string;
  tid: string | null;
  label: string;
  status: string | null;
  kind: string | null;
  subject_meta: string | null;
  plate: string | null;
  reason: string | null;
  reader_id: string;
  mode: "handheld" | "antenna";
  gate_id: string;
  direction: "entry" | "exit";
  owner_name: string | null;
  vehicle_name: string | null;
  location: string | null;
  photo_url: string | null;
  website_url: string | null;
  website_payload: Record<string, unknown>;
  updated_at: string;
}

interface MemoryStore {
  events: AccessEvent[];
  resolutions: ResolutionRow[];
  rawRows: RawScanRow[];
  registrations: RegistrationRow[];
}

const MEMORY_STORE_KEY = "__seceurope_web_memory_store__";
const MEMORY_STORE_FILE = join(process.cwd(), ".data", "memory-store.json");

function isDiskPersistenceEnabled() {
  return process.env.NODE_ENV !== "test";
}

function createInitialRawRows(): RawScanRow[] {
  const now = Date.now();
  const seededRawRows: RawScanRow[] = PRESETS.slice(0, 7).map((preset, index) => {
    const shifted = new Date(now - (index + 1) * 1000 * 60 * 7).toISOString();
    return {
      id: `seed_${index}`,
      epc: preset.epc,
      tid: `TID-SEED-${index}`,
      reader_id: index % 2 === 0 ? "CW-FM830-A" : "CW-C72-01",
      ts: shifted,
      gate_id: "gate-main-entry",
      direction: "entry",
      mode: index % 2 === 0 ? "antenna" : "handheld",
    };
  });

  seededRawRows.unshift({
    id: "restored_known_vehicle",
    epc: "E280699520000400008D040987",
    tid: "TID-RESTORED-ABIOT-01",
    reader_id: "CW-C72-01",
    ts: new Date(now - 1000 * 60 * 3).toISOString(),
    gate_id: "gate-main-entry",
    direction: "entry",
    mode: "handheld",
    status: "allowed",
    kind: "registered",
    subject_name: "Known vehicle",
    subject_meta: "Restored ABIOT vehicle card from previous session",
    reason: null,
  });

  return seededRawRows;
}

function createInitialMemoryStore(): MemoryStore {
  return {
    events: [],
    resolutions: [],
    rawRows: createInitialRawRows(),
    registrations: [],
  };
}

function normalizeMemoryStoreShape(store: Partial<MemoryStore> | null | undefined): MemoryStore {
  return {
    events: Array.isArray(store?.events) ? (store!.events as AccessEvent[]) : [],
    resolutions: Array.isArray(store?.resolutions) ? (store!.resolutions as ResolutionRow[]) : [],
    rawRows: Array.isArray(store?.rawRows) ? (store!.rawRows as RawScanRow[]) : createInitialRawRows(),
    registrations: Array.isArray(store?.registrations) ? (store!.registrations as RegistrationRow[]) : [],
  };
}

function loadMemoryStoreFromDisk(): MemoryStore | null {
  if (!isDiskPersistenceEnabled() || !existsSync(MEMORY_STORE_FILE)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(MEMORY_STORE_FILE, "utf8")) as Partial<MemoryStore>;
    return normalizeMemoryStoreShape(parsed);
  } catch {
    return null;
  }
}

function saveMemoryStoreToDisk(store: MemoryStore) {
  if (!isDiskPersistenceEnabled()) {
    return;
  }

  mkdirSync(dirname(MEMORY_STORE_FILE), { recursive: true });
  writeFileSync(MEMORY_STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

function getMemoryStore(): MemoryStore {
  const globalState = globalThis as unknown as Record<string, unknown>;
  if (!globalState[MEMORY_STORE_KEY]) {
    globalState[MEMORY_STORE_KEY] = loadMemoryStoreFromDisk() ?? createInitialMemoryStore();
  } else {
    globalState[MEMORY_STORE_KEY] = normalizeMemoryStoreShape(globalState[MEMORY_STORE_KEY] as Partial<MemoryStore>);
  }
  return globalState[MEMORY_STORE_KEY] as MemoryStore;
}

async function buildSeededEvents(rows: RawScanRow[]) {
  const events: AccessEvent[] = [];
  for (const row of rows) {
    const event = await convertRawRowToAccessEventWithLookup(row, columnMappingConfig);
    if (event) {
      events.push(event);
    }
  }
  return events;
}

async function ensureMemoryEventsSeeded() {
  const store = getMemoryStore();
  if (store.events.length > 0) {
    return store;
  }
  store.events = await buildSeededEvents(store.rawRows);
  saveMemoryStoreToDisk(store);
  return store;
}

async function getReadyMemoryStore() {
  return ensureMemoryEventsSeeded();
}

function computeCounters(events: AccessEvent[]): EventCounters {
  return {
    total: events.length,
    pending: events.filter((event) => event.status === "review").length,
    allowed: events.filter((event) => event.status === "allowed").length,
    denied: events.filter((event) => event.status === "denied").length,
  };
}

function registrationKey(epc: string) {
  return `registry_${epc.trim().toUpperCase()}`;
}

function registrationRowFromSupabase(row: Record<string, unknown>): RegistrationRow {
  const websitePayload =
    typeof row.website_payload === "object" &&
    row.website_payload !== null &&
    !Array.isArray(row.website_payload)
      ? (row.website_payload as Record<string, unknown>)
      : {};

  return {
    epc: String(row.epc ?? "").trim().toUpperCase(),
    tid: row.tid ? String(row.tid) : null,
    label: String(row.label ?? ""),
    status: row.status ? String(row.status) : null,
    kind: row.kind ? String(row.kind) : null,
    subject_meta: row.subject_meta ? String(row.subject_meta) : null,
    plate: row.plate ? String(row.plate) : null,
    reason: row.reason ? String(row.reason) : null,
    reader_id: row.reader_id ? String(row.reader_id) : "CW-C72-01",
    mode: row.mode === "antenna" ? "antenna" : "handheld",
    gate_id: row.gate_id ? String(row.gate_id) : "gate-main-entry",
    direction: row.direction === "exit" ? "exit" : "entry",
    owner_name: row.owner_name ? String(row.owner_name) : null,
    vehicle_name: row.vehicle_name ? String(row.vehicle_name) : null,
    location: row.location ? String(row.location) : null,
    photo_url: row.photo_url ? String(row.photo_url) : null,
    website_url: row.website_url ? String(row.website_url) : null,
    website_payload: websitePayload,
    updated_at: row.updated_at ? String(row.updated_at) : new Date().toISOString(),
  };
}

async function upsertRegistrationInSupabase(registration: RegistrationRow) {
  const client = getSupabaseServerClient();
  if (!client) {
    return;
  }
  const result = await client
    .from(appConfig.vehicleRegistrationsTable)
    .upsert(
      [
        {
          epc: registration.epc,
          tid: registration.tid,
          label: registration.label,
          status: registration.status,
          kind: registration.kind,
          subject_meta: registration.subject_meta,
          plate: registration.plate,
          reason: registration.reason,
          reader_id: registration.reader_id,
          mode: registration.mode,
          gate_id: registration.gate_id,
          direction: registration.direction,
          owner_name: registration.owner_name,
          vehicle_name: registration.vehicle_name,
          location: registration.location,
          photo_url: registration.photo_url,
          website_url: registration.website_url,
          website_payload: registration.website_payload,
          updated_at: registration.updated_at,
        },
      ],
      { onConflict: "epc" },
    );
  if (result.error) {
    throw result.error;
  }
}

async function fetchRegistrationFromSupabase(epc: string): Promise<RegistrationRow | null> {
  const client = getSupabaseServerClient();
  if (!client) {
    return null;
  }
  const result = await client
    .from(appConfig.vehicleRegistrationsTable)
    .select("*")
    .eq("epc", epc)
    .limit(1)
    .maybeSingle();
  if (result.error) {
    return null;
  }
  return result.data ? registrationRowFromSupabase(result.data as Record<string, unknown>) : null;
}

async function fetchAllRegistrationsFromSupabase(): Promise<RegistrationRow[]> {
  const client = getSupabaseServerClient();
  if (!client) {
    return [];
  }
  const result = await client
    .from(appConfig.vehicleRegistrationsTable)
    .select("*")
    .order("updated_at", { ascending: false });
  if (result.error || !Array.isArray(result.data)) {
    return [];
  }
  return result.data.map((row) => registrationRowFromSupabase(row as Record<string, unknown>));
}

/**
 * Look up a previously registered vehicle by EPC.
 * Called by the converter as a fallback when the ABIOT API returns no match,
 * and by the lookup proxy so the scanner can discover web-only registrations.
 *
 * Reads the in-memory cache first, then falls back to Supabase so
 * registrations survive Render restarts (ephemeral FS).
 * Populates the in-memory cache on a Supabase hit.
 */
export async function findRegistrationByEpc(epc: string): Promise<{
  label: string;
  status: string | null;
  kind: string | null;
  subjectMeta: string | null;
  plate: string | null;
  tid: string | null;
  reason: string | null;
  websitePayload: Record<string, unknown> | null;
} | null> {
  const normalized = epc.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const store = getMemoryStore();
  let registration = store.registrations.find((r) => r.epc === normalized);

  if (!registration) {
    const fromSupabase = await fetchRegistrationFromSupabase(normalized);
    if (fromSupabase) {
      const existingIndex = store.registrations.findIndex((r) => r.epc === normalized);
      if (existingIndex >= 0) {
        store.registrations[existingIndex] = fromSupabase;
      } else {
        store.registrations.unshift(fromSupabase);
      }
      saveMemoryStoreToDisk(store);
      registration = fromSupabase;
    }
  }

  if (!registration) {
    return null;
  }

  return {
    label: registration.label,
    status: registration.status,
    kind: registration.kind,
    subjectMeta: registration.subject_meta,
    plate: registration.plate,
    tid: registration.tid,
    reason: registration.reason,
    websitePayload: Object.keys(registration.website_payload).length > 0 ? registration.website_payload : null,
  };
}

export async function findEventByKey(eventKey: string): Promise<AccessEvent | null> {
  if (!eventKey.trim()) {
    return null;
  }

  const client = getSupabaseServerClient();
  if (!client) {
    const memory = await getReadyMemoryStore();
    return memory.events.find((event) => event.eventKey === eventKey) ?? null;
  }

  const result = await client
    .from(appConfig.accessEventsTable)
    .select("*")
    .eq("event_key", eventKey)
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data ? mapDbRowToAccessEvent(result.data) : null;
}

export async function findLatestEventByEpc(epc: string): Promise<AccessEvent | null> {
  const normalized = epc.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const client = getSupabaseServerClient();
  if (!client) {
    const memory = await getReadyMemoryStore();
    const matches = memory.events
      .filter((event) => event.epc === normalized)
      .sort((left, right) => new Date(right.ts).getTime() - new Date(left.ts).getTime());
    return matches[0] ?? null;
  }

  const result = await client
    .from(appConfig.accessEventsTable)
    .select("*")
    .eq("epc", normalized)
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data ? mapDbRowToAccessEvent(result.data) : null;
}

function registrationToRawRow(registration: RegistrationRow): RawScanRow {
  return {
    id: registrationKey(registration.epc),
    [columnMappingConfig.epc]: registration.epc,
    [columnMappingConfig.tid]: registration.tid,
    [columnMappingConfig.readerId]: registration.reader_id,
    [columnMappingConfig.ts]: registration.updated_at,
    [columnMappingConfig.gateId]: registration.gate_id,
    [columnMappingConfig.direction]: registration.direction,
    mode: registration.mode,
    plate: registration.plate,
    status: registration.status,
    kind: registration.kind,
    subject_name: registration.label,
    subject_meta: registration.subject_meta,
    reason: registration.reason,
  };
}

function deriveMetaFromResolution(event: AccessEvent, resolution?: ResolutionRow): AccessEvent {
  if (!resolution) {
    return event;
  }
  const notes = [...event.notes];
  if (resolution.note) {
    notes.push(resolution.note);
  }
  return {
    ...event,
    status: resolution.status as AccessEvent["status"],
    outcome: resolution.outcome || event.outcome,
    resolvedAt: resolution.resolved_at,
    resolvedBy: resolution.resolved_by,
    notes,
  };
}

function mapDbRowToAccessEvent(row: Record<string, unknown>): AccessEvent {
  return {
    eventKey: String(row.event_key ?? row.eventKey ?? ""),
    ts: String(row.ts ?? new Date().toISOString()),
    epc: String(row.epc ?? ""),
    tid: row.tid ? String(row.tid) : null,
    readerId: String(row.reader_id ?? row.readerId ?? "CW-C72-01"),
    mode: row.mode === "antenna" ? "antenna" : "handheld",
    gateId: String(row.gate_id ?? row.gateId ?? "gate-main-entry"),
    direction: row.direction === "exit" ? "exit" : "entry",
    status: row.status === "allowed" || row.status === "denied" ? row.status : "review",
    outcome: String(row.outcome ?? "needs-review"),
    kind: String(row.kind ?? "unknown"),
    subjectName: String(row.subject_name ?? row.subjectName ?? "Unknown vehicle"),
    subjectMeta: String(row.subject_meta ?? row.subjectMeta ?? "Awaiting directory resolution"),
    plate: row.plate ? String(row.plate) : null,
    rssi: typeof row.rssi === "number" ? row.rssi : row.rssi ? Number(row.rssi) : null,
    location: row.location ? String(row.location) : null,
    reason: row.reason ? String(row.reason) : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    resolvedBy: row.resolved_by ? String(row.resolved_by) : null,
    notes: Array.isArray(row.notes) ? row.notes.map((note) => String(note)) : [],
    payload:
      typeof row.payload === "object" && row.payload !== null
        ? (row.payload as Record<string, unknown>)
        : {},
  };
}

async function convertPendingRawRowsInMemory(): Promise<ConversionResult> {
  const store = await getReadyMemoryStore();
  let converted = 0;
  for (const rawRow of store.rawRows) {
    const event = await convertRawRowToAccessEventWithLookup(rawRow, columnMappingConfig);
    if (!event) continue;
    converted += 1;
    const index = store.events.findIndex((existing) => existing.eventKey === event.eventKey);
    if (index === -1) {
      store.events.unshift(event);
    } else {
      store.events[index] = event;
    }
  }
  return {
    fetched: store.rawRows.length,
    converted,
    upserted: converted,
    skipped: Math.max(0, store.rawRows.length - converted),
  };
}

async function convertPendingRawRowsSupabase(): Promise<ConversionResult> {
  const client = getSupabaseServerClient();
  if (!client) {
    return convertPendingRawRowsInMemory();
  }

  const rawTable = appConfig.rawScanTable;
  let rows: Record<string, unknown>[] | null = null;

  const orderedQuery = await client
    .from(rawTable)
    .select("*")
    .order(columnMappingConfig.ts, { ascending: false })
    .limit(appConfig.convertBatchSize);

  if (!orderedQuery.error) {
    rows = (orderedQuery.data ?? []) as Record<string, unknown>[];
  } else {
    const fallbackQuery = await client.from(rawTable).select("*").limit(appConfig.convertBatchSize);
    if (fallbackQuery.error) {
      throw fallbackQuery.error;
    }
    rows = (fallbackQuery.data ?? []) as Record<string, unknown>[];
  }

  const convertedRows: AccessEvent[] = [];
  for (const row of rows ?? []) {
    const event = await convertRawRowToAccessEventWithLookup(row, columnMappingConfig);
    if (event) {
      convertedRows.push(event);
    }
  }

  if (convertedRows.length === 0) {
    return {
      fetched: rows?.length ?? 0,
      converted: 0,
      upserted: 0,
      skipped: rows?.length ?? 0,
    };
  }

  const upsertPayload = convertedRows.map((event) => accessEventToDbRow(event));
  const upsertResult = await client
    .from(appConfig.accessEventsTable)
    .upsert(upsertPayload, { onConflict: "event_key" });

  if (upsertResult.error) {
    throw upsertResult.error;
  }

  return {
    fetched: rows?.length ?? 0,
    converted: convertedRows.length,
    upserted: convertedRows.length,
    skipped: (rows?.length ?? 0) - convertedRows.length,
  };
}

function mergeWithLatestResolutions(events: AccessEvent[], resolutions: ResolutionRow[]) {
  const latestByEvent = new Map<string, ResolutionRow>();
  for (const resolution of resolutions) {
    const existing = latestByEvent.get(resolution.event_key);
    if (!existing || new Date(existing.resolved_at).getTime() < new Date(resolution.resolved_at).getTime()) {
      latestByEvent.set(resolution.event_key, resolution);
    }
  }
  return events.map((event) => deriveMetaFromResolution(event, latestByEvent.get(event.eventKey)));
}

function sortByTimestampDesc(events: AccessEvent[]) {
  return [...events].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
}

export async function convertPendingRawRows() {
  return convertPendingRawRowsSupabase();
}

async function upsertAccessEventsInSupabase(events: AccessEvent[]) {
  if (events.length === 0) {
    return;
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return;
  }

  const upsertResult = await client
    .from(appConfig.accessEventsTable)
    .upsert(events.map((event) => accessEventToDbRow(event)), { onConflict: "event_key" });

  if (upsertResult.error) {
    throw upsertResult.error;
  }
}

async function materializeRegistrationEvent(store: MemoryStore, registration: RegistrationRow): Promise<AccessEvent | null> {
  const rawRow = registrationToRawRow(registration);
  const converted = await convertRawRowToAccessEventWithLookup(rawRow, columnMappingConfig);
  if (!converted) {
    return null;
  }

  const rawIndex = store.rawRows.findIndex((row) => String(row.id ?? "") === registrationKey(registration.epc));
  if (rawIndex >= 0) {
    store.rawRows[rawIndex] = rawRow;
  } else {
    store.rawRows.unshift(rawRow);
  }

  const eventIndex = store.events.findIndex((event) => event.eventKey === converted.eventKey);
  if (eventIndex >= 0) {
    store.events[eventIndex] = converted;
  } else {
    store.events.unshift(converted);
  }

  return converted;
}

export async function upsertVehicleRegistration(input: {
  epc: string;
  tid?: string | null;
  label: string;
  status?: string | null;
  kind?: string | null;
  subjectMeta?: string | null;
  plate?: string | null;
  reason?: string | null;
  readerId?: string;
  mode?: "handheld" | "antenna";
  gateId?: string;
  direction?: "entry" | "exit";
  ownerName?: string | null;
  vehicleName?: string | null;
  location?: string | null;
  photoUrl?: string | null;
  websiteUrl?: string | null;
  websitePayload?: Record<string, unknown> | null;
  materializeEvent?: boolean;
}) {
  const epc = input.epc.trim().toUpperCase();
  const label = input.label.trim();

  if (!epc || !label) {
    return null;
  }

  const registration: RegistrationRow = {
    epc,
    tid: input.tid?.trim() || null,
    label,
    status: input.status?.trim().toLowerCase() || null,
    kind: input.kind?.trim().toLowerCase() || null,
    subject_meta: input.subjectMeta?.trim() || null,
    plate: input.plate?.trim() || null,
    reason: input.reason?.trim() || null,
    reader_id: input.readerId?.trim() || "CW-C72-01",
    mode: input.mode === "antenna" ? "antenna" : "handheld",
    gate_id: input.gateId?.trim() || "gate-main-entry",
    direction: input.direction === "exit" ? "exit" : "entry",
    owner_name: input.ownerName?.trim() || null,
    vehicle_name: input.vehicleName?.trim() || null,
    location: input.location?.trim() || null,
    photo_url: input.photoUrl?.trim() || null,
    website_url: input.websiteUrl?.trim() || null,
    website_payload: input.websitePayload ?? {},
    updated_at: new Date().toISOString(),
  };

  await upsertRegistrationInSupabase(registration);

  const store = await getReadyMemoryStore();
  const existingIndex = store.registrations.findIndex((item) => item.epc === registration.epc);
  if (existingIndex >= 0) {
    store.registrations[existingIndex] = registration;
  } else {
    store.registrations.unshift(registration);
  }

  const event = input.materializeEvent === false ? null : await materializeRegistrationEvent(store, registration);
  saveMemoryStoreToDisk(store);

  if (event) {
    await upsertAccessEventsInSupabase([event]);
    broadcastLiveMessage({
      type: "scan-created",
      source: "registration-mirror",
      eventKey: event.eventKey,
      epc: event.epc,
      message: `${event.subjectName} was synced from ABIOT.`,
    });
  }

  return {
    registration,
    event,
  };
}

export async function syncLatestRegistrations(surface: "manager" | "tablet" = "manager", gateId?: string) {
  const store = await getReadyMemoryStore();

  const fromSupabase = await fetchAllRegistrationsFromSupabase();
  if (fromSupabase.length > 0) {
    const byEpc = new Map<string, RegistrationRow>();
    for (const row of store.registrations) {
      byEpc.set(row.epc, row);
    }
    for (const row of fromSupabase) {
      const existing = byEpc.get(row.epc);
      if (!existing || new Date(row.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
        byEpc.set(row.epc, row);
      }
    }
    store.registrations = Array.from(byEpc.values());
  }

  const registrations = [...store.registrations].sort(
    (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
  );

  const convertedEvents: AccessEvent[] = [];

  for (const registration of registrations) {
    const converted = await materializeRegistrationEvent(store, registration);
    if (!converted) {
      continue;
    }

    convertedEvents.push(converted);
  }

  saveMemoryStoreToDisk(store);

  await upsertAccessEventsInSupabase(convertedEvents);

  if (convertedEvents.length > 0) {
    const latest = convertedEvents[0];
    broadcastLiveMessage({
      type: "events-changed",
      source: "manual-sync",
      eventKey: latest.eventKey,
      epc: latest.epc,
      message: `${convertedEvents.length} registered vehicle${convertedEvents.length === 1 ? "" : "s"} synced into the feed.`,
    });
  }

  const snapshot = await fetchEvents(surface, gateId);
  return {
    synced: convertedEvents.length,
    ...snapshot,
  };
}

export async function fetchEvents(surface: "manager" | "tablet", gateId?: string): Promise<EventsResponse> {
  await convertPendingRawRows();
  const client = getSupabaseServerClient();

  if (!client) {
    const memory = await getReadyMemoryStore();
    const merged = mergeWithLatestResolutions(memory.events, memory.resolutions);
    const filtered = gateId ? merged.filter((event) => event.gateId === gateId) : merged;
    const sorted = sortByTimestampDesc(filtered);
    return {
      events: sorted.slice(0, appConfig.fetchLimit),
      counters: computeCounters(sorted),
      generatedAt: new Date().toISOString(),
    };
  }

  let eventsQuery = client
    .from(appConfig.accessEventsTable)
    .select("*")
    .order("ts", { ascending: false })
    .limit(appConfig.fetchLimit);

  if (gateId && surface === "manager") {
    eventsQuery = eventsQuery.eq("gate_id", gateId);
  }

  const eventsResult = await eventsQuery;
  if (eventsResult.error) {
    throw eventsResult.error;
  }

  const eventRows = (eventsResult.data ?? []) as Record<string, unknown>[];
  const events = eventRows.map((row) => mapDbRowToAccessEvent(row));

  const eventKeys = events.map((event) => event.eventKey);
  let resolutions: ResolutionRow[] = [];
  if (eventKeys.length > 0) {
    const resolutionsResult = await client
      .from(appConfig.eventResolutionsTable)
      .select("event_key,status,outcome,note,resolved_by,resolved_at")
      .in("event_key", eventKeys)
      .order("resolved_at", { ascending: false });
    if (resolutionsResult.error) {
      throw resolutionsResult.error;
    }
    resolutions = (resolutionsResult.data ?? []) as ResolutionRow[];
  }

  const merged = mergeWithLatestResolutions(events, resolutions);
  return {
    events: merged,
    counters: computeCounters(merged),
    generatedAt: new Date().toISOString(),
  };
}

export async function resolveEvent(eventKey: string, input: ResolutionInput): Promise<AccessEvent | null> {
  const note = input.note?.trim() || null;
  const resolutionRow: ResolutionRow = {
    event_key: eventKey,
    status: input.status,
    outcome: input.outcome,
    note,
    resolved_by: input.resolvedBy,
    resolved_at: new Date().toISOString(),
  };

  const client = getSupabaseServerClient();
  if (!client) {
    const memory = await getReadyMemoryStore();
    memory.resolutions.unshift(resolutionRow);
    const index = memory.events.findIndex((event) => event.eventKey === eventKey);
    if (index === -1) return null;
    const updated = deriveMetaFromResolution(memory.events[index], resolutionRow);
    memory.events[index] = updated;
    saveMemoryStoreToDisk(memory);
    broadcastLiveMessage({
      type: "event-resolved",
      source: "resolve-memory",
      eventKey: updated.eventKey,
      epc: updated.epc,
      message: `${updated.subjectName} was updated by the guard.`,
    });
    return updated;
  }

  const insertResolution = await client.from(appConfig.eventResolutionsTable).insert({
    event_key: resolutionRow.event_key,
    status: resolutionRow.status,
    outcome: resolutionRow.outcome,
    note: resolutionRow.note,
    resolved_by: resolutionRow.resolved_by,
    resolved_at: resolutionRow.resolved_at,
  });

  if (insertResolution.error) {
    throw insertResolution.error;
  }

  const updateEvent = await client
    .from(appConfig.accessEventsTable)
    .update({
      status: input.status,
      outcome: input.outcome,
      resolved_by: input.resolvedBy,
      resolved_at: resolutionRow.resolved_at,
      updated_at: new Date().toISOString(),
    })
    .eq("event_key", eventKey);
  if (updateEvent.error) {
    throw updateEvent.error;
  }

  const readEvent = await client
    .from(appConfig.accessEventsTable)
    .select("*")
    .eq("event_key", eventKey)
    .limit(1)
    .maybeSingle();

  if (readEvent.error) {
    throw readEvent.error;
  }

  if (!readEvent.data) {
    return null;
  }
  const updated = deriveMetaFromResolution(mapDbRowToAccessEvent(readEvent.data), resolutionRow);
  broadcastLiveMessage({
    type: "event-resolved",
    source: "resolve-supabase",
    eventKey: updated.eventKey,
    epc: updated.epc,
    message: `${updated.subjectName} was updated by the guard.`,
  });
  return updated;
}

function composeRawRowFromScan(input: {
  epc: string;
  tid?: string | null;
  readerId?: string;
  mode?: "handheld" | "antenna";
  gateId?: string;
  direction?: "entry" | "exit";
  plate?: string | null;
  status?: string | null;
  kind?: string | null;
  subjectName?: string | null;
  subjectMeta?: string | null;
  reason?: string | null;
}): RawScanRow {
  const nowIso = new Date().toISOString();
  const row: RawScanRow = {
    [columnMappingConfig.epc]: input.epc,
    [columnMappingConfig.tid]: input.tid ?? null,
    [columnMappingConfig.readerId]: input.readerId ?? "CW-C72-01",
    [columnMappingConfig.ts]: nowIso,
    [columnMappingConfig.gateId]: input.gateId ?? "gate-main-entry",
    [columnMappingConfig.direction]: input.direction ?? "entry",
    mode: input.mode ?? "handheld",
    plate: input.plate ?? null,
    status: input.status ?? null,
    kind: input.kind ?? null,
    subject_name: input.subjectName ?? null,
    subject_meta: input.subjectMeta ?? null,
    reason: input.reason ?? null,
  };

  if (columnMappingConfig.plate) {
    row[columnMappingConfig.plate] = input.plate ?? null;
  }

  return row;
}

export async function insertManualRawScan(input: {
  epc: string;
  tid?: string | null;
  readerId?: string;
  mode?: "handheld" | "antenna";
  gateId?: string;
  direction?: "entry" | "exit";
  plate?: string | null;
  status?: string | null;
  kind?: string | null;
  subjectName?: string | null;
  subjectMeta?: string | null;
  reason?: string | null;
}): Promise<AccessEvent | null> {
  const rawRow = composeRawRowFromScan(input);
  const client = getSupabaseServerClient();
  const converted = await convertRawRowToAccessEventWithLookup(rawRow, columnMappingConfig);

  if (!converted) {
    return null;
  }

  if (!client) {
    const memory = await getReadyMemoryStore();
    memory.rawRows.unshift(rawRow);
    const existingIndex = memory.events.findIndex((event) => event.eventKey === converted.eventKey);
    if (existingIndex >= 0) {
      memory.events[existingIndex] = converted;
    } else {
      memory.events.unshift(converted);
    }
    saveMemoryStoreToDisk(memory);
    broadcastLiveMessage({
      type: "scan-created",
      source: "manual-memory",
      eventKey: converted.eventKey,
      epc: converted.epc,
      message: `${converted.subjectName} was added to the live queue.`,
    });
    return converted;
  }

  const insertRaw = await client.from(appConfig.rawScanTable).insert(rawRow);
  if (insertRaw.error) {
    const upsertDirect = await client
      .from(appConfig.accessEventsTable)
      .upsert([accessEventToDbRow(converted)], { onConflict: "event_key" });
    if (upsertDirect.error) {
      throw upsertDirect.error;
    }
    broadcastLiveMessage({
      type: "scan-created",
      source: "direct-upsert",
      eventKey: converted.eventKey,
      epc: converted.epc,
      message: `${converted.subjectName} was added to the live queue.`,
    });
    return converted;
  }

  await convertPendingRawRows();

  const readEvent = await client
    .from(appConfig.accessEventsTable)
    .select("*")
    .eq("epc", input.epc)
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readEvent.error) {
    throw readEvent.error;
  }

  const finalEvent = readEvent.data ? mapDbRowToAccessEvent(readEvent.data) : converted;
  broadcastLiveMessage({
    type: "scan-created",
    source: "raw-insert",
    eventKey: finalEvent.eventKey,
    epc: finalEvent.epc,
    message: `${finalEvent.subjectName} was added to the live queue.`,
  });
  return finalEvent;
}

export function __resetMemoryStoreForTests() {
  const globalState = globalThis as unknown as Record<string, unknown>;
  delete globalState[MEMORY_STORE_KEY];
}
