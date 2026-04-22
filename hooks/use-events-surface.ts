"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createScanViaApi, fetchEventsFromApi, resolveEventViaApi, syncLatestViaApi } from "@/lib/client-api";
import type { LiveConnectionState, LiveTransport, LiveUpdateMessage } from "@/lib/live-updates";
import type { AccessEvent, EventCounters, EventsResponse, ResolutionInput } from "@/lib/types";

interface SurfaceState {
  events: AccessEvent[];
  counters: EventCounters;
  generatedAt: string;
}

const EMPTY_COUNTERS: EventCounters = {
  total: 0,
  pending: 0,
  allowed: 0,
  denied: 0,
};

function defaultSurfaceState(): SurfaceState {
  return {
    events: [],
    counters: EMPTY_COUNTERS,
    generatedAt: new Date(0).toISOString(),
  };
}

function getWebSocketUrl() {
  if (typeof window === "undefined") {
    return "";
  }
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws`;
}

function normalizeSurfaceState(initialData?: EventsResponse): SurfaceState {
  if (!initialData) {
    return defaultSurfaceState();
  }

  return {
    events: Array.isArray(initialData.events) ? initialData.events : [],
    counters: initialData.counters ?? EMPTY_COUNTERS,
    generatedAt: initialData.generatedAt ?? new Date(0).toISOString(),
  };
}

export function useEventsSurface(surface: "manager" | "tablet", gateId?: string, initialData?: EventsResponse) {
  const [state, setState] = useState<SurfaceState>(() => normalizeSurfaceState(initialData));
  const [loading, setLoading] = useState(() => !initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveConnectionState>(() => (initialData ? "live" : "connecting"));
  const [liveTransport, setLiveTransport] = useState<LiveTransport>("polling");
  const [lastLiveMessage, setLastLiveMessage] = useState<LiveUpdateMessage | null>(null);
  const inFlightRef = useRef(false);
  const refreshTimeoutRef = useRef<number | null>(null);
  const liveTransportRef = useRef<LiveTransport>("polling");
  const hasLiveDataRef = useRef(Boolean(initialData));

  useEffect(() => {
    liveTransportRef.current = liveTransport;
  }, [liveTransport]);

  const lastSignatureRef = useRef<string>("");

  const refresh = useCallback(async (source: "initial" | "manual" | "live" | "poll" = "manual") => {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    if (source === "manual") {
      setRefreshing(true);
    }

    try {
      const nextState = await fetchEventsFromApi(surface, gateId);
      hasLiveDataRef.current = true;

      const signature = `${nextState.events.length}|${nextState.events[0]?.eventKey ?? ""}|${nextState.events[0]?.ts ?? ""}|${nextState.counters.total}|${nextState.counters.pending}`;
      if (signature !== lastSignatureRef.current) {
        lastSignatureRef.current = signature;
        setState(nextState);
      }

      setError(null);
      if (liveTransportRef.current !== "websocket") {
        setLiveTransport("polling");
        setLiveStatus("live");
      }
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : "Failed to refresh events";
      setError(message);
      if (typeof window !== "undefined") {
        window.console.error(`[${surface}] refresh failed from ${source}:`, refreshError);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      inFlightRef.current = false;
    }
  }, [gateId, surface]);

  useEffect(() => {
    hasLiveDataRef.current = Boolean(initialData);
    setState(normalizeSurfaceState(initialData));
    setLoading(!initialData);
    setError(null);
    if (initialData && liveTransportRef.current !== "websocket") {
      setLiveTransport("polling");
      setLiveStatus("live");
    }
  }, [initialData]);

  useEffect(() => {
    if (initialData) {
      return;
    }
    setLoading(true);
    void refresh("initial");
  }, [initialData, refresh]);

  useEffect(() => {
    const fastInterval = 2_500;
    const safetyInterval = 20_000;
    const intervalMs = liveTransport === "websocket" ? safetyInterval : fastInterval;
    const pollTimer = window.setInterval(() => {
      void refresh("poll");
    }, intervalMs);

    return () => {
      window.clearInterval(pollTimer);
    };
  }, [liveTransport, refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onFocus = () => {
      if (document.visibilityState === "visible") {
        void refresh("poll");
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectAttempt = 0;

    const clearReconnectTimer = () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };

    const connect = () => {
      if (cancelled || typeof window === "undefined") {
        return;
      }

      if (!hasLiveDataRef.current) {
        setLiveStatus(reconnectAttempt === 0 ? "connecting" : "reconnecting");
      }
      setLiveTransport("polling");

      socket = new WebSocket(getWebSocketUrl());

      socket.addEventListener("open", () => {
        reconnectAttempt = 0;
        setLiveStatus("live");
        setLiveTransport("websocket");
        void refresh("live");
      });

      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data) as LiveUpdateMessage;
          if (!payload || typeof payload !== "object" || !("type" in payload)) {
            return;
          }

          if (payload.type === "connected") {
            if (payload.lastMessage) {
              setLastLiveMessage(payload.lastMessage);
            }
            return;
          }

          if (payload.type !== "heartbeat") {
            setLastLiveMessage(payload);
            void refresh("live");
          }
        } catch {
          // ignore malformed frames
        }
      });

      socket.addEventListener("error", () => {
        socket?.close();
      });

      socket.addEventListener("close", () => {
        if (cancelled) {
          return;
        }

        reconnectAttempt += 1;
        setLiveStatus(hasLiveDataRef.current ? "live" : "reconnecting");
        setLiveTransport("polling");
        clearReconnectTimer();
        refreshTimeoutRef.current = window.setTimeout(connect, Math.min(8_000, 1_200 * reconnectAttempt));
      });
    };

    connect();

    return () => {
      cancelled = true;
      clearReconnectTimer();
      socket?.close();
      setLiveStatus("offline");
    };
  }, [refresh]);

  const actions = useMemo(() => {
    return state.events
      .filter((event) => Boolean(event.resolvedAt || event.outcome))
      .slice(0, 40)
      .map((event) => ({
        id: `${event.eventKey}-${event.resolvedAt ?? event.ts}`,
        ts: event.resolvedAt ?? event.ts,
        label: `${event.subjectName} - ${event.outcome}`,
        tone: event.status === "allowed" ? "success" : event.status === "denied" ? "danger" : "warn",
      }));
  }, [state.events]);

  const resolveEvent = useCallback(async (eventKey: string, payload: ResolutionInput) => {
    await resolveEventViaApi(eventKey, payload);
    await refresh("manual");
  }, [refresh]);

  const createScan = useCallback(
    async (payload: {
      epc: string;
      tid?: string | null;
      readerId?: string;
      mode?: "handheld" | "antenna";
      gateId?: string;
      direction?: "entry" | "exit";
      plate?: string | null;
    }) => {
      await createScanViaApi(payload);
      await refresh("manual");
    },
    [refresh],
  );

  const refreshSurface = useCallback(async () => {
    await refresh("manual");
  }, [refresh]);

  const syncLatest = useCallback(async () => {
    setRefreshing(true);
    try {
      const nextState = await syncLatestViaApi(surface, gateId);
      setState({
        events: nextState.events,
        counters: nextState.counters,
        generatedAt: nextState.generatedAt,
      });
      setError(null);
      setLoading(false);
      return nextState.synced;
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : "Failed to fetch latest registrations";
      setError(message);
      throw syncError;
    } finally {
      setRefreshing(false);
    }
  }, [gateId, surface]);

  return {
    events: state.events,
    counters: state.counters,
    generatedAt: state.generatedAt,
    loading,
    refreshing,
    error,
    actions,
    liveStatus,
    liveTransport,
    lastLiveMessage,
    refresh: refreshSurface,
    refreshSurface,
    syncLatest,
    resolveEvent,
    createScan,
  };
}
