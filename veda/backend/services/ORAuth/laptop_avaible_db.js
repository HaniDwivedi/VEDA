// const crypto = require('crypto');

// // Active Laptop & Verified Session Registry Map
// const activeLaptopsMap = new Map();
// const verifiedDeviceSessions = new Map(); // Store hashed device IDs and sessions securely

// /**
//  * Custom encryption/hashing formula to generate a unique Device ID from mobile payload
//  */
// const generateCustomDeviceHash = (deviceDetails, location, timestamp) => {
//   const rawString = `${deviceDetails}_${location}_${timestamp}_VEDA_SECURE_SALT`;
//   return crypto
//     .createHmac('sha256', 'veda-secret-encryption-key')
//     .update(rawString)
//     .digest('hex');
// };

// /**
//  * Validate incoming mobile string/payload and register both laptop and generated secure ID
//  */
// const processAndRegisterIncomingSession = (mobilePayload, socketId) => {
//   try {
//     // 1. Validate if incoming mobile payload has required data
//     if (!mobilePayload || !mobilePayload.deviceDetails || !mobilePayload.timestamp) {
//       return { success: false, message: "Invalid or incomplete string payload received from mobile." };
//     }

//     const { deviceDetails, location, timestamp } = mobilePayload;

//     // 2. Generate unique secure device ID/hash using custom formula
//     const secureDeviceHash = generateCustomDeviceHash(deviceDetails, location, timestamp);

//     // 3. Store the verified secure session in DB/Map
//     verifiedDeviceSessions.set(secureDeviceHash, {
//       deviceDetails,
//       location,
//       timestamp,
//       verifiedAt: Date.now()
//     });

//     // 4. Register or update the connecting laptop in the active registry
//     activeLaptopsMap.set(secureDeviceHash, {
//       socketId: socketId || "PENDING_SOCKET",
//       deviceHash: secureDeviceHash,
//       metadata: { deviceDetails, location },
//       lastActive: Date.now()
//     });

//     console.log(`🔒 [Security & Registry] Secure Device ID generated & registered: ${secureDeviceHash.substring(0, 16)}...`);

//     return {
//       success: true,
//       secureDeviceId: secureDeviceHash,
//       message: "Payload validated, secure device ID created, and laptop registered successfully."
//     };

//   } catch (error) {
//     console.error("❌ Error in processAndRegisterIncomingSession:", error.message);
//     return { success: false, error: error.message };
//   }
// };

// /**
//  * Register or update laptop availability directly via Device ID
//  */
// const registerLaptopDevice = (secureDeviceHash, socketId, metadata) => {
//   if (activeLaptopsMap.has(secureDeviceHash)) {
//     const existing = activeLaptopsMap.get(secureDeviceHash);
//     existing.socketId = socketId;
//     existing.lastActive = Date.now();
//     if (metadata) existing.metadata = metadata;
//   } else {
//     activeLaptopsMap.set(secureDeviceHash, {
//       socketId: socketId,
//       deviceHash: secureDeviceHash,
//       metadata: metadata || {},
//       lastActive: Date.now()
//     });
//   }
//   console.log(`💻 [Laptop Registry] Laptop connection updated for Hash: ${secureDeviceHash.substring(0, 10)}...`);
// };

// /**
//  * Heartbeat: Remove stale connections & unverified sessions after 15 minutes of inactivity
//  */
// setInterval(() => {
//   const now = Date.now();
//   const FIFTEEN_MINUTES = 15 * 60 * 1000;

//   for (let [hashKey, info] of activeLaptopsMap.entries()) {
//     if (now - info.lastActive > FIFTEEN_MINUTES) {
//       activeLaptopsMap.delete(hashKey);
//       verifiedDeviceSessions.delete(hashKey);
//       console.log(`🔌 [Cleanup] Stale laptop & session removed due to 15 mins inactivity: ${hashKey.substring(0, 10)}...`);
//     }
//   }
// }, 60 * 1000); // Check every minute

// const getLaptopByDeviceHash = (secureDeviceHash) => {
//   return activeLaptopsMap.get(secureDeviceHash) || null;
// };

// const removeLaptopDevice = (socketId) => {
//   for (let [hashKey, info] of activeLaptopsMap.entries()) {
//     if (info.socketId === socketId) {
//       activeLaptopsMap.delete(hashKey);
//       verifiedDeviceSessions.delete(hashKey);
//       console.log(`❌ [Laptop Registry] Disconnected socket cleaned up for hash: ${hashKey.substring(0, 10)}...`);
//       break;
//     }
//   }
// };

// module.exports = {
//   processAndRegisterIncomingSession,
//   registerLaptopDevice,
//   getLaptopByDeviceHash,
//   removeLaptopDevice,
//   activeLaptopsMap,
//   verifiedDeviceSessions
// };
// const crypto = require('crypto');
// const jwt = require('jsonwebtoken'); // Tokens generate karne ke liye

// const activeLaptopsMap = new Map();
// const verifiedDeviceSessions = new Map();

// // Custom encryption formula se secure device hash banane ka function
// const generateCustomDeviceHash = (deviceDetails, location, timestamp) => {
//   const rawString = `${deviceDetails}_${location}_${timestamp}_VEDA_SECURE_SALT`;
//   return crypto
//     .createHmac('sha256', 'veda-secret-encryption-key')
//     .update(rawString)
//     .digest('hex');
// };

// /**
//  * Mobile payload validate karega, secure device ID banayega,
//  * aur sath hi Access & Refresh tokens return karega.
//  */
// const processAndRegisterIncomingSession = (mobilePayload, socketId) => {
//   try {
//     if (!mobilePayload || !mobilePayload.deviceDetails || !mobilePayload.timestamp) {
//       return { success: false, message: "Invalid or incomplete payload received." };
//     }

//     const { deviceDetails, location, timestamp } = mobilePayload;

//     // 1. Secure Device ID generate karna
//     const secureDeviceHash = generateCustomDeviceHash(deviceDetails, location, timestamp);

//     // 2. Tokens generate karna (Access Token 15 mins, Refresh Token 7 days)
//     const accessToken = jwt.sign(
//       { secureDeviceId: secureDeviceHash, location }, 
//       'veda-jwt-access-secret', 
//       { expiresIn: '15m' }
//     );

//     const refreshToken = jwt.sign(
//       { secureDeviceId: secureDeviceHash }, 
//       'veda-jwt-refresh-secret', 
//       { expiresIn: '7d' }
//     );

//     // 3. Database / Memory Map me store karna
//     verifiedDeviceSessions.set(secureDeviceHash, {
//       deviceDetails,
//       location,
//       timestamp,
//       accessToken,
//       refreshToken,
//       verifiedAt: Date.now()
//     });

//     // 4. Active Laptop Registry me register karna
//     activeLaptopsMap.set(secureDeviceHash, {
//       socketId: socketId || "PENDING_SOCKET",
//       deviceHash: secureDeviceHash,
//       metadata: { deviceDetails, location },
//       lastActive: Date.now()
//     });

//     console.log(`🔒 [Auth & Registry] Secure Device ID created & tokens issued for: ${secureDeviceHash.substring(0, 12)}...`);

//     return {
//       success: true,
//       secureDeviceId: secureDeviceHash,
//       tokens: {
//         accessToken,
//         refreshToken
//       },
//       message: "Device registered and authentication tokens generated successfully."
//     };

//   } catch (error) {
//     console.error("❌ Error in session registration:", error.message);
//     return { success: false, error: error.message };
//   }
// };

// const getLaptopByDeviceHash = (secureDeviceHash) => {
//   activeLaptopsMap.forEach((val, key) => {
//     if (key === secureDeviceHash) {
//       val.lastActive = Date.now(); // Activity update
//     }
//   });
//   return activeLaptopsMap.get(secureDeviceHash) || null;
// };

// module.exports = {
//   processAndRegisterIncomingSession,
//   getLaptopByDeviceHash,
//   activeLaptopsMap,
//   verifiedDeviceSessions
// };
// // aur   un device ko id de di hian tumne aur dene ke baad unke local storage me unke tokens  bhi dena so that they can store it ..   and jab bhi aapap me baat kare to backend ko pata rhe kis packet ko kahah bhejna ahin .. 