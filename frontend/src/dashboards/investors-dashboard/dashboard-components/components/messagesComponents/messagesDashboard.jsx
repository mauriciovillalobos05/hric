// ./messagesComponents/MessagesDashboard.jsx
import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, MessageSquare, Inbox, Send } from "lucide-react";
import { mockMessages } from "./mockMessages.js";

function formatTime(t) {
  try {
    if (!t) return "";
    const d = new Date(t);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return t || "";
  }
}

export default function MessagesDashboard({ messages = [] }) {
  // local inbox so we can update preview/time/order
  const [inbox, setInbox] = useState(
    messages && messages.length ? messages : mockMessages
  );

  // build a per-sender thread once from initial inbox
  const [threads, setThreads] = useState(() => {
    const base = {};
    (inbox || []).forEach((m) => {
      base[m.sender] = [
        {
          sender: m.sender,
          content: m.preview || m.content || "…",
          time: m.time || formatTime(m.created_at),
        },
      ];
    });
    return base;
  });

  const [selectedSender, setSelectedSender] = useState(inbox[0]?.sender || null);
  const [query, setQuery] = useState("");
  const [showUnread, setShowUnread] = useState(false);
  const [draft, setDraft] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (inbox || []).filter((m) => {
      const okUnread = showUnread ? !m.read : true;
      const okQ =
        !q ||
        m.sender?.toLowerCase().includes(q) ||
        m.preview?.toLowerCase().includes(q);
      return okUnread && okQ;
    });
  }, [inbox, query, showUnread]);

  const activeThread = useMemo(
    () => (selectedSender ? threads[selectedSender] || [] : []),
    [threads, selectedSender]
  );

  const handleSelect = (msg) => {
    setSelectedSender(msg.sender);
    // mark as read in inbox
    setInbox((prev) =>
      prev.map((m) => (m.sender === msg.sender ? { ...m, read: true } : m))
    );
    // ensure thread exists
    setThreads((prev) =>
      prev[msg.sender]
        ? prev
        : {
            ...prev,
            [msg.sender]: [
              {
                sender: msg.sender,
                content: msg.preview || "…",
                time: msg.time || formatTime(msg.created_at),
              },
            ],
          }
    );
  };

  const sendMessage = () => {
    const text = draft.trim();
    if (!selectedSender || !text) return;

    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // append to thread
    setThreads((prev) => ({
      ...prev,
      [selectedSender]: [
        ...(prev[selectedSender] || []),
        { sender: "You", content: text, time },
      ],
    }));

    // update inbox preview/time and move to top
    setInbox((prev) => {
      const idx = prev.findIndex((m) => m.sender === selectedSender);
      if (idx === -1) {
        return [{ sender: selectedSender, preview: text, time, read: true }, ...prev];
      }
      const updated = { ...prev[idx], preview: text, time, read: true };
      return [updated, ...prev.filter((_, i) => i !== idx)];
    });

    setDraft("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full">
      {/* Inbox */}
      <Card className="lg:col-span-1 h-[520px] flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="w-4 h-4" /> Inbox
            <Badge variant="secondary" className="ml-2">
              {inbox?.length || 0}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0 flex-1 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                className="pl-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant={showUnread ? "default" : "outline"}
              size="sm"
              onClick={() => setShowUnread((v) => !v)}
            >
              Unread
            </Button>
          </div>

          <div className="mt-1 overflow-y-auto grow rounded-md border">
            {filtered.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">
                No messages {showUnread ? "unread " : ""}matching your search.
              </div>
            ) : (
              <ul className="divide-y">
                {filtered.map((m, idx) => {
                  const active = selectedSender === m.sender;
                  return (
                    <li
                      key={`${m.id || m.sender}-${idx}`}
                      className={`p-3 cursor-pointer hover:bg-slate-50 transition ${
                        active ? "bg-slate-50" : "bg-white"
                      }`}
                      onClick={() => handleSelect(m)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{m.sender}</span>
                            {!m.read && (
                              <Badge className="h-5" variant="default">
                                New
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            {m.preview}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground ml-2 shrink-0">
                          {m.time || formatTime(m.created_at)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Thread + Composer (no dock) */}
      <Card className="lg:col-span-2 h-[520px] flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {selectedSender ? (
              <span className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                {selectedSender}
              </span>
            ) : (
              "Select a conversation"
            )}
          </CardTitle>
        </CardHeader>

        {/* Thread */}
        <CardContent className="flex-1 overflow-y-auto">
          {!selectedSender ? (
            <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
              Pick a message from the left to preview the thread.
            </div>
          ) : (
            <div className="space-y-3">
              {activeThread.map((h, i) => {
                const mine = h.sender === "You";
                return (
                  <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-lg p-2 border text-sm ${
                        mine ? "bg-blue-50 border-blue-100" : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="text-[11px] text-gray-500 mb-1">
                        {h.sender} • {h.time}
                      </div>
                      <div>{h.content}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>

        {/* Composer */}
        <div className="border-t p-3 flex gap-2">
          <Input
            placeholder={selectedSender ? "Type a message…" : "Select a conversation first"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!selectedSender}
          />
          <Button type="button" onClick={sendMessage} disabled={!selectedSender || !draft.trim()}>
            <Send className="w-4 h-4 mr-1" />
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}