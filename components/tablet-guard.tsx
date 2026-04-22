 "use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { VehicleRegistrationForm } from "@/components/vehicle-registration-form";
import { registerVehicleViaApi } from "@/lib/client-api";
import { GATES, PRESETS, SITE_INFO } from "@/lib/demo-data";
import { latestEventsByEpc } from "@/lib/event-views";
import { useEventsSurface } from "@/hooks/use-events-surface";
import {
  Icon,
  avatarClassForKind,
  badgeClassForKind,
  badgeClassForStatus,
  badgeLabelForStatus,
  formatTime,
  initials,
  relative,
} from "@/lib/ui";
import type { AccessEvent, EventStatus, EventsResponse, ResolutionInput } from "@/lib/types";

type TabletTab = "review" | "history" | "directory" | "register";

function modeBadge(mode: AccessEvent["mode"]) {
  return (
    <span className="badge outline">
      <Icon name={mode === "antenna" ? "antenna" : "radio"} size={12} /> {mode === "antenna" ? "Antenna" : "Handheld"}
    </span>
  );
}

function statusBadge(status: EventStatus) {
  return <span className={`badge ${badgeClassForStatus(status)}`}>{badgeLabelForStatus(status)}</span>;
}

function kindBadge(kind: string) {
  return <span className={`badge ${badgeClassForKind(kind)}`}>{kind}</span>;
}

function avatarFor(event: AccessEvent) {
  return <div className={`avatar ${avatarClassForKind(event.kind)}`}>{initials(event.subjectName)}</div>;
}

function queueResolution(action: "open" | "call" | "visitor" | "deny", event: AccessEvent): ResolutionInput {
  if (action === "open") {
    return {
      status: "allowed",
      outcome: "guard-open",
      note: `${event.subjectName} - guard opened the gate.`,
      resolvedBy: "Kiran P. - Guard 14",
    };
  }
  if (action === "call") {
    return {
      status: "review",
      outcome: "resident-called",
      note: `${event.subjectName} - guard called resident for confirmation.`,
      resolvedBy: "Kiran P. - Guard 14",
    };
  }
  if (action === "visitor") {
    return {
      status: "allowed",
      outcome: "visitor-pass",
      note: `${event.subjectName} - temporary visitor pass issued.`,
      resolvedBy: "Kiran P. - Guard 14",
    };
  }
  return {
    status: "denied",
    outcome: "denied-by-guard",
    note: `${event.subjectName} - guard denied access.`,
    resolvedBy: "Kiran P. - Guard 14",
  };
}

function kpi(label: string, value: number | string, meta: string, accent = false) {
  return (
    <div className={`kpi-card ${accent ? "accent" : ""}`}>
      <div className="eyebrow">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-meta">{meta}</div>
    </div>
  );
}

function titleFor(tab: TabletTab) {
  if (tab === "review") return "Review & action";
  if (tab === "history") return "Today's gate log";
  if (tab === "register") return "Register vehicle";
  return "Directory";
}

function subtitleFor(tab: TabletTab) {
  if (tab === "review") return "Make a call on every car the gate could not clear automatically.";
  if (tab === "history") return `Every scan captured today at ${SITE_INFO.tenant}.`;
  if (tab === "register") return "Save a vehicle profile directly into ABIOT from the tablet.";
  return "ABIOT registry records resolved from scans at this gate.";
}

function liveBadgeTone(status: "connecting" | "live" | "reconnecting" | "offline") {
  if (status === "live") return "success";
  if (status === "reconnecting" || status === "connecting") return "warn";
  return "danger";
}

function liveBadgeLabel(status: "connecting" | "live" | "reconnecting" | "offline", transport: "websocket" | "polling") {
  if (status === "live") {
    return transport === "websocket" ? "WebSocket live" : "Live sync";
  }
  if (status === "reconnecting") return "Reconnecting";
  if (status === "connecting") return "Connecting";
  return "Offline";
}

function canRegisterVehicle(event: AccessEvent) {
  return event.kind === "unknown" || event.subjectName === "Unknown vehicle";
}

function isOpenedAtGate(event: AccessEvent) {
  return event.status === "allowed" && event.outcome !== "auto-allowed";
}

function outcomeLabel(event: AccessEvent) {
  if (event.outcome === "guard-open") return "Opened by guard";
  if (event.outcome === "visitor-pass") return "Visitor pass issued";
  if (event.outcome === "resident-called") return "Resident called";
  if (event.outcome === "denied-by-guard") return "Denied by guard";
  if (event.outcome === "denied") return "Blocked vehicle";
  if (event.outcome === "auto-allowed") return "Auto allowed";
  return event.outcome.replace(/-/g, " ");
}

export function TabletGuard({ initialData }: { initialData: EventsResponse }) {
  const [tab, setTab] = useState<TabletTab>("review");
  const [epcDraft, setEpcDraft] = useState("E28011606000021180UN002");
  const [selectedEventKey, setSelectedEventKey] = useState<string | null>(null);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);
  const [fetchMessageTone, setFetchMessageTone] = useState<"success" | "danger" | null>(null);
  const [clock, setClock] = useState<string>(new Date().toISOString());
  const [decisionMessage, setDecisionMessage] = useState<string | null>(null);
  const [decisionTone, setDecisionTone] = useState<"success" | "danger" | null>(null);
  const [decisionPendingKey, setDecisionPendingKey] = useState<string | null>(null);
  const [registeringEventKey, setRegisteringEventKey] = useState<string | null>(null);
  const [registerEpc, setRegisterEpc] = useState("");
  const [registerTid, setRegisterTid] = useState("");
  const [registerLabel, setRegisterLabel] = useState("");
  const [registerOwnerName, setRegisterOwnerName] = useState("");
  const [registerVehicleName, setRegisterVehicleName] = useState("");
  const [registerPlate, setRegisterPlate] = useState("");
  const [registerLocation, setRegisterLocation] = useState("");
  const [registerVehicleKind, setRegisterVehicleKind] = useState("registered");
  const [registerNotes, setRegisterNotes] = useState("");
  const [registerState, setRegisterState] = useState<"allowed" | "review">("allowed");
  const [registerMessage, setRegisterMessage] = useState<string | null>(null);
  const [registerTone, setRegisterTone] = useState<"success" | "danger" | null>(null);
  const [isRegisterSubmitting, setIsRegisterSubmitting] = useState(false);
  const {
    events,
    counters,
    error,
    loading,
    refreshing,
    generatedAt,
    resolveEvent,
    createScan,
    refreshSurface,
    syncLatest,
    liveStatus,
    liveTransport,
    lastLiveMessage,
  } = useEventsSurface("tablet", undefined, initialData);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(new Date().toISOString());
    }, 60_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const currentEvents = useMemo(() => latestEventsByEpc(events), [events]);
  const reviewEvents = useMemo(() => currentEvents.filter((event) => event.status === "review"), [currentEvents]);
  const openedEvents = useMemo(() => events.filter(isOpenedAtGate), [events]);
  const deniedEvents = useMemo(() => events.filter((event) => event.status === "denied"), [events]);
  const recentCardEvents = useMemo(() => currentEvents.slice(0, 4), [currentEvents]);
  const antennaEvents = useMemo(() => reviewEvents.filter((event) => event.mode === "antenna"), [reviewEvents]);
  const directoryEvents = currentEvents;
  const directoryGroups = useMemo(() => {
    return {
      allowed: directoryEvents.filter((event) => event.status === "allowed"),
      review: directoryEvents.filter((event) => event.status === "review"),
      denied: directoryEvents.filter((event) => event.status === "denied"),
    };
  }, [directoryEvents]);
  const latest = useMemo(() => {
    const mostRecent = [...events].sort(
      (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
    );
    if (!selectedEventKey) {
      return mostRecent[0] ?? null;
    }
    return (
      mostRecent.find((event) => event.eventKey === selectedEventKey)
      ?? mostRecent[0]
      ?? null
    );
  }, [events, selectedEventKey]);
  const syncLabel = generatedAt.startsWith("1970-01-01") ? "No sync yet" : `Updated ${relative(generatedAt)}`;

  const submitScan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!epcDraft.trim()) return;
    try {
      const epc = epcDraft.trim().toUpperCase();
      await createScan({
        epc,
        mode: "handheld",
        readerId: "CW-C72-01",
        gateId: "gate-main-entry",
        direction: "entry",
      });
      setFetchMessage(`Fetched latest data for ${epc}. The card is now visible in the queue and history.`);
      setFetchMessageTone("success");
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Failed to fetch the latest data";
      setFetchMessage(message);
      setFetchMessageTone("danger");
    }
  };

  const submitDecision = async (action: "open" | "call" | "visitor" | "deny", event: AccessEvent) => {
    setDecisionPendingKey(event.eventKey);
    setDecisionMessage(null);
    try {
      await resolveEvent(event.eventKey, queueResolution(action, event));
      const labels = {
        open: `Opened the gate for ${event.subjectName}.`,
        call: `Marked ${event.subjectName} as awaiting resident confirmation.`,
        visitor: `Issued a visitor pass for ${event.subjectName}.`,
        deny: `Denied access for ${event.subjectName}.`,
      };
      setDecisionMessage(labels[action]);
      setDecisionTone("success");
      setRegisteringEventKey((current) => (current === event.eventKey ? null : current));
    } catch (decisionError) {
      setDecisionMessage(decisionError instanceof Error ? decisionError.message : "Failed to update vehicle status");
      setDecisionTone("danger");
    } finally {
      setDecisionPendingKey(null);
    }
  };

  const handleRegistrationSuccess = async (message: string) => {
    setDecisionMessage(message);
    setDecisionTone("success");
    setRegisteringEventKey(null);
    await refreshSurface();
  };

  const applyRegisterDraftFromEvent = (event: AccessEvent | null) => {
    if (!event) {
      return;
    }
    setRegisterEpc(event.epc);
    setRegisterTid(event.tid || "");
    setRegisterLabel(event.subjectName !== "Unknown vehicle" ? event.subjectName : "");
    setRegisterVehicleName(event.subjectName !== "Unknown vehicle" ? event.subjectName : "");
    setRegisterPlate(event.plate || "");
    setRegisterLocation(event.location || "");
    setRegisterVehicleKind(event.kind && event.kind !== "unknown" ? event.kind : "registered");
    setRegisterNotes(event.reason || "");
    setRegisterState(event.status === "review" ? "review" : "allowed");
    setRegisterMessage(null);
  };

  const resetRegisterDraft = (clearFeedback: boolean = true): void => {
    setRegisterEpc("");
    setRegisterTid("");
    setRegisterLabel("");
    setRegisterOwnerName("");
    setRegisterVehicleName("");
    setRegisterPlate("");
    setRegisterLocation("");
    setRegisterVehicleKind("registered");
    setRegisterNotes("");
    setRegisterState("allowed");
    if (clearFeedback) {
      setRegisterMessage(null);
      setRegisterTone(null);
    }
  };

  const submitRegisterVehicle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const epc = registerEpc.trim().toUpperCase();
    const label = registerLabel.trim() || registerOwnerName.trim() || registerVehicleName.trim();

    if (!epc) {
      setRegisterMessage("EPC is required.");
      setRegisterTone("danger");
      return;
    }

    if (!label) {
      setRegisterMessage("Add at least a label, owner name, or vehicle name.");
      setRegisterTone("danger");
      return;
    }

    setIsRegisterSubmitting(true);
    setRegisterMessage(null);

    try {
      const result = await registerVehicleViaApi({
        epc,
        tid: registerTid.trim().toUpperCase() || undefined,
        label,
        state: registerState,
        ownerName: registerOwnerName.trim() || undefined,
        vehicleName: registerVehicleName.trim() || undefined,
        plate: registerPlate.trim().toUpperCase() || undefined,
        location: registerLocation.trim() || undefined,
        vehicleKind: registerVehicleKind.trim().toLowerCase() || undefined,
        details: registerNotes.trim() || undefined,
        readerId: "Tablet-UI",
        mode: "handheld",
        gateId: "gate-main-entry",
        direction: "entry",
        resolvedBy: "Kiran P. - Guard 14",
      });

      const successMessage = result.message || `Saved ${label} and made it available to Tablet and Manager.`;
      setRegisterMessage(successMessage);
      setRegisterTone("success");
      await handleRegistrationSuccess(successMessage);
      resetRegisterDraft(false);
    } catch (registerError) {
      setRegisterMessage(registerError instanceof Error ? registerError.message : "Failed to save vehicle");
      setRegisterTone("danger");
    } finally {
      setIsRegisterSubmitting(false);
    }
  };

  return (
    <div className="tab-body">
      <div className="tab-frame">
        <div className="tab-screen">
          <aside className="tab-side">
            <div className="tab-brand">
              <div className="mark">Se</div>
              <div>
                <strong>Seceurope</strong>
                <span>Tablet guard</span>
              </div>
            </div>

            <div className="tab-guard">
              <div className="avatar" style={{ background: "rgba(232, 90, 30, 0.2)", color: "#FFB673" }}>
                KP
              </div>
              <div>
                <strong>Kiran P. - Guard 14</strong>
                <span>Main Gate - Entry</span>
              </div>
            </div>

            <nav className="tab-nav">
              <button className={tab === "review" ? "active" : ""} onClick={() => setTab("review")}>
                <Icon name="queue" size={16} /> Review queue
                {reviewEvents.length ? <span className="counter">{reviewEvents.length}</span> : null}
              </button>
              <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>
                <Icon name="history" size={16} /> Today&apos;s log
              </button>
              <button className={tab === "directory" ? "active" : ""} onClick={() => setTab("directory")}>
                <Icon name="users" size={16} /> Directory
              </button>
              <button className={tab === "register" ? "active" : ""} onClick={() => setTab("register")}>
                <Icon name="plus" size={16} /> Register vehicle
              </button>
            </nav>

            <div className="spacer" />

            <div className="tab-side-foot">
              <div className="stat-row">
                <div>
                  <span>Scans</span>
                  <b>{counters.total}</b>
                </div>
                <div>
                  <span>Review</span>
                  <b>{reviewEvents.length}</b>
                </div>
              </div>
              <Link className="btn ghost-dark block" href="/">
                <Icon name="dashboard" size={14} /> Home
              </Link>
              <Link className="btn ghost-dark block" href="/manager" target="_blank" rel="noreferrer">
                <Icon name="arrowUpRight" size={14} /> Open manager
              </Link>
            </div>
          </aside>

          <main className="tab-main scroll">
            <header className="tab-head">
              <div>
                <h1>{titleFor(tab)}</h1>
                <p>{subtitleFor(tab)}</p>
              </div>
              <div className="row-wrap">
                <span className={`badge ${liveBadgeTone(liveStatus)}`}>
                  <span className={`dot ${liveBadgeTone(liveStatus) === "success" ? "live" : liveBadgeTone(liveStatus) === "danger" ? "danger" : "warn"}`} />
                  {liveBadgeLabel(liveStatus, liveTransport)}
                </span>
                <span className="badge outline">
                  <Icon name="clock" size={12} /> {formatTime(clock)}
                </span>
                {lastLiveMessage?.epc ? (
                  <span className="badge outline">
                    <Icon name="scan" size={12} /> {lastLiveMessage.epc.slice(-12)}
                  </span>
                ) : null}
                <span className="badge outline">
                  <Icon name="refresh" size={12} /> {syncLabel}
                </span>
                <button
                  className="btn ghost sm"
                  onClick={async () => {
                    try {
                      const synced = await syncLatest();
                      setFetchMessage(
                        synced > 0
                          ? `Fetched ${synced} latest ${synced === 1 ? "entry" : "entries"} into the tablet queue.`
                          : "No new registered vehicles were waiting to be fetched.",
                      );
                      setFetchMessageTone("success");
                    } catch (syncError) {
                      const message = syncError instanceof Error ? syncError.message : "Failed to fetch latest entries";
                      setFetchMessage(message);
                      setFetchMessageTone("danger");
                    }
                  }}
                  disabled={refreshing}
                >
                  <Icon name="refresh" size={12} /> {refreshing ? "Refreshing..." : "Fetch latest"}
                </button>
              </div>
            </header>

            <section className="tab-kpis">
              {kpi("Cars today", counters.total, "Entry + exit")}
              {kpi("Auto-allowed", counters.allowed, "Resident - guest - worker")}
              {kpi("Needs review", reviewEvents.length, "Waiting at the gate", reviewEvents.length > 0)}
              {kpi("Denied", counters.denied, "Blocked vehicles")}
            </section>

            {loading ? <div className="card"><div className="card-body">Loading events...</div></div> : null}
            {error ? (
              <div className="card">
                <div className="card-body">
                  <span className="badge danger">Sync error</span>
                  <div className="mt-2">{error}</div>
                </div>
              </div>
            ) : null}
            {decisionMessage ? (
              <div className={`fetch-note ${decisionTone === "danger" ? "danger" : "success"}`}>
                {decisionMessage}
              </div>
            ) : null}

            {tab === "review" ? (
              <section className="tab-split">
                <div className="stack">
                  {latest ? (
                    <div className={`scan-spotlight ${latest.status}`}>
                      <div className="row-between">
                        <div>
                          <div className="eyebrow">
                            {GATES.find((gate) => gate.id === latest.gateId)?.label || latest.gateId} - {latest.direction}
                          </div>
                          <div className="muted small mt-2">{latest.payload.title ? String(latest.payload.title) : "RFID event"}</div>
                        </div>
                        {statusBadge(latest.status)}
                      </div>
                      <div className="subject">{latest.subjectName}</div>
                      <div className="meta">{latest.subjectMeta}</div>
                      <div className="plate">{latest.plate || "-"}</div>
                      <div className="row-wrap mt-4 small muted">
                        {kindBadge(latest.kind)}
                        {modeBadge(latest.mode)}
                        <span className="badge outline">
                          <Icon name="signal" size={12} /> RSSI {latest.rssi ?? "-"}
                        </span>
                        <span className="badge outline">
                          <Icon name="clock" size={12} /> {relative(latest.ts)}
                        </span>
                      </div>

                      {latest.status === "review" || latest.status === "denied" ? (
                        <div className="stack" style={{ gap: 12 }}>
                          <div className="scan-actions">
                            <button className="btn success" type="button" onClick={() => void submitDecision("open", latest)} disabled={decisionPendingKey === latest.eventKey}>
                              <Icon name="check" size={14} /> Open gate
                            </button>
                            <button className="btn ghost" type="button" onClick={() => void submitDecision("call", latest)} disabled={decisionPendingKey === latest.eventKey}>
                              <Icon name="phone" size={14} /> Call resident
                            </button>
                            <button className="btn warn" type="button" onClick={() => void submitDecision("visitor", latest)} disabled={decisionPendingKey === latest.eventKey}>
                              <Icon name="shieldCheck" size={14} /> Issue visitor pass
                            </button>
                            <button className="btn danger" type="button" onClick={() => void submitDecision("deny", latest)} disabled={decisionPendingKey === latest.eventKey}>
                              <Icon name="x" size={14} /> Deny entry
                            </button>
                            {canRegisterVehicle(latest) ? (
                              <button className="btn primary" type="button" onClick={() => setRegisteringEventKey((current) => current === latest.eventKey ? null : latest.eventKey)}>
                                <Icon name="plus" size={14} /> Register vehicle
                              </button>
                            ) : null}
                          </div>
                          {registeringEventKey === latest.eventKey ? (
                            <div className="card card-accent">
                              <div className="card-body">
                                <VehicleRegistrationForm
                                  actorLabel="Kiran P. - Guard 14"
                                  initialEvent={latest}
                                  allowIdentityEdit={false}
                                  compact
                                  title="Register this unknown vehicle"
                                  description="Save the tag to ABIOT directly from the live queue so future scans resolve automatically."
                                  submitLabel="Register from queue"
                                  onCancel={() => setRegisteringEventKey(null)}
                                  onSuccess={(message) => handleRegistrationSuccess(message)}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="scan-actions">
                          <button className="btn ghost" type="button" onClick={() => setSelectedEventKey(latest.eventKey)}>
                            <Icon name="radio" size={14} /> Re-scan to locate
                          </button>
                          <button
                            className="btn primary"
                            type="button"
                            onClick={() => {
                              setSelectedEventKey(latest.eventKey);
                              setTab("history");
                            }}
                          >
                            <Icon name="history" size={14} /> Open log entry
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="scan-spotlight">
                      <div className="eyebrow">Waiting for RFID signal...</div>
                      <div className="subject">No scan yet</div>
                      <div className="meta">The spotlight updates automatically when ABIOT records are converted.</div>
                    </div>
                  )}

                  <div className="card">
                    <div className="card-header">
                      <div>
                        <div className="eyebrow">Recent cards</div>
                        <div className="title">Latest vehicle cards</div>
                      </div>
                      <span className="badge outline">{recentCardEvents.length}</span>
                    </div>
                    <div className="card-body">
                      {recentCardEvents.length ? (
                        <div className="event-card-grid">
                          {recentCardEvents.map((event) => (
                            <div className={`event-card ${event.status}`} key={`tablet-recent-${event.eventKey}`}>
                              <div className="row-between">
                                <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                                  {avatarFor(event)}
                                  <div>
                                    <strong style={{ fontSize: 14 }}>{event.subjectName}</strong>
                                    <div className="muted small">{event.subjectMeta}</div>
                                  </div>
                                </div>
                                {statusBadge(event.status)}
                              </div>
                              <div className="row-wrap small muted">
                                {kindBadge(event.kind)}
                                {modeBadge(event.mode)}
                                <span className="badge outline">
                                  <Icon name="clock" size={12} /> {relative(event.ts)}
                                </span>
                              </div>
                              <div className="mono muted">{event.epc}</div>
                              <div className="event-card-actions">
                                {event.status === "review" || event.status === "denied" ? (
                                  <>
                                    <button className="btn success sm" type="button" onClick={() => void submitDecision("open", event)} disabled={decisionPendingKey === event.eventKey}>
                                      <Icon name="check" size={12} /> Open
                                    </button>
                                    <button className="btn ghost sm" type="button" onClick={() => void submitDecision("call", event)} disabled={decisionPendingKey === event.eventKey}>
                                      <Icon name="phone" size={12} /> Call
                                    </button>
                                    <button className="btn warn sm" type="button" onClick={() => void submitDecision("visitor", event)} disabled={decisionPendingKey === event.eventKey}>
                                      <Icon name="shieldCheck" size={12} /> Pass
                                    </button>
                                    <button className="btn danger sm" type="button" onClick={() => void submitDecision("deny", event)} disabled={decisionPendingKey === event.eventKey}>
                                      <Icon name="x" size={12} /> Deny
                                    </button>
                                    {canRegisterVehicle(event) ? (
                                      <button className="btn primary sm" type="button" onClick={() => setRegisteringEventKey((current) => current === event.eventKey ? null : event.eventKey)}>
                                        <Icon name="plus" size={12} /> Register
                                      </button>
                                    ) : null}
                                  </>
                                ) : (
                                  <button className="btn ghost sm" type="button" onClick={() => setSelectedEventKey(event.eventKey)}>
                                    <Icon name="scan" size={12} /> Focus card
                                  </button>
                                )}
                              </div>
                              {registeringEventKey === event.eventKey ? (
                                <div className="mt-3">
                                  <VehicleRegistrationForm
                                    actorLabel="Kiran P. - Guard 14"
                                    initialEvent={event}
                                    allowIdentityEdit={false}
                                    compact
                                    title="Register this vehicle"
                                    description="Save the vehicle profile to ABIOT from the tablet queue."
                                    submitLabel="Register"
                                    onCancel={() => setRegisteringEventKey(null)}
                                    onSuccess={(message) => handleRegistrationSuccess(message)}
                                  />
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty">
                          <Icon name="car" size={26} />
                          <strong>No cards yet</strong>
                          <span className="small">Fetch a tag below to create the first vehicle card.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="eyebrow">Antenna queue</div>
                      <div className="title">Cars waiting</div>
                    </div>
                    {antennaEvents.length ? <span className="badge warn">{antennaEvents.length}</span> : <span className="badge success">Clear</span>}
                  </div>
                  <div className="card-body tight">
                    {antennaEvents.length ? (
                      <div className="stack">
                        {antennaEvents.slice(0, 4).map((event) => (
                          <div className="queue-card" key={event.eventKey}>
                            <div className="row-between">
                              <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
                                {avatarFor(event)}
                                <div>
                                  <strong>{event.subjectName}</strong>
                                  <div className="muted small">{event.subjectMeta}</div>
                                </div>
                              </div>
                              {statusBadge(event.status)}
                            </div>
                            <div className="row-wrap small muted">
                              {kindBadge(event.kind)}
                              {modeBadge(event.mode)}
                              <span className="mono">{event.epc.slice(-10)}</span>
                              <span className="badge outline">
                                <Icon name="clock" size={12} /> {relative(event.ts)}
                              </span>
                            </div>
                            <div className="row-wrap">
                              {event.status === "review" || event.status === "denied" ? (
                                <>
                                  <button className="btn success sm" type="button" onClick={() => void submitDecision("open", event)} disabled={decisionPendingKey === event.eventKey}>
                                    <Icon name="check" size={12} /> Open
                                  </button>
                                  <button className="btn warn sm" type="button" onClick={() => void submitDecision("visitor", event)} disabled={decisionPendingKey === event.eventKey}>
                                    <Icon name="shieldCheck" size={12} /> Pass
                                  </button>
                                  <button className="btn ghost sm" type="button" onClick={() => void submitDecision("call", event)} disabled={decisionPendingKey === event.eventKey}>
                                    <Icon name="phone" size={12} /> Call
                                  </button>
                                  <button className="btn danger sm" type="button" onClick={() => void submitDecision("deny", event)} disabled={decisionPendingKey === event.eventKey}>
                                    <Icon name="x" size={12} /> Deny
                                  </button>
                                  {canRegisterVehicle(event) ? (
                                    <button className="btn primary sm" type="button" onClick={() => setRegisteringEventKey((current) => current === event.eventKey ? null : event.eventKey)}>
                                      <Icon name="plus" size={12} /> Register
                                    </button>
                                  ) : null}
                                </>
                              ) : (
                                <button className="btn ghost sm" type="button" onClick={() => setSelectedEventKey(event.eventKey)}>
                                  <Icon name="scan" size={12} /> Focus card
                                </button>
                              )}
                            </div>
                            {registeringEventKey === event.eventKey ? (
                              <div className="mt-3">
                                <VehicleRegistrationForm
                                  actorLabel="Kiran P. - Guard 14"
                                  initialEvent={event}
                                  allowIdentityEdit={false}
                                  compact
                                  title="Register from live queue"
                                  description="Write the vehicle profile to ABIOT without leaving the tablet queue."
                                  submitLabel="Register vehicle"
                                  onCancel={() => setRegisteringEventKey(null)}
                                  onSuccess={(message) => handleRegistrationSuccess(message)}
                                />
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty">
                        <Icon name="shieldCheck" size={26} />
                        <strong>All clear</strong>
                        <span className="small">No cars waiting at the gate.</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            {tab === "review" ? (
              <section className="tab-split">
                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="eyebrow">Opened section</div>
                      <div className="title">Opened at the gate</div>
                    </div>
                    <span className={`badge ${openedEvents.length ? "success" : "outline"}`}>{openedEvents.length}</span>
                  </div>
                  <div className="card-body scroll" style={{ padding: 0, maxHeight: 340 }}>
                    <div className="list">
                      {openedEvents.length ? (
                        openedEvents.map((event) => (
                          <div className="list-row" key={`tablet-opened-${event.eventKey}`}>
                            <div className="left row" style={{ gap: 12, alignItems: "flex-start" }}>
                              {avatarFor(event)}
                              <div className="min-w-0">
                                <strong>{event.subjectName}</strong>
                                <div className="muted small">{event.subjectMeta}</div>
                                <div className="row-wrap small muted mt-2">
                                  <span className="badge success">{outcomeLabel(event)}</span>
                                  {kindBadge(event.kind)}
                                  {modeBadge(event.mode)}
                                  <span className="mono">{event.epc.slice(-12)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="right small">
                              <div className="mono">{formatTime(event.resolvedAt ?? event.ts)}</div>
                              <div className="muted mt-2">{relative(event.resolvedAt ?? event.ts)}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="empty" style={{ padding: 24 }}>
                          <Icon name="check" size={26} />
                          <strong>No opened entries yet</strong>
                          <span className="small">Vehicles opened from the tablet will appear here immediately.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="eyebrow">Denied section</div>
                      <div className="title">Denied entries</div>
                    </div>
                    <span className={`badge ${deniedEvents.length ? "danger" : "outline"}`}>{deniedEvents.length}</span>
                  </div>
                  <div className="card-body scroll" style={{ padding: 0, maxHeight: 340 }}>
                    <div className="list">
                      {deniedEvents.length ? (
                        deniedEvents.map((event) => (
                          <div className="list-row" key={`tablet-denied-${event.eventKey}`}>
                            <div className="left row" style={{ gap: 12, alignItems: "flex-start" }}>
                              {avatarFor(event)}
                              <div className="min-w-0">
                                <strong>{event.subjectName}</strong>
                                <div className="muted small">{event.reason || event.subjectMeta}</div>
                                <div className="row-wrap small muted mt-2">
                                  <span className="badge danger">{outcomeLabel(event)}</span>
                                  {kindBadge(event.kind)}
                                  {modeBadge(event.mode)}
                                  <span className="mono">{event.epc.slice(-12)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="right small">
                              <div className="mono">{formatTime(event.resolvedAt ?? event.ts)}</div>
                              <div className="muted mt-2">{relative(event.resolvedAt ?? event.ts)}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="empty" style={{ padding: 24 }}>
                          <Icon name="shieldCheck" size={26} />
                          <strong>No denied entries yet</strong>
                          <span className="small">Blocked or denied vehicles will collect here for guard review.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {tab === "history" ? (
              <section className="stack" style={{ gap: 14 }}>
                <section className="card">
                  <div className="card-header">
                    <div>
                      <div className="eyebrow">Today&apos;s log</div>
                      <div className="title">All {events.length} scans</div>
                    </div>
                    <span className="badge outline">Newest first</span>
                  </div>
                  <div className="card-body scroll" style={{ padding: 0, maxHeight: 420 }}>
                    <div className="list">
                      {events.length ? (
                        events.map((event) => (
                          <div className="list-row" key={event.eventKey}>
                            <div className="left row" style={{ gap: 12, alignItems: "flex-start" }}>
                              {avatarFor(event)}
                              <div className="min-w-0">
                                <strong>{event.subjectName}</strong>
                                <div className="muted small">{event.subjectMeta}</div>
                                <div className="row-wrap small muted mt-2">
                                  {statusBadge(event.status)}
                                  <span className={`badge ${event.status === "allowed" ? "success" : event.status === "denied" ? "danger" : "warn"}`}>
                                    {outcomeLabel(event)}
                                  </span>
                                  {kindBadge(event.kind)}
                                  {modeBadge(event.mode)}
                                  <span className="mono">{event.epc.slice(-12)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="right small">
                              <div className="mono">{formatTime(event.ts)}</div>
                              <div className="muted mt-2">{relative(event.ts)}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="empty" style={{ padding: 24 }}>
                          <Icon name="history" size={26} />
                          <strong>No log entries yet</strong>
                          <span className="small">New scans will appear here as soon as the gate or handheld creates them.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="tab-split">
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <div className="eyebrow">Opened section</div>
                        <div className="title">Opened at the gate</div>
                      </div>
                      <span className={`badge ${openedEvents.length ? "success" : "outline"}`}>{openedEvents.length}</span>
                    </div>
                    <div className="card-body scroll" style={{ padding: 0, maxHeight: 320 }}>
                      <div className="list">
                        {openedEvents.length ? (
                          openedEvents.map((event) => (
                            <div className="list-row" key={`history-opened-${event.eventKey}`}>
                              <div className="left row" style={{ gap: 12, alignItems: "flex-start" }}>
                                {avatarFor(event)}
                                <div className="min-w-0">
                                  <strong>{event.subjectName}</strong>
                                  <div className="muted small">{event.subjectMeta}</div>
                                  <div className="row-wrap small muted mt-2">
                                    <span className="badge success">{outcomeLabel(event)}</span>
                                    {kindBadge(event.kind)}
                                    <span className="mono">{event.epc.slice(-12)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="right small">
                                <div className="mono">{formatTime(event.resolvedAt ?? event.ts)}</div>
                                <div className="muted mt-2">{relative(event.resolvedAt ?? event.ts)}</div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="empty" style={{ padding: 24 }}>
                            <Icon name="check" size={26} />
                            <strong>No opened entries yet</strong>
                            <span className="small">Open-gate actions will be listed here.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <div>
                        <div className="eyebrow">Denied section</div>
                        <div className="title">Denied entries</div>
                      </div>
                      <span className={`badge ${deniedEvents.length ? "danger" : "outline"}`}>{deniedEvents.length}</span>
                    </div>
                    <div className="card-body scroll" style={{ padding: 0, maxHeight: 320 }}>
                      <div className="list">
                        {deniedEvents.length ? (
                          deniedEvents.map((event) => (
                            <div className="list-row" key={`history-denied-${event.eventKey}`}>
                              <div className="left row" style={{ gap: 12, alignItems: "flex-start" }}>
                                {avatarFor(event)}
                                <div className="min-w-0">
                                  <strong>{event.subjectName}</strong>
                                  <div className="muted small">{event.reason || event.subjectMeta}</div>
                                  <div className="row-wrap small muted mt-2">
                                    <span className="badge danger">{outcomeLabel(event)}</span>
                                    {kindBadge(event.kind)}
                                    <span className="mono">{event.epc.slice(-12)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="right small">
                                <div className="mono">{formatTime(event.resolvedAt ?? event.ts)}</div>
                                <div className="muted mt-2">{relative(event.resolvedAt ?? event.ts)}</div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="empty" style={{ padding: 24 }}>
                            <Icon name="shieldCheck" size={26} />
                            <strong>No denied entries yet</strong>
                            <span className="small">Denied and blocked vehicles will be shown here.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </section>
            ) : null}

            {tab === "directory" ? (
              <section className="stack" style={{ gap: 14 }}>
                <section className="card">
                  <div className="card-header">
                    <div>
                      <div className="eyebrow">Directory</div>
                      <div className="title">Seen ABIOT records</div>
                    </div>
                    <span className="badge outline">{directoryEvents.length}</span>
                  </div>
                  <div className="card-body scroll" style={{ padding: 0, maxHeight: 420 }}>
                    <div className="list">
                      {directoryEvents.length ? (
                        directoryEvents.map((event) => (
                          <div className="list-row" key={`directory-${event.epc}`}>
                            <div className="left row" style={{ gap: 12, alignItems: "flex-start" }}>
                              <div className={`avatar ${avatarClassForKind(event.kind)}`}>{initials(event.subjectName)}</div>
                              <div className="min-w-0">
                                <strong>{event.subjectName}</strong>
                                <div className="muted small">{event.subjectMeta || "Resolved from ABIOT lookup"}</div>
                                <div className="row-wrap small muted mt-2">
                                  {statusBadge(event.status)}
                                  {kindBadge(event.kind)}
                                  <span className="mono">{event.epc}</span>
                                </div>
                              </div>
                            </div>
                            <div className="right small">
                              <div>{event.plate || "-"}</div>
                              <div className="muted mt-2">{event.location || "Location pending"}</div>
                              <button
                                className="btn ghost sm mt-2"
                                onClick={() =>
                                  createScan({
                                    epc: event.epc,
                                    tid: event.tid,
                                    plate: event.plate,
                                    mode: "handheld",
                                    readerId: "CW-C72-01",
                                    gateId: "gate-main-entry",
                                    direction: "entry",
                                  })
                                }
                              >
                                <Icon name="refresh" size={12} /> Fetch latest
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="empty" style={{ padding: 24 }}>
                          <Icon name="users" size={26} />
                          <strong>No ABIOT records yet</strong>
                          <span className="small">Scan a tag first so the website can resolve it through ABIOT lookup.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="tab-split">
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <div className="eyebrow">Needs review</div>
                        <div className="title">Directory records waiting on guard action</div>
                      </div>
                      <span className={`badge ${directoryGroups.review.length ? "warn" : "outline"}`}>{directoryGroups.review.length}</span>
                    </div>
                    <div className="card-body scroll" style={{ padding: 0, maxHeight: 300 }}>
                      <div className="list">
                        {directoryGroups.review.length ? (
                          directoryGroups.review.map((event) => (
                            <div className="list-row" key={`directory-review-${event.epc}`}>
                              <div className="left row" style={{ gap: 12, alignItems: "flex-start" }}>
                                {avatarFor(event)}
                                <div className="min-w-0">
                                  <strong>{event.subjectName}</strong>
                                  <div className="muted small">{event.reason || event.subjectMeta}</div>
                                  <div className="row-wrap small muted mt-2">
                                    {kindBadge(event.kind)}
                                    <span className="mono">{event.epc.slice(-12)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="right small">
                                <div>{event.plate || "-"}</div>
                                <div className="muted mt-2">{event.location || "Gate queue"}</div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="empty" style={{ padding: 24 }}>
                            <Icon name="queue" size={26} />
                            <strong>No review records</strong>
                            <span className="small">Unknown or flagged directory records will show here.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <div>
                        <div className="eyebrow">Denied records</div>
                        <div className="title">Blocked and denied directory records</div>
                      </div>
                      <span className={`badge ${directoryGroups.denied.length ? "danger" : "outline"}`}>{directoryGroups.denied.length}</span>
                    </div>
                    <div className="card-body scroll" style={{ padding: 0, maxHeight: 300 }}>
                      <div className="list">
                        {directoryGroups.denied.length ? (
                          directoryGroups.denied.map((event) => (
                            <div className="list-row" key={`directory-denied-${event.epc}`}>
                              <div className="left row" style={{ gap: 12, alignItems: "flex-start" }}>
                                {avatarFor(event)}
                                <div className="min-w-0">
                                  <strong>{event.subjectName}</strong>
                                  <div className="muted small">{event.reason || event.subjectMeta}</div>
                                  <div className="row-wrap small muted mt-2">
                                    {kindBadge(event.kind)}
                                    <span className="mono">{event.epc.slice(-12)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="right small">
                                <div>{event.plate || "-"}</div>
                                <div className="muted mt-2">{event.location || "Approach lane"}</div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="empty" style={{ padding: 24 }}>
                            <Icon name="shieldCheck" size={26} />
                            <strong>No blocked records</strong>
                            <span className="small">Denied directory records will appear here when they are scanned or fetched.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </section>
            ) : null}

            {tab === "register" ? (
              <section className="tab-split">
                <div className="card card-accent">
                  <div className="card-header">
                    <div>
                      <div className="eyebrow">ABIOT registry</div>
                      <div className="title">Register a vehicle tag</div>
                    </div>
                    <span className="badge outline">Deferred add</span>
                  </div>
                  <div className="card-body">
                    <form className="stack" style={{ gap: 16 }} onSubmit={submitRegisterVehicle}>
                      <div className="row-wrap">
                        <button type="button" className="btn ghost sm" onClick={() => setRegisterEpc(epcDraft.trim().toUpperCase())}>
                          <Icon name="scan" size={12} /> Use manual EPC
                        </button>
                        <button type="button" className="btn ghost sm" onClick={() => applyRegisterDraftFromEvent(latest)}>
                          <Icon name="refresh" size={12} /> Use latest scan
                        </button>
                        {selectedEventKey ? (
                          <button
                            type="button"
                            className="btn ghost sm"
                            onClick={() => applyRegisterDraftFromEvent(events.find((item) => item.eventKey === selectedEventKey) || null)}
                          >
                            <Icon name="queue" size={12} /> Use focused card
                          </button>
                        ) : null}
                        <button type="button" className="btn ghost sm" onClick={() => resetRegisterDraft()}>
                          <Icon name="x" size={12} /> Clear
                        </button>
                      </div>

                      <div className="form-group">
                        <label>EPC *</label>
                        <input
                          className="input mono mt-2"
                          value={registerEpc}
                          onChange={(inputEvent) => setRegisterEpc(inputEvent.target.value.toUpperCase())}
                          placeholder="E2806995000050008D040962"
                          required
                        />
                      </div>

                      <div className="grid grid-2">
                        <div className="form-group">
                          <label>Label shown on web *</label>
                          <input
                            className="input mt-2"
                            value={registerLabel}
                            onChange={(inputEvent) => setRegisterLabel(inputEvent.target.value)}
                            placeholder="Resident or vehicle card label"
                          />
                        </div>
                        <div className="form-group">
                          <label>Default access state</label>
                          <select className="input mt-2" value={registerState} onChange={(inputEvent) => setRegisterState(inputEvent.target.value as "allowed" | "review")}>
                            <option value="allowed">Auto-Allowed</option>
                            <option value="review">Needs Review</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-2">
                        <div className="form-group">
                          <label>Owner name</label>
                          <input
                            className="input mt-2"
                            value={registerOwnerName}
                            onChange={(inputEvent) => setRegisterOwnerName(inputEvent.target.value)}
                            placeholder="Resident or driver name"
                          />
                        </div>
                        <div className="form-group">
                          <label>Vehicle name</label>
                          <input
                            className="input mt-2"
                            value={registerVehicleName}
                            onChange={(inputEvent) => setRegisterVehicleName(inputEvent.target.value)}
                            placeholder="Honda City / Creta / courier van"
                          />
                        </div>
                      </div>

                      <div className="grid grid-3">
                        <div className="form-group">
                          <label>Plate number</label>
                          <input
                            className="input mt-2"
                            value={registerPlate}
                            onChange={(inputEvent) => setRegisterPlate(inputEvent.target.value.toUpperCase())}
                            placeholder="MH 12 AB 1234"
                          />
                        </div>
                        <div className="form-group">
                          <label>Unit / location</label>
                          <input
                            className="input mt-2"
                            value={registerLocation}
                            onChange={(inputEvent) => setRegisterLocation(inputEvent.target.value)}
                            placeholder="Tower A - 1204"
                          />
                        </div>
                        <div className="form-group">
                          <label>Vehicle kind</label>
                          <input
                            className="input mt-2"
                            value={registerVehicleKind}
                            onChange={(inputEvent) => setRegisterVehicleKind(inputEvent.target.value)}
                            placeholder="resident / worker / guest"
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Notes</label>
                        <input
                          className="input mt-2"
                          value={registerNotes}
                          onChange={(inputEvent) => setRegisterNotes(inputEvent.target.value)}
                          placeholder="Parking note, visitor detail, or access instruction"
                        />
                      </div>

                      <div className="row-wrap" style={{ justifyContent: "flex-end", alignItems: "center" }}>
                        <button type="submit" className="btn primary" disabled={isRegisterSubmitting} style={{ justifyContent: "center" }}>
                          <Icon name="plus" size={14} /> {isRegisterSubmitting ? "Saving..." : "Save vehicle"}
                        </button>
                      </div>

                      {registerMessage ? (
                        <div className={`fetch-note ${registerTone === "danger" ? "danger" : "success"}`}>
                          {registerMessage}
                        </div>
                      ) : null}
                    </form>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="eyebrow">Quick help</div>
                      <div className="title">How this register tab works</div>
                    </div>
                    <span className="badge outline">Tablet + Manager</span>
                  </div>
                  <div className="card-body">
                    <div className="stack" style={{ gap: 14 }}>
                      <div className="card" style={{ background: "var(--surface-alt)" }}>
                        <div className="card-body">
                          <strong>1. Save the vehicle</strong>
                          <div className="muted small mt-2">
                            This writes the EPC, label, owner, vehicle, plate, location, kind, and notes to the shared registry used by the tablet and manager.
                          </div>
                        </div>
                      </div>
                      <div className="card" style={{ background: "var(--surface-alt)" }}>
                        <div className="card-body">
                          <strong>2. Reuse scanned EPCs</strong>
                          <div className="muted small mt-2">
                            Use the buttons above to pull the EPC from the manual scan box, the latest card, or the currently focused queue card.
                          </div>
                        </div>
                      </div>
                      <div className="card" style={{ background: "var(--surface-alt)" }}>
                        <div className="card-body">
                          <strong>3. What happens next</strong>
                          <div className="muted small mt-2">
                            After saving, the next fetch or live scan for that EPC will show the registered vehicle on both Tablet and Manager.
                          </div>
                        </div>
                      </div>
                      <div className="stack">
                        <div className="eyebrow">Recent EPCs</div>
                        {currentEvents.slice(0, 4).map((event) => (
                          <button
                            key={`register-epc-${event.eventKey}`}
                            type="button"
                            className="btn ghost"
                            style={{ justifyContent: "space-between" }}
                            onClick={() => applyRegisterDraftFromEvent(event)}
                          >
                            <span>{event.subjectName}</span>
                            <span className="mono small">{event.epc.slice(-12)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="tab-split">
              <div className="card card-accent">
                <div className="card-header">
                  <div>
                    <div className="eyebrow">Manual scan</div>
                    <div className="title">Scan an EPC</div>
                  </div>
                  <span className="badge outline">Handheld mode</span>
                </div>
                  <div className="card-body">
                    <form className="scan-input" onSubmit={submitScan}>
                      <input className="input mono" value={epcDraft} onChange={(event) => setEpcDraft(event.target.value)} placeholder="Paste EPC to fetch latest ABIOT data" />
                      <button type="submit" className="btn primary">
                        <Icon name="refresh" size={14} /> Fetch card
                      </button>
                    </form>
                  <div className="muted small mt-3">This creates a fresh scan event, re-runs ABIOT lookup, and shows a new card on Tablet and Manager.</div>
                  {fetchMessage ? (
                    <div className={`fetch-note ${fetchMessageTone === "danger" ? "danger" : "success"}`}>
                      {fetchMessage}
                    </div>
                  ) : null}
                  <div className="muted small mt-3">Or pick a realistic preset to simulate a scan:</div>
                  <div className="presets mt-2">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.epc}
                        onClick={() =>
                          createScan({
                            epc: preset.epc,
                            mode: "handheld",
                            readerId: "CW-C72-01",
                                gateId: "gate-main-entry",
                                direction: "entry",
                              })
                            }
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {latest ? (
                <div className="sonar-card">
                  <div className="s-head">
                    <div>
                      <div className="eyebrow">Find car</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>RFID sonar locator</div>
                    </div>
                    <span className={`badge ${latest.rssi && latest.rssi >= 70 ? "success" : latest.rssi && latest.rssi >= 50 ? "warn" : "danger"}`}>
                      {latest.rssi ?? 0}% signal
                    </span>
                  </div>
                  <div className="s-body">
                    <div className="sonar-ring" />
                    <div className="sonar-ring delay" />
                    <div className="sonar-ring delay2" />
                    <div className="sonar-core">
                      <strong>{latest.plate || "-"}</strong>
                      <span>{latest.location || "Locating..."}</span>
                    </div>
                  </div>
                  <div className="s-foot">
                    <div>
                      <div className="muted small" style={{ color: "rgba(255,255,255,0.56)" }}>
                        Signal strength
                      </div>
                      <div className="rssi-dial mt-2">
                        {Array.from({ length: 8 }, (_, index) => (
                          <span className={index < Math.round(((latest.rssi ?? 0) / 100) * 8) ? "on" : ""} key={index} />
                        ))}
                      </div>
                    </div>
                    <div className="right muted small" style={{ color: "rgba(255,255,255,0.72)" }}>
                      <div>{latest.subjectName}</div>
                      <div className="mono" style={{ color: "rgba(255,255,255,0.5)", fontSize: 10.5 }}>
                        {latest.epc.slice(-14)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="sonar-card">
                  <div className="s-head">
                    <div>
                      <div className="eyebrow">Find car</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>RFID sonar locator</div>
                    </div>
                  </div>
                  <div className="s-body">
                    <div className="sonar-core">
                      <strong>-</strong>
                      <span>No target</span>
                    </div>
                  </div>
                  <div className="s-foot muted small" style={{ color: "rgba(255,255,255,0.64)" }}>
                    Scan a tag to locate it inside the estate.
                  </div>
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
