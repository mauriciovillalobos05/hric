import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button.jsx";

export default function Portfolio() {
  const [items, setItems] = useState([
    { id: "neo", name: "NeoCart AI", invested: 50000, current: 82000, industry: "AI" },
    { id: "fin", name: "FinNova",    invested: 30000, current: 27000, industry: "Fintech" },
  ]);

  const metrics = useMemo(() => {
    const totalInvestment = items.reduce((s, i) => s + i.invested, 0);
    const totalCurrent    = items.reduce((s, i) => s + (i.current ?? i.invested), 0);
    const gain            = totalCurrent - totalInvestment;
    const pct             = totalInvestment ? (gain / totalInvestment) * 100 : 0;
    const industries = [...new Set(items.map(i => i.industry))].length;
    return { totalInvestment, totalCurrent, gain, pct, industries };
  }, [items]);

  const addInvestment = () => {
    setItems(prev => [
      ...prev,
      { id: crypto.randomUUID().slice(0, 6), name: "NewCo", invested: 20000, current: 24000, industry: "AI" }
    ]);
  };

  const removeInvestment = (id) => setItems(prev => prev.filter(i => i.id !== id));

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Virtual Portfolio (MVP)</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-500">Total Invested</div>
          <div className="text-xl font-bold">${metrics.totalInvestment.toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-500">Current Value</div>
          <div className="text-xl font-bold">${metrics.totalCurrent.toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-500">Total Return</div>
          <div className={`text-xl font-bold ${metrics.gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${metrics.gain.toLocaleString()} ({metrics.pct.toFixed(1)}%)
          </div>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <div className="text-sm text-gray-500">Diversification</div>
          <div className="text-xl font-bold">{metrics.industries} industries</div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={addInvestment}>Add Investment</Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Startup</th>
              <th className="text-right p-3">Invested</th>
              <th className="text-right p-3">Current</th>
              <th className="text-right p-3">Return</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(i => {
              const ret = (i.current ?? i.invested) - i.invested;
              const pct = i.invested ? (ret / i.invested) * 100 : 0;
              return (
                <tr key={i.id} className="border-t">
                  <td className="p-3">{i.name}</td>
                  <td className="p-3 text-right">${i.invested.toLocaleString()}</td>
                  <td className="p-3 text-right">${(i.current ?? i.invested).toLocaleString()}</td>
                  <td className={`p-3 text-right ${ret >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${ret.toLocaleString()} ({pct.toFixed(1)}%)
                  </td>
                  <td className="p-3 text-right">
                    <button className="text-red-600" onClick={() => removeInvestment(i.id)}>Remove</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
