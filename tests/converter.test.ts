import { afterEach, describe, expect, it, vi } from "vitest";
import { convertRawRowToAccessEvent, convertRawRowToAccessEventWithLookup } from "@/lib/converter";
import type { ColumnMappingConfig } from "@/lib/types";

const baseMap: ColumnMappingConfig = {
  epc: "raw_epc",
  tid: "raw_tid",
  readerId: "raw_reader",
  ts: "raw_ts",
  gateId: "raw_gate",
  direction: "raw_dir",
  plate: "raw_plate",
};

describe("convertRawRowToAccessEvent", () => {
  afterEach(() => {
    delete process.env.ABIOT_LOOKUP_URL;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps a raw column row to canonical event json", () => {
    const event = convertRawRowToAccessEvent(
      {
        id: "1001",
        raw_epc: "E28011606000021180A7F001",
        raw_tid: "TID-1001",
        raw_reader: "CW-FM830-A",
        raw_ts: "2026-04-15T10:00:00.000Z",
        raw_gate: "gate-main-entry",
        raw_dir: "entry",
        raw_plate: "MH 12 AB 4421",
      },
      baseMap,
    );

    expect(event).not.toBeNull();
    expect(event?.eventKey).toBe("evt_1001");
    expect(event?.epc).toBe("E28011606000021180A7F001");
    expect(event?.tid).toBe("TID-1001");
    expect(event?.readerId).toBe("CW-FM830-A");
    expect(event?.mode).toBe("antenna");
    expect(event?.status).toBe("allowed");
    expect(event?.kind).toBe("resident");
  });

  it("defaults unknown/partial rows to review + unknown", () => {
    const event = convertRawRowToAccessEvent(
      {
        raw_epc: "E28011606000021180UN404",
      },
      baseMap,
    );

    expect(event).not.toBeNull();
    expect(event?.status).toBe("review");
    expect(event?.kind).toBe("unknown");
    expect(event?.outcome).toBe("needs-review");
    expect(event?.gateId).toBe("gate-main-entry");
    expect(event?.direction).toBe("entry");
  });

  it("supports mapper changes without code changes", () => {
    const mapped = convertRawRowToAccessEvent(
      {
        epc_col: "E28011606000021180A7F002",
        tid_col: "TID-2002",
        reader_col: "CW-C72-01",
        when_col: "2026-04-15T11:00:00.000Z",
        gate_col: "gate-service",
        dir_col: "exit",
      },
      {
        epc: "epc_col",
        tid: "tid_col",
        readerId: "reader_col",
        ts: "when_col",
        gateId: "gate_col",
        direction: "dir_col",
      },
    );

    expect(mapped).not.toBeNull();
    expect(mapped?.epc).toBe("E28011606000021180A7F002");
    expect(mapped?.readerId).toBe("CW-C72-01");
    expect(mapped?.gateId).toBe("gate-service");
    expect(mapped?.direction).toBe("exit");
  });

  it("merges ABIOT lookup data into the canonical event", async () => {
    process.env.ABIOT_LOOKUP_URL = "https://api.abiot.lookup/lookup/index.php";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        found: true,
        data: {
          id: 42,
          uhf_epc_hex: "E28011606000021180AB1001",
          uhf_tid: "TID-ABIOT-42",
          label: "John Carter",
          state: "active",
          website: {
            owner_name: "John Carter",
            vehicle: "White Tesla Model Y",
            plate: "MH12AB1234",
            location: "Tower 3",
          },
          views: 12,
          created_at: "2026-04-15T08:45:00.000Z",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const event = await convertRawRowToAccessEventWithLookup(
      {
        id: "abiot-42",
        raw_epc: "E28011606000021180AB1001",
        raw_reader: "CW-C72-01",
        raw_ts: "2026-04-15T10:00:00.000Z",
        raw_gate: "gate-main-entry",
        raw_dir: "entry",
      },
      baseMap,
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(event).not.toBeNull();
    expect(event?.tid).toBe("TID-ABIOT-42");
    expect(event?.status).toBe("allowed");
    expect(event?.kind).toBe("registered");
    expect(event?.subjectName).toBe("John Carter");
    expect(event?.subjectMeta).toContain("White Tesla Model Y");
    expect(event?.plate).toBe("MH12AB1234");
    expect(event?.location).toBe("Tower 3");
    expect(event?.payload.abiot).toBeTruthy();
  });

  it("does not keep unknown fallback reason when an explicit known vehicle payload is supplied", async () => {
    process.env.ABIOT_LOOKUP_URL = "https://api.abiot.lookup/lookup/index.php";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const event = await convertRawRowToAccessEventWithLookup(
      {
        id: "manual-known-1",
        raw_epc: "E280699520000400008D040987",
        raw_reader: "CW-C72-01",
        raw_ts: "2026-04-15T10:00:00.000Z",
        raw_gate: "gate-main-entry",
        raw_dir: "entry",
        status: "allowed",
        kind: "registered",
        subject_name: "Vehicle 27",
        subject_meta: "Rahul Mehta - White Honda City - Tower 5",
        plate: "MH12AB5678",
      },
      baseMap,
    );

    expect(event).not.toBeNull();
    expect(event?.status).toBe("allowed");
    expect(event?.kind).toBe("registered");
    expect(event?.subjectName).toBe("Vehicle 27");
    expect(event?.reason).toBeNull();
  });
});
