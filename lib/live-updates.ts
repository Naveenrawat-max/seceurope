import {
  broadcastLiveMessage as broadcastLiveMessageUntyped,
  getLastLiveMessage as getLastLiveMessageUntyped,
} from "./live-updates.mjs";

export type LiveTransport = "websocket" | "polling";
export type LiveConnectionState = "connecting" | "live" | "reconnecting" | "offline";

export interface LiveUpdateMessage {
  type: "connected" | "events-changed" | "scan-created" | "event-resolved" | "conversion-updated" | "heartbeat";
  seq: number;
  ts: string;
  source?: string;
  eventKey?: string;
  epc?: string;
  message?: string;
  lastMessage?: LiveUpdateMessage | null;
}

export const broadcastLiveMessage = broadcastLiveMessageUntyped as (message: Partial<LiveUpdateMessage> & {
  type: LiveUpdateMessage["type"];
}) => LiveUpdateMessage;

export const getLastLiveMessage = getLastLiveMessageUntyped as () => LiveUpdateMessage | null;
