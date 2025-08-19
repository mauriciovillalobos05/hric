// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { AuthBridge } from "@/helpers/authBridge";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);


const USE_SUPABASE_AUTH = true; 

const API_BASE = USE_SUPABASE_AUTH
  ? (import.meta.env.VITE_API_URL?.replace(/\/$/, "") || `${window.location.protocol}//${window.location.hostname}:5173`)
  : "";
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function localLoginFallback() {
    const users = AuthBridge.ssRead(AuthBridge.STORAGE_KEYS.USERS);
    const u = users[email];
    if (!u || (u.password && u.password !== password))
      throw new Error("Invalid credentials");
    AuthBridge.setAuthSession(email, { source: "local" });
    const role = (u.role || "entrepreneur").toLowerCase();
    navigate(
      role.includes("investor")
        ? "/dashboard/investor"
        : "/dashboard/entrepreneur"
    );
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    if (!USE_SUPABASE_AUTH)
      return localLoginFallback().catch((err) => setError(err.message));

    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      { email, password }
    );
    if (signInError) {
      // fallback to local session login if present
      return localLoginFallback().catch(() => setError(signInError.message));
    }

    const accessToken = data?.session?.access_token;
    const user = data?.user;
    if (!accessToken || !user) {
      setError("Login failed: no session returned.");
      return;
    }

    try {
      // optional backend pings
      fetch(`${API_BASE}/api/auth/after-login`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => {});
      const meRes = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const me = meRes.ok ? await meRes.json() : {};

      // persist to sessionStorage for dashboard hydration
      const meta = user.user_metadata || {};
      const fullName = `${meta.first_name || ""} ${
        meta.last_name || ""
      }`.trim();
      AuthBridge.setSessionUser(email, {
        supabaseId: user.id,
        firstName: meta.first_name,
        lastName: meta.last_name,
        fullName,
        phone: meta.phone,
        role:
          meta.role || me?.memberships?.[0]?.enterprise_type || "entrepreneur",
        investorProfile: {},
        entrepreneurProfile: {},
      });
      AuthBridge.setAuthSession(email, {
        provider: "supabase",
        user_id: user.id,
      });

      // route resolution (preserve existing logic)
      const owner = (me.memberships || []).find(
        (m) => m.role === "owner" && m.is_active
      );
      const enterpriseType =
        owner?.enterprise?.enterprise_type || owner?.enterprise_type;
      const metaRole = meta.role || meta.plan;
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
              <label className="block mb-1 text-sm text-gray-700">
                Password
              </label>
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
