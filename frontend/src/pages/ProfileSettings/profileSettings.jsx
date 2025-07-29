import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function ProfileSettings() {
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    email: "",
    location: "",
    bio: "",
    plan: "",
    role: "",
    profile_image: "",
  });

  const [editMode, setEditMode] = useState({});
  const [avatarFile, setAvatarFile] = useState(null);
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const navigate = useNavigate();

  const defaultAvatar = "/default_user_image.png";

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error loading profile", error);
      } else {
        setProfile(data);
      }
    };

    fetchProfile();
  }, []);

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from("user")
      .update(profile)
      .eq("id", profile.id);

    setMessage(error ? "Failed to update profile." : "Profile updated successfully.");
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile || !profile.id) return;

    const ext = avatarFile.name.split(".").pop();
    const filePath = `${profile.id}/profile.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-images")
      .upload(filePath, avatarFile, { upsert: true });

    if (uploadError) {
      console.error("Upload failed:", uploadError.message);
      setMessage("Avatar upload failed.");
      return;
    }

    const { data: { publicUrl } } = supabase
      .storage
      .from("profile-images")
      .getPublicUrl(filePath);

    const { error: updateError } = await supabase
      .from("user")
      .update({ profile_image: filePath })
      .eq("id", profile.id);

    if (!updateError) {
      setProfile((prev) => ({ ...prev, profile_image: filePath }));
      setMessage("Avatar updated.");
    } else {
      console.error(updateError);
      setMessage("Failed to update avatar reference.");
    }
  };

  const EditField = ({ label, name, type = "text" }) => (
    <div>
      <Label className="flex justify-between items-center">
        {label}
        <button
          type="button"
          className="text-sm text-blue-600 hover:underline"
          onClick={() => setEditMode((prev) => ({ ...prev, [name]: !prev[name] }))}
        >
          {editMode[name] ? "Cancel" : "Edit"}
        </button>
      </Label>
      <Input
        name={name}
        type={type}
        value={profile[name] || ""}
        onChange={handleChange}
        readOnly={!editMode[name]}
        className={!editMode[name] ? "bg-gray-100 cursor-not-allowed" : ""}
      />
    </div>
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const publicAvatarUrl = profile.profile_image
    ? supabase.storage.from("profile-images").getPublicUrl(profile.profile_image).data.publicUrl
    : defaultAvatar;

  return (
    <div className="max-w-2xl mx-auto py-10 px-6">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-800">
            Profile Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {message && <p className="text-sm text-green-600">{message}</p>}

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Profile Image
            </Label>
            <div className="flex items-center gap-6">
              <div className="relative">
                <img
                  src={previewUrl || publicAvatarUrl}
                  alt="avatar"
                  className="h-20 w-20 rounded-full object-cover border border-gray-300 shadow-sm"
                />
              </div>
              <div className="flex flex-col space-y-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    setAvatarFile(file);
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setPreviewUrl(reader.result);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <Button onClick={handleAvatarUpload} className="w-fit bg-blue-600 text-white">
                  Upload Avatar
                </Button>
              </div>
            </div>
          </div>

          {/* Editable Profile Fields */}
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <EditField label="First Name" name="first_name" />
            <EditField label="Last Name" name="last_name" />
            <EditField label="Email" name="email" type="email" />
            <EditField label="Location" name="location" />
            <EditField label="Short Bio" name="bio" />
            <EditField label="Plan" name="plan" />
            <EditField label="Role" name="role" />
            <Button type="submit" className="bg-blue-600 text-white">
              Save Changes
            </Button>
          </form>

          <Separator />

          <div className="space-y-3">
            <h2 className="text-md font-semibold">Subscription Plan</h2>
            <p className="text-sm text-gray-600">
              Current: <strong>{profile.plan || "None"}</strong>
            </p>
            <Button onClick={() => navigate("/subscription")} variant="outline">
              Upgrade Subscription
            </Button>
          </div>

          <Separator />

          <Button variant="destructive" onClick={handleLogout}>
            Log Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
