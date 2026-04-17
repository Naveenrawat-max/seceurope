import { createServer } from "node:http";

import next from "next";
import { WebSocketServer } from "ws";
import { broadcastLiveMessage, registerLiveSocket } from "./lib/live-updates.mjs";

const args = new Set(process.argv.slice(2));
const dev = args.has("--dev") || !args.has("--prod");
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();
const wss = new WebSocketServer({ noServer: true });

let lastSignature = "";
let watcherTimer = null;
let heartbeatTimer = null;
let watcherInFlight = false;

function signatureForPayload(payload) {
  const safeEvents = Array.isArray(payload?.events)
    ? payload.events.slice(0, 60).map((event) => ({
        eventKey: event?.eventKey ?? "",
        ts: event?.ts ?? "",
        status: event?.status ?? "",
        outcome: event?.outcome ?? "",
        resolvedAt: event?.resolvedAt ?? "",
        resolvedBy: event?.resolvedBy ?? "",
        epc: event?.epc ?? "",
      }))
    : [];

  return JSON.stringify({
    counters: payload?.counters ?? {},
    events: safeEvents,
  });
}

async function pollForChanges(baseUrl) {
  if (watcherInFlight) {
    return;
  }

  watcherInFlight = true;
  try {
    const response = await fetch(`${baseUrl}/api/events?surface=manager`, {
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const nextSignature = signatureForPayload(payload);
    if (!lastSignature) {
      lastSignature = nextSignature;
      return;
    }

    if (nextSignature !== lastSignature) {
      lastSignature = nextSignature;
      broadcastLiveMessage({
        type: "events-changed",
        source: "watcher",
        message: "A new ABIOT update was detected.",
      });
    }
  } catch {
    // keep websocket channel alive even if one poll fails
  } finally {
    watcherInFlight = false;
  }
}

function startWatcher(baseUrl) {
  if (watcherTimer) {
    return;
  }

  void pollForChanges(baseUrl);
  watcherTimer = setInterval(() => {
    void pollForChanges(baseUrl);
  }, 2500);
}

function startHeartbeat() {
  if (heartbeatTimer) {
    return;
  }

  heartbeatTimer = setInterval(() => {
    for (const socket of wss.clients) {
      if (socket.isAlive === false) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, 20000);
}

app.prepare().then(() => {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
    const query = {};
    for (const [key, value] of requestUrl.searchParams) {
      if (query[key] !== undefined) {
        if (Array.isArray(query[key])) {
          query[key].push(value);
        } else {
          query[key] = [query[key], value];
        }
      } else {
        query[key] = value;
      }
    }
    handle(request, response, { pathname: requestUrl.pathname, query });
  });

  wss.on("connection", (socket) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });
    registerLiveSocket(socket);
  });

  server.on("upgrade", (request, socket, head) => {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || `127.0.0.1:${port}`}`);
    if (requestUrl.pathname !== "/ws") {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  server.listen(port, host, () => {
    const baseUrl = `http://127.0.0.1:${port}`;
    startWatcher(baseUrl);
    startHeartbeat();
    console.log(`Seceurope web listening on http://${host}:${port} (${dev ? "dev" : "prod"})`);
  });
});
