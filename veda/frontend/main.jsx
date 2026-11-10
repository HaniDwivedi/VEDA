// Mount the VEDA landing page.
import React from "react";
import { createRoot } from "react-dom/client";
import WebUI from "./webui.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WebUI />
  </React.StrictMode>
);
