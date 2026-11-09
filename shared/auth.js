// Provide the backend URL and shared HTTP/socket token renewal.
import { io } from "socket.io-client";
import {
  clearTokens,
  getStoredToken,
  setStoredToken
} from "./token_storage.js";

export const API_URL = window.VEDA_SERVER_URL ||
  localStorage.getItem("veda-server-url") ||
  import.meta.env.VITE_VEDA_SERVER_URL ||
  "http://localhost:5000";

let refreshInFlight;

const tokenExpiresSoon = (token) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp !== "number" || payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
};

export const refreshStoredTokens = () => {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = getStoredToken("gft");
  if (!refreshToken) {
    return clearTokens().then(() => null);
  }

  const rotateTokens = async () => {
    const latestRefreshToken = getStoredToken("gft");
    if (!latestRefreshToken) return null;
    if (latestRefreshToken !== refreshToken) return getStoredToken("gat");

    const response = await fetch(`${API_URL}/api/tokens/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: latestRefreshToken })
    });
    if (!response.ok) {
      await clearTokens();
      return null;
    }

    const refreshed = await response.json();
    if (!refreshed.accessToken || !refreshed.refreshToken) {
      throw new Error("Backend returned an incomplete token refresh response.");
    }
    await Promise.all([
      setStoredToken("gat", refreshed.accessToken),
      setStoredToken("gft", refreshed.refreshToken)
    ]);
    return refreshed.accessToken;
  };

  refreshInFlight = navigator.locks?.request
    ? navigator.locks.request("veda-refresh-token", rotateTokens)
    : rotateTokens();
  refreshInFlight = refreshInFlight.finally(() => {
    refreshInFlight = undefined;
  });

  return refreshInFlight;
};

const getSocketAccessToken = async () => {
  let token = getStoredToken("gat");
  if (!token) return "";
  if (tokenExpiresSoon(token)) token = await refreshStoredTokens();
  return token || "";
};

export const createAuthenticatedSocket = ({ clientType, ...options } = {}) => {
  const socket = io(API_URL, {
    ...options,
    autoConnect: false,
    auth: (callback) => {
      getSocketAccessToken()
        .then((token) => callback({
          token,
          ...(clientType ? { clientType } : {})
        }))
        .catch((error) => {
          console.error("Could not prepare socket authentication:", error);
          callback({ token: "" });
        });
    }
  });
  let refreshing = false;

  socket.on("connect_error", (error) => {
    if (error.message !== "Authentication error" || refreshing) return;
    refreshing = true;
    socket.disconnect();
    refreshStoredTokens()
      .then((token) => {
        if (!token) throw new Error("Pair this device again to reconnect.");
        socket.connect();
      })
      .catch((refreshError) => {
        console.error("Socket authentication could not be renewed:", refreshError);
      })
      .finally(() => {
        refreshing = false;
      });
  });

  return socket;
};

export const fetchWithAuth = async (input, options = {}) => {
  const url = input instanceof URL ? input.toString() : input;
  const headers = new Headers(options.headers || {});
  const accessToken = getStoredToken("gat");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(url, { ...options, headers });

  if (response.status !== 401) return response;
  const refreshedToken = await refreshStoredTokens();
  if (!refreshedToken) return response;

  const retryHeaders = new Headers(options.headers || {});
  retryHeaders.set("Authorization", `Bearer ${refreshedToken}`);
  return fetch(url, { ...options, headers: retryHeaders });
};
