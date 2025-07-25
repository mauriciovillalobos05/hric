import React from "react";
import Button from "./ui/button";

function EventShowcaseAccess({ events = [] }) {
  const upcomingEvents = events.filter(event => new Date(event.date) > new Date());

  if (upcomingEvents.length === 0) return null;

  return (
    <section className="bg-white border rounded-lg shadow-sm p-6 mt-6">
      <h2 className="text-lg font-semibold mb-4">Upcoming Pitch Opportunities</h2>

      <div className="space-y-4">
        {upcomingEvents.map((event, i) => (
          <div key={i} className="border rounded-md p-4 flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h3 className="text-md font-bold text-gray-800">{event.title}</h3>
              <p className="text-sm text-gray-600">{event.type} • {new Date(event.date).toLocaleString()}</p>
            </div>

            <div className="mt-2 md:mt-0">
              {event.registration_status === "registered" ? (
                <Button size="sm">Join Event</Button>
              ) : (
                <Button size="sm" variant="outline">Apply to Pitch</Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default EventShowcaseAccess;
