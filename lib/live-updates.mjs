const LIVE_STATE_KEY = "__seceurope_web_live_updates__";

function createState() {
  return {
    sockets: new Set(),
    sequence: 0,
    lastMessage: null,
  };
}

function getState() {
  const globalState = globalThis;
  if (!globalState[LIVE_STATE_KEY]) {
    globalState[LIVE_STATE_KEY] = createState();
  }
  return globalState[LIVE_STATE_KEY];
}

function createEnvelope(message) {
  const state = getState();
  state.sequence += 1;
  return {
    seq: state.sequence,
    ts: message.ts ?? new Date().toISOString(),
    ...message,
  };
}

export function broadcastLiveMessage(message) {
  const state = getState();
  const envelope = createEnvelope(message);
  state.lastMessage = envelope;

  for (const socket of state.sockets) {
    if (socket.readyState !== 1) {
      state.sockets.delete(socket);
      continue;
    }
    socket.send(JSON.stringify(envelope));
  }

  return envelope;
}

export function registerLiveSocket(socket) {
  const state = getState();
  state.sockets.add(socket);

  socket.on("close", () => {
    state.sockets.delete(socket);
  });

  socket.send(
    JSON.stringify({
      type: "connected",
      seq: state.sequence,
      ts: new Date().toISOString(),
      message: "WebSocket live sync ready",
      lastMessage: state.lastMessage,
    }),
  );
}

export function getLastLiveMessage() {
  return getState().lastMessage;
}
