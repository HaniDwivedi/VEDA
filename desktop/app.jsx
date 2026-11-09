// Select the desktop pairing screen or the incoming-device stream screen.
import React from "react";
import DesktopHome from "./src/pages/home.jsx";
import DesktopStream from "./src/pages/stream.jsx";

export default function App() {
  return window.location.pathname === "/stream"
    ? <DesktopStream />
    : <DesktopHome />;
}
