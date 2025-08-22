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
import { getSessionContactMeta, buildInvestorMetaMap } from "@/lib/investorMeta";
import mockInvestors from "../matchComponents/mockInvestors.js";
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
    // Build an investor meta map: name -> { id, name, thesis, type }
  const baseMetaMap = useMemo(() => buildInvestorMetaMap(mockInvestors), []);
  const sessionContact = useMemo(() => getSessionContactMeta(), []);
  const investorMetaMap = useMemo(() => {
    // Merge session contact (if any) so new contacts also show thesis immediately
    if (sessionContact?.name) {
      return {
        ...baseMetaMap,
        [sessionContact.name]: {
          id: sessionContact.id ?? baseMetaMap[sessionContact.name]?.id ?? null,
          name: sessionContact.name,
          thesis: sessionContact.thesis ?? baseMetaMap[sessionContact.name]?.thesis ?? "",
          type: sessionContact.type ?? baseMetaMap[sessionContact.name]?.type ?? "",
        },
      };
    }
    return baseMetaMap;
  }, [baseMetaMap, sessionContact]);

  const getThesisFor = (name) => {
    if (!name) return "";
    const meta = investorMetaMap[name];
    return meta?.thesis || "";
  };

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

  // Thesis for the currently selected sender (used in header)
  const selectedThesis = useMemo(() => {
    if (!selectedSender || isFreeStartup) return "";
    return getThesisFor(selectedSender);
  }, [selectedSender, isFreeStartup, investorMetaMap]);

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
  <div className="relative w-full min-h-[520px] flex items-center justify-center overflow-hidden rounded-2xl border bg-white">
    {/* soft gradient glow */}
    <div className="pointer-events-none absolute -inset-24 opacity-60 blur-2xl animate-pulse
                    bg-[radial-gradient(60rem_30rem_at_50%_-10%,theme(colors.blue.200),transparent),
                        radial-gradient(40rem_20rem_at_-10%_120%,theme(colors.purple.200),transparent),
                        radial-gradient(40rem_20rem_at_110%_120%,theme(colors.teal.200),transparent)]" />
    {/* card-ish chip */}
    <div className="relative rounded-2xl border bg-white/80 backdrop-blur px-10 py-7 shadow-xl">
      <span className="select-none text-3xl font-semibold tracking-tight text-gray-800">
        Coming soon
      </span>
    </div>
  </div>
);
}
