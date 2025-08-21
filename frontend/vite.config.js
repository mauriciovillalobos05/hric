// src/lib/socket.js
import { io } from "socket.io-client";

const API_BASE =
  (import.meta?.env?.VITE_API_BASE_URL || "").replace(/\/$/, "") ||
  window.location.origin;

export const socket = io(API_BASE, {
  path: "/socket.io",
  transports: ["polling", "websocket"], // 👈 polling first, then upgrade
  autoConnect: false,
  withCredentials: false,
});

// optional: if you want to silence upgrade errors entirely during dev:
// export const socket = io(API_BASE, { transports: ["polling"], upgrade: false, autoConnect: false });