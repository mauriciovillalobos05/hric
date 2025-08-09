import React from "react";
import { Button } from "@/components/ui/button";
import { CalendarDays } from "lucide-react";

export default function EventList({ events = [], role = "investor", onRegisterClick }) {
  const upcomingEvents = events.filter(e => new Date(e.date) > new Date());
  if (upcomingEvents.length === 0) return null;

  return (
    <section className="bg-white border rounded-lg shadow-sm p-6 mt-6">
      <h2 className="text-lg font-semibold mb-4">
        {role === "investor" ? "Upcoming Events" : "Upcoming Pitch Opportunities"}
      </h2>

      <div className="space-y-4">
        {upcomingEvents.map(event => (
          <div
            key={event.id}
            className="border rounded-md p-4 flex flex-col md:flex-row justify-between items-start md:items-center"
          >
            <div>
              <h3 className="text-md font-bold text-gray-800">{event.title}</h3>
              <p className="text-sm text-gray-600">
                <CalendarDays className="inline-block w-4 h-4 mr-1" />
                {new Date(event.date).toLocaleString()}
              </p>
            </div>

            <div className="mt-2 md:mt-0">
              {event.registration_status === "registered" ? (
                <Button size="sm">
                  {role === "investor" ? "Join Event" : "Join Pitch"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRegisterClick?.(event)}
                >
                  {role === "investor" ? "Register" : "Apply to Pitch"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
