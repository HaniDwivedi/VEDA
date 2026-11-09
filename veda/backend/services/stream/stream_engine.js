// Authenticate sockets and route signaling, chat, and agent events by paired role.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const MAX_SIGNAL_BYTES = 256 * 1024;
const MAX_COMMAND_LENGTH = 1000;
const MAX_CHAT_MESSAGE_LENGTH = 4000;

const setupStreamEngine = (io, accessTokenSecret) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) {
      next(new Error("Authentication error"));
      return;
    }

    try {
      const claims = jwt.verify(token, accessTokenSecret);
      if (!claims || claims.tokenType !== "access" ||
          !claims.pairingId || !claims.deviceId ||
          !["desktop", "mobile"].includes(claims.deviceRole)) {
        next(new Error("Authentication error"));
        return;
      }

      const pairRoom = `pair_${crypto
        .createHash("sha256")
        .update(claims.pairingId)
        .digest("hex")}`;
      const clientType = socket.handshake.auth && socket.handshake.auth.clientType;
      if ((claims.clientId === "agent") !== (clientType === "desktop-agent")) {
        next(new Error("Authentication error"));
        return;
      }
      socket.data.pairingId = claims.pairingId;
      socket.data.deviceId = claims.deviceId;
      socket.data.deviceRole = claims.deviceRole;
      socket.data.isDesktopAgent = claims.deviceRole === "desktop" &&
        clientType === "desktop-agent";
      socket.data.pairRoom = pairRoom;
      socket.data.roleRoom = `${pairRoom}_${claims.deviceRole}`;
      socket.data.agentRoom = `${pairRoom}_desktop_agent`;
      socket.data.targetRoleRoom = `${pairRoom}_${claims.deviceRole === "desktop" ? "mobile" : "desktop"}`;
      next();
    } catch (_error) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    const {
      pairRoom,
      roleRoom,
      targetRoleRoom,
      agentRoom,
      deviceRole,
      isDesktopAgent
    } = socket.data;
    socket.join([pairRoom, roleRoom]);
    if (isDesktopAgent) socket.join(agentRoom);
    socket.emit("stream_ready");

    socket.on("webrtc_ready", async () => {
      const peers = await io.in(targetRoleRoom).fetchSockets();
      if (peers.length) {
        socket.emit("webrtc_peer_ready");
        socket.to(targetRoleRoom).emit("webrtc_peer_ready");
      }
    });

    socket.on("webrtc_signal", (signal) => {
      if (!signal || typeof signal !== "object") {
        socket.emit("stream_error", { message: "Invalid WebRTC signal." });
        return;
      }

      let serializedSignal;
      try {
        serializedSignal = JSON.stringify(signal);
      } catch (_error) {
        socket.emit("stream_error", { message: "Invalid WebRTC signal." });
        return;
      }
      if (Buffer.byteLength(serializedSignal, "utf8") > MAX_SIGNAL_BYTES) {
        socket.emit("stream_error", { message: "WebRTC signal is too large." });
        return;
      }
      socket.to(targetRoleRoom).emit("webrtc_signal", {
        from: socket.id,
        signal
      });
    });

    socket.on("send_agent_command", (payload) => {
      const commandText = payload && payload.commandText;
      if (deviceRole !== "mobile" || typeof commandText !== "string" ||
          !commandText.trim() || commandText.length > MAX_COMMAND_LENGTH) {
        socket.emit("stream_error", { message: "Invalid agent command." });
        return;
      }
      const commandId = crypto.randomUUID();
      socket.to(targetRoleRoom).emit("agent_status_update", { command: commandText.trim() });
      socket.to(targetRoleRoom).emit("agent_command_received", {
        commandId,
        commandText: commandText.trim()
      });
    });

    socket.on("agent_command_approval", (payload) => {
      if (deviceRole !== "desktop" || isDesktopAgent ||
          typeof payload?.commandId !== "string" ||
          typeof payload.approved !== "boolean") {
        socket.emit("stream_error", { message: "Invalid agent command approval." });
        return;
      }
      io.to(agentRoom).emit("agent_command_approval", {
        commandId: payload.commandId,
        approved: payload.approved
      });
    });

    socket.on("send_message", (payload) => {
      const text = payload && payload.text;
      if (typeof text !== "string" || !text.trim() ||
          text.length > MAX_CHAT_MESSAGE_LENGTH) {
        socket.emit("stream_error", { message: "Invalid chat message." });
        return;
      }
      socket.to(targetRoleRoom).emit("receive_message", {
        text: text.trim(),
        sender: deviceRole === "desktop" ? "Desktop" : "Mobile",
        timestamp: new Date().toISOString()
      });
    });

    socket.on("agent_response_send", (payload) => {
      const resultText = payload && payload.resultText;
      if (deviceRole !== "desktop" || typeof resultText !== "string" ||
          !resultText.trim() || resultText.length > MAX_COMMAND_LENGTH) {
        socket.emit("stream_error", { message: "Invalid agent response." });
        return;
      }
      socket.to(targetRoleRoom).emit("agent_response", { resultText: resultText.trim() });
    });

    socket.on("disconnect", () => {
      socket.to(targetRoleRoom).emit("stream_peer_disconnected");
    });
  });
};

module.exports = { setupStreamEngine };
