import { Server } from 'socket.io';

let io;
const userSockets = {}; // userId → socketId

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    }
  });

  io.on('connection', (socket) => {
    // Frontend emits 'register' with userId after connecting
    socket.on('register', (userId) => {
      userSockets[String(userId)] = socket.id;
      console.log(`User ${userId} registered with socket ${socket.id}`);
    });

    socket.on('disconnect', () => {
      for (const uid in userSockets) {
        if (userSockets[uid] === socket.id) {
          delete userSockets[uid];
          console.log(`User ${uid} disconnected`);
          break;
        }
      }
    });
  });

  return io;
};

export const emitToUser = (userId, event, data) => {
  const socketId = userSockets[String(userId)];
  if (io && socketId) {
    io.to(socketId).emit(event, data);
  }
};