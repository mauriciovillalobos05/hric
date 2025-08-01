import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function EmailPendingSecondary() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-gray-800">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">First Confirmation Received</h1>
        <p>
          You have confirmed from your old email. Please check your new email now and confirm it to complete the process.
        </p>
        <Button onClick={() => navigate("/")}>Return to Home</Button>
      </div>
    </div>
  );
}
