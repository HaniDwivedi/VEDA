// Let each client set its backend origin before pairing a device.
import React, { useState } from "react";
import { API_URL } from "./auth.js";

export default function BackendSettings() {
  const [serverUrl, setServerUrl] = useState(API_URL);
  const [error, setError] = useState("");

  const save = (event) => {
    event.preventDefault();
    try {
      const url = new URL(serverUrl.trim());
      const localHttp = url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname);
      if (url.protocol !== "https:" && !localHttp) {
        throw new Error("Use HTTPS for a deployed backend; HTTP is allowed only on localhost.");
      }
      if (url.pathname !== "/" || url.search || url.hash) {
        throw new Error("Enter only the backend origin, without a path or query.");
      }
      const origin = url.origin;
      localStorage.setItem("veda-server-url", origin);
      window.VEDA_SERVER_URL = origin;
      window.location.reload();
    } catch (saveError) {
      setError(saveError.message || "Enter a valid backend URL.");
    }
  };

  return (
    <form onSubmit={save} style={styles.form}>
      <label htmlFor="veda-server-url">Backend URL</label>
      <input
        id="veda-server-url"
        type="url"
        value={serverUrl}
        onChange={(event) => setServerUrl(event.target.value)}
        autoComplete="url"
        style={styles.input}
      />
      <button type="submit">Save backend</button>
      {error && <p role="alert" style={styles.error}>{error}</p>}
    </form>
  );
}

const styles = {
  form: { display: "grid", gap: 8, margin: "20px 0", textAlign: "left" },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #475569",
    background: "#0f172a",
    color: "#f8fafc"
  },
  error: { color: "#fecaca" }
};
