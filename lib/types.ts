export type EventStatus = "allowed" | "review" | "denied";

export interface AccessEvent {
  eventKey: string;
  ts: string;
  epc: string;
  tid: string | null;
  readerId: string;
  mode: "handheld" | "antenna";
  gateId: string;
  direction: "entry" | "exit";
  status: EventStatus;
  outcome: string;
  kind: string;
  subjectName: string;
  subjectMeta: string;
  plate: string | null;
  rssi: number | null;
  location: string | null;
  reason: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  notes: string[];
  payload: Record<string, unknown>;
}

export interface ResolutionInput {
  status: EventStatus;
  outcome: string;
  note?: string;
  resolvedBy: string;
}

export interface VehicleRegistrationInput {
  epc: string;
  label: string;
  state: string;
  tid?: string | null;
  eventKey?: string | null;
  ownerName?: string | null;
  vehicleName?: string | null;
  plate?: string | null;
  location?: string | null;
  vehicleKind?: string | null;
  details?: string | null;
  photoUrl?: string | null;
  websiteUrl?: string | null;
  readerId?: string;
  mode?: "handheld" | "antenna";
  gateId?: string;
  direction?: "entry" | "exit";
  resolvedBy?: string;
}

export interface ColumnMappingConfig {
  epc: string;
  tid: string;
  readerId: string;
  ts: string;
  gateId: string;
  direction: string;
  plate?: string;
}

export interface EventCounters {
  total: number;
  pending: number;
  allowed: number;
  denied: number;
}

export interface EventsResponse {
  events: AccessEvent[];
  counters: EventCounters;
  generatedAt: string;
}

export interface ConversionResult {
  fetched: number;
  converted: number;
  upserted: number;
  skipped: number;
}

export interface RawScanRow {
  [key: string]: unknown;
}
