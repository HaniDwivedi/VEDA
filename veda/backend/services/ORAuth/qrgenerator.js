// Create expiring one-time QR challenges and provide the shared Redis client.
const crypto = require("crypto");
const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379"
});

redisClient.on("error", (error) => {
  console.error("Redis client error:", error.message);
});

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
};

const createPairingQr = async (desktopMeta) => {
  const qrValue = crypto.randomBytes(32).toString("base64url");
  const pairingToken = crypto.randomBytes(32).toString("base64url");
  const pollTokenHash = sha256(pairingToken);
  const qrKey = `pairing:qr:${sha256(qrValue)}`;
  const expiresAt = Date.now() + 15 * 60 * 1000;

  await redisClient.set(
    qrKey,
    JSON.stringify({ desktopMeta, pollTokenHash, expiresAt }),
    { EX: 900, NX: true }
  );

  return { qrValue, pairingToken, expiresAt };
};

const storePairingResult = async (pollTokenHash, result) => {
  await redisClient.set(
    `pairing:result:${pollTokenHash}`,
    JSON.stringify(result),
    { EX: 600 }
  );
};

const consumePairingResult = async (pairingToken) => {
  const result = await redisClient.getDel(`pairing:result:${sha256(pairingToken)}`);
  return result ? JSON.parse(result) : null;
};

module.exports = {
  connectRedis,
  consumePairingResult,
  createPairingQr,
  redisClient,
  sha256,
  storePairingResult
};
