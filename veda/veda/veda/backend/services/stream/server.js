// veda/backend/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

io.on('connection', (socket) => {
  console.log(`Device connected: ${socket.id}`);

  // Mobile aur Laptop dono ek hi paired Room ID se judte hain
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room: ${roomId}`);
    socket.to(roomId).emit('peer-joined', socket.id);
  });

  // Mobile/Laptop se aane wala WebRTC Offer doosre peer ko bhejna
  socket.on('offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('offer', offer);
  });

  // Peer se aane wala WebRTC Answer wapas bhejna
  socket.on('answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('answer', answer);
  });

  // Network path (ICE Candidate) exchange karna
  socket.on('ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice-candidate', candidate);
  });

  socket.on('disconnect', () => {
    console.log(`Device disconnected: ${socket.id}`);
  });
});

server.listen(5000, () => {
  console.log('Signaling server running on port 5000');
});