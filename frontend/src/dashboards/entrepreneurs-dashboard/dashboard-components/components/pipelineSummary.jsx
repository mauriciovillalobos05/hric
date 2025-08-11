import React from "react";
import { Send, Star, Calendar, Search, FileText } from "lucide-react";

function PipelineSummary({ data }) {
  const stages = [
    {
      label: "Contacted",
      value: data.contacted,
      icon: <Send className="h-5 w-5 text-blue-500" />,
    },
    {
      label: "Interested",
      value: data.interested,
      icon: <Star className="h-5 w-5 text-yellow-500" />,
    },
    {
      label: "Scheduled Call",
      value: data.scheduled,
      icon: <Calendar className="h-5 w-5 text-green-500" />,
    },
    {
      label: "Due Diligence",
      value: data.diligence,
      icon: <Search className="h-5 w-5 text-purple-500" />,
    },
    {
      label: "Term Sheet",
      value: data.termSheet,
      icon: <FileText className="h-5 w-5 text-red-500" />,
    },
  ];

  return (
    <>
      <section className="bg-white rounded-lg shadow-sm p-6 mt-0">
        <h1 className="text-lg font-semibold mb-2">
          Investor Pipeline Summary
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          {stages.map((stage) => (
            <div key={stage.label} className="flex items-center space-x-3">
              {stage.icon}
              <div>
                <p className="text-sm text-gray-500">{stage.label}</p>
                <p className="text-lg font-semibold text-gray-800">
                  {stage.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export default PipelineSummary;
