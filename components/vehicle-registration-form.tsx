"use client";

import { FormEvent, useMemo, useState } from "react";
import { registerVehicleViaApi } from "@/lib/client-api";
import { Icon } from "@/lib/ui";
import type { AccessEvent } from "@/lib/types";

interface VehicleRegistrationFormProps {
  actorLabel: string;
  initialEvent?: AccessEvent | null;
  initialEpc?: string;
  initialTid?: string | null;
  initialLabel?: string;
  initialState?: "allowed" | "review";
  allowIdentityEdit?: boolean;
  compact?: boolean;
  title?: string;
  description?: string;
  submitLabel?: string;
  onCancel?: () => void;
  onSuccess?: (message: string) => void | Promise<void>;
}

function normalizeInitialLabel(value?: string) {
  if (!value || value === "Unknown vehicle") {
    return "";
  }
  return value;
}

export function VehicleRegistrationForm({
  actorLabel,
  initialEvent,
  initialEpc,
  initialTid,
  initialLabel,
  initialState = "allowed",
  allowIdentityEdit = true,
  compact = false,
  title = "Register vehicle",
  description = "Save this EPC to ABIOT so future scans resolve automatically on Manager and Tablet.",
  submitLabel = "Save to ABIOT",
  onCancel,
  onSuccess,
}: VehicleRegistrationFormProps) {
  const [epc, setEpc] = useState((initialEpc || initialEvent?.epc || "").toUpperCase());
  const [tid, setTid] = useState(initialTid || initialEvent?.tid || "");
  const [label, setLabel] = useState(normalizeInitialLabel(initialLabel || initialEvent?.subjectName));
  const [ownerName, setOwnerName] = useState("");
  const [vehicleName, setVehicleName] = useState("");
  const [plate, setPlate] = useState(initialEvent?.plate || "");
  const [location, setLocation] = useState(initialEvent?.location || "");
  const [vehicleKind, setVehicleKind] = useState(initialEvent?.kind && initialEvent.kind !== "unknown" ? initialEvent.kind : "registered");
  const [details, setDetails] = useState(initialEvent?.reason || "");
  const [state, setState] = useState<"allowed" | "review">(initialState);
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"success" | "danger" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const helperText = useMemo(() => {
    if (tid.trim()) {
      return "TID is available, so this record can be written back to ABIOT immediately.";
    }
    return "If TID is blank, the web will try to recover it from the last scan for this EPC.";
  }, [tid]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!epc.trim() || !label.trim()) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      await registerVehicleViaApi({
        epc: epc.trim().toUpperCase(),
        tid: tid.trim() || undefined,
        eventKey: initialEvent?.eventKey,
        label: label.trim(),
        state,
        ownerName: ownerName.trim() || undefined,
        vehicleName: vehicleName.trim() || undefined,
        plate: plate.trim().toUpperCase() || undefined,
        location: location.trim() || undefined,
        vehicleKind: vehicleKind.trim().toLowerCase() || undefined,
        details: details.trim() || undefined,
        readerId: initialEvent?.readerId,
        mode: initialEvent?.mode,
        gateId: initialEvent?.gateId,
        direction: initialEvent?.direction,
        resolvedBy: actorLabel,
      });

      const successMessage = initialEvent
        ? `Saved ${label.trim()} to ABIOT and refreshed the live gate card.`
        : `Saved ${label.trim()} to ABIOT and added it to the website registry.`;

      setMessage(successMessage);
      setTone("success");

      if (!initialEvent) {
        setEpc("");
        setTid("");
        setLabel("");
        setOwnerName("");
        setVehicleName("");
        setPlate("");
        setLocation("");
        setVehicleKind("registered");
        setDetails("");
        setState(initialState);
      }

      await onSuccess?.(successMessage);
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : "Failed to register vehicle");
      setTone("danger");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack" style={{ gap: compact ? 12 : 16 }}>
      <div>
        <div className="eyebrow">{title}</div>
        <div className="muted small mt-2">{description}</div>
      </div>

      <div className={compact ? "grid grid-2" : "stack"} style={{ gap: 12 }}>
        <div className="form-group">
          <label className="text-sm font-semibold">EPC *</label>
          <input
            className="input mono mt-1"
            value={epc}
            onChange={(inputEvent) => setEpc(inputEvent.target.value.toUpperCase())}
            readOnly={!allowIdentityEdit}
            required
          />
        </div>

        <div className="form-group">
          <label className="text-sm font-semibold">TID</label>
          <input
            className="input mono mt-1"
            value={tid}
            onChange={(inputEvent) => setTid(inputEvent.target.value.toUpperCase())}
            readOnly={!allowIdentityEdit}
            placeholder="Recovered automatically when available"
          />
          <div className="muted small mt-2">{helperText}</div>
        </div>
      </div>

      <div className={compact ? "grid grid-2" : "stack"} style={{ gap: 12 }}>
        <div className="form-group">
          <label className="text-sm font-semibold">Label shown on web *</label>
          <input
            className="input mt-1"
            value={label}
            onChange={(inputEvent) => setLabel(inputEvent.target.value)}
            placeholder="e.g. Priya Mehta"
            required
          />
        </div>

        <div className="form-group">
          <label className="text-sm font-semibold">Default access state</label>
          <select className="input mt-1" value={state} onChange={(inputEvent) => setState(inputEvent.target.value as "allowed" | "review")}>
            <option value="allowed">Auto-Allowed</option>
            <option value="review">Needs Review</option>
          </select>
        </div>
      </div>

      <div className={compact ? "grid grid-2" : "stack"} style={{ gap: 12 }}>
        <div className="form-group">
          <label className="text-sm font-semibold">Owner name</label>
          <input className="input mt-1" value={ownerName} onChange={(inputEvent) => setOwnerName(inputEvent.target.value)} placeholder="Resident / driver name" />
        </div>

        <div className="form-group">
          <label className="text-sm font-semibold">Vehicle name</label>
          <input className="input mt-1" value={vehicleName} onChange={(inputEvent) => setVehicleName(inputEvent.target.value)} placeholder="Honda City / Creta / delivery van" />
        </div>
      </div>

      <div className={compact ? "grid grid-3" : "stack"} style={{ gap: 12 }}>
        <div className="form-group">
          <label className="text-sm font-semibold">Plate number</label>
          <input className="input mt-1 text-uppercase" value={plate} onChange={(inputEvent) => setPlate(inputEvent.target.value.toUpperCase())} placeholder="MH 12 AB 1234" />
        </div>

        <div className="form-group">
          <label className="text-sm font-semibold">Unit / location</label>
          <input className="input mt-1" value={location} onChange={(inputEvent) => setLocation(inputEvent.target.value)} placeholder="Tower A - 1204" />
        </div>

        <div className="form-group">
          <label className="text-sm font-semibold">Vehicle kind</label>
          <input className="input mt-1" value={vehicleKind} onChange={(inputEvent) => setVehicleKind(inputEvent.target.value)} placeholder="resident / worker / guest / registered" />
        </div>
      </div>

      <div className="form-group">
        <label className="text-sm font-semibold">Notes</label>
        <input className="input mt-1" value={details} onChange={(inputEvent) => setDetails(inputEvent.target.value)} placeholder="Parking note, access instructions, or visitor detail" />
      </div>

      <div className="row-wrap" style={{ justifyContent: "flex-end" }}>
        {onCancel ? (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="btn primary" disabled={isSubmitting} style={{ justifyContent: "center" }}>
          <Icon name="plus" size={14} /> {isSubmitting ? "Saving..." : submitLabel}
        </button>
      </div>

      {message ? (
        <div className={`fetch-note ${tone === "danger" ? "danger" : "success"}`}>
          {message}
        </div>
      ) : null}
    </form>
  );
}
