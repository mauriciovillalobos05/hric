// src/lib/socket.js
import { io } from "socket.io-client";

const API_BASE =
  (import.meta?.env?.VITE_API_BASE_URL || "").replace(/\/$/, "") ||
  window.location.origin; // fallback for dev proxy

export const socket = io(API_BASE, {
  transports: ["websocket", "polling"],
  autoConnect: false,     // we'll connect after setting auth
  withCredentials: false, // using Bearer, not cookies
});

// Call this after login
export function connectSocketWithToken(token) {
  socket.auth = { token };       // Flask-SocketIO can read from `auth`
  if (!socket.connected) socket.connect();
}

export function disconnectSocket() {
  if (socket.connected) socket.disconnect();
}

// (optional) basic logging
socket.on("connect", () => console.log("socket connected", socket.id));
socket.on("disconnect", (reason) => console.log("socket disconnected:", reason));
socket.on("connect_error", (err) => console.error("socket connect_error:", err?.message));