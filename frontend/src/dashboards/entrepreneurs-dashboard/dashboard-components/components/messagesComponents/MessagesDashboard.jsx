// src/dashboards/.../messagesComponents/MessagesDashboard.jsx
import React, { useMemo, useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, MessageSquare, Inbox, Send, Lock } from "lucide-react";
import { mockMessages } from "../../../../investors-dashboard/dashboard-components/components/messagesComponents/mockMessages.js";
import UpgradePrompt from "./UpgradePrompt.jsx";
import { useNavigate } from "react-router-dom";

function formatTime(t) {
  try {
    if (!t) return "";
    const d = new Date(t);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return t || "";
  }
}

// Read role/plan from storage (falls back to localStorage)
function getRolePlan() {
  const role =
    sessionStorage.getItem("registrationRole") ||
    localStorage.getItem("user_role") ||
    "";
  const plan =
    sessionStorage.getItem("registrationPlanKey") ||
    localStorage.getItem("user_plan") ||
    "";
  return { role, plan };
}

export default function MessagesDashboard({ messages = [] }) {
  const navigate = useNavigate();
  const { role, plan } = getRolePlan();

  const isFreeStartup =
    role?.toLowerCase() === "entrepreneur" &&
    (plan === "entrepreneur_free" || plan === "" || plan == null);

  const [inbox, setInbox] = useState(
    messages && messages.length ? messages : mockMessages
  );

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

  const [selectedSender, setSelectedSender] = useState(
    inbox[0]?.sender || null
  );
  const [query, setQuery] = useState("");
  const [showUnread, setShowUnread] = useState(false);
  const [draft, setDraft] = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    const target = sessionStorage.getItem("startChatWith");
    if (!target) return;

    sessionStorage.removeItem("startChatWith");

    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    setInbox((prev) => {
      const exists = prev.some((m) => m.sender === target);
      if (exists) return prev;
      const placeholder = {
        id: `m-${Date.now()}`,
        sender: target,
        preview: "New conversation",
        time,
        read: true,
        created_at: new Date().toISOString(),
      };
      return [placeholder, ...prev];
    });

    setThreads((prev) => {
      if (prev[target]) return prev;
      return {
        ...prev,
        [target]: [
          {
            sender: target,
            content: "— conversation started —",
            time,
          },
        ],
      };
    });

    // select after ensures state exists
    setSelectedSender(target);
  }, []);

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

    // If locked, we don't reveal content; show the upgrade modal
    if (isFreeStartup) {
      setShowUpgrade(true);
      return;
    }

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

    if (isFreeStartup) {
      // Block sending & show upgrade
      setShowUpgrade(true);
      return;
    }

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
        return [
          { sender: selectedSender, preview: text, time, read: true },
          ...prev,
        ];
      }
      const updated = { ...prev[idx], preview: text, time, read: true };
      return [updated, ...prev.filter((_, i) => i !== idx)];
    });

    setDraft("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isFreeStartup && draft.trim() !== "") {
        sendMessage();
      }
    }
  };

  // Render helpers for the locked (freemium) state
  const maskedSender = "Premium Member";
  const maskedPreview = "Message from verified investor…";

  // right before the return (or at top of component)
  const disableSend = isFreeStartup
    ? !selectedSender // allow Upgrade click w/o text
    : !selectedSender || draft.trim() === ""; // require text for Send

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full">
        {/* Inbox */}
        <Card className="lg:col-span-1 h-[520px] flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox className="w-4 h-4" />
              Inbox
              <Badge variant="secondary" className="ml-2">
                {inbox?.length || 0}
              </Badge>
              {isFreeStartup && (
                <span className="ml-auto text-xs text-orange-600 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Upgrade to unlock
                </span>
              )}
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
                    const sender = isFreeStartup ? maskedSender : m.sender;
                    const preview = isFreeStartup ? maskedPreview : m.preview;
                    return (
                      <li
                        key={`${m.id || m.sender}-${idx}`}
                        className={`p-3 cursor-pointer hover:bg-slate-50 transition ${
                          active ? "bg-slate-50" : "bg-white"
                        } ${isFreeStartup ? "opacity-90" : ""}`}
                        onClick={() => handleSelect(m)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">
                                {sender}
                              </span>
                              {!m.read && (
                                <Badge className="h-5" variant="default">
                                  New
                                </Badge>
                              )}
                              {isFreeStartup && (
                                <Lock className="w-3 h-3 text-gray-500" />
                              )}
                            </div>
                            <div
                              className={`text-sm text-muted-foreground truncate ${
                                isFreeStartup ? "blur-[1.5px]" : ""
                              }`}
                            >
                              {preview}
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
                  {isFreeStartup ? maskedSender : selectedSender}
                  {isFreeStartup && (
                    <Badge variant="outline" className="ml-2">
                      Locked
                    </Badge>
                  )}
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
                {(activeThread.length
                  ? activeThread
                  : [{ sender: maskedSender, content: maskedPreview, time: "" }]
                ).map((h, i) => {
                  const mine = h.sender === "You";
                  const showText = isFreeStartup ? maskedPreview : h.content;
                  const showSender =
                    isFreeStartup && !mine ? maskedSender : h.sender;
                  return (
                    <div
                      key={i}
                      className={`flex ${
                        mine ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[75%] rounded-lg p-2 border text-sm ${
                          mine
                            ? "bg-blue-50 border-blue-100"
                            : "bg-gray-50 border-gray-200"
                        } ${isFreeStartup && !mine ? "opacity-90" : ""}`}
                      >
                        <div className="text-[11px] text-gray-500 mb-1 flex items-center gap-1">
                          {showSender} {h.time ? `• ${h.time}` : ""}
                          {isFreeStartup && !mine && (
                            <Lock className="w-3 h-3 text-gray-500" />
                          )}
                        </div>
                        <div
                          className={`${
                            isFreeStartup && !mine ? "blur-[1.5px]" : ""
                          }`}
                        >
                          {showText}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {isFreeStartup && (
                  <div className="mt-4 border rounded-md p-3 bg-amber-50 text-amber-800 text-sm">
                    You have messages from verified investors. Upgrade to read
                    them and reply instantly.
                  </div>
                )}
              </div>
            )}
          </CardContent>

          {/* Composer */}
          <div className="border-t p-3 flex gap-2">
            <Input
              placeholder={
                isFreeStartup
                  ? "Upgrade to reply to investors"
                  : selectedSender
                  ? "Type a message…"
                  : "Select a conversation first"
              }
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!selectedSender || isFreeStartup}
            />
            <Button
              type="button"
              onClick={() =>
                isFreeStartup ? setShowUpgrade(true) : sendMessage()
              }
              disabled={disableSend}
              variant={isFreeStartup ? "secondary" : "default"}
            >
              {isFreeStartup ? (
                <Lock className="w-4 h-4 mr-1" />
              ) : (
                <Send className="w-4 h-4 mr-1" />
              )}
              {isFreeStartup ? "Upgrade" : "Send"}
            </Button>

            {isFreeStartup && (
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/select-plan?role=entrepreneur")}
              >
                See Plans
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Upgrade modal */}
      {showUpgrade && (
        <UpgradePrompt
          onClose={() => setShowUpgrade(false)}
          messageCount={inbox?.length || 0}
          onUpgrade={() => {
            setShowUpgrade(false);
            navigate("/select-plan?role=entrepreneur");
          }}
        />
      )}
    </>
  );
}
