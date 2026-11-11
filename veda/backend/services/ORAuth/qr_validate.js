// Consume one-time desktop QR challenges and complete device pairing.
const { establishDeviceConnection } = require("./qr_token_manager");
const { redisClient, sha256 } = require("./qrgenerator");

const validateAndProcessMobileScan = async (rawScannedData, mobileClientInfo = {}) => {
  if (typeof rawScannedData !== "string" || !rawScannedData.trim()) {
    return { valid: false, message: "No scan data provided." };
  }
  if (!mobileClientInfo.deviceId || !mobileClientInfo.deviceName) {
    return { valid: false, message: "Mobile device ID and name are required." };
  }

  const sessionJson = await redisClient.getDel(
    `pairing:qr:${sha256(rawScannedData.trim())}`
  );
  if (!sessionJson) {
    return {
      valid: false,
      message: "Invalid or expired QR code. Refresh the desktop pairing page."
    };
  }

  const session = JSON.parse(sessionJson);
  const paired = await establishDeviceConnection(
    session.desktopMeta,
    mobileClientInfo,
    session.pollTokenHash
  );

  return {
    valid: true,
    message: "Device successfully paired.",
    tokens: paired.tokens,
    deviceId: paired.deviceId,
    pairingId: paired.pairingId
  };
};

module.exports = { validateAndProcessMobileScan };
