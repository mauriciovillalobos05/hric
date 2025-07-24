import React, { useState } from "react";

export default function ChatWindow({ chat, index, onClose }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(chat.history || []);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMessage = {
      sender: "You",
      text: input,
      time: new Date().toLocaleTimeString(),
    };
    setMessages([...messages, newMessage]);
    setInput("");
  };

  return (
    <div
      className="fixed bottom-0 w-80 bg-white border shadow-lg rounded-t-lg z-50 flex flex-col"
      style={{ right: `${20 + index * 340}px` }}
    >
      <div className="bg-gray-100 px-4 py-2 flex justify-between items-center rounded-t-lg">
        <h3 className="text-sm font-semibold text-gray-700">{chat.sender}</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-red-600">×</button>
      </div>
      <div className="p-3 h-64 overflow-y-auto text-sm">
        {messages.map((m, i) => (
          <div key={i} className="mb-2">
            <strong>{m.sender}: </strong>{m.text}
            <div className="text-xs text-gray-400">{m.time}</div>
          </div>
        ))}
      </div>
      <div className="border-t flex items-center px-2 py-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-2 py-1 border rounded text-sm"
          placeholder="Type a message..."
        />
        <button
          onClick={handleSend}
          className="ml-2 bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
        >
          Send
        </button>
      </div>
    </div>
  );
}
