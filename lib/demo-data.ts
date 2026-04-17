export interface SiteInfo {
  tenant: string;
  city: string;
  units: number;
  residents: number;
  activeGuards: number;
}

export interface Gate {
  id: string;
  label: string;
  short: string;
  kind: string;
  lane: string;
}

export interface Reader {
  id: string;
  model: string;
  type: "handheld" | "antenna";
  assignedTo: string;
  gate: string;
  rssi: number;
}

export interface DirectoryRecord {
  type: "resident" | "worker" | "guest" | "denied";
  status: "allowed" | "review" | "denied";
  name: string;
  unit?: string;
  vehicle?: string;
  role?: string;
  employer?: string;
  host?: string;
  shiftEnd?: string;
  passWindow?: string;
  phone?: string;
  plate?: string;
  zones?: string[];
  location?: string;
  rssi?: number;
  reason?: string;
  since?: string;
}

export interface UnknownPoolRecord {
  epc: string;
  hint: string;
  vehicle: string;
  plate: string;
}

export interface Preset {
  label: string;
  epc: string;
}

export const SITE_INFO: SiteInfo = {
  tenant: "Sundara Greens Estate",
  city: "Pune, India",
  units: 412,
  residents: 986,
  activeGuards: 14,
};

export const GATES: Gate[] = [
  { id: "gate-main-entry", label: "Main Gate - Entry", short: "Main Entry", kind: "primary", lane: "IN" },
  { id: "gate-main-exit", label: "Main Gate - Exit", short: "Main Exit", kind: "primary", lane: "OUT" },
  { id: "gate-service", label: "Service Gate", short: "Service", kind: "service", lane: "IN/OUT" },
  { id: "gate-vip", label: "VIP Gate", short: "VIP", kind: "restricted", lane: "IN/OUT" },
];

export const READERS: Reader[] = [
  {
    id: "CW-C72-01",
    model: "Chainway C72",
    type: "handheld",
    assignedTo: "Kiran P. (Guard 14)",
    gate: "Main Gate - Entry",
    rssi: 86,
  },
  {
    id: "CW-C72-02",
    model: "Chainway C72",
    type: "handheld",
    assignedTo: "Suresh T. (Guard 09)",
    gate: "Service Gate",
    rssi: 79,
  },
  {
    id: "CW-FM830-A",
    model: "Chainway FM830",
    type: "antenna",
    assignedTo: "Fixed mount - Entry canopy",
    gate: "Main Gate - Entry",
    rssi: 92,
  },
  {
    id: "CW-FM830-B",
    model: "Chainway FM830",
    type: "antenna",
    assignedTo: "Fixed mount - Exit canopy",
    gate: "Main Gate - Exit",
    rssi: 88,
  },
];

export const DIRECTORY_BY_EPC: Record<string, DirectoryRecord> = {
  E28011606000021180A7F001: {
    type: "resident",
    status: "allowed",
    name: "Priya Mehta",
    plate: "MH 12 AB 4421",
    unit: "Courtyard A-1204",
    vehicle: "White Hyundai Creta",
    phone: "+91 98220 43210",
    zones: ["Main Gate", "Basement P2", "Lobby A"],
    location: "Basement P2 - Bay B14",
    rssi: 92,
    since: "2021-06-14",
  },
  E28011606000021180A7F002: {
    type: "resident",
    status: "allowed",
    name: "Arjun Rao",
    plate: "MH 14 EV 1801",
    unit: "Lofts L-804",
    vehicle: "Black Kia EV6",
    phone: "+91 90280 11221",
    zones: ["Main Gate", "Lofts Lobby", "Tower L Lift 2"],
    location: "Lofts basement - EV charger 3",
    rssi: 86,
    since: "2023-02-01",
  },
  E28011606000021180A7F003: {
    type: "resident",
    status: "allowed",
    name: "Deepa Iyer",
    plate: "MH 12 AQ 7714",
    unit: "Courtyard A-0902",
    vehicle: "Silver Toyota Innova",
    phone: "+91 98501 99820",
    zones: ["Main Gate", "Basement P1", "Lobby A"],
    location: "Basement P1 - Bay A22",
    rssi: 88,
    since: "2019-09-19",
  },
  E28011606000021180A7F004: {
    type: "resident",
    status: "allowed",
    name: "Family Mehta - Second car",
    plate: "MH 12 CJ 0089",
    unit: "Courtyard A-1204",
    vehicle: "Grey Tata Punch",
    phone: "+91 98220 43210",
    zones: ["Main Gate", "Basement P2"],
    location: "Basement P2 - Bay B15",
    rssi: 78,
    since: "2024-03-04",
  },
  E28011606000021180W001: {
    type: "worker",
    status: "allowed",
    name: "Kamal Singh",
    role: "Cook",
    employer: "Mehta household - A-1204",
    host: "Priya Mehta",
    shiftEnd: "17:00",
    plate: "Worker badge",
    zones: ["Service Gate", "Tower A service lift", "A-1204"],
    location: "Tower A service corridor",
    rssi: 73,
    since: "2022-11-02",
  },
  E28011606000021180W002: {
    type: "worker",
    status: "allowed",
    name: "Lakshmi Devi",
    role: "Housekeeping",
    employer: "Estate maintenance",
    host: "Facilities office",
    shiftEnd: "18:30",
    plate: "Worker badge",
    zones: ["Service Gate", "All public areas"],
    location: "Clubhouse corridor",
    rssi: 69,
    since: "2020-04-10",
  },
  E28011606000021180W003: {
    type: "worker",
    status: "review",
    name: "Nisha Kapoor",
    role: "Domestic help",
    employer: "Lofts concierge desk",
    host: "L-512",
    shiftEnd: "15:00",
    plate: "Worker badge",
    zones: ["Service Gate", "Staff Lift"],
    location: "Service gate queue",
    rssi: 59,
    reason: "Worker badge is outside approved shift window.",
    since: "2023-07-22",
  },
  E28011606000021180G001: {
    type: "guest",
    status: "allowed",
    name: "Neha Kapoor",
    host: "Arjun Rao - L-804",
    plate: "DL 10 CK 9122",
    vehicle: "Silver Honda City",
    passWindow: "16:30 - 20:30",
    zones: ["Main Gate", "Lofts Lobby"],
    location: "Visitor parking V-07",
    rssi: 66,
    since: "today",
  },
  E28011606000021180G002: {
    type: "guest",
    status: "allowed",
    name: "Rahul Menon",
    host: "Deepa Iyer - A-0902",
    plate: "KA 03 MN 0912",
    vehicle: "White Maruti Baleno",
    passWindow: "18:00 - 22:00",
    zones: ["Main Gate", "Lobby A"],
    location: "Visitor parking V-11",
    rssi: 64,
    since: "today",
  },
  E28011606000021180D001: {
    type: "denied",
    status: "denied",
    name: "Blocked vehicle",
    plate: "UK 07 ZZ 9981",
    vehicle: "Grey Mahindra Scorpio",
    reason: "Flagged by estate management - unresolved dues dispute.",
    location: "Main road approach",
    rssi: 48,
  },
  E28011606000021180D002: {
    type: "denied",
    status: "denied",
    name: "Blocked - Contractor",
    plate: "MH 14 TQ 2204",
    vehicle: "Yellow Tata Ace",
    reason: "Vendor contract expired 2026-02-10.",
    location: "Service gate approach",
    rssi: 52,
  },
};

export const UNKNOWN_POOL: UnknownPoolRecord[] = [
  { epc: "E28011606000021180UN001", hint: "Courier vehicle", vehicle: "Orange DHL van", plate: "MH 14 DX 1902" },
  { epc: "E28011606000021180UN002", hint: "Visitor - no pre-pass", vehicle: "Blue Honda Amaze", plate: "MH 12 AP 4422" },
  { epc: "E28011606000021180UN003", hint: "Food delivery rider", vehicle: "Black Yamaha (2W)", plate: "MH 14 WE 0099" },
  { epc: "E28011606000021180UN004", hint: "Cab - unscheduled", vehicle: "White Toyota Etios", plate: "MH 12 TZ 5533" },
  { epc: "E28011606000021180UN005", hint: "Maintenance truck", vehicle: "Yellow Eicher LCV", plate: "MH 14 LT 9020" },
];

export const PRESETS: Preset[] = [
  { label: "Resident - Creta", epc: "E28011606000021180A7F001" },
  { label: "Resident - EV6", epc: "E28011606000021180A7F002" },
  { label: "Cook - Kamal", epc: "E28011606000021180W001" },
  { label: "Expected guest", epc: "E28011606000021180G001" },
  { label: "Shift-expired worker", epc: "E28011606000021180W003" },
  { label: "Denied car", epc: "E28011606000021180D001" },
  { label: "Unknown - courier van", epc: "E28011606000021180UN001" },
  { label: "Unknown - visitor", epc: "E28011606000021180UN002" },
];

export function lookupUnknownByEpc(epc: string) {
  return UNKNOWN_POOL.find((entry) => entry.epc === epc);
}

