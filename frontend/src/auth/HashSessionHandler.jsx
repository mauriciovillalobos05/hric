// src/auth/HashSessionHandler.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function HashSessionHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;

    if (hash.includes("access_token")) {
      console.log("Detected Supabase hash-based login (e.g. email_change)");

      // Convert # to ? so we can use URLSearchParams
      const url = new URL(window.location.href.replace("#", "?"));
      const access_token = url.searchParams.get("access_token");
      const refresh_token = url.searchParams.get("refresh_token");
      const type = url.searchParams.get("type");

      if (!access_token || !refresh_token) {
        console.error("Missing access or refresh token in URL");
        return;
      }

      // Manually set session using tokens
      supabase.auth.setSession({ access_token, refresh_token })
        .then(async ({ error }) => {
          if (error) {
            console.error("Failed to set session:", error.message);
            return;
          }

          const { data: { user }, error: userError } = await supabase.auth.getUser();
          if (userError || !user) {
            console.error("Failed to fetch user:", userError?.message);
            return;
          }

          if (type === "email_change") {
            const { error: dbError } = await supabase
              .from("user")
              .update({ email: user.email })
              .eq("id", user.id);

            if (dbError) {
              console.error("Failed to sync email:", dbError.message);
            } else {
              console.log("Email synced to DB.");
            }

            navigate("/profile-settings");
          } else {
            navigate("/dashboard/user");
          }

          // Clean up the hash
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    }
  }, [navigate]);

  return null;
}
