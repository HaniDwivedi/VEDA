// Issue role-specific device tokens and persist their pairing/routing state.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { redisClient, storePairingResult } = require("./qrgenerator");

const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

if (!accessTokenSecret || accessTokenSecret.length < 32 ||
    !refreshTokenSecret || refreshTokenSecret.length < 32) {
  throw new Error("ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must each be at least 32 characters.");
}

const tokenHash = (token) => crypto.createHash("sha256").update(token).digest("hex");

const issueTokens = (pairingId, deviceId, deviceRole, clientId = "primary") => {
  const identity = { pairingId, deviceId, deviceRole, clientId };
  const accessToken = jwt.sign(
    { ...identity, tokenType: "access", jti: crypto.randomUUID() },
    accessTokenSecret,
    { expiresIn: "15m" }
  );
  const refreshToken = jwt.sign(
    { ...identity, tokenType: "refresh", jti: crypto.randomUUID() },
    refreshTokenSecret,
    { expiresIn: "7d" }
  );
  return { accessToken, refreshToken, refreshTokenHash: tokenHash(refreshToken) };
};

const establishDeviceConnection = async (desktopMeta, mobileMeta, pollTokenHash) => {
  const pairingId = crypto.randomUUID();
  const desktopDeviceId = desktopMeta.deviceId || crypto.randomUUID();
  const mobileDeviceId = mobileMeta.deviceId || crypto.randomUUID();
  const desktopTokens = issueTokens(pairingId, desktopDeviceId, "desktop");
  const desktopAgentTokens = issueTokens(pairingId, desktopDeviceId, "desktop", "agent");
  const mobileTokens = issueTokens(pairingId, mobileDeviceId, "mobile");
  const connection = {
    pairingId,
    desktopDeviceId,
    mobileDeviceId,
    desktopDeviceName: desktopMeta.deviceName || "Desktop",
    mobileDeviceName: mobileMeta.deviceName || "Mobile",
    pairedAt: new Date().toISOString(),
    refreshTokenHashes: {
      desktop: {
        primary: desktopTokens.refreshTokenHash,
        agent: desktopAgentTokens.refreshTokenHash
      },
      mobile: { primary: mobileTokens.refreshTokenHash }
    }
  };

  await redisClient.set(
    `connection:pairing:${pairingId}`,
    JSON.stringify(connection),
    { EX: SESSION_TTL_SECONDS }
  );
  await storePairingResult(pollTokenHash, {
    tokens: {
      accessToken: desktopTokens.accessToken,
      refreshToken: desktopTokens.refreshToken
    },
    agentTokens: {
      accessToken: desktopAgentTokens.accessToken,
      refreshToken: desktopAgentTokens.refreshToken
    },
    deviceId: desktopDeviceId,
    pairingId
  });

  return {
    tokens: {
      accessToken: mobileTokens.accessToken,
      refreshToken: mobileTokens.refreshToken
    },
    deviceId: mobileDeviceId,
    pairingId
  };
};

module.exports = { establishDeviceConnection, issueTokens, tokenHash };
