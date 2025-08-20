// PurchaseForm.jsx
import React, { useEffect, useMemo, useState } from 'react';
export const TICKET_PRICES = { vip: 300, standard: 200, residents: 150 };

const ticketColors = {
  vip: { base: 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300 text-amber-800', selected: 'border-amber-500 bg-yellow-50' },
  standard: { base: 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300 text-gray-800', selected: 'border-gray-500 bg-gray-50' },
  residents: { base: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 text-blue-800', selected: 'border-blue-500 bg-blue-50' },
};

const PurchaseForm = ({ events, defaultEventId, onSimulatePurchase }) => {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [ticketType, setTicketType] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState({ name: false, email: false });

  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (defaultEventId) setSelectedEventId(String(defaultEventId));
  }, [defaultEventId]);

  const current = useMemo(
    () => events.find((e) => String(e.id) === String(selectedEventId)),
    [events, selectedEventId]
  );

  const nameIsFilled = name.trim().length > 0;
  const emailHasAt = email.includes('@');
  const emailHasDomain = /@.+\..+/.test(email);
  const emailValid = emailHasAt && emailHasDomain;

  const isFormFilled = Boolean(current && ticketType && quantity > 0 && nameIsFilled && emailValid);

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
    const unitPrice = Number(TICKET_PRICES[ticketType]);
    const payload = {
      eventId: String(selectedEventId),
      eventTitle: current?.title,
      eventDate: current?.date,
      ticketType,
      unitPrice,
      quantity,
      total: unitPrice * quantity,
      buyer: { name: name.trim(), email: email.trim() },
      createdAt: new Date().toISOString(),
    };
    setPendingPayload(payload);
    setReviewOpen(true);
  };

  const handleConfirmSimulatedSubmit = () => {
    // 🔁 In real usage, replace with: await supabase.from('tickets').insert(...)
    if (onSimulatePurchase && pendingPayload) onSimulatePurchase(pendingPayload);
    setReviewOpen(false);
    setPendingPayload(null);
    setSuccess(true); // show success panel
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-6">
      {success && (
        <div role="status" className="mb-6 rounded-xl border border-green-300 bg-green-50 px-6 py-5 text-center shadow">
          <h3 className="text-lg font-semibold text-green-800">Success! Your order has been recorded.</h3>
          <p className="text-green-700 mt-2 text-sm">
            You may now continue browsing and purchase additional tickets at your convenience.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedEventId('');
              setTicketType('');
              setQuantity(1);
              setName('');
              setEmail('');
              setTouched({ name: false, email: false });
              setSuccess(false);
            }}
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Continue purchasing
          </button>
        </div>
      )}

      {!success && (
        <>
          <h2 className="text-2xl font-bold text-center mb-6">Purchase Event Tickets</h2>

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
                  <option key={e.id} value={e.id}>{e.title}</option>
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
                        ticketType === type ? colors.selected : `${colors.base} hover:opacity-90`
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
                  <option key={q} value={q}>{q} Ticket{q > 1 ? 's' : ''}</option>
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
                  className={`w-full p-3 border rounded ${touched.name && !nameIsFilled ? 'border-red-300' : ''}`}
                  disabled={!current}
                />
                {touched.name && !nameIsFilled && <p className="text-xs text-red-500 mt-1">Full name is required.</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="Enter your email"
                  className={`w-full p-3 border rounded ${touched.email && !emailValid ? 'border-red-300' : ''}`}
                  disabled={!current}
                />
                {touched.email && !emailValid && <p className="text-xs text-red-500 mt-1">{emailErrorMessage()}</p>}
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

            {/* Review / Preview (Simulation) */}
            {reviewOpen && pendingPayload && (
              <div
                role="alert"
                aria-live="polite"
                className="mt-4 rounded border border-amber-300 bg-amber-50 p-5 text-amber-900"
              >
                <h3 className="text-lg font-semibold">Please review your order</h3>
                <p className="mt-1 text-sm">
                  Confirm the details below to proceed with your purchase. This is a simulation for demonstration purposes.
                </p>

                <div className="mt-4 rounded-lg bg-amber-10 p-4 text-sm text-gray-900">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-600">Event</span>
                    <span className="font-medium text-right">{pendingPayload.eventTitle}</span>
                  </div>
                  {pendingPayload.eventDate && (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-gray-600">Date</span>
                      <span className="font-medium text-right">{pendingPayload.eventDate}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-600">Ticket</span>
                    <span className="font-medium text-right">
                      {pendingPayload.ticketType.toUpperCase()} — ${pendingPayload.unitPrice}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-gray-600">Quantity</span>
                    <span className="font-medium text-right">{pendingPayload.quantity}</span>
                  </div>
                  <div className="mt-3 h-px bg-amber-100" />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-semibold">Order Total</span>
                    <span className="font-semibold">${pendingPayload.total}</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Buyer: {pendingPayload.buyer.name} ({pendingPayload.buyer.email})
                  </div>
                </div>

                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer select-none text-amber-800">View raw payload</summary>
                  <pre className="mt-2 overflow-auto rounded bg-white p-2 border border-amber-200">
                    {JSON.stringify(pendingPayload, null, 2)}
                  </pre>
                </details>

                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmSimulatedSubmit}
                    className="flex-1 rounded bg-amber-600 px-4 py-2 text-white hover:bg-amber-700"
                  >
                    Confirm Purchase
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewOpen(false)}
                    className="flex-1 rounded border border-amber-300 px-4 py-2 hover:bg-amber-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PurchaseForm;
