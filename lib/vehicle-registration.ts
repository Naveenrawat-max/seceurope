import type { EventStatus } from "@/lib/types";

export interface VehicleRegistrationDraft {
  label: string;
  state: string;
  ownerName?: string | null;
  vehicleName?: string | null;
  plate?: string | null;
  location?: string | null;
  vehicleKind?: string | null;
  details?: string | null;
  photoUrl?: string | null;
  websiteUrl?: string | null;
}

function normalizeText(value?: string | null) {
  const text = value?.trim();
  return text ? text : null;
}

export function buildVehicleWebsitePayload(input: VehicleRegistrationDraft) {
  const ownerName = normalizeText(input.ownerName);
  const vehicleName = normalizeText(input.vehicleName);
  const plate = normalizeText(input.plate);
  const location = normalizeText(input.location);
  const vehicleKind = normalizeText(input.vehicleKind) || "vehicle";
  const details = normalizeText(input.details);
  const photoUrl = normalizeText(input.photoUrl);
  const websiteUrl = normalizeText(input.websiteUrl);

  if (!ownerName && !vehicleName && !plate && !location && !details && !photoUrl && !websiteUrl) {
    return null;
  }

  const website: Record<string, unknown> = {
    title: input.label.trim(),
    kind: vehicleKind,
  };

  if (ownerName) {
    website.owner_name = ownerName;
    website.owner = {
      name: ownerName,
      type: vehicleKind,
    };
    website.name = ownerName;
  }

  if (vehicleName || plate || input.vehicleKind) {
    website.vehicle = {
      ...(vehicleName ? { name: vehicleName } : {}),
      ...(plate ? { plate } : {}),
      ...(input.vehicleKind ? { kind: vehicleKind } : {}),
    };
  }

  if (vehicleName) {
    website.vehicle_name = vehicleName;
  }

  if (plate) {
    website.plate = plate;
  }

  if (location) {
    website.location = location;
    website.unit = location;
  }

  if (websiteUrl) {
    website.url = websiteUrl;
    website.type = "redirect";
  } else {
    website.type = "metadata";
  }

  if (details) {
    website.notes = details;
  }

  if (photoUrl) {
    website.photoUrl = photoUrl;
  }

  return website;
}

export function buildVehicleSubjectMeta(input: VehicleRegistrationDraft) {
  const parts = [
    normalizeText(input.ownerName),
    normalizeText(input.vehicleName),
    normalizeText(input.location),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" - ") : "Registered by ABIOT web portal";
}

export function normalizeVehicleKind(value?: string | null) {
  return normalizeText(value)?.toLowerCase() || "registered";
}

export function eventStatusFromVehicleState(state?: string | null): EventStatus {
  const normalized = normalizeText(state)?.toLowerCase() || "allowed";
  if (["blocked", "block", "denied", "deny", "blacklist", "blacklisted", "forbidden"].some((token) => normalized.includes(token))) {
    return "denied";
  }
  if (["review", "pending", "manual", "hold", "unknown"].some((token) => normalized.includes(token))) {
    return "review";
  }
  return "allowed";
}
