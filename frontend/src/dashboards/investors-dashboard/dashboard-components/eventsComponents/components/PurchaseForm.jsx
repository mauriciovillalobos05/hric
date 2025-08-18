import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, MapPin, Users, Star, Award } from 'lucide-react';

// Centralized ticket prices (global, event-agnostic)
export const TICKET_PRICES = {
  vip: 300,
  standard: 200,
  residents: 150,
};

// Shared ticket colors (aligned with VipStandardComparison + EventCard)
// VIP = amber, Standard = gray, Residents = blue
const ticketColors = {
  vip: {
    base: 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300 text-amber-800',
    selected: 'border-amber-500 bg-yellow-50',
  },
  standard: {
    base: 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300 text-gray-800',
    selected: 'border-gray-500 bg-gray-50',
  },
  residents: {
    base: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 text-blue-800',
    selected: 'border-blue-500 bg-blue-50',
  },
};

// PurchaseForm — pure JavaScript (no TypeScript syntax)
const PurchaseForm = ({ events, defaultEventId }) => {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [ticketType, setTicketType] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState({ name: false, email: false });

  // Review / submission simulation state
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [submitNote, setSubmitNote] = useState('');

  // ⬇ when defaultEventId changes (from card click), update the select
  useEffect(() => {
    if (defaultEventId) setSelectedEventId(String(defaultEventId));
  }, [defaultEventId]);

  const current = useMemo(
    () => events.find((e) => String(e.id) === String(selectedEventId)),
    [events, selectedEventId]
  );

  // Validation helpers
  const nameIsFilled = name.trim().length > 0;
  const emailHasAt = email.includes('@');
  const emailHasDomain = /@.+\..+/.test(email);
  const emailValid = emailHasAt && emailHasDomain;

  const isFormFilled = Boolean(
    current && ticketType && quantity > 0 && nameIsFilled && emailValid
  );

  const submitDisabledReason = useMemo(() => {
    if (!current) return 'Select an event to continue';
    if (!ticketType) return 'Choose a ticket type';
    if (!nameIsFilled) return 'Enter your full name';
    if (!emailValid) return 'Enter a valid email address';
    return undefined;
  }, [current, ticketType, nameIsFilled, emailValid]);

  const emailErrorMessage = () => {
    if (!emailHasAt) return 'Email must include the “@” symbol.';
    if (!emailHasDomain) return 'Email must include a valid domain (e.g., example.com).';
    return '';
  };

  const handleSubmitPreview = () => {
    if (!isFormFilled || !current) return;
    const unitPrice = Number(TICKET_PRICES[ticketType]); // fixed, event-agnostic
    const payload = {
      eventId: String(selectedEventId),
      eventTitle: current ? current.title : undefined,
      eventDate: current ? current.date : undefined,
      ticketType,
      unitPrice,
      quantity,
      total: unitPrice * quantity,
      buyer: { name: name.trim(), email: email.trim() },
      createdAt: new Date().toISOString(),
    };
    setPendingPayload(payload);
    setReviewOpen(true);
    setSubmitNote('');
  };

  const handleConfirmSimulatedSubmit = () => {
    // ⬇️ Replace this with your Supabase insert call
    // e.g., await supabase.from('orders').insert(pendingPayload)
    console.log('Simulated submit → would send to Supabase:', pendingPayload);
    setReviewOpen(false);
    setSubmitNote('Order captured locally (simulation). Replace with Supabase insert.');
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-6">
      <h2 className="text-2xl font-bold text-center mb-6">Purchase Event Tickets</h2>

      {/* Success / info note after simulated submit */}
      {submitNote && (
        <div
          role="status"
          className="mb-4 rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {submitNote}
        </div>
      )}

      <div className="space-y-6">
        {/* Select Event */}
        <div>
          <label className="block text-sm font-semibold mb-2">Select Event</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full p-3 border rounded"
          >
            <option value="">Choose an event...</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </div>

        {/* Ticket Type */}
        <div>
          <label className="block text-sm font-semibold mb-2">Ticket Type</label>
          <div className="grid grid-cols-3 gap-3">
            {['vip', 'standard', 'residents'].map((type) => {
              const colors = ticketColors[type];
              return (
                <button
                  key={type}
                  onClick={() => setTicketType(type)}
                  type="button"
                  className={`p-4 border-2 rounded transition ${
                    ticketType === type
                      ? colors.selected
                      : `${colors.base} hover:opacity-90`
                  } ${!current ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={!current}
                  aria-pressed={ticketType === type}
                >
                  <div className="font-semibold capitalize">{type}</div>
                  <div>${TICKET_PRICES[type]}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-semibold mb-2">Quantity</label>
          <select
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
            className="w-full p-3 border rounded"
            disabled={!current}
          >
            {[1, 2, 3, 4, 5].map((q) => (
              <option key={q} value={q}>
                {q} Ticket{q > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Buyer Info */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              placeholder="Enter your full name"
              className={`w-full p-3 border rounded ${
                touched.name && !nameIsFilled ? 'border-red-300' : ''
              }`}
              disabled={!current}
            />
            {touched.name && !nameIsFilled && (
              <p className="text-xs text-red-500 mt-1">Full name is required.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              placeholder="Enter your email"
              className={`w-full p-3 border rounded ${
                touched.email && !emailValid ? 'border-red-300' : ''
              }`}
              disabled={!current}
            />
            {touched.email && !emailValid && (
              <p className="text-xs text-red-500 mt-1">{emailErrorMessage()}</p>
            )}
          </div>
        </div>

        {/* Payment Placeholder */}
        <div>
          <label className="block text-sm font-semibold mb-2">Payment</label>
          <div className="p-4 border rounded bg-gray-50 text-gray-500 text-center">
            Payment form will go here
          </div>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={() => {
          if (!isFormFilled || !current) return;
          // If the review panel is already open, treat this as the final confirm
          if (reviewOpen && pendingPayload) {
            handleConfirmSimulatedSubmit();
          } else {
            handleSubmitPreview();
          }
        }}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
          disabled={!isFormFilled}
          title={submitDisabledReason}
          aria-disabled={!isFormFilled}
        >
          Complete Purchase
        </button>

        {/* Review Warning / Preview (Simulated) */}
        {reviewOpen && pendingPayload && (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-4 rounded border border-amber-300 bg-amber-50 p-4 text-amber-900"
          >
            <div className="flex items-start gap-3">
              <div className="text-xl">⚠️</div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Review your order (simulation)</h3>
                <ul className="text-sm list-disc ml-5 space-y-1">
                  <li><span className="font-medium">Event:</span> {pendingPayload.eventTitle}</li>
                  {pendingPayload.eventDate && (
                    <li><span className="font-medium">Date:</span> {pendingPayload.eventDate}</li>
                  )}
                  <li><span className="font-medium">Ticket:</span> {pendingPayload.ticketType.toUpperCase()} — ${pendingPayload.unitPrice}</li>
                  <li><span className="font-medium">Quantity:</span> {pendingPayload.quantity}</li>
                  <li><span className="font-medium">Total:</span> ${pendingPayload.total}</li>
                  <li><span className="font-medium">Buyer:</span> {pendingPayload.buyer.name} ({pendingPayload.buyer.email})</li>
                </ul>

                {/* Dev-friendly JSON peek */}
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer select-none">View raw payload</summary>
                  <pre className="mt-2 overflow-auto rounded bg-white p-2 border">{JSON.stringify(pendingPayload, null, 2)}</pre>
                </details>

                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmSimulatedSubmit}
                    className="flex-1 rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-700"
                  >
                    Confirm (simulate submit)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewOpen(false)}
                    className="flex-1 rounded border border-amber-300 px-4 py-2 hover:bg-amber-100"
                  >
                    Cancel
                  </button>
                </div>

                <p className="mt-2 text-xs text-amber-700">
                  This is a preview only. Replace <code>handleConfirmSimulatedSubmit()</code> with your Supabase insert.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default PurchaseForm;