// src/pages/Register.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { isValidPhoneNumber } from "react-phone-number-input";

// --- Minimal sessionStorage helpers ---
const KEYS = {
  USERS: "hri:users",
  SESSION: "hri:authSession",
};

const read = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const write = (key, value) => {
  sessionStorage.setItem(key, JSON.stringify(value));
};

const emailExists = (email) => {
  const users = read(KEYS.USERS);
  return Boolean(users[email?.toLowerCase?.()]);
};

async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function Register() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState(""); // will be filled from sessionStorage
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Pull role from sessionStorage.registrationRole on mount
  useEffect(() => {
    const storedRole = sessionStorage.getItem("registrationRole");
    if (storedRole) setRole(storedRole);
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!role) {
        throw new Error("No role found. Please start from the role selection step.");
      }
      if (!isValidPhoneNumber(phone)) {
        throw new Error("Please enter a valid phone number.");
      }
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }
      if (emailExists(email)) {
        throw new Error("An account with this email already exists.");
      }

      const users = read(KEYS.USERS);
      const emailKey = email.toLowerCase();

      const userRecord = {
        id: crypto.randomUUID(),
        email: emailKey,
        firstName,
        lastName,
        phone,
        role,
        passwordHash: await sha256Hex(password), // demo only
        verified: true, // skipping email verification in this flow
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      users[emailKey] = userRecord;
      write(KEYS.USERS, users);

      // Create a simple session so the app considers the user "signed in"
      write(KEYS.SESSION, { email: emailKey, issuedAt: Date.now() });

      // Go straight to onboarding
      navigate("/onboarding");
    } catch (err) {
      setError(err.message || "Something went wrong");
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
          {role && (
            <div className="mt-2">
              <Badge className="bg-gray-100 text-gray-800">
                Role: {role.charAt(0).toUpperCase() + role.slice(1)}
              </Badge>
            </div>
          )}
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
              <p className="text-xs text-gray-500 mt-1">
                Minimum 8 characters
              </p>
            </div>

            {/* Role select is intentionally removed; role is sourced from sessionStorage.
                If you want a fallback UI when it's missing, uncomment below:
            {!role && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Role
                </label>
                <select
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    sessionStorage.setItem("registrationRole", e.target.value);
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="" disabled>Select a role</option>
                  <option value="investor">Investor</option>
                  <option value="entrepreneur">Entrepreneur</option>
                </select>
              </div>
            )} */}

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