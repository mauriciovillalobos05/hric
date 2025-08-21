// src/lib/socket.js
import { io } from "socket.io-client";

let socket; // lazy singleton

function getBaseUrl() {
  const fromEnv = (import.meta?.env?.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  // Only touch window in the browser
  if (typeof window !== "undefined") return window.location.origin;
  // Node/SSR fallback (won't be used in the browser)
  return "http://localhost";
}

export function getSocket() {
  if (!socket) {
    const API_BASE = getBaseUrl();
    socket = io(API_BASE, {
      path: "/socket.io",
      transports: ["polling", "websocket"], // polling first to reduce WS noise in dev
      autoConnect: false,
      withCredentials: false,
    });

    // Logs once (only when created in browser)
    if (typeof window !== "undefined") {
      socket.on("connect",    () => console.log("[socket] connected", socket.id));
      socket.on("disconnect", r  => console.log("[socket] disconnected:", r));
      socket.on("connect_error", e => console.error("[socket] connect_error:", e?.message));
    }
  }
  return socket;
}

export function connectSocketWithToken(token) {
  const s = getSocket();
  s.auth = { token };
  if (!s.connected) s.connect();
}

export function disconnectSocket() {
  const s = getSocket();
  if (s.connected) s.disconnect();
}