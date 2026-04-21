import type { AccessEvent } from "@/lib/types";

function timestampOf(event: AccessEvent) {
  return new Date(event.ts).getTime();
}

export function latestEventsByEpc(events: AccessEvent[]) {
  const latestByEpc = new Map<string, AccessEvent>();

  for (const event of events) {
    const identity = event.epc.trim().toUpperCase() || event.eventKey;
    const existing = latestByEpc.get(identity);

    if (!existing || timestampOf(event) > timestampOf(existing)) {
      latestByEpc.set(identity, event);
    }
  }

  return [...latestByEpc.values()].sort((left, right) => timestampOf(right) - timestampOf(left));
}
