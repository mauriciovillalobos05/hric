import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { AuthBridge } from "@/helpers/authBridge";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const USE_SUPABASE_SIGNUP = false; // keep enabled, but always persist to sessionStorage

const API_BASE = USE_SUPABASE_SIGNUP
  ? (import.meta.env.VITE_API_URL?.replace(/\/$/, "") || `${window.location.protocol}//${window.location.hostname}:5173`)
  : "";

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const defaultRole = queryParams.get("role");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState(defaultRole || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function seedRegisterComplete({ supabase_id }) {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register-complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          supabase_id,
          email,
          first_name: firstName,
          last_name: lastName,
          phone,
          role,
        }),
      });
      if (!res.ok && res.status !== 409)
        console.warn(
          "register-complete warning:",
          res.status,
          await res.text().catch(() => "")
        );
    } catch (e) {
      console.warn("register-complete call failed:", e);
    }
  }

  async function localRegisterAndProceed() {
    // Save to session for dev/local flow
    AuthBridge.setSessionUser(email, {
      firstName,
      lastName,
      phone,
      role,
      password,
      entrepreneurProfile: { name: `${firstName} ${lastName}`.trim()},
      investorProfile: { name: `${firstName} ${lastName}`.trim() },
    });
    AuthBridge.setAuthSession(email, { provider: "local" });
    sessionStorage.setItem("registrationRole", role);
    sessionStorage.setItem("registrationData", JSON.stringify({ email, role }));
    navigate("/onboarding");
  }

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const cleanEmail = (email || "").trim();
    const cleanPassword = (password || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    if (!role) {
      setError("Please select a role.");
      setLoading(false);
      return;
    }
    if (phone && !isValidPhoneNumber(phone)) {
      setError("Please enter a valid phone number.");
      setLoading(false);
      return;
    }

    try {
      if (!USE_SUPABASE_SIGNUP) return localRegisterAndProceed();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          data: { first_name: firstName, last_name: lastName, phone, role },
        },
      });
      if (signUpError) throw signUpError;

      // Write-through to session for immediate dashboard usage
      AuthBridge.setSessionUser(email, {
        firstName,
        lastName,
        phone,
        role,
        password,
        entrepreneurProfile: {},
        investorProfile: {},
      });
      AuthBridge.setAuthSession(email, {
        provider: "supabase",
        user_id: data?.user?.id,
      });

      // Backend seed
      const supabaseId = data?.user?.id;
      if (supabaseId) seedRegisterComplete({ supabase_id: supabaseId });

      // Role for Onboarding fallback
      sessionStorage.setItem("registrationRole", role);
      sessionStorage.setItem(
        "registrationData",
        JSON.stringify({ email, role })
      );

      if (USE_SUPABASE_SIGNUP) {
        navigate("/confirm-email");
      } else {
        navigate("/onboarding");
      }

    } catch (err) {
      console.error(err);
      // Fallback to local-only register to keep UX flowing during dev
      await localRegisterAndProceed();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center">
          <Badge className="bg-blue-100 text-blue-800 mb-2">
            Create Your HRIC Account
          </Badge>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Register
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="flex space-x-2">
              <div className="w-1/2">
                <label className="block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <Input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="w-1/2">
                <label className="block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <Input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <PhoneInput
                international
                defaultCountry="US"
                value={phone}
                onChange={setPhone}
                className="border rounded px-3 py-2 w-full text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                We’ll use this for login or contact if needed
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {!defaultRole && (
              <div>
                <label
                  htmlFor="role"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Select Role
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="" disabled>
                    Select a role
                  </option>
                  <option value="investor">Investor</option>
                  <option value="entrepreneur">Entrepreneur</option>
                </select>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Register"
              )}
            </Button>
          </form>

          <p className="text-sm text-center text-gray-600 mt-6">
            Already have an account?{" "}
            <button
              onClick={() => navigate("/login")}
              className="text-blue-600 hover:underline"
            >
              Log in
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
