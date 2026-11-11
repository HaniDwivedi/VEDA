// Pair the mobile device by scanning a desktop challenge and store its tokens.
import React, { useCallback, useState } from "react";
import QRScanner, { fetchClientMetadata } from "../component/QRScanner.jsx";
import { API_URL } from "../component/fetchwithAuth.jsx";
import { clearTokens, getStoredToken, storeTokens } from "../../../shared/token_storage.js";
import BackendSettings from "../../../shared/BackendSettings.jsx";

const existingPairing = () => ({
  accessToken: getStoredToken("gat"),
  refreshToken: getStoredToken("gft")
});

export default function Home() {
  const [tokens, setTokens] = useState(existingPairing);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState("");

  const handleScan = useCallback(async (qrValue) => {
    setIsScanning(false);
    setError("");

    try {
      let deviceId = localStorage.getItem("veda-device-id");
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem("veda-device-id", deviceId);
      }

      const response = await fetch(`${API_URL}/api/pairing/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawScanData: qrValue,
          clientInfo: await fetchClientMetadata(deviceId)
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not pair this device.");

      await storeTokens({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        pairingId: result.pairingId
      });
      localStorage.setItem("veda-device-id", result.deviceId);
      setTokens({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      });
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  const disconnect = async () => {
    try {
      await clearTokens();
      setError("");
      setTokens({ accessToken: null, refreshToken: null });
    } catch (requestError) {
      setError(`Could not securely remove paired credentials: ${requestError.message}`);
    }
  };

  useEffect(() => {
    // यूजर से कैमरे की परमिशन मांगना
    async function requestCameraPermission() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" } // पीछे वाला कैमरा चालू करने के लिए
        });
        
        // अगर परमिशन मिल गई, तो स्ट्रीम को बंद कर दें ताकि QRScanner अपना काम कर सके
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);
      } catch (err) {
        console.error("Camera permission denied:", err);
        onError("कैमरा की अनुमति (Permission) नहीं मिली। कृपया सेटिंग्स में जाकर परमिशन दें।");
      }
    }

    requestCameraPermission();
  }, [onError]);

  if (!hasPermission) {
    return <p>कैमरा परमिशन का इंतज़ार है...</p>;
  }

  if (tokens.accessToken && tokens.refreshToken) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <h1>Phone paired</h1>
          <p>Your mobile device has its own ID and rotated access/refresh tokens.</p>
          <nav style={styles.links}>
            <a href="/chat">Open device chat</a>
            <a href="/stream">Open desktop screen</a>
          </nav>
          {error && <p role="alert" style={styles.error}>{error}</p>}
          <BackendSettings />
          <button onClick={disconnect}>Unpair this browser</button>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1>Pair with VEDA Desktop</h1>
        <p>Scan the one-time QR code shown on the desktop.</p>
        {isScanning
          ? <QRScanner onScan={handleScan} onError={setError} />
          : <button onClick={() => { setError(""); setIsScanning(true); }}>Scan desktop QR</button>}
        {error && <p role="alert" style={styles.error}>{error}</p>}
        <BackendSettings />
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 20,
    background: "#0f172a",
    color: "#f8fafc",
    fontFamily: "Inter, Segoe UI, sans-serif"
  },
  card: {
    width: "min(100%, 440px)",
    padding: 28,
    textAlign: "center",
    border: "1px solid #334155",
    borderRadius: 20,
    background: "#172033"
  },
  links: { display: "flex", justifyContent: "center", gap: 20, margin: "20px 0" },
  error: { color: "#fecaca" }
};
