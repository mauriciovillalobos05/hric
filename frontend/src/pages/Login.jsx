// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { connectSocketWithToken } from "@/lib/socket";

// ---- ENV ----
// Set these in Vercel/Preview/Dev:
// VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    // 1) Supabase sign-in
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      return;
    }

    const accessToken = data?.session?.access_token;
    const user = data?.user;

    if (!accessToken || !user) {
      setError("Login failed: no session returned.");
      return;
    }

    try {
      // Persist token for later app usage (reconnect sockets, API calls, etc.)
      sessionStorage.setItem("hric_token", accessToken);

      // 2) Optional: notify backend after login (last_active_at, activity logs)
      await fetch(`${API_BASE}/api/auth/after-login`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({}),
      }).catch(() => {});

      // 3) Ask backend who we are
      const meRes = await fetch(`${API_BASE}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!meRes.ok) {
        const body = await meRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch profile");
      }

      const me = await meRes.json();

      // 4) Initialize Socket.IO once we have a token
      connectSocketWithToken(accessToken);

      // 5) Decide where to go
      const owner = (me.memberships || []).find(
        (m) => m.role === "owner" && m.is_active
      );

      const enterpriseType =
        owner?.enterprise?.enterprise_type || owner?.enterprise_type;

      const metaRole = user?.user_metadata?.role || user?.user_metadata?.plan;

      let route = "/dashboard/user";
      if (enterpriseType === "investor") route = "/dashboard/investor";
      else if (enterpriseType === "startup") route = "/dashboard/entrepreneur";
      else if (typeof metaRole === "string") {
        const r = metaRole.toLowerCase();
        if (r.includes("investor")) route = "/dashboard/investor";
        else if (r.includes("entrepreneur") || r.includes("startup"))
          route = "/dashboard/entrepreneur";
      }

      navigate(route);
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not complete login.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader className="space-y-1 text-center">
          <Badge className="bg-blue-100 text-blue-800 mb-2">Welcome Back</Badge>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Sign in to HRIC
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block mb-1 text-sm text-gray-700">Email</label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-sm text-gray-700">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="w-full text-white bg-blue-600 hover:bg-blue-700"
            >
              Log In
            </Button>
          </form>
          <p className="mt-4 text-sm text-center text-gray-600">
            Don&apos;t have an account?{" "}
            <span
              onClick={() => navigate("/register")}
              className="text-blue-600 hover:underline cursor-pointer"
            >
              Register here
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default Login;