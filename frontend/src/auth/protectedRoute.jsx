// src/auth/protectedRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

async function fetchEnterpriseType(userId) {
  // same shape as your Login logic
  const { data: memberships, error } = await supabase
    .from("enterprise_user")
    .select(`
      role,
      is_active,
      enterprise:enterprise_id (
        id,
        enterprise_type
      )
    `)
    .eq("user_id", userId);

  if (error) throw error;

  // Prefer active owner; fallback to the first active membership with enterprise
  const active = (memberships || []).filter(m => m.is_active && m.enterprise);
  const owner = active.find(m => m.role === "owner");
  const chosen = owner || active[0];

  return chosen?.enterprise?.enterprise_type || null; // "investor" | "startup" | null
}

export default function ProtectedRoute({
  children,
  redirectPath = "/login",
  isAllowed,                 // legacy: extra predicate
  requiredEnterpriseTypes,   // NEW: e.g. ["investor"] | ["startup"]
}) {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState(null);
  const [enterpriseType, setEnterpriseType] = useState(
    typeof window !== "undefined" ? sessionStorage.getItem("enterpriseType") : null
  );

  useEffect(() => {
    if (DEMO_MODE) {
      setChecking(false);
      return;
    }

    let unsub;
    const load = async (sess) => {
      setSession(sess);

      // Only fetch enterpriseType if a specific type is required and we don't have it cached
      if (sess?.user && requiredEnterpriseTypes && !enterpriseType) {
        try {
          const et = await fetchEnterpriseType(sess.user.id);
          setEnterpriseType(et);
          if (typeof window !== "undefined") {
            sessionStorage.setItem("enterpriseType", et || "");
          }
        } catch (e) {
          console.error("Failed to fetch enterpriseType", e);
        }
      }

      setChecking(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => load(session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => load(s));
    unsub = data?.subscription;

    return () => unsub?.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requiredEnterpriseTypes]); // re-check if gate changes

  if (checking) return null;
  if (DEMO_MODE) return children ?? <Outlet />;

  const signedIn = !!session?.user;

  // Enterprise-type gate
  const enterpriseTypeOk = requiredEnterpriseTypes
    ? requiredEnterpriseTypes.includes(
        (enterpriseType || sessionStorage.getItem("enterpriseType") || "").toLowerCase()
      )
    : true;

  const allowed = signedIn && enterpriseTypeOk && (isAllowed ?? true);

  return allowed ? (children ?? <Outlet />) : <Navigate to={redirectPath} replace />;
}
