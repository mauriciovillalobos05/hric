// src/dashboards/investors-dashboard/dashboard-components/components/headerBarComponents/components/profileSettings.jsx

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
    full_name: "",
    email: "",
    bio: "",
    location: "",
    investment_stage: "",
    industries: "",
    profile_image: "",
  });

  const [editMode, setEditMode] = useState({
    full_name: false,
    email: false,
    location: false,
    bio: false,
    investment_stage: false,
    industries: false,
  });

  const [avatarFile, setAvatarFile] = useState(null);
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const navigate = useNavigate();

  const defaultAvatar = "./src/assets/default_user_image.png";

  // Fetch user profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
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
      .from("profiles")
      .update(profile)
      .eq("id", profile.id);
    setMessage(
      error ? "Failed to update profile." : "Profile updated successfully."
    );
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;

    const { data, error } = await supabase.storage
      .from("avatars")
      .upload(`user-${profile.id}`, avatarFile, { upsert: true });

    if (!error) {
      const url = supabase.storage
        .from("avatars")
        .getPublicUrl(`user-${profile.id}`).data.publicUrl;
      await supabase
        .from("profiles")
        .update({ profile_image: url })
        .eq("id", profile.id);
      setProfile((prev) => ({ ...prev, profile_image: url }));
    }
  };

  const EditField = ({ label, name, type = "text" }) => (
    <div>
      <Label className="flex justify-between items-center">
        {label}
        <button
          type="button"
          className="text-sm text-blue-600 hover:underline"
          onClick={() =>
            setEditMode((prev) => ({ ...prev, [name]: !prev[name] }))
          }
        >
          {editMode[name] ? "Cancel" : "Edit"}
        </button>
      </Label>
      <Input
        name={name}
        type={type}
        value={profile[name]}
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
              {/* Circular avatar preview */}
              <div className="relative">
                <img
                  src={previewUrl || profile.profile_image || defaultAvatar}
                  alt=""
                  className="h-20 w-20 rounded-full object-cover border border-gray-300 shadow-sm font-semibold"
                />
              </div>

              <div className="flex flex-col space-y-2">
                <Input
                  type="file"
                  accept="image/*"
                  className="cursor-pointer file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-blue-50 file:text-sm file:text-blue-700 hover:file:bg-blue-100"
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
                <Button
                  onClick={handleAvatarUpload}
                  className="w-fit bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  Upload Avatar
                </Button>
              </div>
            </div>
          </div>

          {/* Editable Profile Info */}
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <EditField label="Full Name" name="full_name" />
            <EditField label="Email" name="email" type="email" />
            <EditField label="Location" name="location" />
            <EditField label="Short Bio" name="bio" />
            <EditField label="Investment Stage" name="investment_stage" />
            <EditField label="Industries" name="industries" />
          </form>

          <Separator />

          {/* Subscription Info + Actions */}
          <div className="space-y-3">
            <h2 className="text-md font-semibold">Subscription Plan</h2>
            <p className="text-sm text-gray-600">
              Current: <strong>Premium</strong>
            </p>
            <Button onClick={() => navigate("/subscription")} variant="outline">
              Upgrade Subscription
            </Button>
          </div>

          <Separator />

          {/* Logout */}
          <Button variant="destructive" onClick={handleLogout}>
            Log Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
