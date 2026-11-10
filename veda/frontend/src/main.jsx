// Mount the VEDA landing page in the browser.
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import WebUI from "../webui.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WebUI />
  </React.StrictMode>
);
