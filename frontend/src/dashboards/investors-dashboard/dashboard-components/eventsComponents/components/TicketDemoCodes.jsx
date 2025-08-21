import React, { useMemo, useState } from "react";
import { MOCK_EVENTS } from "../data/mockEvents";

const PurchaseForm = ({ events = MOCK_EVENTS, defaultQuantity = 1 }) => {
const [selectedEventId, setSelectedEventId] = useState("");
const [ticketType, setTicketType] = useState("");
const [quantity, setQuantity] = useState(defaultQuantity);

const current = useMemo(() => events.find((e) => e.id === selectedEventId), [events, selectedEventId]);
const price = current?.pricing?.[ticketType] || 0;
const subtotal = price * quantity;
const impact = +(subtotal * 0.04).toFixed(2);

return (
<div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-6">
<h2 className="text-2xl font-bold text-center mb-6">Purchase Event Tickets</h2>
{/* Placeholder: Stripe Elements mount (no logic) */}

<div className="space-y-6">
    <div>
      <label className="block text-sm font-semibold mb-2">Select Event</label>
      <select
        value={selectedEventId}
        onChange={(e) => setSelectedEventId(e.target.value)}
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Choose an event...</option>
        {events.filter((e) => e.capacity.available > 0).map((e) => (
          <option key={e.id} value={e.id}>
            {e.title} — {e.date}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label className="block text-sm font-semibold mb-2">Ticket Type</label>
      <div className="grid grid-cols-3 gap-3">
        {["vip", "standard", "residents"].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setTicketType(type)}
            className={`p-4 border-2 rounded-lg text-center transition ${
              ticketType === type ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <div className="font-semibold capitalize">{type}</div>
            <div className="text-lg font-bold text-blue-600">
              ${selectedEventId ? current?.pricing?.[type] : "--"}
            </div>
          </button>
        ))}
      </div>
    </div>

    <div>
      <label className="block text-sm font-semibold mb-2">Quantity</label>
      <select
        value={quantity}
        onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      >
        {[1, 2, 3, 4, 5].map((q) => (
          <option key={q} value={q}>
            {q} Ticket{q > 1 ? "s" : ""}
          </option>
        ))}
      </select>
    </div>

    {selectedEventId && ticketType && (
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Purchase Summary</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span>Ticket Price:</span><span>${price}</span></div>
          <div className="flex justify-between"><span>Quantity:</span><span>{quantity}</span></div>
          <div className="flex justify-between font-semibold"><span>Subtotal:</span><span>${subtotal}</span></div>
          <div className="flex justify-between text-green-700"><span>Social Impact (4%):</span><span>${impact}</span></div>
          <div className="border-t pt-2 flex justify-between text-lg font-bold"><span>Total:</span><span>${subtotal}</span></div>
        </div>
      </div>
    )}

    <button
      type="button"
      disabled={!selectedEventId || !ticketType}
      className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
    >
      Proceed to Payment
    </button>
  </div>
</div>
);
};
export default PurchaseForm;


