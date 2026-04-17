import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetMemoryStoreForTests,
  convertPendingRawRows,
  fetchEvents,
  insertManualRawScan,
  resolveEvent,
  syncLatestRegistrations,
  upsertVehicleRegistration,
} from "@/lib/events-store";

describe("events store fallback pipeline", () => {
  beforeEach(() => {
    __resetMemoryStoreForTests();
  });

  it("returns merged event + resolution state", async () => {
    const created = await insertManualRawScan({
      epc: "E28011606000021180UN002",
      readerId: "CW-C72-01",
      mode: "handheld",
      direction: "entry",
      gateId: "gate-main-entry",
    });
    expect(created).not.toBeNull();

    await resolveEvent(created!.eventKey, {
      status: "allowed",
      outcome: "guard-open",
      note: "Guard opened gate",
      resolvedBy: "Kiran P.",
    });

    const response = await fetchEvents("tablet");
    const found = response.events.find((event) => event.eventKey === created!.eventKey);
    expect(found).toBeDefined();
    expect(found?.status).toBe("allowed");
    expect(found?.outcome).toBe("guard-open");
    expect(found?.resolvedBy).toBe("Kiran P.");
    expect(response.counters.total).toBeGreaterThan(0);
  });

  it("converter run is idempotent", async () => {
    const first = await convertPendingRawRows();
    const before = await fetchEvents("manager");
    const keysBefore = new Set(before.events.map((event) => event.eventKey));

    const second = await convertPendingRawRows();
    const after = await fetchEvents("manager");
    const keysAfter = new Set(after.events.map((event) => event.eventKey));

    expect(first.fetched).toBeGreaterThan(0);
    expect(second.fetched).toBeGreaterThan(0);
    expect(keysAfter.size).toBe(keysBefore.size);
    expect(after.events.length).toBe(before.events.length);
  });

  it("mirrors registrations into event cards immediately", async () => {
    const mirrored = await upsertVehicleRegistration({
      epc: "E280699520000400008D040987",
      tid: "TID-MIRROR-01",
      label: "QA vehicle",
      status: "allowed",
      kind: "registered",
      subjectMeta: "Owner - Test Sedan - Tower B",
      plate: "MH 12 QA 1001",
      reason: null,
    });

    expect(mirrored?.event?.subjectName).toBe("QA vehicle");

    const response = await fetchEvents("manager");
    expect(response.events.some((event) => event.subjectName === "QA vehicle")).toBe(true);
  });

  it("manual latest sync remains idempotent for mirrored registrations", async () => {
    await upsertVehicleRegistration({
      epc: "E280699520000400008D040987",
      tid: "TID-MIRROR-02",
      label: "Manual sync vehicle",
      status: "allowed",
      kind: "registered",
      subjectMeta: "Owner - Test Sedan - Tower C",
      plate: "MH 12 QA 1002",
      reason: null,
    });

    const response = await syncLatestRegistrations("manager");
    expect(response.synced).toBeGreaterThan(0);
    expect(response.events.some((event) => event.subjectName === "Manual sync vehicle")).toBe(true);
  });
});
