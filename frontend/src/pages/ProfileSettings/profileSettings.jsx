import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import Mailcheck from "mailcheck";
import defaultAvatar from "../../assets/default_user_image.png"; 

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

  const [activeField, setActiveField] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [message, setMessage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error loading profile", error);
      } else {
        // If emails are out of sync, update the custom user table
        if (user.email !== data.email) {
          await supabase
            .from("user")
            .update({ email: user.email, role: data.role })
            .eq("id", user.id);
          data.email = user.email; // update local copy
        }

        setProfile(data);
        setLoading(false);
      }
    };

    const initialize = async () => {
      setLoading(true);
      await fetchProfile();

      // Show success message if redirected from email change
      if (location.state?.emailChangeSuccess) {
        setMessage("Your email was successfully updated!.");

        // Optional: clear the location state after use to prevent repeated messages
        window.history.replaceState({}, document.title);
      }
      setLoading(false);
    };

    initialize();
  }, []);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!profile.id) return;

    const { error } = await supabase
      .from("user")
      .update({
        first_name: profile.first_name,
        last_name: profile.last_name,
        location: profile.location,
        bio: profile.bio,
      })
      .eq("id", profile.id);

    if (error) {
      console.error("Update failed:", error);
      setMessage("Failed to update profile.");
    } else {
      setMessage("Profile updated successfully.");
      setEditMode({});
    }
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

    const {
      data: { publicUrl },
    } = supabase.storage.from("profile-images").getPublicUrl(filePath);

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

  const EditField = ({ label, name, type = "text", disabled = false }) => {
    const isEditing = activeField === name;

    return (
      <div>
        <Label className="flex justify-between items-center">
          {label}
          {!disabled && (
            <button
              type="button"
              className="text-sm text-blue-600 hover:underline"
              onClick={() => {
                if (isEditing) {
                  setActiveField(null); // cancel editing
                } else {
                  setActiveField(name); // start editing
                }
              }}
            >
              {isEditing ? "Cancel" : "Edit"}
            </button>
          )}
        </Label>
        <Input
          name={name}
          type={type}
          value={profile[name] || ""}
          onChange={(e) => {
            const value = e.target.value;
            setProfile((prev) => ({ ...prev, [name]: value }));
          }}
          readOnly={!isEditing || disabled}
          autoFocus={isEditing}
          className={
            !isEditing || disabled ? "bg-gray-100 cursor-not-allowed" : ""
          }
        />
      </div>
    );
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const requestEmailChange = async () => {
    const newEmail = prompt("Enter your new email address:");
    if (!newEmail || newEmail === profile.email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setMessage("Please enter a valid email address.");
      return;
    }

    // Run Mailcheck
    Mailcheck.run({
      email: newEmail,
      domains: ["gmail.com", "hotmail.com", "outlook.com", "intelleges.com"],
      topLevelDomains: ["com", "net", "org"],
      suggested: async function (suggestion) {
        const confirmSuggestion = window.confirm(
          `Did you mean ${suggestion.full}?`
        );
        if (!confirmSuggestion) {
          setMessage("Email update canceled. Please double-check your input.");
          return;
        }

        // Proceed with suggested correction
        await handleEmailUpdate(suggestion.full);
      },
      empty: async function () {
        // No suggestion needed
        await handleEmailUpdate(newEmail);
      },
    });
  };

  // Helper function for making the email update request
  const handleEmailUpdate = async (emailToUpdate) => {
    const { error } = await supabase.auth.updateUser({
      email: emailToUpdate,
    });

    if (error) {
      console.error("Email update error:", error.message);
      setMessage("Failed to update email.");
    } else {
      setMessage(
        <div className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded-md shadow-sm text-sm text-gray-800 space-y-2">
          <p>
            <strong>Email change initiated.</strong>
          </p>
          <p>
            Confirmation links have been sent to both your{" "}
            <strong>current</strong> and <strong>new</strong> email addresses.
          </p>
          <p className="text-blue-700 font-medium">
            To complete the update, you must confirm the email sent to your{" "}
            <u>current email address</u> first.
          </p>
          <p>
            Once the first confirmation is received, you can then confirm the
            new email link.
          </p>
        </div>
      );
    }
  };

  const publicAvatarUrl = profile.profile_image
    ? supabase.storage
        .from("profile-images")
        .getPublicUrl(profile.profile_image).data.publicUrl
    : defaultAvatar;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white text-gray-600">
        <Loader2 className="h-10 w-10 animate-spin mb-4 text-gray-800" />
        <p className="text-sm">Loading...</p>
      </div>
    );
  }

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

          {/* Avatar Section */}
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
                <Button
                  onClick={handleAvatarUpload}
                  className="w-fit bg-blue-600 text-white"
                >
                  Upload Avatar
                </Button>
              </div>
            </div>
          </div>

          {/* Editable Profile Fields */}
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <EditField label="First Name" name="first_name" />
            <EditField label="Last Name" name="last_name" />
            <EditField label="Location" name="location" />
            <EditField label="Short Bio" name="bio" />
            <EditField label="Role" name="role" disabled />
            <Button type="submit" className="bg-blue-600 text-white">
              Save Changes
            </Button>
          </form>

          {/* Email Handling */}
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={profile.email}
              readOnly
              className="bg-gray-100 cursor-not-allowed"
            />
            <Button
              variant="outline"
              type="button"
              onClick={requestEmailChange}
            >
              Request Email Change
            </Button>
          </div>

          <Separator />

          {/* Subscription Plan */}
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
