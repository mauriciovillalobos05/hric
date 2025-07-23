import React from "react";

export default function MessagesPreview({ messages, onOpenChat }) {
  return (
    <section className="p-6">
      <h2 className="text-lg font-semibold mb-3">Unread Messages</h2>
      <ul className="divide-y bg-white border rounded-md shadow-sm">
        {messages.map((msg, index) => (
          <li
            key={index}
            className="p-4 hover:bg-gray-50 cursor-pointer"
            onClick={() => onOpenChat(msg)} // trigger chat open
          >
            <p className="font-medium">{msg.sender}</p>
            <p className="text-sm text-gray-600">{msg.preview}</p>
            <p className="text-xs text-gray-400">{msg.time}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
