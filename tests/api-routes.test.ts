import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetMemoryStoreForTests, insertManualRawScan } from "@/lib/events-store";
import { GET as getEventsRoute } from "@/app/api/events/route";
import { POST as resolveRoute } from "@/app/api/events/[eventKey]/resolve/route";
import { POST as convertRoute } from "@/app/api/convert/run/route";
import { GET as abiotIngestRoute } from "@/app/api/abiot/ingest/route";
import { POST as registerRoute } from "@/app/api/abiot/register/route";
import { POST as fetchLatestRoute } from "@/app/api/fetch-latest/route";

describe("api routes", () => {
  beforeEach(() => {
    __resetMemoryStoreForTests();
  });

  it("GET /api/events returns counters and events", async () => {
    const response = await getEventsRoute(new Request("http://localhost/api/events?surface=manager"));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(Array.isArray(payload.events)).toBe(true);
    expect(typeof payload.counters.total).toBe("number");
  });

  it("POST /api/events/{eventKey}/resolve persists and returns updated event", async () => {
    const created = await insertManualRawScan({
      epc: "E28011606000021180UN001",
      mode: "handheld",
      readerId: "CW-C72-01",
      gateId: "gate-main-entry",
    });
    expect(created).not.toBeNull();

    const response = await resolveRoute(
      new Request(`http://localhost/api/events/${created!.eventKey}/resolve`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          status: "denied",
          outcome: "denied-by-guard",
          note: "Blocked at gate",
          resolvedBy: "Guard 14",
        }),
      }),
      { params: Promise.resolve({ eventKey: created!.eventKey }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.event.eventKey).toBe(created!.eventKey);
    expect(payload.event.status).toBe("denied");
  });

  it("POST /api/convert/run is idempotent", async () => {
    const first = await convertRoute(new Request("http://localhost/api/convert/run", { method: "POST" }));
    const firstPayload = await first.json();
    const second = await convertRoute(new Request("http://localhost/api/convert/run", { method: "POST" }));
    const secondPayload = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(firstPayload.ok).toBe(true);
    expect(secondPayload.ok).toBe(true);
  });

  it("GET /api/abiot/ingest converts raw scan query data into an event", async () => {
    const response = await abiotIngestRoute(
      new Request(
        "http://localhost/api/abiot/ingest?uhf_epc_hex=E280116060000211E8A98A3F&uhf_tid=TID-ABIOT-1&reader_id=CW-C72-01&mode=handheld&gate_id=gate-main-entry&direction=entry",
      ),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.event.epc).toBe("E280116060000211E8A98A3F");
    expect(payload.event.tid).toBe("TID-ABIOT-1");
    expect(payload.event.mode).toBe("handheld");
  });

  it("GET /api/abiot/ingest mirrors metadata registrations into an immediate card", async () => {
    const response = await abiotIngestRoute(
      new Request(
        "http://localhost/api/abiot/ingest?uhf_epc_hex=E280116060000211E8A98A3F&uhf_tid=TID-ABIOT-1&reader_id=CW-C72-01&mode=handheld&gate_id=gate-main-entry&direction=entry&status=allowed&kind=registered&label=Known%20Vehicle&details=Tower%20A",
      ),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.mirrored).toBe(true);
    expect(payload.registration.label).toBe("Known Vehicle");
    expect(payload.event.subjectName).toBe("Known Vehicle");

    const eventsResponse = await getEventsRoute(new Request("http://localhost/api/events?surface=manager"));
    const eventsPayload = await eventsResponse.json();
    expect(eventsPayload.events.some((event: { subjectName: string }) => event.subjectName === "Known Vehicle")).toBe(true);
  });

  it("POST /api/fetch-latest keeps mirrored registrations visible", async () => {
    await abiotIngestRoute(
      new Request(
        "http://localhost/api/abiot/ingest?uhf_epc_hex=E280699520000400008D040987&uhf_tid=TID-ABIOT-2&reader_id=CW-C72-01&mode=handheld&gate_id=gate-main-entry&direction=entry&status=allowed&kind=registered&label=Manual%20Sync%20Vehicle&details=Tower%20B",
      ),
    );

    const response = await fetchLatestRoute(
      new Request("http://localhost/api/fetch-latest", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          surface: "manager",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.synced).toBeGreaterThan(0);
    expect(payload.events.some((event: { subjectName: string }) => event.subjectName === "Manual Sync Vehicle")).toBe(true);
  });

  it("POST /api/abiot/register saves the vehicle in ABIOT and refreshes the source event", async () => {
    const originalFetch = global.fetch;
    const upstreamFetch = vi.fn(async () =>
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", upstreamFetch);

    try {
      const created = await insertManualRawScan({
        epc: "E2806995000050008D040962",
        tid: "TID-REG-0962",
        mode: "handheld",
        readerId: "CW-C72-01",
        gateId: "gate-main-entry",
        direction: "entry",
      });
      expect(created).not.toBeNull();

      const response = await registerRoute(
        new Request("http://localhost/api/abiot/register", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            eventKey: created!.eventKey,
            epc: created!.epc,
            label: "Kiran Kapoor",
            state: "allowed",
            ownerName: "Kiran Kapoor",
            vehicleName: "Honda City",
            plate: "MH12AB1234",
            location: "Tower A - 1204",
            vehicleKind: "resident",
            details: "Registered at the gate",
            resolvedBy: "Guard 14",
          }),
        }),
      );

      const payload = await response.json();
      expect(response.status, JSON.stringify(payload)).toBe(200);
      expect(payload.ok).toBe(true);
      expect(payload.resolvedTid).toBe("TID-REG-0962");
      expect(upstreamFetch).toHaveBeenCalledTimes(1);

      const eventsResponse = await getEventsRoute(new Request("http://localhost/api/events?surface=tablet"));
      const eventsPayload = await eventsResponse.json();
      const updated = eventsPayload.events.find((event: { eventKey: string }) => event.eventKey === created!.eventKey);
      expect(updated?.subjectName).toBe("Kiran Kapoor");
      expect(updated?.status).toBe("allowed");
    } finally {
      vi.unstubAllGlobals();
      global.fetch = originalFetch;
    }
  });

  it("POST /api/abiot/register allows EPC-only saves when no TID is known", async () => {
    const originalFetch = global.fetch;
    const upstreamFetch = vi.fn(async (input: RequestInfo | URL) =>
      new Response(JSON.stringify({ error: "uhf_tid is required", url: String(input) }), {
        status: 400,
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", upstreamFetch);

    try {
      const response = await registerRoute(
        new Request("http://localhost/api/abiot/register", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            epc: "E2806995000050008D040977",
            label: "EPC Only Vehicle",
            state: "allowed",
            ownerName: "EPC Only Owner",
          }),
        }),
      );

      const payload = await response.json();
      expect(response.status, JSON.stringify(payload)).toBe(200);
      expect(payload.ok).toBe(true);
      expect(payload.resolvedTid).toBeNull();
      expect(payload.abiotSynced).toBe(false);
      expect(payload.message).toContain("website registry by EPC");
      expect(upstreamFetch).not.toHaveBeenCalled();

      const eventsResponse = await getEventsRoute(new Request("http://localhost/api/events?surface=manager"));
      const eventsPayload = await eventsResponse.json();
      expect(eventsPayload.events.some((event: { subjectName: string }) => event.subjectName === "EPC Only Vehicle")).toBe(true);
    } finally {
      vi.unstubAllGlobals();
      global.fetch = originalFetch;
    }
  });
});
