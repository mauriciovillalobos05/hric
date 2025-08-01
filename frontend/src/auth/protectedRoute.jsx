import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function ProtectedRoute({ children, redirectPath = "/login", isAllowed }) {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setChecking(false);
    });
  }, []);

  if (checking) return null; // or a spinner

  // Require a signed-in, confirmed user
  const signedInAndConfirmed = !!session?.user?.email_confirmed_at;

  // If isAllowed is provided, enforce it in addition to sign-in
  const allowed = signedInAndConfirmed && (isAllowed ?? true);

  return allowed ? (children ?? <Outlet />) : <Navigate to={redirectPath} replace />;
}

export default ProtectedRoute;
