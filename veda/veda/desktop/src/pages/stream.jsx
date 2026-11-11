// desktop/src/pages/DesktopStream.jsx
import React, { useEffect, useRef, useState } from "react";
import { API_URL, createAuthenticatedSocket, fetchWithAuth } from "../../../shared/auth.js";

export default function DesktopStream() {
  const [mobileVideoAvailable, setMobileVideoAvailable] = useState(false);
  const [agentStatus, setAgentStatus] = useState("Waiting for connection");
  const [connectionStatus, setConnectionStatus] = useState("Connecting");
  const [mobileConnected, setMobileConnected] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const screenTrackRef = useRef(null);
  const screenSenderRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  useEffect(() => {
    const token = localStorage.getItem("gat");
    if (!token) {
      setConnectionStatus("Pair this device before opening the stream");
      return undefined;
    }   

    const socket = createAuthenticatedSocket({
      transports: ["websocket"]
    });
    socketRef.current = socket;

    const stopScreenShare = async (updateStatus = true) => {
      const track = screenTrackRef.current;
      screenTrackRef.current = null;
      if (screenSenderRef.current) {
        await screenSenderRef.current.replaceTrack(null);
      }
      if (track && track.readyState !== "ended") track.stop();
      setIsSharingScreen(false);
      if (updateStatus) setConnectionStatus("Screen sharing stopped");
    };

    const applyPendingCandidates = async (peer) => {
      const candidates = pendingCandidatesRef.current.splice(0);
      for (const candidate of candidates) await peer.addIceCandidate(candidate);
    };

    const handleSignal = async ({ signal }) => {
      const peer = peerRef.current;
      if (!peer || !signal) return;
      try {
        if (signal.description) {
          await peer.setRemoteDescription(signal.description);
          await applyPendingCandidates(peer);
          if (signal.description.type === "offer") {
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.emit("webrtc_signal", { description: peer.localDescription });
          }
        } else if (signal.candidate) {
          const candidate = new RTCIceCandidate(signal.candidate);
          if (peer.remoteDescription) await peer.addIceCandidate(candidate);
          else pendingCandidatesRef.current.push(candidate);
        }
      } catch (error) {
        console.error("WebRTC signaling failed:", error);
        setConnectionStatus("Could not establish paired-device video");
      }
    };

    const preparePeerConnection = async () => {
      const response = await fetchWithAuth(`${API_URL}/api/rtc-config`);
      if (!response.ok) {
        throw new Error(`ICE configuration request failed (${response.status}).`);
      }
      const { iceServers } = await response.json();
      const peer = new RTCPeerConnection({ iceServers });
      peerRef.current = peer;
      peer.onicecandidate = ({ candidate }) => {
        if (candidate) socket.emit("webrtc_signal", { candidate });
      };
      peer.ontrack = ({ streams }) => {
        if (remoteVideoRef.current && streams[0]) {
          remoteVideoRef.current.srcObject = streams[0];
          setMobileVideoAvailable(true);
        }
      };
      peer.onconnectionstatechange = () => setConnectionStatus(peer.connectionState);
      socket.emit("webrtc_ready");
    };

    socket.on("connect", () => {
      setConnectionStatus("Connected; waiting for the phone");
      preparePeerConnection().catch((error) => {
        console.error("WebRTC setup failed:", error);
        socket.emit("voice_stream_state", { active: false });
        setConnectionStatus(error.message);
      });
    });
    socket.on("connect_error", (error) => {
      setConnectionStatus(`Connection failed: ${error.message}`);
    });
    socket.on("webrtc_peer_ready", () => {
      setMobileConnected(true);
      socket.emit("voice_stream_state", { active: true });
      setConnectionStatus("Phone connected; screen sharing is ready");
    });
    socket.on("webrtc_signal", handleSignal);
    socket.on("stream_error", ({ message }) => setConnectionStatus(message));
    
    socket.on("agent_status_update", ({ command }) => {
      setAgentStatus(`Received command: ${command}`);
    });

    // Jab agent bridge connected na ho ya response aaye
    socket.on("agent_command_received", ({ commandId, commandText }) => {
      const approved = window.confirm(
        `Allow the paired phone to run this supported desktop action?\n\n${commandText}`
      );
      socket.emit("agent_command_approval", { commandId, approved });
      setAgentStatus(approved ? "Command approved; waiting for desktop agent" : "Command declined");
      if (!approved) {
        socket.emit("agent_response_send", { resultText: "Desktop user declined the command." });
      }
    });

    socket.on("stream_peer_disconnected", () => {
      setMobileConnected(false);
      socket.emit("voice_stream_state", { active: false });
      setConnectionStatus("Paired device disconnected");
      stopScreenShare(false).catch((error) => {
        console.error("Could not stop the disconnected screen share:", error);
      });
    });

    socket.connect();

    return () => {
      if (socket.connected) socket.emit("voice_stream_state", { active: false });
      socket.disconnect();
      if (peerRef.current) peerRef.current.close();
      if (screenTrackRef.current && screenTrackRef.current.readyState !== "ended") {
        screenTrackRef.current.stop();
      }
    };
  }, []);

  const startScreenShare = async () => {
    if (!mobileConnected || !peerRef.current || isSharingScreen) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setConnectionStatus("Screen sharing is not supported by this browser.");
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        audio: false,
        video: {
          displaySurface: "monitor",
          selfBrowserSurface: "exclude",
          surfaceSwitching: "include",
          monitorTypeSurfaces: "include"
        }
      });
      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) {
        displayStream.getTracks().forEach((track) => track.stop());
        throw new Error("No screen video track was selected.");
      }

      screenTrackRef.current = screenTrack;
      screenTrack.addEventListener("ended", () => {
        if (screenTrackRef.current === screenTrack) {
          screenTrackRef.current = null;
          screenSenderRef.current?.replaceTrack(null).catch((error) => {
            console.error("Could not detach the ended screen track:", error);
          });
          setIsSharingScreen(false);
          setConnectionStatus("Screen sharing stopped");
        }
      }, { once: true });

      if (screenSenderRef.current) {
        await screenSenderRef.current.replaceTrack(screenTrack);
      } else {
        screenSenderRef.current = peerRef.current.addTrack(screenTrack, displayStream);
        const offer = await peerRef.current.createOffer();
        await peerRef.current.setLocalDescription(offer);
        socketRef.current.emit("webrtc_signal", {
          description: peerRef.current.localDescription
        });
      }
      setIsSharingScreen(true);
      setConnectionStatus("Sharing screen with the paired phone");
    } catch (error) {
      if (error.name === "NotAllowedError") {
        setConnectionStatus("Screen sharing was cancelled.");
        return;
      }
      console.error("Screen sharing failed:", error);
      setConnectionStatus(`Could not share screen: ${error.message}`);
    }
  };

  const stopSharingScreen = async () => {
    try {
      await stopScreenShare();
    } catch (error) {
      console.error("Could not stop screen sharing:", error);
      setConnectionStatus("Could not stop screen sharing cleanly.");
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1>Paired device</h1>
        <p>{connectionStatus}</p>
        <p>
          Screen sharing starts only when you choose it. The VEDA browser tab is
          excluded, and the outgoing screen is never previewed inside this page,
          preventing an infinite mirror loop.
        </p>
        {!isSharingScreen ? (
          <button onClick={startScreenShare} disabled={!mobileConnected} style={styles.button}>
            Share desktop screen
          </button>
        ) : (
          <button onClick={stopSharingScreen} style={styles.dangerButton}>Stop screen sharing</button>
        )}
      </section>
      <section style={styles.card}>
        <h2>Phone screen</h2>
        <video ref={remoteVideoRef} autoPlay playsInline muted style={styles.video} />
        {!mobileVideoAvailable && <p>No incoming video stream.</p>}
        <h2>Agent status</h2>
        <p>{agentStatus}</p>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 20,
    padding: 20,
    background: "#0f172a",
    color: "#fff",
    fontFamily: "Inter, sans-serif"
  },
  card: { border: "1px solid #334155", borderRadius: 12, padding: 18, background: "#1e293b" },
  video: { width: "100%", maxHeight: 420, background: "#0f172a", borderRadius: 8 },
  button: { padding: "10px 16px", background: "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" },
  dangerButton: { padding: "10px 16px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: "bold" }
};