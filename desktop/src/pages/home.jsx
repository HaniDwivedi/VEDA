// Display a one-time pairing QR and securely store this desktop's issued tokens.
import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { API_URL } from "../../../shared/auth.js";
import BackendSettings from "../../../shared/BackendSettings.jsx";

const getDeviceId = () => {
  let deviceId = localStorage.getItem("veda-device-id");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("veda-device-id", deviceId);
  }
  return deviceId;
};

export default function DesktopHome() {
  const [qrValue, setQrValue] = useState("");
  const [paired, setPaired] = useState(false);
  const [error, setError] = useState("");
  const [agentBridgeStatus, setAgentBridgeStatus] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    let pollTimer;
    let expiryTimer;
    let pairingToken;

    const createQr = async () => {
      try {
        const response = await fetch(`${API_URL}/api/pairing/qr`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceId: getDeviceId(),
            deviceName: navigator.userAgent || "VEDA Desktop"
          })
        }).catch((error) => {
          throw new Error(
            `Could not reach the backend at ${API_URL}. Check that it is online and allows this app's origin. ${error.message}`
          );
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not create pairing QR.");
        if (!active) return;

        setError("");
        pairingToken = data.pairingToken;
        setQrValue(data.qrValue);
        expiryTimer = window.setTimeout(() => {
          window.clearInterval(pollTimer);
          if (active) {
            setQrValue("");
            createQr();
          }
        }, Math.max(0, data.expiresAt - Date.now()));
        pollTimer = window.setInterval(async () => {
          try {
            const result = await fetch(`${API_URL}/api/pairing/status`, {
              headers: { Authorization: `Bearer ${pairingToken}` }
            });
            if (result.status === 204) {
              if (active) setError("");
              return;
            }
            const pairing = await result.json();
            if (!result.ok) throw new Error(pairing.error || "Pairing status failed.");
            localStorage.setItem("gat", pairing.tokens.accessToken);
            localStorage.setItem("gft", pairing.tokens.refreshToken);
            localStorage.setItem("veda-device-id", pairing.deviceId);
            localStorage.setItem("veda-pairing-id", pairing.pairingId);
            window.clearInterval(pollTimer);
            if (active) {
              setPaired(true);
              try {
                if (!pairing.agentTokens?.accessToken || !pairing.agentTokens?.refreshToken) {
                  throw new Error("Backend did not provide separate desktop-agent credentials.");
                }
                const bridgeUrl = window.VEDA_AGENT_BRIDGE_URL || "http://127.0.0.1:8765";
                const pairingData = {
                  ...pairing.agentTokens,
                  serverUrl: API_URL
                };
                if (window.vedaAgent?.pair) {
                  await window.vedaAgent.pair(pairingData);
                } else {
                  const bridgeResponse = await fetch(`${bridgeUrl}/pair`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(pairingData)
                  });
                  if (!bridgeResponse.ok) {
                    throw new Error(`Local desktop agent pairing failed (${bridgeResponse.status}).`);
                  }
                }
                setAgentBridgeStatus("Desktop agent paired and credentials stored securely.");
              } catch (bridgeError) {
                setAgentBridgeStatus(
                  `Desktop agent is not connected: ${bridgeError.message}. Restart VEDA Desktop and pair again.`
                );
              }
            }
          } catch (pollError) {
            if (active) {
              setError(
                `Could not reach the backend at ${API_URL}; pairing will retry. ${pollError.message}`
              );
            }
          }
        }, 3000);
      } catch (requestError) {
        if (active) setError(requestError.message);
      }
    };

    createQr();
    return () => {
      active = false;
      window.clearInterval(pollTimer);
      window.clearTimeout(expiryTimer);
    };
  }, [retryCount]);

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>VEDA DEVICE PAIRING</p>
        <h1>{paired ? "Desktop connected" : "Connect your phone"}</h1>
        {paired ? (
          <>
            <p>This desktop now has its own device ID and access/refresh tokens.</p>
            <p role="status">{agentBridgeStatus}</p>
            <nav style={styles.links}>
              <a href="#/stream">Open paired-device stream</a>
              <a href="#/chat">Open device chat</a>
            </nav>
          </>
        ) : qrValue ? (
          <>
            <p>Scan this one-time code with the VEDA mobile app.</p>
            <div style={styles.qr}>
              <QRCodeSVG value={qrValue} size={240} />
            </div>
            <p style={styles.muted}>The code expires after 15 minutes.</p>
          </>
        ) : (
          <p>Preparing a secure pairing code…</p>
        )}
        <BackendSettings />
        {error && <p role="alert" style={styles.error}>{error}</p>}
        {error && !qrValue && !paired && (
          <button onClick={() => { setError(""); setRetryCount((count) => count + 1); }}>
            Retry connection
          </button>
        )}
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "radial-gradient(circle at top, #172554, #070b16 65%)",
    color: "#f8fafc",
    fontFamily: "Inter, Segoe UI, sans-serif"
  },
  card: {
    width: "min(100%, 440px)",
    padding: 32,
    textAlign: "center",
    border: "1px solid #334155",
    borderRadius: 24,
    background: "rgba(15, 23, 42, .94)",
    boxShadow: "0 24px 80px rgba(0, 0, 0, .35)"
  },
  links: { display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap" },
  eyebrow: { color: "#a5b4fc", letterSpacing: 2, fontSize: 12, fontWeight: 700 },
  qr: { display: "inline-flex", padding: 14, background: "#fff", borderRadius: 12 },
  muted: { color: "#94a3b8", fontSize: 14 },
  error: { color: "#fecaca" }
};
