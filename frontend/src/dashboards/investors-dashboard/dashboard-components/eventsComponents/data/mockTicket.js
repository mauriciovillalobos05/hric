// data/mockTickets.js
// In real usage, this will come from Supabase `tickets` table filtered by investor_id.

export const MOCK_TICKETS = [
    {
      id: "tkt-001",
      investorId: "investor-demo",
      eventId: "oct-2025",
      tier: "vip",
      qty: 2,
      purchaseDate: "2025-08-15T18:10:00.000Z",
      code: "INV-8F2K-OCT25-VIP",
    },
    {
      id: "tkt-002",
      investorId: "investor-demo",
      eventId: "nov-2025",
      tier: "standard",
      qty: 1,
      purchaseDate: "2025-08-16T12:00:00.000Z",
      code: "INV-4M9Q-NOV25-STD",
    },
    {
      id: "tkt-003",
      investorId: "investor-demo",
      eventId: "jan-2026",
      tier: "vip",
      qty: 1,
      purchaseDate: "2025-08-17T09:20:00.000Z",
      code: "INV-VIP-JAN26-1X",
    },
  ];
  