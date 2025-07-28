// src/pages/ConfirmEmail.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function ConfirmEmail() {
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // User is authenticated (email confirmed)
        navigate("/");
      } else {
        setChecking(false); // Show waiting message
      }
    };

    checkAuth();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold mb-2">Check Your Email</h1>
        <p className="text-gray-600 mb-4">
          We've sent a confirmation link to your email address. Please click the link to verify your account.
        </p>
        {checking ? (
          <p className="text-sm text-blue-600 animate-pulse">Waiting for confirmation...</p>
        ) : (
          <p className="text-sm text-gray-500">
            Once you confirm your email, you'll be redirected automatically.
          </p>
        )}
      </div>
    </div>
  );
}
