import { createServer } from "node:http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import mongoose from "mongoose";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Define port
const port = process.env.PORT || 3000;

// Connect to MongoDB
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is not defined");
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

// Initialize server
connectDB().then(() => {
  app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Socket.io setup
  const io = new Server(server, {
    cors: {
      origin: "*", // Adjust for production
      methods: ["GET", "POST"]
    }
  });

  // Store connected users (socketId -> userId)
  // In a real app, use Redis. For this MVP, in-memory is fine.
  const onlineUsers = new Map<string, string>(); // userId -> socketId

  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // User authenticates/identifies
    socket.on("identify", async (userId: string) => {
      console.log(`User ${userId} identified with socket ${socket.id}`);
      
      // Store userId in socket.data for easy access on disconnect
      socket.data.userId = userId;
      onlineUsers.set(userId, socket.id);
      
      // Broadcast to others that this user came online
      socket.broadcast.emit("user-online", userId);
      
      // Send current online user list to the new user
      socket.emit("online-users-list", Array.from(onlineUsers.keys()));
      
      // Emit consolidated list to all clients
      io.emit("online-users-list", Array.from(onlineUsers.keys()));
    });

    // Generic Signaling for WebRTC (SimplePeer or Raw)
    socket.on("send-signal", (data) => {
      const socketIdToCall = onlineUsers.get(data.to);
      if (socketIdToCall) {
        io.to(socketIdToCall).emit("signal-received", { 
          signal: data.signal, 
          from: data.from // userId of sender
        });
      }
    });

    // Keeping these for specific initial call intent if needed, but generic is better
    socket.on("call-user", ({ userToCall, signalData, from, name, avatar }) => {
      const socketIdToCall = onlineUsers.get(userToCall);
      if (socketIdToCall) {
        io.to(socketIdToCall).emit("call-made", { signal: signalData, from, name, avatar }); // from is userId
      }
    });

    socket.on("answer-call", (data) => {
      const socketIdToCall = onlineUsers.get(data.to);
      if (socketIdToCall) {
        io.to(socketIdToCall).emit("call-answered", { signal: data.signal, from: data.from });
      }
    });
    
    // Status updates
    socket.on("disconnect", (reason) => {
      const userId = socket.data.userId;
      console.log(`Client disconnected: ${socket.id}, userId: ${userId}, reason: ${reason}`);
      
      if (userId && onlineUsers.has(userId)) {
        onlineUsers.delete(userId);
        // Broadcast to all clients that user went offline
        io.emit("user-offline", userId);
        // Emit updated online users list
        io.emit("online-users-list", Array.from(onlineUsers.keys()));
      }
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
  });});