import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react';

const TicketValidator = () => {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);

  const handleValidate = () => {
    // Static mock validation
    if (code === 'HRIC-DEMO123') {
      setResult({ valid: true, ticket: { event: 'Demo Event', type: 'VIP', holder: 'Demo User' } });
    } else {
      setResult({ valid: false, error: 'Invalid access code' });
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-6">
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter access code" className="w-full p-3 border rounded" />
      <button onClick={handleValidate} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded">Validate</button>

      {result && result.valid && <div className="mt-4 text-green-700"><CheckCircle className="inline w-5 h-5 mr-2" />Valid Ticket</div>}
      {result && !result.valid && <div className="mt-4 text-red-700">{result.error}</div>}
    </div>
  );
};

export default TicketValidator;
