// Verify and rotate a paired device's refresh token from Redis-backed state.
const jwt = require("jsonwebtoken");
const { redisClient } = require("../ORAuth/qrgenerator");
const { issueTokens, tokenHash } = require("../ORAuth/qr_token_manager");

const invalidToken = (message) => Object.assign(new Error(message), { statusCode: 401 });
const ROTATE_REFRESH_TOKEN_SCRIPT = `
  local encoded = redis.call("GET", KEYS[1])
  if not encoded then
    return 0
  end
  local connection = cjson.decode(encoded)
  local clients = connection.refreshTokenHashes[ARGV[1]]
  local stored
  if type(clients) == "table" then
    stored = clients[ARGV[2]]
  elseif ARGV[2] == "primary" then
    stored = clients
  end
  if stored ~= ARGV[3] then
    return 0
  end
  if type(clients) ~= "table" then
    clients = { primary = clients }
    connection.refreshTokenHashes[ARGV[1]] = clients
  end
  clients[ARGV[2]] = ARGV[4]
  redis.call("SET", KEYS[1], cjson.encode(connection), "KEEPTTL")
  return 1
`;

const refreshDeviceTokens = async (refreshToken) => {
  let claims;
  try {
    claims = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  } catch (_error) {
    throw invalidToken("Refresh token is invalid or expired.");
  }
  if (!claims || claims.tokenType !== "refresh" ||
      !claims.pairingId || !claims.deviceId ||
      !["desktop", "mobile"].includes(claims.deviceRole)) {
    throw invalidToken("Invalid refresh token.");
  }

  const key = `connection:pairing:${claims.pairingId}`;
  const nextTokens = issueTokens(
    claims.pairingId,
    claims.deviceId,
    claims.deviceRole,
    claims.clientId || "primary"
  );
  const rotated = await redisClient.eval(ROTATE_REFRESH_TOKEN_SCRIPT, {
    keys: [key],
    arguments: [
      claims.deviceRole,
      claims.clientId || "primary",
      tokenHash(refreshToken),
      nextTokens.refreshTokenHash
    ]
  });
  if (rotated !== 1) {
    throw invalidToken("Refresh token has already been rotated or the paired session expired.");
  }

  return {
    accessToken: nextTokens.accessToken,
    refreshToken: nextTokens.refreshToken
  };
};

module.exports = { refreshDeviceTokens };
