import { abiotConfig } from "@/lib/config";

export interface DirectoryDetails {
  kind: string;
  status: "allowed" | "review" | "denied";
  subjectName: string;
  subjectMeta: string;
  plate: string | null;
  rssi: number | null;
  location: string | null;
  reason: string | null;
  tid?: string | null;
  payload?: Record<string, unknown>;
}

interface AbiotLookupData {
  id: number;
  uhf_epc_hex: string;
  uhf_tid: string | null;
  label: string | null;
  state: string | null;
  website: unknown;
  views: number | null;
  created_at: string | null;
}

interface LookupCacheEntry {
  expiresAt: number;
  value: DirectoryDetails | null;
}

const LOOKUP_CACHE_KEY = "__seceurope_web_abiot_lookup_cache__";
const LOOKUP_TTL_MS = 60 * 1000;
const LOOKUP_TIMEOUT_MS = 2500;
const DENIED_STATES = ["blocked", "block", "denied", "deny", "blacklist", "blacklisted", "forbidden"];
const REVIEW_STATES = ["review", "pending", "manual", "hold", "unknown"];

function getLookupCache(): Map<string, LookupCacheEntry> {
  const globalState = globalThis as unknown as Record<string, unknown>;
  if (!globalState[LOOKUP_CACHE_KEY]) {
    globalState[LOOKUP_CACHE_KEY] = new Map<string, LookupCacheEntry>();
  }
  return globalState[LOOKUP_CACHE_KEY] as Map<string, LookupCacheEntry>;
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object") {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function maybeParseJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function readPath(obj: Record<string, unknown> | null, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    const currentObject = asObject(current);
    if (!currentObject || !(key in currentObject)) {
      return null;
    }
    current = currentObject[key];
  }
  return current;
}

function pickString(obj: Record<string, unknown> | null, paths: string[][]): string | null {
  for (const path of paths) {
    const value = asString(readPath(obj, path));
    if (value) {
      return value;
    }
  }
  return null;
}

function deriveStatus(state: string | null): "allowed" | "review" | "denied" {
  const normalized = state?.toLowerCase() || "";
  if (DENIED_STATES.some((token) => normalized.includes(token))) {
    return "denied";
  }
  if (REVIEW_STATES.some((token) => normalized.includes(token))) {
    return "review";
  }
  return "allowed";
}

function deriveKind(state: string | null, website: Record<string, unknown> | null): string {
  const explicitKind = pickString(website, [
    ["kind"],
    ["type"],
    ["category"],
    ["vehicle", "kind"],
    ["vehicle", "type"],
    ["owner", "type"],
  ]);
  if (explicitKind) {
    return explicitKind.toLowerCase();
  }
  const normalized = state?.toLowerCase() || "";
  if (DENIED_STATES.some((token) => normalized.includes(token))) {
    return "denied";
  }
  return "registered";
}

function buildSubjectMeta(website: Record<string, unknown> | null, state: string | null, subjectName: string): string {
  const parts: string[] = [];
  const ownerName = pickString(website, [
    ["owner_name"],
    ["ownerName"],
    ["name"],
    ["owner", "name"],
  ]);
  const vehicleName = pickString(website, [
    ["vehicle"],
    ["vehicle_name"],
    ["vehicleName"],
    ["vehicle", "name"],
    ["car"],
  ]);
  const location = pickString(website, [
    ["location"],
    ["unit"],
    ["flat"],
    ["apartment"],
    ["building"],
  ]);

  if (ownerName && ownerName !== subjectName) {
    parts.push(ownerName);
  }
  if (vehicleName) {
    parts.push(vehicleName);
  }
  if (location) {
    parts.push(location);
  }
  if (state) {
    parts.push(`state ${state}`);
  }

  return parts.length > 0 ? parts.join(" - ") : "Registered in ABIOT lookup";
}

export function mapLookupDataToDirectoryDetails(data: AbiotLookupData): DirectoryDetails {
  const website = asObject(maybeParseJson(data.website));
  const state = asString(data.state);
  const subjectName =
    asString(data.label) ||
    pickString(website, [["name"], ["owner_name"], ["ownerName"], ["owner", "name"]]) ||
    "Registered vehicle";
  const plate = pickString(website, [
    ["plate"],
    ["plate_number"],
    ["plateNumber"],
    ["license_plate"],
    ["licensePlate"],
    ["vehicle", "plate"],
  ]);
  const location = pickString(website, [["location"], ["gate"], ["unit"], ["flat"], ["apartment"]]);
  const reason = pickString(website, [["reason"], ["note"], ["notes"]]) || (state ? `ABIOT state: ${state}` : null);
  const status = deriveStatus(state);
  const kind = deriveKind(state, website);

  return {
    kind,
    status,
    subjectName,
    subjectMeta: buildSubjectMeta(website, state, subjectName),
    plate,
    rssi: null,
    location,
    reason: status === "allowed" ? null : reason,
    tid: asString(data.uhf_tid),
    payload: {
      source: "abiot",
      id: data.id,
      label: data.label,
      state: data.state,
      website: maybeParseJson(data.website),
      views: data.views,
      created_at: data.created_at,
      uhf_tid: data.uhf_tid,
      uhf_epc_hex: data.uhf_epc_hex,
    },
  };
}

export async function lookupAbiotDirectoryDetails(epc: string): Promise<DirectoryDetails | null> {
  if (!epc || !abiotConfig.lookupUrl) {
    return null;
  }

  if (process.env.NODE_ENV === "test" && !process.env.ABIOT_LOOKUP_URL?.trim()) {
    return null;
  }

  const cache = getLookupCache();
  const cached = cache.get(epc);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const url = new URL(abiotConfig.lookupUrl);
    url.searchParams.set("uhf_epc_hex", epc);

    const response = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });

    if (!response.ok) {
      cache.set(epc, { expiresAt: Date.now() + LOOKUP_TTL_MS, value: null });
      return null;
    }

    const payload = (await response.json()) as {
      success?: boolean;
      found?: boolean;
      data?: AbiotLookupData;
    };

    if (!payload?.success || !payload.found || !payload.data) {
      cache.set(epc, { expiresAt: Date.now() + LOOKUP_TTL_MS, value: null });
      return null;
    }

    const mapped = mapLookupDataToDirectoryDetails(payload.data);
    cache.set(epc, { expiresAt: Date.now() + LOOKUP_TTL_MS, value: mapped });
    return mapped;
  } catch {
    cache.set(epc, { expiresAt: Date.now() + LOOKUP_TTL_MS, value: null });
    return null;
  }
}

export async function updateAbiotRecord(input: {
  uhf_epc_hex: string;
  uhf_tid: string;
  label?: string;
  state?: string;
  website?: Record<string, unknown> | string;
}) {
  if (!abiotConfig.updateUrl || !abiotConfig.updateToken) {
    throw new Error("ABIOT update endpoint is not configured");
  }

  const url = new URL(abiotConfig.updateUrl);
  url.searchParams.set("token", abiotConfig.updateToken);
  url.searchParams.set("uhf_epc_hex", input.uhf_epc_hex);
  url.searchParams.set("uhf_tid", input.uhf_tid);
  if (input.label) {
    url.searchParams.set("label", input.label);
  }
  if (input.state) {
    url.searchParams.set("state", input.state);
  }
  if (input.website !== undefined) {
    url.searchParams.set("website", typeof input.website === "string" ? input.website : JSON.stringify(input.website));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`ABIOT update failed (${response.status})`);
  }

  return response.json();
}

export async function sendAbiotMail(input: {
  usermail: string;
  uid: string;
  newsletter?: string;
}) {
  if (!abiotConfig.mailUrl || !abiotConfig.mailKeyId) {
    throw new Error("ABIOT mail endpoint is not configured");
  }

  const url = new URL(abiotConfig.mailUrl);
  url.searchParams.set("keyid", abiotConfig.mailKeyId);
  url.searchParams.set("usermail", input.usermail);
  url.searchParams.set("uid", input.uid);
  url.searchParams.set("newsletter", input.newsletter || "no");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`ABIOT mail failed (${response.status})`);
  }

  return response.text();
}
