// Mount the mobile pairing, chat, and remote-control screens in the browser.
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import App from "../app.jsx";
import { initializeTokenStorage } from "../../shared/token_storage.js";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Mobile app root element #root was not found.");
}
const root = createRoot(rootElement);

function StartupStatus({ children, error = false }) {
  return (
    <main
      role={error ? "alert" : "status"}
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        boxSizing: "border-box",
        background: "#0f172a",
        color: "#f8fafc",
        fontFamily: "Inter, Segoe UI, sans-serif",
        textAlign: "center"
      }}
    >
      {children}
    </main>
  );
}

class AppErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("Mobile app rendering failed:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <StartupStatus error>
          <div>
            <h1>VEDA could not open</h1>
            <p>{this.state.error.message || "An unexpected app error occurred."}</p>
            <p>Please close and reopen the app. If this continues, reinstall or update it.</p>
          </div>
        </StartupStatus>
      );
    }
    return this.props.children;
  }
}

function UpdaterReady() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    CapacitorUpdater.notifyAppReady().catch((error) => {
      console.error("Could not confirm the mobile app started successfully:", error);
    });
  }, []);

  return null;
}

root.render(<StartupStatus>Starting VEDA...</StartupStatus>);

initializeTokenStorage()
  .then(() => {
    root.render(
      <React.StrictMode>
        <AppErrorBoundary>
          <>
            <App />
            <UpdaterReady />
          </>
        </AppErrorBoundary>
      </React.StrictMode>
    );
  })
  .catch((error) => {
    console.error("Could not initialize secure authentication storage:", error);
    root.render(
      <StartupStatus error>
        <div>
          <h1>VEDA could not start</h1>
          <p>Secure token storage failed to initialize.</p>
          <p>{error.message}</p>
          <p>Please update or reinstall the app.</p>
        </div>
      </StartupStatus>
    );
  });
