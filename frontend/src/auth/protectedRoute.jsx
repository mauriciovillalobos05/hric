import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

function ProtectedRoute({ children, redirectPath = "/login", isAllowed }) {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (DEMO_MODE) {
      setChecking(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setChecking(false);
    });
  }, []);

  if (checking) return null;

  if (DEMO_MODE) return children ?? <Outlet />; // <-- bypass guard entirely

  // For real auth:
  const signedInAndConfirmed = !!session?.user?.email_confirmed_at;
  const allowed = signedInAndConfirmed && (isAllowed ?? true);

  return allowed ? (children ?? <Outlet />) : <Navigate to={redirectPath} replace />;
}

export default ProtectedRoute;
