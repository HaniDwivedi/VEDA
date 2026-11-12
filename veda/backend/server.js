// HTTP API for QR pairing, token renewal, RTC configuration, and Socket.IO.
require("dotenv").config();

const crypto = require("crypto");
const cors = require("cors");
const express = require("express");
const http = require("http");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const { ipKeyGenerator, rateLimit } = require("express-rate-limit");
const { createAdapter } = require("@socket.io/redis-adapter");
const { Server } = require("socket.io");
const {
  connectRedis,
  consumePairingResult,
  createPairingQr,
  redisClient
} = require("./services/ORAuth/qrgenerator");
const { validateAndProcessMobileScan } = require("./services/ORAuth/qr_validate");
const { refreshDeviceTokens } = require("./services/tokenmanager/refreshtoken");
const { setupStreamEngine } = require("./services/stream/stream_engine");

const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
if (!accessTokenSecret || accessTokenSecret.length < 32) {
  throw new Error("ACCESS_TOKEN_SECRET must be set to a random value of at least 32 characters.");
}
if (!process.env.REFRESH_TOKEN_SECRET || process.env.REFRESH_TOKEN_SECRET.length < 32) {
  throw new Error("REFRESH_TOKEN_SECRET must be set to a separate random value of at least 32 characters.");
}

const turnUrls = (process.env.TURN_URLS || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const turnSharedSecret = process.env.TURN_SHARED_SECRET;
if (Boolean(turnUrls.length) !== Boolean(turnSharedSecret)) {
  throw new Error("Set both TURN_URLS and TURN_SHARED_SECRET, or leave both unset.");
}

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "https://localhost",
  "capacitor://localhost",
  ...(process.env.CLIENT_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
]);
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin is not allowed by CLIENT_ORIGINS."));
  }
};

const app = express();
if (process.env.TRUST_PROXY) {
  const proxyConfig = process.env.TRUST_PROXY.trim();
  app.set(
    "trust proxy",
    /^\d+$/.test(proxyConfig)
      ? Number(proxyConfig)
      : proxyConfig.split(",").map((value) => value.trim())
  );
}
const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
  pingInterval: 20000,
  pingTimeout: 20000,
  maxHttpBufferSize: 256 * 1024
});

app.use(cors(corsOptions));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "32kb" }));

const createRateLimiter = (limit, message, keyGenerator) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: message },
  ...(keyGenerator ? { keyGenerator } : {})
});

app.get("/healthz", (_request, response) => {
  const ready = redisClient.isReady;
  response.status(ready ? 200 : 503).json({ status: ready ? "ok" : "not_ready" });
});

app.use("/api/pairing/qr", createRateLimiter(10, "Too many pairing requests. Try again later."));
app.post("/api/pairing/qr", async (request, response, next) => {
  try {
    const { deviceId, deviceName } = request.body || {};
    if (typeof deviceId !== "string" || !deviceId.trim() ||
        typeof deviceName !== "string" || !deviceName.trim()) {
      response.status(400).json({ error: "Desktop device ID and name are required." });
      return;
    }
    response.status(201).json(await createPairingQr({
      deviceId: deviceId.trim(),
      deviceName: deviceName.trim()
    }));
  } catch (error) {
    next(error);
  }
});

app.use("/api/pairing/scan", createRateLimiter(20, "Too many pairing attempts. Try again later."));
app.post("/api/pairing/scan", async (request, response, next) => {
  try {
    const clientInfo = request.body && request.body.clientInfo;
    if (!clientInfo || typeof clientInfo !== "object" || Array.isArray(clientInfo)) {
      response.status(400).json({ error: "Mobile client information is required." });
      return;
    }
    const result = await validateAndProcessMobileScan(
      request.body && request.body.rawScanData,
      clientInfo
    );
    if (!result.valid) {
      response.status(401).json({ error: result.message });
      return;
    }
    response.json(result);
  } catch (error) {
    next(error);
  }
});

app.use("/api/pairing/status", createRateLimiter(
  400,
  "Too many pairing status requests.",
  (request) => {
    const authorization = request.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(\S+)$/i);
    if (!match) return `ip:${ipKeyGenerator(request.ip)}`;
    return `pairing:${crypto.createHash("sha256").update(match[1]).digest("hex")}`;
  }
));
app.get("/api/pairing/status", async (request, response, next) => {
  try {
    const authorization = request.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(\S+)$/i);
    if (!match) {
      response.status(401).json({ error: "Pairing token required." });
      return;
    }
    const result = await consumePairingResult(match[1]);
    if (!result) {
      response.status(204).end();
      return;
    }
    response.set("Cache-Control", "no-store").json(result);
  } catch (error) {
    next(error);
  }
});

app.use("/api/tokens/refresh", createRateLimiter(30, "Too many token refresh requests."));
app.post("/api/tokens/refresh", async (request, response, next) => {
  try {
    const refreshToken = request.body && request.body.refreshToken;
    if (typeof refreshToken !== "string" || !refreshToken) {
      response.status(400).json({ error: "Refresh token required." });
      return;
    }
    response.set("Cache-Control", "no-store").json(
      await refreshDeviceTokens(refreshToken)
    );
  } catch (error) {
    if (error.statusCode === 401) {
      response.status(401).json({ error: error.message });
      return;
    }
    next(error);
  }
});

app.get("/api/rtc-config", (request, response) => {
  const authorization = request.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    response.status(401).json({ error: "Access token required." });
    return;
  }

  let claims;
  try {
    claims = jwt.verify(match[1], accessTokenSecret);
  } catch (_error) {
    response.status(401).json({ error: "Invalid or expired access token." });
    return;
  }
  if (!claims || claims.tokenType !== "access" ||
      !claims.pairingId || !claims.deviceId ||
      !["desktop", "mobile"].includes(claims.deviceRole)) {
    response.status(401).json({ error: "Token is not associated with a paired device." });
    return;
  }

  const iceServers = [
    { urls: process.env.STUN_URL || "stun:stun.l.google.com:19302" }
  ];
  if (turnUrls.length) {
    const username = `${Math.floor(Date.now() / 1000) + 3600}:${claims.pairingId}`;
    const credential = crypto
      .createHmac("sha1", turnSharedSecret)
      .update(username)
      .digest("base64");
    iceServers.push({ urls: turnUrls, username, credential });
  }

  response.set("Cache-Control", "no-store").json({ iceServers });
});

app.use((error, _request, response, _next) => {
  console.error("Request failed:", error.message);
  response.status(500).json({ error: "The request could not be completed." });
});

setupStreamEngine(io, accessTokenSecret);

const start = async () => {
  await connectRedis();
  const publisher = redisClient.duplicate();
  const subscriber = redisClient.duplicate();
  await Promise.all([publisher.connect(), subscriber.connect()]);
  io.adapter(createAdapter(publisher, subscriber));
  const port = Number(process.env.PORT || 5000);
  await new Promise((resolve) => server.listen(port, "0.0.0.0", resolve));
  console.log(`VEDA signaling server listening on port ${port}`);
  if (!turnUrls.length) {
    console.warn("TURN is not configured; some networks may not establish WebRTC media connections.");
  }
};

if (require.main === module) {
  start().catch((error) => {
    console.error("VEDA backend could not start:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, io, server, start };
