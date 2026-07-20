import { Server } from "socket.io";
import logger from "./logger.js";

let io;
const userSockets = {}; // userId → socketId

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [
        "http://localhost:5173",
        "https://vinayak-frontend-seven.vercel.app",
        "https://tender.mittalu.com",
        "https://d1ysllr1medks8.cloudfront.net",
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    // Frontend emits 'register' with userId after connecting
    socket.on("register", (userId) => {
      userSockets[String(userId)] = socket.id;
      logger.info(`User ${userId} registered with socket ${socket.id}`);
    });

    socket.on("disconnect", () => {
      for (const uid in userSockets) {
        if (userSockets[uid] === socket.id) {
          delete userSockets[uid];
          logger.info(`User ${uid} disconnected`);
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
