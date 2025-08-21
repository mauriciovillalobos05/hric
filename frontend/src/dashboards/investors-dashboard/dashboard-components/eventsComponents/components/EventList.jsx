// EventList.jsx
import React from 'react';
import EventCard from './EventCard';
import VipStandardComparison from './VipStandardComparison.jsx';

const EventList = ({ events, onEventClick, showFilters }) => {
  return (
    <div className="space-y-6">
      <VipStandardComparison />
      <div>
        <h2 className="text-2xl font-bold mb-4">Upcoming Events</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              onClick={() => onEventClick && onEventClick(ev.id)} // ⬅ call parent handler
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default EventList;
