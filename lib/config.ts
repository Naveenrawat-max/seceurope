import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { type ColumnMappingConfig } from "@/lib/types";

function env(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function readLocalProperties() {
  const candidates = [
    path.resolve(/* turbopackIgnore: true */ process.cwd(), "local.properties"),
    path.resolve(/* turbopackIgnore: true */ process.cwd(), "..", "local.properties"),
  ];

  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) {
        continue;
      }
      const content = readFileSync(candidate, "utf8");
      const values = new Map<string, string>();
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) {
          continue;
        }
        const separator = line.indexOf("=");
        if (separator <= 0) {
          continue;
        }
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim();
        if (key) {
          values.set(key, value);
        }
      }
      return values;
    } catch {
      // ignore local fallback parsing errors
    }
  }

  return new Map<string, string>();
}

const localProperties = readLocalProperties();

function localProperty(key: string) {
  return localProperties.get(key)?.trim() || "";
}

export const columnMappingConfig: ColumnMappingConfig = {
  epc: env("MAP_EPC", "epc"),
  tid: env("MAP_TID", "tid"),
  readerId: env("MAP_READER_ID", "reader_id"),
  ts: env("MAP_TS", "ts"),
  gateId: env("MAP_GATE_ID", "gate_id"),
  direction: env("MAP_DIRECTION", "direction"),
  plate: process.env.MAP_PLATE?.trim() || undefined,
};

export const appConfig = {
  rawScanTable: env("RAW_SCAN_TABLE", "raw_scans"),
  accessEventsTable: env("ACCESS_EVENTS_TABLE", "access_events"),
  eventResolutionsTable: env("EVENT_RESOLUTIONS_TABLE", "event_resolutions"),
  vehicleRegistrationsTable: env("VEHICLE_REGISTRATIONS_TABLE", "vehicle_registrations"),
  convertBatchSize: envNumber("CONVERT_BATCH_SIZE", 400),
  fetchLimit: envNumber("EVENT_FETCH_LIMIT", 250),
  internalConvertToken: process.env.CONVERT_INTERNAL_TOKEN?.trim() || "",
};

const abiotBaseUrl = env("ABIOT_API_BASE_URL", "https://api.abiot.re").replace(/\/+$/, "");
const localLookupBase = localProperty("trc.abiot.lookupBaseUrl").replace(/\/+$/, "");
const localUpdateBase = localProperty("trc.abiot.updateBaseUrl").replace(/\/+$/, "");

export const abiotConfig = {
  baseUrl: abiotBaseUrl,
  lookupUrl: env("ABIOT_LOOKUP_URL", localLookupBase ? `${localLookupBase}/lookup/index.php` : `${abiotBaseUrl}/lookup/index.php`),
  updateUrl: env("ABIOT_UPDATE_URL", localUpdateBase ? `${localUpdateBase}/update/index.php` : `${abiotBaseUrl}/update/index.php`),
  mailUrl: env("ABIOT_MAIL_URL", `${abiotBaseUrl}/mail/index.php`),
  updateToken: process.env.ABIOT_UPDATE_TOKEN?.trim() || localProperty("trc.abiot.updateToken") || "",
  mailKeyId: process.env.ABIOT_MAIL_KEYID?.trim() || localProperty("trc.abiot.mailKeyId") || "",
};

export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "",
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "",
};

export function hasSupabaseServerCredentials(): boolean {
  return Boolean(supabaseConfig.url && supabaseConfig.serviceRoleKey);
}
