// src/dashboards/.../messagesComponents/NotificationCounter.jsx
import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotificationCounter({ startupId, onClick }) {
  const [counts, setCounts] = useState({
    unread_messages: 0,
    total_likes: 0,
    connection_requests: 0,
  });

  useEffect(() => {
    // TODO: wire to your API when ready.
    // For now, simulate with local state every few seconds.
    const timer = setInterval(() => {
      setCounts((c) => ({
        unread_messages: c.unread_messages + 1,
        total_likes: c.total_likes + 2,
        connection_requests: c.connection_requests + 1,
      }));
    }, 10000);
    return () => clearInterval(timer);
  }, [startupId]);

  return (
    <div className="flex items-center gap-3 p-3 border rounded-md bg-white">
      <Bell className="w-4 h-4 text-blue-600" />
      <div className="text-sm">
        <div>
          <b>{counts.unread_messages}</b> new messages
        </div>
        <div className="text-gray-600">
          {counts.total_likes} likes • {counts.connection_requests} requests
        </div>
      </div>
      <Button size="sm" className="ml-auto" onClick={onClick}>
        View
      </Button>
    </div>
  );
}