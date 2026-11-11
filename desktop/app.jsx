// Select the desktop pairing screen or the incoming-device stream screen.
import React, { useEffect, useState } from "react";
import DesktopHome from "./src/pages/home.jsx";
import DesktopStream from "./src/pages/stream.jsx";

export default function App() {
  const [path, setPath] = useState(window.location.hash.slice(1) || "/");

  useEffect(() => {
    const updatePath = () => setPath(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", updatePath);
    return () => window.removeEventListener("hashchange", updatePath);
  }, []);

  return path === "/stream" ? <DesktopStream /> : <DesktopHome />;
}
