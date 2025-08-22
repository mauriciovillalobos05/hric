// src/pages/EmailConfirmationSent.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function EmailConfirmationSent() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/"); // Redirect after 5 seconds
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <Card className="w-full max-w-md text-center shadow-xl">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-green-700">
            Confirmation Email Sent
          </CardTitle>
        </CardHeader>
        <CardContent className="text-gray-700 space-y-3">
          <p>
            A confirmation email has been sent to your email address to keep on with the process of register.
          </p>
          <p>
            Please check your inbox and confirm your email to continue.
          </p>
          <p className="text-sm text-gray-500">
            You will be redirected shortly...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
