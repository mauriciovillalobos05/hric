import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button.jsx";

export default function Analysis() {
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef(null);

  const run = () => {
    if (running) return;
    setRunning(true);
    setProgress(0);
    timer.current = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(timer.current);
          setRunning(false);
          return 100;
        }
        return p + Math.random() * 12;
      });
    }, 250);
  };

  useEffect(() => () => clearInterval(timer.current), []);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Monte Carlo Analysis (MVP)</h1>
      <p className="text-gray-600">
        Demo run with progress. Later this page will use the Web Worker and real parameters.
      </p>

      <div className="bg-white p-6 rounded shadow">
        <div className="mb-4">
          <div className="h-2 rounded bg-gray-200">
            <div
              className="h-2 rounded bg-blue-600 transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="text-sm text-gray-600 mt-2 text-right">
            {Math.min(progress, 100).toFixed(0)}%
          </div>
        </div>
        <Button onClick={run} disabled={running}>
          {running ? "Running..." : "Run Simulation"}
        </Button>
      </div>

      {progress >= 100 && (
        <div className="bg-green-50 p-6 rounded shadow">
          <h2 className="font-semibold text-green-800 mb-2">Results (sample)</h2>
          <ul className="text-sm text-green-700 list-disc ml-5">
            <li>Expected Return: 2.8x</li>
            <li>Risk Score: Medium</li>
            <li>Loss Probability: 22%</li>
            <li>95% VaR: −35%</li>
          </ul>
        </div>
      )}
    </div>
  );
}
