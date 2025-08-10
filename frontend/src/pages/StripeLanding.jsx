import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function StripeLanding() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  useEffect(() => {
    (async () => {
      // Only act on success
      const isSuccess = params.get("stripe") === "success";
      // Find role from metadata/session; default entrepreneur
      let role = "entrepreneur";
      try {
        const { data: { user } } = await supabase.auth.getUser();
        role = user?.user_metadata?.role || sessionStorage.getItem("registrationRole") || "entrepreneur";
      } catch (_) {}
      if (isSuccess) {
        navigate(`/complete-profile/${role}`, { replace: true });
      } else {
        navigate("/onboarding", { replace: true });
      }
    })();
  }, [navigate, params]);

  return null;
}