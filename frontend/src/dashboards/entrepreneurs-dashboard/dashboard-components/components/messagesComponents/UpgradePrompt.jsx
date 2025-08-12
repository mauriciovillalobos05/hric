// src/dashboards/.../messagesComponents/UpgradePrompt.jsx
import React from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, X } from "lucide-react";

export default function UpgradePrompt({ onClose, onUpgrade, messageCount = 0 }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[100] grid place-items-center p-4">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <span className="font-semibold">Unlock Your Messages</span>
          </div>
          <button className="p-1 rounded hover:bg-gray-100" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-700">
            You have <b>{messageCount}</b> messages from verified investors waiting for you.
          </p>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>✓ See who messaged you</li>
            <li>✓ Read full content</li>
            <li>✓ Access investor contact details</li>
            <li>✓ Reply instantly</li>
          </ul>

          <div className="rounded-md bg-blue-50 border border-blue-100 p-3 text-sm">
            <b>Startup Premium — $75/month</b>
            <div>Full access to investor communications</div>
          </div>
        </div>

        <div className="p-4 border-t flex gap-2 justify-end">
          <Button onClick={onUpgrade} className="min-w-[140px]">
            Upgrade Now
          </Button>
          <Button variant="outline" onClick={onClose}>
            Maybe Later
          </Button>
        </div>
      </div>
    </div>
  );
}