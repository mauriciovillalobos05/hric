// Dummy messages + helpers for the Messages tab

const now = Date.now();
const t = (minsAgo) => new Date(now - minsAgo * 60 * 1000).toISOString();

export const mockMessages = [
  { id: "m-001", sender: "Investor JP", preview: "Interested in your KPIs — can we set up a call?", time: "10:14", read: false, created_at: t(45) },
  { id: "m-002", sender: "Ana (HRIC)", preview: "Event reminder for Thu: doors at 6:30.", time: "09:21", read: true, created_at: t(120) },
  { id: "m-003", sender: "María Gómez (ALLVP)", preview: "Loved the deck. What’s current MRR and churn?", time: "Yesterday", read: false, created_at: t(60 * 26) },
  { id: "m-004", sender: "Sam • Aster Capital", preview: "We typically lead Seed–A. Would that fit?", time: "Mon", read: true, created_at: t(60 * 24 * 2 + 10) },
  { id: "m-005", sender: "Clara @ FinRise", preview: "Quick follow-up on your data room access.", time: "Sun", read: true, created_at: t(60 * 24 * 3 + 5) },
];

export const mockOpenChats = [
  {
    sender: "Investor JP",
    history: [
      { sender: "Investor JP", content: "Hey! Really liked your traction slide. Are you free this week?", time: "10:14" },
      { sender: "You", content: "Thanks! Wed/Thu afternoon works — want to pick a slot?", time: "10:17" },
    ],
  },
];

export const buildChatFromMessage = (msg) => ({
  sender: msg.sender,
  history: [
    {
      sender: msg.sender,
      content: msg.preview || msg.content || "…",
      time:
        msg.time ||
        new Date(msg.created_at || Date.now()).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
  ],
});