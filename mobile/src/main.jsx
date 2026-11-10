// Mount the mobile pairing, chat, and remote-control screens in the browser.
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import App from "../app.jsx";
import { initializeTokenStorage } from "../../shared/token_storage.js";

const root = createRoot(document.getElementById("root"));

function UpdaterReady() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    CapacitorUpdater.notifyAppReady().catch((error) => {
      console.error("Could not confirm the mobile app started successfully:", error);
    });
  }, []);

  return null;
}

initializeTokenStorage().then(() => {
  root.render(
    <React.StrictMode>
      <>
        <App />
        <UpdaterReady />
      </>
    </React.StrictMode>
  );
}).catch((error) => {
  console.error("Could not initialize secure authentication storage:", error);
  root.render(
    <main role="alert" style={{ padding: 24 }}>
      VEDA could not start secure token storage. Please reinstall or update the app.
    </main>
  );
});
