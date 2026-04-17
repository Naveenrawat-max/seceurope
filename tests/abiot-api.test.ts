import { describe, expect, it } from "vitest";
import { mapLookupDataToDirectoryDetails } from "@/lib/abiot-api";

describe("mapLookupDataToDirectoryDetails", () => {
  it("maps ABIOT lookup payloads into website directory details", () => {
    const mapped = mapLookupDataToDirectoryDetails({
      id: 5,
      uhf_epc_hex: "E28011606000021180AB5005",
      uhf_tid: "TID-5005",
      label: "Visitor Vehicle",
      state: "blocked",
      website: JSON.stringify({
        owner: {
          name: "Alex Morgan",
          type: "guest",
        },
        vehicle: {
          name: "Blue BMW X1",
          plate: "DL01XY9988",
        },
        flat: "B-702",
        note: "Do not allow entry",
      }),
      views: 3,
      created_at: "2026-04-15 10:00:00",
    });

    expect(mapped.kind).toBe("guest");
    expect(mapped.status).toBe("denied");
    expect(mapped.subjectName).toBe("Visitor Vehicle");
    expect(mapped.subjectMeta).toContain("Alex Morgan");
    expect(mapped.subjectMeta).toContain("Blue BMW X1");
    expect(mapped.subjectMeta).toContain("B-702");
    expect(mapped.plate).toBe("DL01XY9988");
    expect(mapped.reason).toBe("Do not allow entry");
    expect(mapped.tid).toBe("TID-5005");
    expect(mapped.payload?.source).toBe("abiot");
  });
});
