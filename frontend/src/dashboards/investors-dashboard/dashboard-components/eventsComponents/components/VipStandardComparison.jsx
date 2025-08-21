import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle } from "lucide-react";

const ticketComparison = {
  vip: {
    title: "VIP Experience",
    subtitle: "Premium Access",
    price: 300,
    color: "bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300",
    accent: "text-amber-800", // VIP amber for text & icons
    features: [
      { title: "Front Row Seating", desc: "Best view of presentations", included: true },
      { title: "Exclusive Cocktail Hour", desc: "8:00–9:00 PM networking", included: true },
      { title: "Direct Shark Access", desc: "Personal introductions", included: true },
      { title: "Premium Networking", desc: "High-value connections", included: true },
      { title: "VIP Lounge Access", desc: "Exclusive area", included: true },
      { title: "Priority Q&A", desc: "First questions to speakers", included: true },
      { title: "Premium Gifts", desc: "Exclusive event merchandise", included: true },
      { title: "Photo Opportunities", desc: "With sharks and speakers", included: true },
    ],
  },
  standard: {
    title: "Standard Access",
    subtitle: "General Admission",
    price: 200,
    color: "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300",
    accent: "text-gray-800", // Standard now gray for text & icons
    features: [
      { title: "General Seating", desc: "Good view of presentations", included: true },
      { title: "Full Event Access", desc: "Complete program", included: true },
      { title: "Networking Opportunities", desc: "Connect with attendees", included: true },
      { title: "Q&A Participation", desc: "Ask questions during sessions", included: true },
      { title: "No cocktail hour access", included: false },
      { title: "No direct shark introductions", included: false },
      { title: "No VIP lounge access", included: false },
      { title: "No priority Q&A access", included: false },
    ],
  },
};

function FeatureRow({ f, accent }) {
  const yesIcon = (
    <CheckCircle2
      className={`${accent} w-5 h-5 mr-3 mt-[2px] flex-none`}
      strokeWidth={2.25}
    />
  );
  const noIcon = (
    <AlertCircle
      className="text-gray-400 w-5 h-5 mr-3 mt-[2px] flex-none"
      strokeWidth={2.25}
    />
  );

  if (f.included) {
    return (
      <li className="flex items-start text-[15px]">
        {yesIcon}
        <div>
          <span className={`font-semibold ${accent}`}>{f.title}</span>
          {f.desc && <span className="text-slate-700"> — {f.desc}</span>}
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start text-[15px] text-gray-400 line-through">
      {noIcon}
      <div>{f.title}</div>
    </li>
  );
}

const VipStandardComparison = () => {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {Object.entries(ticketComparison).map(([key, t]) => (
        <Card key={key} className={`${t.color} border-2 rounded-2xl shadow-sm`}>
          <CardHeader className="text-center">
            {/* Title now uses accent color */}
            <CardTitle className={`text-2xl font-extrabold tracking-tight ${t.accent}`}>
              {t.title}
            </CardTitle>
            {/* Price now uses accent color */}
            <div className={`mt-1 text-4xl font-extrabold ${t.accent}`}>
              ${t.price} <span className="text-xl font-bold">USD</span>
            </div>
            <div className="text-[15px] font-medium mt-1 text-slate-700">
              {t.subtitle}
            </div>
          </CardHeader>

          <CardContent>
            <ul className="space-y-3">
              {t.features.map((f, i) => (
                <FeatureRow key={i} f={f} accent={t.accent} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default VipStandardComparison;
