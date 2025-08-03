import React from 'react'
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";

const EventHighlight = ({ Events }) => {
  return (
    <section className="bg-white border rounded-lg shadow-sm p-4 mt-6">
      <h2 className="text-lg font-semibold mb-3">Upcoming Events</h2>
      <div className="grid gap-4">
        {Events.map((event) => (
          <EventCard key={event.id} {...event} />
        ))}
      </div>
    </section>
  );
}

function EventCard({ title, type, date, location, registration_status }) {
  const readableDate = new Date(date).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const safeType = typeof type === "string" ? type.replace("_", " ") : "Unknown Type";

  return (
    <div className="border rounded-md p-4 flex items-center justify-between hover:shadow-md transition-shadow">
      <div>
        <h3 className="text-md font-semibold">{title}</h3>
        <p className="text-sm text-gray-600">
          <CalendarDays className="inline-block w-4 h-4 mr-1" />
          {readableDate} • {safeType} • {location || "TBD"}
        </p>
      </div>

      {registration_status === "approved" ? (
        <Button size="sm">Join</Button>
      ) : (
        <Button variant="outline" size="sm">Register</Button>
      )}
    </div>
  );
}

export default EventHighlight