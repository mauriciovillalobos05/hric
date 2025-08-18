export const API_BASE = ""; // e.g., process.env.REACT_APP_API_URL
export const STRIPE_PUBLISHABLE_KEY = ""; // e.g., pk_live_xxx
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

// File: src/data/mockEvents.js
// Brief: Static mock events for UI structure (no fetching).
export const MOCK_EVENTS = [
{
id: "oct-2025",
title: "Innovation & Investment Launch",
date: "October 9, 2025",
time: "6:00 PM – 8:00 PM",
venue: "Hyatt Andares, Guadalajara",
featured: "5 Sharks, Roberto Arechederra, Startup Presentations",
special: "VIP Cocktail Hour, Networking, Social Impact Showcase",
capacity: { total: 100, sold: 23, available: 77 },
pricing: { vip: 300, standard: 200, residents: 150 },
},
{
id: "nov-2025",
title: "Tech Entrepreneurs Summit",
date: "November 13, 2025",
time: "6:00 PM – 8:00 PM",
venue: "Hyatt Andares, Guadalajara",
featured: "Government Officials, Tech Leaders, Innovation Showcase",
special: "International Investors, AI Demonstrations",
capacity: { total: 100, sold: 18, available: 82 },
pricing: { vip: 300, standard: 200, residents: 150 },
},
{
id: "dec-2025",
title: "Year-End Celebration",
date: "December 4, 2025",
time: "6:00 PM – 8:00 PM",
venue: "Hyatt Andares, Guadalajara",
featured: "Awards Ceremony, Success Stories, Impact Report",
special: "Jóvenes Emprendedores Showcase, Premium Networking",
capacity: { total: 100, sold: 31, available: 69 },
pricing: { vip: 300, standard: 200, residents: 150 },
},
];