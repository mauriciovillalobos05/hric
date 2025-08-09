// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    const sessionUser = data.user;

    // Now fetch from your custom 'user' table
    const { data: userProfile, error: profileError } = await supabase
      .from("user")
      .select("role")
      .eq("id", sessionUser.id)
      .single();

    if (profileError) {
      console.error("Failed to fetch user_type", profileError);
      setError("Could not retrieve user type.");
      return;
    }

    const role = userProfile.role;
    console.log("User role:", role);
    console.log("User data", userProfile);
    // Navigate based on role 
    if (role === "investor") {
      navigate("/dashboard/investor");
    } else if (role === "entrepreneur") {
      navigate("/dashboard/entrepreneur");
    } else {
      navigate("/dashboard/user");
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
            Don't have an account?{" "}
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
