import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function ProfileSettings() {
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    bio: "",
    location: "",
    investment_stage: "",
    industries: "",
    profile_image: "",
    motivation: "",
    problem: "",
    business_model: "",
    investment_goals: "",
  });

  const [role, setRole] = useState("investor");
  const [editMode, setEditMode] = useState({});
  const [avatarFile, setAvatarFile] = useState(null);
  const [message, setMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const navigate = useNavigate();

  const defaultAvatar = "/default-profile.png";

  useEffect(() => {
    const data = JSON.parse(sessionStorage.getItem("profile"));
    const roleFromStorage = sessionStorage.getItem("user_role") || "investor";
    setRole(roleFromStorage);

    if (data) {
      const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
      setProfile((prev) => ({
        ...prev,
        full_name: fullName,
        email: data.email || "",
        bio: data.bio || "",
        location: data.location || "",
        investment_stage: data.investment_stage || "",
        industries: data.industries || "",
        profile_image: data.profile_image || "",
        motivation: data.motivation || "",
        problem: data.problem || "",
        business_model: data.business_model || "",
        investment_goals: data.investment_goals || "",
      }));
    }
  }, []);

  const handleChange = (e) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleProfileUpdate = (e) => {
    e.preventDefault();
    const updated = {
      ...JSON.parse(sessionStorage.getItem("profile")),
      firstName: profile.full_name.split(" ")[0],
      lastName: profile.full_name.split(" ").slice(1).join(" "),
      email: profile.email,
      bio: profile.bio,
      location: profile.location,
      investment_stage: profile.investment_stage,
      industries: profile.industries,
      profile_image: profile.profile_image,
      motivation: profile.motivation,
      problem: profile.problem,
      business_model: profile.business_model,
      investment_goals: profile.investment_goals,
    };
    sessionStorage.setItem("profile", JSON.stringify(updated));
    setMessage("Profile updated locally.");
  };

  const handleAvatarUpload = () => {
    if (!avatarFile) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfile((prev) => ({
        ...prev,
        profile_image: reader.result,
      }));
      const updated = JSON.parse(sessionStorage.getItem("profile")) || {};
      updated.profile_image = reader.result;
      sessionStorage.setItem("profile", JSON.stringify(updated));
      setMessage("Avatar uploaded locally.");
    };
    reader.readAsDataURL(avatarFile);
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

  const handleLogout = () => {
    sessionStorage.clear();
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
              <img
                src={previewUrl || profile.profile_image || "https://i.pravatar.cc/150?img=31"}
                alt="avatar"
                className="h-20 w-20 rounded-full object-cover border border-gray-300 shadow-sm"
              />
              <div className="flex flex-col space-y-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    setAvatarFile(file);
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setPreviewUrl(reader.result);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <Button
                  onClick={handleAvatarUpload}
                  className="w-fit bg-blue-600 text-white hover:bg-blue-700"
                >
                  Upload Avatar
                </Button>
              </div>
            </div>
          </div>

          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <EditField label="Full Name" name="full_name" />
            <EditField label="Email" name="email" type="email" />
            <EditField label="Location" name="location" />
            <EditField label="Short Bio" name="bio" />

            {role === "investor" ? (
              <>
                <EditField label="Investment Stage" name="investment_stage" />
                <EditField label="Industries" name="industries" />
              </>
            ) : (
              <>
                <EditField label="Motivation" name="motivation" />
                <EditField label="Problem Statement" name="problem" />
                <EditField label="Business Model" name="business_model" />
                <EditField label="Investment Goals" name="investment_goals" />
              </>
            )}

            <Button type="submit" className="bg-blue-600 text-white">
              Save Profile
            </Button>
          </form>

          <Separator />

          <div className="space-y-3">
            <h2 className="text-md font-semibold">Subscription Plan</h2>
            <p className="text-sm text-gray-600">
              Current:{" "}
              <strong>
                {JSON.parse(sessionStorage.getItem("profile"))?.plan || "None"}
              </strong>
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