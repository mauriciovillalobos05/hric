import React from 'react';
import { Calendar, Clock, MapPin, Users, Star, Award } from 'lucide-react';

const EventCard = ({ event, onClick }) => {
  const soldPct =
    event.capacity.total > 0
      ? Math.round((event.capacity.sold / event.capacity.total) * 100)
      : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
      className="bg-white rounded-2xl shadow-lg flex flex-col justify-between h-full border border-gray-400 hover:shadow-xl transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600"
    >
      <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col justify-between h-full border border-gray-100 hover:shadow-xl transition">
        {/* Top content */}
        <div>
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-extrabold text-gray-800">{event.title}</h3>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold text-center break-words leading-tight
              ${
                event.capacity.available > 50
                  ? 'bg-green-100 text-green-700'
                  : event.capacity.available > 20
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
              }`}
              style={{ minWidth: 'fit-content', maxWidth: '100%' }}
            >
              {event.capacity.available} Available
            </span>
          </div>

          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-gray-500" /> {event.date}
            </div>
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-2 text-gray-500" /> {event.time}
            </div>
            <div className="flex items-center">
              <MapPin className="w-4 h-4 mr-2 text-gray-500" /> {event.venue}
            </div>
            <div className="flex items-center">
              <Users className="w-4 h-4 mr-2 text-gray-500" /> {event.capacity.total} Total • {event.capacity.sold} Sold
            </div>
            <div className="flex items-center">
              <Star className="w-4 h-4 mr-2 text-gray-500" /> {event.featured}
            </div>
            <div className="flex items-center">
              <Award className="w-4 h-4 mr-2 text-gray-500" /> {event.special}
            </div>
          </div>
        </div>

        {/* Bottom section */}
        <div className="mt-5">
          {/* Pricing grid with gradients */}
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <div className="rounded-lg p-2 bg-gradient-to-br from-yellow-50 to-amber-100 border border-amber-300">
              <p className="text-xs font-semibold text-amber-800">VIP</p>
              <p className="font-bold text-amber-700">${event.pricing.vip}</p>
            </div>
            <div className="rounded-lg p-2 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-300">
              <p className="text-xs font-semibold text-gray-800">Standard</p>
              <p className="font-bold text-gray-700">${event.pricing.standard}</p>
            </div>
            <div className="rounded-lg p-2 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-300">
              <p className="text-xs font-semibold text-blue-800">Residents</p>
              <p className="font-bold text-blue-700">${event.pricing.residents}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-2 bg-blue-600 transition-all duration-300"
              style={{ width: `${soldPct}%` }}
            />
          </div>
          <p className="text-[11px] mt-1 text-center text-gray-600">{soldPct}% Sold</p>
        </div>
      </div>
    </div>
  );
};

export default EventCard;
