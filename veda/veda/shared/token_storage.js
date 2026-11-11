// Keep native mobile authentication values in the OS-backed secure store.
import { Capacitor } from "@capacitor/core";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";

const isNative = Capacitor.isNativePlatform();
const tokenKeys = ["gat", "gft", "veda-pairing-id"];
const nativeValues = new Map();
let initialization;
let initialized = !isNative;

export const initializeTokenStorage = () => {
  if (!isNative) return Promise.resolve();
  if (initialization) return initialization;

  initialization = (async () => {
    await SecureStorage.setKeyPrefix("veda_");
    for (const key of tokenKeys) {
      const secureValue = await SecureStorage.get(key);
      if (typeof secureValue === "string") {
        nativeValues.set(key, secureValue);
      } else {
        const legacyValue = localStorage.getItem(key);
        if (legacyValue) {
          await SecureStorage.set(key, legacyValue);
          nativeValues.set(key, legacyValue);
        }
      }
      localStorage.removeItem(key);
    }
    initialized = true;
  })();
  return initialization;
};

export const getStoredToken = (key) => {
  if (!initialized) throw new Error("Secure token storage has not been initialized.");
  return isNative ? nativeValues.get(key) || null : localStorage.getItem(key);
};

export const setStoredToken = async (key, value) => {
  if (!initialized) await initializeTokenStorage();
  if (isNative) {
    await SecureStorage.set(key, value);
    nativeValues.set(key, value);
    return;
  }
  localStorage.setItem(key, value);
};

export const removeStoredToken = async (key) => {
  if (!initialized) await initializeTokenStorage();
  if (isNative) {
    await SecureStorage.remove(key);
    nativeValues.delete(key);
    return;
  }
  localStorage.removeItem(key);
};

export const storeTokens = async ({ accessToken, refreshToken, pairingId }) => {
  await Promise.all([
    setStoredToken("gat", accessToken),
    setStoredToken("gft", refreshToken),
    ...(pairingId ? [setStoredToken("veda-pairing-id", pairingId)] : [])
  ]);
};

export const clearTokens = async () => {
  await Promise.all(tokenKeys.map(removeStoredToken));
};
