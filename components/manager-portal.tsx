"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { VehicleRegistrationForm } from "@/components/vehicle-registration-form";
import { GATES, READERS } from "@/lib/demo-data";
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

type ManagerTab = "overview" | "feed" | "queue" | "map" | "residents" | "readers" | "settings";

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

function titleFor(tab: ManagerTab) {
  return {
    overview: "Control room",
    feed: "Live event feed",
    queue: "Exception queue",
    map: "Gate map",
    residents: "Residents & vehicles",
    readers: "Readers & antennas",
    settings: "Access policies",
  }[tab];
}

function emptyState(title: string, copy: string) {
  return (
    <div className="empty">
      <Icon name="shieldCheck" size={28} />
      <strong>{title}</strong>
      {copy ? <span className="small">{copy}</span> : null}
    </div>
  );
}

function outcomeFromAction(action: "open" | "call" | "visitor" | "deny", event: AccessEvent): ResolutionInput {
  if (action === "open") {
    return {
      status: "allowed",
      outcome: "manual-open",
      note: `Manager opened the gate for ${event.subjectName}.`,
      resolvedBy: "Ravi A. - Manager",
    };
  }
  if (action === "call") {
    return {
      status: "review",
      outcome: "resident-called",
      note: `Resident called about ${event.subjectName} - waiting on confirmation.`,
      resolvedBy: "Ravi A. - Manager",
    };
  }
  if (action === "visitor") {
    return {
      status: "allowed",
      outcome: "visitor-pass",
      note: `Visitor pass issued to ${event.subjectName}.`,
      resolvedBy: "Ravi A. - Manager",
    };
  }
  return {
    status: "denied",
    outcome: "denied-by-manager",
    note: `${event.subjectName} denied by manager.`,
    resolvedBy: "Ravi A. - Manager",
  };
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

export function ManagerPortal({ initialData }: { initialData: EventsResponse }) {
  const [activeTab, setActiveTab] = useState<ManagerTab>("overview");
  const [selectedGate, setSelectedGate] = useState<string>("gate-main-entry");
  const [fetchEpcDraft, setFetchEpcDraft] = useState("");
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);
  const [fetchMessageTone, setFetchMessageTone] = useState<"success" | "danger" | null>(null);
  const [clock, setClock] = useState<string>(new Date().toISOString());
  const [decisionMessage, setDecisionMessage] = useState<string | null>(null);
  const [decisionTone, setDecisionTone] = useState<"success" | "danger" | null>(null);
  const [decisionPendingKey, setDecisionPendingKey] = useState<string | null>(null);
  const [registeringEventKey, setRegisteringEventKey] = useState<string | null>(null);
  const {
    events,
    counters,
    actions,
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
  } = useEventsSurface("manager", undefined, initialData);

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
  const recentCardEvents = useMemo(() => currentEvents.slice(0, 4), [currentEvents]);
  const latestEvent = currentEvents[0] ?? events[0] ?? null;
  const selectedGateInfo = GATES.find((gate) => gate.id === selectedGate) ?? GATES[0];
  const syncLabel = generatedAt.startsWith("1970-01-01") ? "No sync yet" : `Updated ${relative(generatedAt)}`;

  const subtitle = {
    overview: `Real-time view across all gates - ${events.length} scans buffered`,
    feed: "Every Chainway scan, handheld or antenna, in chronological order",
    queue: "Cars held at the gate that need a human decision",
    map: `Selected gate - ${selectedGateInfo.label} - live sync`,
    residents: "Directory of resident, worker, and guest EPC tags",
    readers: "Chainway reader fleet - C72 handhelds and FM830 fixed antennas",
    settings: "Policies, tenant settings, and escalation rules",
  }[activeTab];

  const bucketedHourly = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => 0);
    events
      .filter((event) => event.status === "allowed")
      .forEach((event) => {
        buckets[new Date(event.ts).getHours()] += 1;
      });
    const max = Math.max(...buckets, 1);
    const now = new Date().getHours();
    return buckets.map((value, index) => ({
      h: (value / max) * 100,
      hot: now === index,
    }));
  }, [events]);

  const submitFetch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const epc = fetchEpcDraft.trim().toUpperCase();
    if (!epc) {
      return;
    }

    try {
      await createScan({
        epc,
        mode: "handheld",
        readerId: "CW-C72-01",
        gateId: selectedGate,
        direction: "entry",
      });
      setFetchMessage(`Fetched latest data for ${epc}. A fresh card is now in the event feed.`);
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
      await resolveEvent(event.eventKey, outcomeFromAction(action, event));
      const labels = {
        open: `Opened the gate for ${event.subjectName}.`,
        call: `Marked ${event.subjectName} as pending resident confirmation.`,
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

  return (
    <div className="mgr-body">
      <div className="mgr-shell">
        <aside className="mgr-side">
          <div className="mgr-brand">
            <div className="mark">Se</div>
            <div>
              <strong>Seceurope</strong>
              <span>Manager portal</span>
            </div>
          </div>

          <nav className="mgr-nav">
            <div className="mgr-nav-section">Operations</div>
            <button className={`mgr-link ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
              <Icon name="dashboard" size={16} />
              <span className="flex-1">Overview</span>
            </button>
            <button className={`mgr-link ${activeTab === "feed" ? "active" : ""}`} onClick={() => setActiveTab("feed")}>
              <Icon name="signal" size={16} />
              <span className="flex-1">Live feed</span>
            </button>
            <button className={`mgr-link ${activeTab === "queue" ? "active" : ""}`} onClick={() => setActiveTab("queue")}>
              <Icon name="queue" size={16} />
              <span className="flex-1">Exception queue</span>
              {reviewEvents.length ? <span className="badge warn">{reviewEvents.length}</span> : null}
            </button>
            <button className={`mgr-link ${activeTab === "map" ? "active" : ""}`} onClick={() => setActiveTab("map")}>
              <Icon name="map" size={16} />
              <span className="flex-1">Gate map</span>
            </button>

            <div className="mgr-nav-section">Directory</div>
            <button className={`mgr-link ${activeTab === "residents" ? "active" : ""}`} onClick={() => setActiveTab("residents")}>
              <Icon name="users" size={16} />
              <span className="flex-1">Residents & vehicles</span>
            </button>
            <button className={`mgr-link ${activeTab === "readers" ? "active" : ""}`} onClick={() => setActiveTab("readers")}>
              <Icon name="antenna" size={16} />
              <span className="flex-1">Readers & antennas</span>
            </button>

            <div className="mgr-nav-section">Configuration</div>
            <button className={`mgr-link ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}>
              <Icon name="settings" size={16} />
              <span className="flex-1">Access policies</span>
            </button>
          </nav>

          <div className="spacer" />

          <div className="side-card">
            <div className="row-between">
              <strong>Shared state</strong>
              <span className="row" style={{ gap: 6 }}>
                <span className="dot live" />
                <span className="muted small">Live</span>
              </span>
            </div>
            <div className="muted small" style={{ marginTop: 6 }}>
              {events.length} events buffered - {actions.length} actions
            </div>
            <div className="mini-stats">
              <div>
                <span>Today</span>
                <b>{counters.total}</b>
              </div>
              <div>
                <span>Review</span>
                <b>{reviewEvents.length}</b>
              </div>
            </div>
          </div>

          <div className="side-card">
            <div className="row" style={{ gap: 10 }}>
              <div className="avatar" style={{ background: "rgba(255,255,255,0.06)", color: "white" }}>
                RA
              </div>
              <div>
                <strong style={{ color: "white", fontSize: 12.5 }}>Ravi Agarwal</strong>
                <div className="muted small" style={{ color: "var(--text-inverse-muted)" }}>
                  Estate manager - on duty
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="mgr-main">
          <header className="mgr-topbar">
            <div>
              <h1>{titleFor(activeTab)}</h1>
              <p>{subtitle}</p>
            </div>
            <div className="row" style={{ gap: 10 }}>
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
                className="btn ghost"
                onClick={async () => {
                  try {
                    const synced = await syncLatest();
                    setFetchMessage(
                      synced > 0
                        ? `Fetched ${synced} latest ${synced === 1 ? "entry" : "entries"} from the website registry.`
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
                <Icon name="refresh" size={14} /> {refreshing ? "Refreshing..." : "Fetch latest"}
              </button>
              <Link className="btn ghost" href="/">
                <Icon name="dashboard" size={14} /> Home
              </Link>
              <Link className="btn ghost" href="/tablet" target="_blank" rel="noreferrer">
                <Icon name="arrowUpRight" size={14} /> Tablet
              </Link>
            </div>
          </header>

          <div className="mgr-content">
            {loading ? (
              <div className="card">
                <div className="card-body">Loading events...</div>
              </div>
            ) : null}
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

            {activeTab === "overview" ? (
              <>
                <section className="kpi-strip">
                  <div className="kpi-card accent">
                    <div className="eyebrow">Scans today</div>
                    <div className="kpi-value">{counters.total}</div>
                    <div className="kpi-meta">All RFID events captured</div>
                  </div>
                  <div className="kpi-card">
                    <div className="eyebrow">Auto-allowed</div>
                    <div className="kpi-value">{counters.allowed}</div>
                    <div className="kpi-meta">Resident - guest - worker</div>
                  </div>
                  <div className="kpi-card">
                    <div className="eyebrow">Needs review</div>
                    <div className="kpi-value">{reviewEvents.length}</div>
                    <div className="kpi-meta">Cars waiting at the gate</div>
                  </div>
                  <div className="kpi-card">
                    <div className="eyebrow">Realtime</div>
                    <div className="kpi-value">Live</div>
                    <div className="kpi-meta">Supabase channels active</div>
                  </div>
                </section>

                <section className="split">
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
                            <div className={`event-card ${event.status}`} key={`recent-${event.eventKey}`}>
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
                                  <Icon name="mapPin" size={12} /> {GATES.find((gate) => gate.id === event.gateId)?.short || event.gateId}
                                </span>
                                <span className="badge outline">
                                  <Icon name="clock" size={12} /> {relative(event.ts)}
                                </span>
                              </div>
                              <div className="mono muted">{event.epc}</div>
                              {event.reason ? <div className="small muted">{event.reason}</div> : null}
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
                                  <button className="btn ghost sm" type="button" onClick={() => setActiveTab("feed")}>
                                    <Icon name="history" size={12} /> Open feed
                                  </button>
                                )}
                              </div>
                              {registeringEventKey === event.eventKey ? (
                                <div className="mt-3">
                                  <VehicleRegistrationForm
                                    actorLabel="Ravi A. - Manager"
                                    initialEvent={event}
                                    allowIdentityEdit={false}
                                    compact
                                    title="Register this vehicle"
                                    description="Save the live EPC to ABIOT so future scans resolve automatically."
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
                        emptyState("No cards yet", "Use the fetch form to create a fresh card from an EPC.")
                      )}
                    </div>
                  </div>

                  <div className="card card-accent">
                    <div className="card-header">
                      <div>
                        <div className="eyebrow">Fetch latest data</div>
                        <div className="title">Create or refresh a vehicle card</div>
                      </div>
                      <span className="badge outline">{selectedGateInfo.short}</span>
                    </div>
                    <div className="card-body">
                      <form className="fetch-form" onSubmit={submitFetch}>
                        <input
                          className="input mono"
                          value={fetchEpcDraft}
                          onChange={(event) => setFetchEpcDraft(event.target.value)}
                          placeholder="Enter EPC to fetch from ABIOT"
                        />
                        <button type="submit" className="btn primary">
                          <Icon name="refresh" size={14} /> Fetch card
                        </button>
                      </form>
                      <div className="muted small mt-3">
                        This creates a fresh scan event for the EPC, re-runs ABIOT lookup, and adds a new visible card to Manager and Tablet.
                      </div>
                      {fetchMessage ? (
                        <div className={`fetch-note ${fetchMessageTone === "danger" ? "danger" : "success"}`}>
                          {fetchMessage}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="split">
                  <div className="card card-accent">
                    <div className="card-header">
                      <div>
                        <div className="eyebrow">Exception queue</div>
                        <div className="title">Cars waiting at the gate</div>
                      </div>
                      {reviewEvents.length ? <span className="badge warn">{reviewEvents.length} open</span> : <span className="badge success">Clear</span>}
                    </div>
                    <div className="card-body tight">
                      {reviewEvents.length ? (
                        <div className="stack">
                          {reviewEvents.slice(0, 4).map((event) => (
                            <div className="review-card" key={event.eventKey}>
                              <div className="row-between">
                                <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                                  {avatarFor(event)}
                                  <div>
                                    <strong style={{ fontSize: 14 }}>{event.subjectName}</strong>
                                    <div className="muted small">{event.subjectMeta}</div>
                                    <div className="mono muted mt-2">{event.epc}</div>
                                  </div>
                                </div>
                                {statusBadge(event.status)}
                              </div>
                              <div className="row-wrap small muted">
                                {kindBadge(event.kind)}
                                {modeBadge(event.mode)}
                                <span className="badge outline">
                                  <Icon name="mapPin" size={12} /> {event.location || "Main gate"}
                                </span>
                                <span className="badge outline">
                                  <Icon name="clock" size={12} /> {relative(event.ts)}
                                </span>
                              </div>
                              <div className="review-actions">
                                <button className="btn success sm" type="button" onClick={() => void submitDecision("open", event)} disabled={decisionPendingKey === event.eventKey}>
                                  <Icon name="check" size={14} /> Open gate
                                </button>
                                <button className="btn ghost sm" type="button" onClick={() => void submitDecision("call", event)} disabled={decisionPendingKey === event.eventKey}>
                                  <Icon name="phone" size={14} /> Call resident
                                </button>
                                <button className="btn warn sm" type="button" onClick={() => void submitDecision("visitor", event)} disabled={decisionPendingKey === event.eventKey}>
                                  <Icon name="shieldCheck" size={14} /> Issue pass
                                </button>
                                <button className="btn danger sm" type="button" onClick={() => void submitDecision("deny", event)} disabled={decisionPendingKey === event.eventKey}>
                                  <Icon name="x" size={14} /> Deny
                                </button>
                                {canRegisterVehicle(event) ? (
                                  <button className="btn primary sm" type="button" onClick={() => setRegisteringEventKey((current) => current === event.eventKey ? null : event.eventKey)}>
                                    <Icon name="plus" size={14} /> Register
                                  </button>
                                ) : null}
                              </div>
                              {registeringEventKey === event.eventKey ? (
                                <div className="mt-3">
                                  <VehicleRegistrationForm
                                    actorLabel="Ravi A. - Manager"
                                    initialEvent={event}
                                    allowIdentityEdit={false}
                                    compact
                                    title="Register from exception queue"
                                    description="Write the unknown vehicle to ABIOT without leaving the manager queue."
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
                        emptyState("No cars waiting", "Every scan has been cleared. Nice and quiet.")
                      )}
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <div>
                        <div className="eyebrow">Latest scan</div>
                        <div className="title">Most recent RFID event</div>
                      </div>
                      {latestEvent ? modeBadge(latestEvent.mode) : null}
                    </div>
                    <div className="card-body">
                      {latestEvent ? (
                        <div className={`result-card ${latestEvent.status}`}>
                          <div className="row-between">
                            <div>
                              <div className="eyebrow">
                                {GATES.find((gate) => gate.id === latestEvent.gateId)?.label || latestEvent.gateId} - {latestEvent.direction}
                              </div>
                              <div className="title mt-2">{latestEvent.payload.title ? String(latestEvent.payload.title) : "Latest gate event"}</div>
                            </div>
                            {statusBadge(latestEvent.status)}
                          </div>
                          <div className="mt-3">
                            <strong>{latestEvent.subjectName}</strong>
                            <div className="muted small">{latestEvent.subjectMeta}</div>
                          </div>
                          <div className="row-wrap mt-3 small">
                            <span className="badge outline">{latestEvent.plate || "-"}</span>
                            {modeBadge(latestEvent.mode)}
                            <span className="badge outline">
                              <Icon name="signal" size={12} /> RSSI {latestEvent.rssi ?? "-"}
                            </span>
                            <span className="badge outline">
                              <Icon name="clock" size={12} /> {relative(latestEvent.ts)}
                            </span>
                          </div>
                          <div className="mono muted small mt-3">{latestEvent.epc}</div>
                          {latestEvent.status === "review" || latestEvent.status === "denied" ? (
                            <div className="stack mt-4" style={{ gap: 12 }}>
                              <div className="review-actions">
                                <button className="btn success sm" type="button" onClick={() => void submitDecision("open", latestEvent)} disabled={decisionPendingKey === latestEvent.eventKey}>
                                  <Icon name="check" size={14} /> Open gate
                                </button>
                                <button className="btn ghost sm" type="button" onClick={() => void submitDecision("call", latestEvent)} disabled={decisionPendingKey === latestEvent.eventKey}>
                                  <Icon name="phone" size={14} /> Call resident
                                </button>
                                <button className="btn warn sm" type="button" onClick={() => void submitDecision("visitor", latestEvent)} disabled={decisionPendingKey === latestEvent.eventKey}>
                                  <Icon name="shieldCheck" size={14} /> Issue pass
                                </button>
                                <button className="btn danger sm" type="button" onClick={() => void submitDecision("deny", latestEvent)} disabled={decisionPendingKey === latestEvent.eventKey}>
                                  <Icon name="x" size={14} /> Deny
                                </button>
                                {canRegisterVehicle(latestEvent) ? (
                                  <button className="btn primary sm" type="button" onClick={() => setRegisteringEventKey((current) => current === latestEvent.eventKey ? null : latestEvent.eventKey)}>
                                    <Icon name="plus" size={14} /> Register vehicle
                                  </button>
                                ) : null}
                              </div>
                              {registeringEventKey === latestEvent.eventKey ? (
                                <VehicleRegistrationForm
                                  actorLabel="Ravi A. - Manager"
                                  initialEvent={latestEvent}
                                  allowIdentityEdit={false}
                                  compact
                                  title="Register latest scan"
                                  description="Save the live EPC to ABIOT directly from the manager overview."
                                  submitLabel="Register from latest scan"
                                  onCancel={() => setRegisteringEventKey(null)}
                                  onSuccess={(message) => handleRegistrationSuccess(message)}
                                />
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        emptyState("No events yet", "Waiting for scans from ABIOT or manual input.")
                      )}
                    </div>
                  </div>
                </section>

                <section className="split">
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <div className="eyebrow">Gate map</div>
                        <div className="title">Sundara Greens Estate</div>
                      </div>
                      <span className="badge outline">{selectedGateInfo.short}</span>
                    </div>
                    <div className="card-body">
                      <div className="estate-map" data-live="1">
                        <div className="road" />
                        <div className="building b-a">Tower A<br />Courtyard</div>
                        <div className="building b-b">Tower L<br />Lofts</div>
                        <div className="building b-c">Clubhouse</div>
                        <div className="building b-d">Service bay</div>
                        <div className={`gate g-main ${selectedGate === "gate-main-entry" ? "hot" : ""}`}>
                          <span className="dot" />
                          Main Entry
                        </div>
                        <div className={`gate g-exit ${selectedGate === "gate-main-exit" ? "hot" : ""}`}>
                          <span className="dot" />
                          Main Exit
                        </div>
                        <div className={`gate g-serv ${selectedGate === "gate-service" ? "hot" : reviewEvents.length ? "warn" : ""}`}>
                          <span className="dot" />
                          Service
                        </div>
                        <div className={`gate g-vip ${selectedGate === "gate-vip" ? "hot" : ""}`}>
                          <span className="dot" />
                          VIP
                        </div>
                        <div className="signal-wave" />
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <div>
                        <div className="eyebrow">Hourly throughput</div>
                        <div className="title">Allowed scans by hour</div>
                      </div>
                    </div>
                    <div className="card-body">
                      <div className="kpi-value">{counters.allowed}</div>
                      <div className="muted small mt-2">Across all readers today</div>
                      <div className="spark">
                        {bucketedHourly.map((bucket, index) => (
                          <div className={`spark-bar ${bucket.hot ? "hot" : ""}`} style={{ height: `${Math.max(8, bucket.h)}%` }} key={index} />
                        ))}
                      </div>
                      <div className="row-between mt-4 small muted">
                        <span>00:00</span>
                        <span>06:00</span>
                        <span>12:00</span>
                        <span>18:00</span>
                        <span>now</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="split">
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <div className="eyebrow">Live feed</div>
                        <div className="title">All RFID scans</div>
                      </div>
                      <span className="badge outline">{events.length}</span>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                      <div className="feed scroll list">
                        {events.slice(0, 8).map((event) => (
                          <div className="list-row" key={event.eventKey}>
                            <div className="left row" style={{ gap: 12, alignItems: "flex-start", flex: 1 }}>
                              {avatarFor(event)}
                              <div className="min-w-0 flex-1">
                                <div className="feed-header">
                                  <span>{event.subjectName}</span>
                                  {statusBadge(event.status)}
                                </div>
                                <div className="muted small">{event.subjectMeta}</div>
                                <div className="feed-meta mt-2">
                                  {kindBadge(event.kind)}
                                  {modeBadge(event.mode)}
                                  <span className="mono">{event.epc.slice(-12)}</span>
                                  <span>{event.plate || ""}</span>
                                  <span>{GATES.find((gate) => gate.id === event.gateId)?.short || event.gateId}</span>
                                </div>
                              </div>
                            </div>
                            <div className="right">
                              <div className="mono small">{formatTime(event.ts)}</div>
                              <div className="muted small mt-2">{relative(event.ts)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="card-footer">
                      <span className="muted">Showing 8 of {events.length}</span>
                      <button className="btn ghost sm" onClick={() => setActiveTab("feed")}>
                        Open full feed <Icon name="arrowRight" size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <div>
                        <div className="eyebrow">Decisions timeline</div>
                        <div className="title">Guard actions</div>
                      </div>
                    </div>
                    <div className="card-body" style={{ padding: "6px 8px" }}>
                      <div className="timeline">
                        {actions.slice(0, 8).map((action) => (
                          <div className="timeline-item" key={action.id}>
                            <div className={`timeline-node ${action.tone}`} />
                            <div className="timeline-body">
                              <strong>{action.label}</strong>
                              <span>{relative(action.ts)}</span>
                            </div>
                            <div className="mono small muted">{formatTime(action.ts)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            ) : null}

            {activeTab === "feed" ? (
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="eyebrow">Live feed</div>
                    <div className="title">All RFID scan events</div>
                  </div>
                  <div className="row-wrap">
                    <span className="badge outline">{events.length} events</span>
                    <span className="badge success">DB stream</span>
                  </div>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  <div className="list">
                    {events.map((event) => (
                      <div className="list-row" key={event.eventKey}>
                        <div className="left row" style={{ gap: 12, alignItems: "flex-start", flex: 1 }}>
                          {avatarFor(event)}
                          <div className="min-w-0 flex-1">
                            <div className="feed-header">
                              <span>{event.subjectName}</span>
                              {statusBadge(event.status)}
                            </div>
                            <div className="muted small">{event.subjectMeta}</div>
                            <div className="feed-meta mt-2">
                              {kindBadge(event.kind)}
                              {modeBadge(event.mode)}
                              <span className="mono">{event.epc.slice(-12)}</span>
                              <span>{event.plate || ""}</span>
                              <span>{GATES.find((gate) => gate.id === event.gateId)?.short || event.gateId}</span>
                            </div>
                          </div>
                        </div>
                        <div className="right">
                          <div className="mono small">{formatTime(event.ts)}</div>
                          <div className="muted small mt-2">{relative(event.ts)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "queue" ? (
              <div className="card card-accent">
                <div className="card-header">
                  <div>
                    <div className="eyebrow">Needs guard decision</div>
                    <div className="title">Exception queue</div>
                  </div>
                  <span className="badge warn">{reviewEvents.length} open</span>
                </div>
                <div className="card-body">
                  {reviewEvents.length ? (
                    <div className="grid grid-2">
                      {reviewEvents.map((event) => (
                        <div className="review-card" key={event.eventKey}>
                          <div className="row-between">
                            <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                              {avatarFor(event)}
                              <div>
                                <strong style={{ fontSize: 14 }}>{event.subjectName}</strong>
                                <div className="muted small">{event.subjectMeta}</div>
                                <div className="mono muted mt-2">{event.epc}</div>
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
                          <div className="review-actions">
                            <button className="btn success sm" type="button" onClick={() => void submitDecision("open", event)} disabled={decisionPendingKey === event.eventKey}>
                              <Icon name="check" size={14} /> Open gate
                            </button>
                            <button className="btn ghost sm" type="button" onClick={() => void submitDecision("call", event)} disabled={decisionPendingKey === event.eventKey}>
                              <Icon name="phone" size={14} /> Call resident
                            </button>
                            <button className="btn warn sm" type="button" onClick={() => void submitDecision("visitor", event)} disabled={decisionPendingKey === event.eventKey}>
                              <Icon name="shieldCheck" size={14} /> Issue pass
                            </button>
                            <button className="btn danger sm" type="button" onClick={() => void submitDecision("deny", event)} disabled={decisionPendingKey === event.eventKey}>
                              <Icon name="x" size={14} /> Deny
                            </button>
                            {canRegisterVehicle(event) ? (
                              <button className="btn primary sm" type="button" onClick={() => setRegisteringEventKey((current) => current === event.eventKey ? null : event.eventKey)}>
                                <Icon name="plus" size={14} /> Register
                              </button>
                            ) : null}
                          </div>
                          {registeringEventKey === event.eventKey ? (
                            <div className="mt-3">
                              <VehicleRegistrationForm
                                actorLabel="Ravi A. - Manager"
                                initialEvent={event}
                                allowIdentityEdit={false}
                                compact
                                title="Register from exception queue"
                                description="Save the live EPC to ABIOT and convert this unknown vehicle into a known record."
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
                    emptyState("All clear", "No review events at the moment. Every car has been cleared.")
                  )}
                </div>
              </div>
            ) : null}

            {activeTab === "map" ? (
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="eyebrow">Gate map</div>
                    <div className="title">Sundara Greens Estate - live gate activity</div>
                  </div>
                  <div className="row-wrap">
                    {GATES.map((gate) => (
                      <button
                        key={gate.id}
                        className={`btn ${selectedGate === gate.id ? "primary" : "ghost"} sm`}
                        onClick={() => setSelectedGate(gate.id)}
                      >
                        {gate.short}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="card-body">
                  <div className="estate-map" data-live="1">
                    <div className="road" />
                    <div className="building b-a">Tower A<br />Courtyard</div>
                    <div className="building b-b">Tower L<br />Lofts</div>
                    <div className="building b-c">Clubhouse</div>
                    <div className="building b-d">Service bay</div>
                    <div className={`gate g-main ${selectedGate === "gate-main-entry" ? "hot" : ""}`}>
                      <span className="dot" />
                      Main Entry
                    </div>
                    <div className={`gate g-exit ${selectedGate === "gate-main-exit" ? "hot" : ""}`}>
                      <span className="dot" />
                      Main Exit
                    </div>
                    <div className={`gate g-serv ${selectedGate === "gate-service" ? "hot" : reviewEvents.length ? "warn" : ""}`}>
                      <span className="dot" />
                      Service
                    </div>
                    <div className={`gate g-vip ${selectedGate === "gate-vip" ? "hot" : ""}`}>
                      <span className="dot" />
                      VIP
                    </div>
                    <div className="signal-wave" />
                  </div>
                  <div className="grid grid-4 mt-4">
                    {GATES.map((gate) => {
                      const scans = events.filter((event) => event.gateId === gate.id).length;
                      return (
                        <div className={`kpi-card ${selectedGate === gate.id ? "accent" : ""}`} key={gate.id}>
                          <div className="eyebrow">{gate.short}</div>
                          <div className="kpi-value">{scans}</div>
                          <div className="kpi-meta">
                            {gate.lane} - {gate.kind}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "residents" ? (
              <div className="grid grid-2">
                <div className="card card-accent">
                  <div className="card-header">
                    <div>
                      <div className="eyebrow">Deferred registration</div>
                      <div className="title">Add a vehicle later</div>
                    </div>
                  </div>
                  <div className="card-body">
                    <VehicleRegistrationForm
                      actorLabel="Ravi A. - Manager"
                      initialEpc={fetchEpcDraft}
                      title="Register an EPC in ABIOT"
                      description="Use this when you have the EPC and want to add the vehicle profile after the gate event."
                      submitLabel="Register vehicle"
                      onSuccess={(message) => handleRegistrationSuccess(message)}
                    />
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="eyebrow">Directory</div>
                      <div className="title">Resolved event subjects</div>
                    </div>
                    <span className="badge outline">{events.length} seen</span>
                  </div>
                  <div className="card-body" style={{ padding: 0 }}>
                    <div className="list">
                      {events.map((event) => (
                        <div className="list-row" key={event.eventKey}>
                          <div className="left row" style={{ gap: 12, alignItems: "center" }}>
                            <div className={`avatar ${avatarClassForKind(event.kind)}`}>{initials(event.subjectName)}</div>
                            <div>
                              <strong>{event.subjectName}</strong>
                              <div className="muted small">{event.subjectMeta}</div>
                              <div className="mono muted mt-2">{event.epc}</div>
                            </div>
                          </div>
                          <div className="right small">
                            {kindBadge(event.kind)}
                            <div className="muted mt-2">{event.plate || "-"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "readers" ? (
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="eyebrow">Reader fleet</div>
                    <div className="title">Chainway hardware</div>
                  </div>
                  <span className="badge outline">{READERS.length} devices</span>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  {READERS.map((reader) => (
                    <div className="reader-card" key={reader.id}>
                      <div className="reader-icon">
                        <Icon name={reader.type === "antenna" ? "antenna" : "radio"} size={20} />
                      </div>
                      <div>
                        <div className="row" style={{ gap: 10 }}>
                          <strong>{reader.model}</strong>
                          {reader.type === "antenna" ? <span className="badge info">Fixed antenna</span> : <span className="badge brand">Handheld</span>}
                        </div>
                        <div className="muted small mt-2">
                          {reader.id} - {reader.gate}
                        </div>
                        <div className="muted small">{reader.assignedTo}</div>
                      </div>
                      <div className="right">
                        <div className={`rssi-bars ${reader.rssi < 70 ? "weak" : ""}`} title={`RSSI ${reader.rssi}`}>
                          <span />
                          <span />
                          <span />
                          <span />
                        </div>
                        <div className="mono muted small mt-2">{reader.rssi} dBm</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {activeTab === "settings" ? (
              <div className="grid grid-2">
                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="eyebrow">Access policy</div>
                      <div className="title">Resident auto-allow</div>
                    </div>
                    <span className="badge success">On</span>
                  </div>
                  <div className="card-body muted">
                    Residents with a matching EPC in the directory trigger an automatic gate open when scanned by any reader assigned to
                    the Main Gate.
                  </div>
                </div>
                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="eyebrow">Access policy</div>
                      <div className="title">Visitor pass window</div>
                    </div>
                    <span className="badge success">On</span>
                  </div>
                  <div className="card-body muted">
                    Expected guests are auto-allowed during their issued window. Outside the window they are downgraded to review.
                  </div>
                </div>
                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="eyebrow">Escalation</div>
                      <div className="title">Denied vehicle alert</div>
                    </div>
                    <span className="badge warn">On</span>
                  </div>
                  <div className="card-body muted">
                    A scan from a denied EPC pings the estate manager and the supervisor on duty, and logs the attempt to the audit trail.
                  </div>
                </div>
                <div className="card">
                  <div className="card-header">
                    <div>
                      <div className="eyebrow">Data retention</div>
                      <div className="title">Scan history</div>
                    </div>
                    <span className="badge outline">90 days</span>
                  </div>
                  <div className="card-body muted">
                    Every RFID event is retained for 90 days, after which the event is rolled up into the weekly throughput summary.
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
