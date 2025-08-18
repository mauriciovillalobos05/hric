import React from "react";
import { Calendar, CreditCard, CheckCircle, BarChart3 } from "lucide-react";

const NavigationTabs = ({ activeTab, onChange }) => {
  const tabs = [
    { id: "events", label: "Events", icon: Calendar },
    { id: "purchase", label: "Purchase", icon: CreditCard },
    /*{ id: "validate", label: "Validate", icon: CheckCircle },*/
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="w-full flex justify-center">
      <div className="flex flex-wrap gap-2 bg-muted rounded-lg p-[3px] shadow">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;

          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition text-sm
                ${isActive ? "bg-blue-600 text-white shadow" : "text-gray-700 hover:bg-gray-100"}`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default NavigationTabs;
