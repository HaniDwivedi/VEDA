// mobile/src/pages/stream.jsx
import React, { useEffect, useRef, useState } from "react";
import { API_URL, createAuthenticatedSocket, fetchWithAuth } from "../../../shared/auth.js";
import { getStoredToken } from "../../../shared/token_storage.js";

export default function MobileStream() {
  const [voiceCommand, setVoiceCommand] = useState("");
  const [agentResponse, setAgentResponse] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Connecting");
  const [isStopped, setIsStopped] = useState(false);
  
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const videoRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  useEffect(() => {
    const token = getStoredToken("gat");
    if (!token) {
      setConnectionStatus("Pair this device before connecting.");
      return undefined;
    }

    // 1. WebSocket connection setup with auth token
    const socket = createAuthenticatedSocket();
    socketRef.current = socket;

    let peerConnectionSetup;
    let peerConnectionGeneration = 0;

    const resetPeerConnection = () => {
      peerConnectionGeneration += 1;
      peerConnectionSetup = null;
      const peer = peerRef.current;
      peerRef.current = null;
      pendingCandidatesRef.current = [];
      if (peer && peer.signalingState !== "closed") peer.close();
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const applyPendingCandidates = async (peer) => {
      const candidates = pendingCandidatesRef.current.splice(0);
      for (const candidate of candidates) {
        await peer.addIceCandidate(candidate);
      }
    };

    // 2. WebRTC Signaling Handler
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
          if (peer.remoteDescription) {
            await peer.addIceCandidate(candidate);
          } else {
            pendingCandidatesRef.current.push(candidate);
          }
        }
      } catch (error) {
        console.error("WebRTC signaling failed:", error);
        setConnectionStatus("Could not receive desktop screen.");
      }
    };

    // 3. Prepare WebRTC Peer Connection using server ICE config
    const preparePeerConnection = async () => {
      if (peerRef.current && peerRef.current.signalingState !== "closed") return;
      const generation = peerConnectionGeneration;
      if (peerConnectionSetup?.generation === generation) {
        return peerConnectionSetup.promise;
      }

      pendingCandidatesRef.current = [];
      const setup = (async () => {
        const response = await fetchWithAuth(`${API_URL}/api/rtc-config`);
        if (!response.ok) {
          throw new Error(`ICE configuration request failed (${response.status}).`);
        }

        const { iceServers } = await response.json();
        if (!socket.connected || generation !== peerConnectionGeneration) return;

        const peer = new RTCPeerConnection({ iceServers });
        peerRef.current = peer;
        peer.onicecandidate = ({ candidate }) => {
          if (candidate) socket.emit("webrtc_signal", { candidate: candidate.toJSON() });
        };
        peer.ontrack = ({ streams }) => {
          if (peerRef.current === peer && videoRef.current && streams[0]) {
            videoRef.current.srcObject = streams[0];
            setConnectionStatus("Receiving desktop screen");
          }
        };
        peer.onconnectionstatechange = () => {
          if (peerRef.current === peer) setConnectionStatus(peer.connectionState);
        };
        socket.emit("webrtc_ready");
      })();
      peerConnectionSetup = { generation, promise: setup };

      try {
        await setup;
      } finally {
        if (peerConnectionSetup?.promise === setup) peerConnectionSetup = null;
      }
    };

    socket.on("connect", () => {
      setConnectionStatus("Connected; waiting for desktop...");
      preparePeerConnection().catch((error) => {
        console.error("WebRTC setup failed:", error);
        setConnectionStatus(error.message);
      });
    });

    socket.on("connect_error", (error) => {
      setConnectionStatus(`Connection failed: ${error.message}`);
    });

    socket.on("webrtc_peer_ready", () => {
      setConnectionStatus("Desktop connected; waiting for screen share...");
      preparePeerConnection().catch((error) => {
        console.error("WebRTC setup failed:", error);
        setConnectionStatus(error.message);
      });
    });

    socket.on("webrtc_signal", handleSignal);
    
    socket.on("stream_error", ({ message }) => {
      setConnectionStatus(message);
    });

    socket.on("stream_peer_disconnected", () => {
      setConnectionStatus("Desktop disconnected.");
      resetPeerConnection();
      if (socket.connected) {
        preparePeerConnection().catch((error) => {
          console.error("WebRTC setup failed:", error);
          setConnectionStatus(error.message);
        });
      }
    });

    socket.on("disconnect", () => {
      resetPeerConnection();
    });

    socket.on("agent_response", ({ resultText }) => {
      setAgentResponse(resultText);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(resultText));
      }
    });

    socket.connect();

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      resetPeerConnection();
    };
  }, []);

  const stopStream = () => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    pendingCandidatesRef.current = [];
    if (videoRef.current) videoRef.current.srcObject = null;
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsStopped(true);
    setConnectionStatus("Stream stopped.");
  };

  const sendAgentCommand = (commandText) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected || isStopped) {
      setAgentResponse("Not connected to the desktop.");
      return;
    }
    socket.emit("send_agent_command", { commandText: commandText.trim() });
    setAgentResponse("Command sent to desktop...");
  };

  const handleVoiceListen = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setAgentResponse("Speech recognition is not supported in this browser.");
      return;
    }

    let microphoneStream;
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphoneStream.getTracks().forEach((track) => track.stop());
        microphoneStream = undefined;
      }

      const recognition = new SpeechRecognition();
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setVoiceCommand(transcript);
        sendAgentCommand(transcript);
      };
      recognition.onerror = (event) => {
        const message = ["not-allowed", "service-not-allowed"].includes(event.error)
          ? "Microphone access was denied. Allow microphone permission for VEDA in Android settings and try again."
          : `Voice recognition failed: ${event.error}`;
        setAgentResponse(message);
      };
      recognition.start();
    } catch (error) {
      microphoneStream?.getTracks().forEach((track) => track.stop());
      const denied = error.name === "NotAllowedError" || error.name === "SecurityError";
      setAgentResponse(denied
        ? "Microphone access was denied. Allow microphone permission for VEDA in Android settings and try again."
        : `Could not start voice recognition: ${error.message}`);
    }
  };

  return (
    <main style={styles.page}>
      <h1>Desktop Screen Viewer</h1>
      <p style={{ color: '#38bdf8', fontWeight: '500' }}>{connectionStatus}</p>
      <p style={{ fontSize: '14px', color: '#94a3b8' }}>
        This phone receives the desktop WebRTC stream and sends remote execution commands.
      </p>
      
      <video ref={videoRef} autoPlay playsInline muted controls style={styles.video} />
      
      <div style={styles.controls}>
        <button onClick={handleVoiceListen} disabled={isStopped} style={styles.button}>
          Use Voice Command
        </button>
        <input
          value={voiceCommand}
          onChange={(event) => setVoiceCommand(event.target.value)}
          placeholder="Enter a desktop command..."
          disabled={isStopped}
          style={styles.input}
        />
        <button
          onClick={() => sendAgentCommand(voiceCommand)}
          disabled={isStopped || !voiceCommand.trim()}
          style={styles.primaryButton}
        >
          Send Command
        </button>
        <button onClick={stopStream} disabled={isStopped} style={styles.dangerButton}>
          End Stream
        </button>
      </div>

      {agentResponse && (
        <div style={styles.responseBox}>
          <strong>Agent Response:</strong> {agentResponse}
        </div>
      )}
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 20,
    textAlign: "center",
    background: "#0f172a",
    color: "#fff",
    fontFamily: "Inter, sans-serif"
  },
  video: {
    width: "min(100%, 900px)",
    maxHeight: "55vh",
    background: "#1e293b",
    borderRadius: 10,
    border: "1px solid #334155",
    marginTop: 10
  },
  controls: {
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 12,
    margin: 20
  },
  input: {
    padding: "10px 14px",
    borderRadius: 6,
    border: "1px solid #475569",
    background: "#1e293b",
    color: "#fff",
    outline: "none",
    width: "250px"
  },
  button: {
    padding: "10px 16px",
    borderRadius: 6,
    border: "none",
    background: "#334155",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "600"
  },
  primaryButton: {
    padding: "10px 16px",
    borderRadius: 6,
    border: "none",
    background: "#10b981",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "600"
  },
  dangerButton: {
    padding: "10px 16px",
    borderRadius: 6,
    border: "none",
    background: "#ef4444",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "600"
  },
  responseBox: {
    marginTop: 15,
    padding: 12,
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 6,
    display: "inline-block",
    maxWidth: "600px",
    textAlign: "left"
  }
};