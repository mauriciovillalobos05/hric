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
    const url = new URL(window.location.href);

    // Case 1: Hash-based tokens (email change)
    if (url.hash.includes("access_token")) {
      console.log("Detected Supabase hash-based login (e.g. email_change)");

      const hashUrl = new URL(window.location.href.replace("#", "?"));
      const access_token = hashUrl.searchParams.get("access_token");
      const refresh_token = hashUrl.searchParams.get("refresh_token");
      const type = hashUrl.searchParams.get("type");

      if (!access_token || !refresh_token) return;

      supabase.auth
        .setSession({ access_token, refresh_token })
        .then(async ({ error }) => {
          if (error) {
            console.error("Failed to set session:", error.message);
            return;
          }

          const {
            data: { user },
            error: userError,
          } = await supabase.auth.getUser();
          if (userError || !user) return;

          if (type === "email_change") {
            // Handle email change
            await supabase
              .from("user")
              .update({ email: user.email })
              .eq("id", user.id);
            navigate("/profile-settings", {
              state: { emailChangeSuccess: true },
            });
          } else {
            // Determine if the user is new (i.e., hasn't onboarded yet)
            const { data: dbUser, error: fetchError } = await supabase
              .from("user")
              .select("role")
              .eq("id", user.id)
              .maybeSingle();

            const userMetadataRole = user.user_metadata?.role;

            if (!dbUser?.role && userMetadataRole) {
              console.log(
                "Detected new user (no role in DB yet). Routing to onboarding."
              );
              navigate("/onboarding");
            } else {
              console.log("User has onboarded. Routing to dashboard.");
              navigate(
                dbUser?.role === "investor"
                  ? "/dashboard/investor"
                  : dbUser?.role === "entrepreneur"
                  ? "/dashboard/entrepreneur"
                  : "/dashboard/user"
              );
            }
          }

          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        });
      return;
    }

    // Case 2: Query-based token (signup confirmation)
    const token = url.searchParams.get("token");
    const type = url.searchParams.get("type");
    if (token && type === "signup") {
      console.log("Detected Supabase signup token in URL");

      // Retrieve stored email from registration
      const email = sessionStorage.getItem("pending_email");
      if (!email) {
        console.warn("No pending email stored. Cannot verify signup token.");
        return;
      }

      supabase.auth
        .verifyOtp({ email, token, type: "signup" })
        .then(({ data, error }) => {
          if (error) {
            console.error("Failed to verify signup token:", error.message);
            navigate("/login");
            return;
          }

          console.log("Signup token verified, session created", data);
          navigate("/onboarding");
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          );
        });
    }

    // Case 3: Old email confirmation link
    if (url.hash.includes("message=Confirmation+link+accepted")) {
      console.log(
        "User clicked the link in old email. Prompting to check new email."
      );
      navigate("/email-pending-secondary");
      return;
    }
  }, [navigate]);

  return null;
}
