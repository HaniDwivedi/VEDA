// Mount the desktop pairing and stream screens in the browser.
import React from "react";
import { createRoot } from "react-dom/client";
import App from "../app.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
