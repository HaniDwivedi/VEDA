// Select the pairing, chat, or desktop-stream screen by URL path.
import React from "react";
import Home from "./src/pages/homes.jsx";
import Chat from "./src/pages/chat.jsx";
import MobileStream from "./src/pages/stream.jsx";

export default function App() {
  if (window.location.pathname === "/chat") return <Chat />;
  if (window.location.pathname === "/stream") return <MobileStream />;
  return <Home />;
}
