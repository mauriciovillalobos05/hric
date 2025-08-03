import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function ProtectedRoute({ children, redirectPath = "/login" }) {
  const [isAllowed, setIsAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user?.email_confirmed_at) {
        setIsAllowed(true);
      }

      setChecking(false);
    };

    checkUser();
  }, []);

  if (checking) return null;

  return isAllowed ? (children ? children : <Outlet />) : <Navigate to={redirectPath} replace />;
}

export default ProtectedRoute;
