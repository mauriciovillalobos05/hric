// src/pages/Onboarding.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import DefaultAvatar from "@/assets/default_user_image.png";
import LocationAutocomplete from "@/components/LocationAutocomplete";

// --- sessionStorage helpers (same keys used in Register) ---
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

export default function Onboarding() {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    email: "",
    role: "",
    firstName: "",
    lastName: "",
    phone: "",
    location: "",
    linkedinUrl: "",
    websiteUrl: "",
    bio: "",
    profileImage: null, // data URL (persisted)
  });
  const [file, setFile] = useState(null); // for new uploads
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Load current user from sessionStorage
  useEffect(() => {
    try {
      const session = read(KEYS.SESSION); // { email, issuedAt }
      if (!session?.email) {
        throw new Error("Not authenticated. Please register or log in.");
      }

      const users = read(KEYS.USERS);
      const user = users[session.email];
      if (!user) {
        throw new Error("User record not found. Please register again.");
      }

      setForm((prev) => ({
        ...prev,
        email: user.email,
        role: user.role || sessionStorage.getItem("registrationRole") || "",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phone: user.phone || "",
        location: user.location || "",
        linkedinUrl: user.linkedinUrl || "",
        websiteUrl: user.websiteUrl || "",
        bio: user.bio || "",
        profileImage: user.profileImage || null,
      }));

      // optional: cleanup the temporary role flag
      sessionStorage.removeItem("registrationRole");
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result); // data URL
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const session = read(KEYS.SESSION);
      if (!session?.email) throw new Error("Not authenticated.");

      const users = read(KEYS.USERS);
      const user = users[session.email];
      if (!user) throw new Error("User record not found.");

      // If a new file was chosen, convert and persist as data URL
      let profileImage = form.profileImage || null;
      if (file) {
        profileImage = await fileToDataUrl(file);
      }

      // Persist updates
      users[session.email] = {
        ...user,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        role: form.role,
        location: form.location,
        linkedinUrl: form.linkedinUrl,
        websiteUrl: form.websiteUrl,
        bio: form.bio,
        profileImage,
        updatedAt: Date.now(),
      };
      write(KEYS.USERS, users);

      // Next step (no Stripe yet): go to role-specific complete-profile
      const next =
        (form.role || "").toLowerCase() === "investor"
          ? "/complete-profile/investor"
          : "/complete-profile/entrepreneur";
      navigate(next);
    } catch (err) {
      console.error("Onboarding error:", err);
      setError(err.message || "Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  };

  const previewSrc = file
    ? URL.createObjectURL(file)
    : form.profileImage || DefaultAvatar;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Complete Your Profile
          </CardTitle>
          <p className="text-sm text-blue-700 mt-1">
            You are signing up as: <strong>{form.role || "—"}</strong>
          </p>
        </CardHeader>
        <CardContent>
          {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="col-span-2 flex justify-center">
              <label className="relative cursor-pointer group">
                <Input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-gray-300 group-hover:ring-2 group-hover:ring-blue-400 transition-all">
                  <img
                    src={previewSrc}
                    alt="Profile Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute bottom-0 w-full text-center text-xs text-gray-600 bg-white bg-opacity-70 py-1 rounded-b-full">
                  Change
                </div>
              </label>
            </div>

            {/* Basic identity (prefilled from registration) */}
            <Input
              placeholder="First name"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
            <Input
              placeholder="Last name"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
            <Input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <LocationAutocomplete
              value={form.location}
              onChange={(value) => setForm({ ...form, location: value })}
            />
            <Input
              placeholder="LinkedIn URL"
              value={form.linkedinUrl}
              onChange={(e) =>
                setForm({ ...form, linkedinUrl: e.target.value })
              }
            />
            <Input
              placeholder="Website URL"
              value={form.websiteUrl}
              onChange={(e) =>
                setForm({ ...form, websiteUrl: e.target.value })
              }
            />
            <textarea
              placeholder="Short Bio"
              className="col-span-2 border rounded-md p-2"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={4}
            />

            {/* disabled={loading} */}
            <Button type="submit" className="col-span-2">
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