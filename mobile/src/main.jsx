// Mount the mobile pairing, chat, and remote-control screens in the browser.
import React from "react";
import { createRoot } from "react-dom/client";
import App from "../app.jsx";
import { initializeTokenStorage } from "../../shared/token_storage.js";

const root = createRoot(document.getElementById("root"));

initializeTokenStorage().then(() => {
  root.render(
    <React.StrictMode>
      <App />
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
