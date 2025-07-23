import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function Onboarding() {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    location: "",
    linkedin_url: "",
    website_url: "",
    bio: "",
  });
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        setAccessToken(session.access_token);
      } else {
        setError("No session found. Please login again.");
      }
      setLoading(false);
    };
    fetchSession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let profileImagePath = null;
    console.log("Session token:", accessToken);

    try {
      if (!user || !user.id) throw new Error("User session not loaded");

      if (file) {
        const fileExt = file.name.split(".").pop();
        const fileName = `profile.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        console.log('Uploading file for user:', user.id)
        console.log("Uploading to:", filePath);

        const { error: uploadError } = await supabase.storage
          .from("profile-images")
          .upload(filePath, file, {
            upsert: false,
            cacheControl: "3600",
            contentType: file.type,
          });

        if (uploadError) throw uploadError;

        profileImagePath = filePath;
      }

      const payload = {
        ...form,
        profile_image: profileImagePath,
        supabase_id: user.id,
        email: user.email,
        user_type: user.user_metadata.role || "entrepreneur",
      };

      const res = await fetch("http://localhost:8000/api/auth/register-complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to save user");
      }

      localStorage.setItem("user_role", payload.user_type);
      navigate("/");
    } catch (err) {
      console.error("Upload/Register error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin h-6 w-6 text-gray-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Complete Your Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <Input
              placeholder="First Name"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              required
            />
            <Input
              placeholder="Last Name"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              required
            />
            <Input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <Input
              placeholder="LinkedIn URL"
              value={form.linkedin_url}
              onChange={(e) =>
                setForm({ ...form, linkedin_url: e.target.value })
              }
            />
            <Input
              placeholder="Website URL"
              value={form.website_url}
              onChange={(e) =>
                setForm({ ...form, website_url: e.target.value })
              }
            />
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files[0])}
            />
            <textarea
              placeholder="Short Bio"
              className="col-span-2 border rounded-md p-2"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={4}
            />
            <Button type="submit" className="col-span-2" disabled={loading}>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Save & Continue"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}