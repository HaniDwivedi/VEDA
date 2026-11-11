// Exercise QR pairing, role-specific tokens, refresh rotation, and room routing.
const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const jwt = require("jsonwebtoken");
const { io: connectSocket } = require("socket.io-client");

process.env.ACCESS_TOKEN_SECRET = "test-access-secret-at-least-thirty-two-characters";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret-at-least-thirty-two-characters";

const { io, server } = require("../server");
const { redisClient } = require("../services/ORAuth/qrgenerator");
const store = new Map();
const originalRedisMethods = {
  get: redisClient.get,
  getDel: redisClient.getDel,
  eval: redisClient.eval,
  set: redisClient.set
};
const sockets = [];

redisClient.set = async (key, value, options = {}) => {
  if (options.NX && store.has(key)) return null;
  store.set(key, value);
  return "OK";
};
redisClient.get = async (key) => store.get(key) || null;
redisClient.getDel = async (key) => {
  const value = store.get(key) || null;
  store.delete(key);
  return value;
};
redisClient.eval = async (_script, { keys, arguments: args }) => {
  const [key] = keys;
  const [role, clientId, oldHash, newHash] = args;
  const encoded = store.get(key);
  if (!encoded) return 0;
  const connection = JSON.parse(encoded);
  const clients = connection.refreshTokenHashes[role];
  if (!clients || clients[clientId] !== oldHash) return 0;
  clients[clientId] = newHash;
  store.set(key, JSON.stringify(connection));
  return 1;
};

let serverUrl;

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  serverUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  for (const socket of sockets) socket.disconnect();
  await new Promise((resolve) => io.close(resolve));
  redisClient.get = originalRedisMethods.get;
  redisClient.getDel = originalRedisMethods.getDel;
  redisClient.eval = originalRedisMethods.eval;
  redisClient.set = originalRedisMethods.set;
});

const waitForEvent = (socket, eventName) => {
  if (eventName === "connect" && socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${eventName}`)), 3000);
    socket.once(eventName, (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
};

test("pairs devices, rotates tokens, and routes packets to the opposite role", async () => {
  const qrResponse = await fetch(`${serverUrl}/api/pairing/qr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId: "desktop-123", deviceName: "Desktop" })
  });
  assert.equal(qrResponse.status, 201);
  const qr = await qrResponse.json();
  assert.ok(qr.qrValue);
  assert.ok(qr.pairingToken);

  const scanResponse = await fetch(`${serverUrl}/api/pairing/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rawScanData: qr.qrValue,
      clientInfo: { deviceId: "mobile-456", deviceName: "Phone" }
    })
  });
  assert.equal(scanResponse.status, 200);
  const mobile = await scanResponse.json();
  assert.equal(jwt.decode(mobile.tokens.accessToken).deviceRole, "mobile");
  assert.equal(jwt.decode(mobile.tokens.accessToken).deviceId, "mobile-456");

  const replayResponse = await fetch(`${serverUrl}/api/pairing/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rawScanData: qr.qrValue,
      clientInfo: { deviceId: "other-mobile", deviceName: "Other phone" }
    })
  });
  assert.equal(replayResponse.status, 401);

  const desktopResponse = await fetch(`${serverUrl}/api/pairing/status`, {
    headers: { Authorization: `Bearer ${qr.pairingToken}` }
  });
  assert.equal(desktopResponse.status, 200);
  const desktop = await desktopResponse.json();
  assert.ok(desktop.agentTokens.accessToken);
  assert.equal(jwt.decode(desktop.agentTokens.accessToken).clientId, "agent");
  assert.equal(jwt.decode(desktop.tokens.accessToken).deviceRole, "desktop");
  assert.equal(jwt.decode(desktop.tokens.accessToken).deviceId, "desktop-123");
  assert.equal(jwt.decode(desktop.tokens.accessToken).pairingId, mobile.pairingId);

  const secondPoll = await fetch(`${serverUrl}/api/pairing/status`, {
    headers: { Authorization: `Bearer ${qr.pairingToken}` }
  });
  assert.equal(secondPoll.status, 204);

  const rtcResponse = await fetch(`${serverUrl}/api/rtc-config`, {
    headers: { Authorization: `Bearer ${mobile.tokens.accessToken}` }
  });
  assert.equal(rtcResponse.status, 200);

  const refreshRequest = (refreshToken) => fetch(`${serverUrl}/api/tokens/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });
  const refreshResponses = await Promise.all([
    refreshRequest(mobile.tokens.refreshToken),
    refreshRequest(mobile.tokens.refreshToken)
  ]);
  assert.deepEqual(refreshResponses.map((response) => response.status).sort(), [200, 401]);
  const refreshResponse = refreshResponses.find((response) => response.ok);
  const refreshed = await refreshResponse.json();
  assert.notEqual(refreshed.refreshToken, mobile.tokens.refreshToken);

  const agentRefreshResponses = await Promise.all([
    refreshRequest(desktop.agentTokens.refreshToken),
    refreshRequest(desktop.agentTokens.refreshToken)
  ]);
  assert.deepEqual(agentRefreshResponses.map((response) => response.status).sort(), [200, 401]);
  const agentRefresh = await agentRefreshResponses.find((response) => response.ok).json();

  const desktopSocket = connectSocket(serverUrl, {
    auth: { token: desktop.tokens.accessToken },
    transports: ["websocket"]
  });
  const agentSocket = connectSocket(serverUrl, {
    auth: { token: agentRefresh.accessToken, clientType: "desktop-agent" },
    transports: ["websocket"]
  });
  const mobileSocket = connectSocket(serverUrl, {
    auth: { token: refreshed.accessToken },
    transports: ["websocket"]
  });
  const secondMobileSocket = connectSocket(serverUrl, {
    auth: { token: refreshed.accessToken },
    transports: ["websocket"]
  });
  sockets.push(desktopSocket, agentSocket, mobileSocket, secondMobileSocket);
  await Promise.all([
    waitForEvent(desktopSocket, "connect"),
    waitForEvent(agentSocket, "connect"),
    waitForEvent(mobileSocket, "connect"),
    waitForEvent(secondMobileSocket, "connect")
  ]);

  const desktopReady = waitForEvent(desktopSocket, "webrtc_peer_ready");
  const mobileReady = waitForEvent(mobileSocket, "webrtc_peer_ready");
  mobileSocket.emit("webrtc_ready");
  await Promise.all([desktopReady, mobileReady]);

  const activeVoiceState = waitForEvent(agentSocket, "voice_stream_state");
  desktopSocket.emit("voice_stream_state", { active: true });
  assert.deepEqual(await activeVoiceState, { active: true });

  const lateAgentSocket = connectSocket(serverUrl, {
    auth: { token: agentRefresh.accessToken, clientType: "desktop-agent" },
    transports: ["websocket"]
  });
  sockets.push(lateAgentSocket);
  const lateAgentVoiceState = waitForEvent(lateAgentSocket, "voice_stream_state");
  await waitForEvent(lateAgentSocket, "connect");
  assert.deepEqual(await lateAgentVoiceState, { active: true });

  const inactiveVoiceState = waitForEvent(agentSocket, "voice_stream_state");
  desktopSocket.emit("voice_stream_state", { active: false });
  assert.deepEqual(await inactiveVoiceState, { active: false });

  const routedSignal = waitForEvent(desktopSocket, "webrtc_signal");
  let sameRoleReceivedSignal = false;
  secondMobileSocket.once("webrtc_signal", () => { sameRoleReceivedSignal = true; });
  mobileSocket.emit("webrtc_signal", { candidate: { candidate: "test-candidate" } });
  const signal = await routedSignal;
  assert.equal(signal.signal.candidate.candidate, "test-candidate");
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(sameRoleReceivedSignal, false);

  const routedMessage = waitForEvent(desktopSocket, "receive_message");
  let sameRoleReceivedMessage = false;
  secondMobileSocket.once("receive_message", () => { sameRoleReceivedMessage = true; });
  mobileSocket.emit("send_message", { text: "hello desktop" });
  const message = await routedMessage;
  assert.equal(message.text, "hello desktop");
  assert.equal(message.sender, "Mobile");
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(sameRoleReceivedMessage, false);

  const approvedCommand = waitForEvent(agentSocket, "agent_command_approval");
  const receivedCommand = waitForEvent(desktopSocket, "agent_command_received");
  mobileSocket.emit("send_agent_command", { commandText: "open notepad" });
  const command = await receivedCommand;
  desktopSocket.emit("agent_command_approval", {
    commandId: command.commandId,
    approved: true
  });
  assert.deepEqual(await approvedCommand, {
    commandId: command.commandId,
    approved: true
  });
});

test("reports Redis readiness and limits public QR creation", async () => {
  const healthResponse = await fetch(`${serverUrl}/healthz`);
  assert.equal(healthResponse.status, 503);
  assert.deepEqual(await healthResponse.json(), { status: "not_ready" });

  for (let index = 0; index < 9; index += 1) {
    const response = await fetch(`${serverUrl}/api/pairing/qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: `limited-${index}`, deviceName: "Desktop" })
    });
    assert.equal(response.status, 201);
  }
  const limitedResponse = await fetch(`${serverUrl}/api/pairing/qr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId: "limited-overflow", deviceName: "Desktop" })
  });
  assert.equal(limitedResponse.status, 429);
});
