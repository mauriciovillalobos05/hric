// src/components/HeaderBar.jsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Bell, MessageCircle } from "lucide-react";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";

function HeaderBar({
  entrepreneurName,
  notifications = [],
  profileImage,
  messages = [],
  onOpenChat = () => {},
}) {
  const navigate = useNavigate();
  const [notificationBarOpen, setNotificationBarIsOpen] = useState(false);
  const [chatBarOpen, setChatBarIsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const menuRef = useRef(null);
  const unreadNotificationCount = notifications.filter((n) => !n.read).length;
  const unreadMessagesCount = messages.filter((n) => !n.read).length;

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
        setNotificationBarIsOpen(false);
        setChatBarIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      // get current access token to notify API before signOut
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        // best-effort server log
        fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => {});
      }

      await supabase.auth.signOut(); // revoke refresh token
    } catch (e) {
      // non-fatal; still send them to login
      console.error("Logout error:", e);
    } finally {
      setMenuOpen(false);
      navigate("/login");
    }
  };

  return (
    <header className="bg-white shadow-sm py-4 px-6 flex justify-between items-center border-b relative">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {entrepreneurName}
        </h1>
        <p className="text-sm text-gray-500">
          Your Ideas and Associate Partners dashboard
        </p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-6" ref={menuRef}>
        {/* Message Icon */}
        <div
          className="relative cursor-pointer"
          onClick={() => {
            setChatBarIsOpen(!chatBarOpen);
            setNotificationBarIsOpen(false);
            setMenuOpen(false);
          }}
        >
          <MessageCircle className="h-6 w-6 text-gray-600" />
          {unreadMessagesCount > 0 && (
            <span className="absolute top-0 right-0 block h-2 w-2 bg-red-500 rounded-full ring-2 ring-white" />
          )}
        </div>

        {/* Chat Dropdown */}
        {chatBarOpen && (
          <div className="absolute right-20 top-16 w-80 bg-white border rounded-lg shadow-lg z-50">
            <div className="p-4 border-b font-semibold text-gray-700">
              Recent Messages
            </div>
            <ul className="max-h-64 overflow-y-auto divide-y">
              {messages.length === 0 ? (
                <li className="p-4 text-gray-500 text-sm text-center">
                  No messages
                </li>
              ) : (
                messages.map((msg, index) => (
                  <li
                    key={index}
                    className="p-4 hover:bg-gray-50 text-sm"
                    onClick={() => {
                      onOpenChat(msg);
                      setChatBarIsOpen(false);
                    }}
                  >
                    <p className="font-medium text-gray-800">{msg.sender}</p>
                    <p className="text-gray-600">{msg.preview}</p>
                    <p className="text-xs text-gray-400">{msg.time}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        {/* Notification Bell */}
        <div
          className="relative cursor-pointer"
          onClick={() => {
            setNotificationBarIsOpen(!notificationBarOpen);
            setChatBarIsOpen(false);
            setMenuOpen(false);
          }}
        >
          <Bell className="h-6 w-6 text-gray-600" />
          {unreadNotificationCount > 0 && (
            <span className="absolute top-0 right-0 block h-2 w-2 bg-red-500 rounded-full ring-2 ring-white" />
          )}
        </div>

        {/* Notification Dropdown */}
        {notificationBarOpen && (
          <div className="absolute right-20 top-16 w-80 bg-white border rounded-lg shadow-lg z-50">
            <div className="p-4 border-b font-semibold text-gray-700">
              Notifications
            </div>
            <ul className="max-h-64 overflow-y-auto divide-y">
              {notifications.length === 0 ? (
                <li className="p-4 text-gray-500 text-sm text-center">
                  No notifications
                </li>
              ) : (
                notifications.map((notif, index) => (
                  <li key={index} className="p-4 hover:bg-gray-50 text-sm">
                    <p className="font-medium text-gray-800">{notif.title}</p>
                    <p className="text-gray-500 text-xs">{notif.time}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        {/* Profile Image */}
        <div
          className="relative cursor-pointer"
          onClick={() => {
            setMenuOpen(!menuOpen);
            setNotificationBarIsOpen(false);
            setChatBarIsOpen(false);
          }}
        >
          <img
            src={profileImage}
            alt="User avatar"
            className="h-10 w-10 rounded-full object-cover border border-gray-300"
          />

          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border z-50">
              <ul className="py-1 text-sm text-gray-700">
                <li
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => navigate("/settings/profile")}
                >
                  Profile Settings
                </li>
                <li
                  className={`px-4 py-2 hover:bg-gray-100 cursor-pointer text-red-600 ${
                    loggingOut ? "opacity-70 cursor-wait" : ""
                  }`}
                  onClick={handleLogout}
                >
                  {loggingOut ? "Logging out…" : "Log Out"}
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default HeaderBar;