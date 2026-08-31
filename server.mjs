import * as dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { createServer } from "node:http";

import next from "next";
import { createClient } from "@supabase/supabase-js";
import { WebSocketServer } from "ws";
import { broadcastLiveMessage, registerLiveSocket } from "./lib/live-updates.mjs";

const args = new Set(process.argv.slice(2));
const dev = args.has("--dev") || !args.has("--prod");
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();
const wss = new WebSocketServer({ noServer: true });

let heartbeatTimer = null;

function startKeepAlives() {
  let publicAppUrl = process.env.PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || "https://seceurope.onrender.com";
  if (publicAppUrl.endsWith("/")) publicAppUrl = publicAppUrl.slice(0, -1);


  // Database keep-alive (every 4 days)
  const baseUrl = `http://127.0.0.1:${process.env.PORT || 3000}`;

  function dbKeepAlive() {
    console.log(`[Keep-Alive] Sending keep-alive scan event to internal API.`);
    fetch(`${baseUrl}/api/scans`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        epc: "E28011606000021180UN002",
        mode: "handheld",
        readerId: "CW-C72-01",
        gateId: "gate-main-entry",
        direction: "entry"
      }),
    }).then(res => {
      console.log(`[Keep-Alive] DB keep-alive ok: ${res.ok}`);
    }).catch(err => {
      console.error(`[Keep-Alive] DB keep-alive failed: `, err.message);
    });
  }

  // Run immediately once
  dbKeepAlive();

  // And then every 4 days
  setInterval(dbKeepAlive, 4 * 24 * 60 * 60 * 1000);

  // Render keep-alive (every 4 minutes)
  console.log(`[Keep-Alive] Starting Render web service keep-alive ping to ${publicAppUrl} every 4 minutes.`);
  setInterval(() => {
    fetch(`${publicAppUrl}/`, {
      method: "GET",
      headers: { "user-agent": "render-keep-alive" },
    }).then(res => {
      console.log(`[Keep-Alive] Render ping ok: ${res.ok}`);
    }).catch(err => {
      console.error(`[Keep-Alive] Render ping failed: `, err.message);
    });
  }, 4 * 60 * 1000);
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
    startKeepAlives();
    startHeartbeat();
    console.log(`Seceurope web listening on http://${host}:${port} (${dev ? "dev" : "prod"})`);
  });
});
