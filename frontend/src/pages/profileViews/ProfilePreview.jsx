import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, UserCircle2 } from "lucide-react";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function ProfilePreview() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data: userData } = await supabase
        .from("user")
        .select("*")
        .eq("id", userId)
        .single();

      if (!userData) return setLoading(false);

      setRole(userData.role);

      if (userData.role === "entrepreneur") {
        const { data: enterpriseData } = await supabase
          .from("enterprise")
          .select("*")
          .eq("user_id", userId)
          .single();

        setProfile({ ...userData, ...enterpriseData });
      } else if (userData.role === "investor") {
        const { data: investorData } = await supabase
          .from("investor_profile")
          .select("*")
          .eq("user_id", userId)
          .single();

        setProfile({ ...userData, ...investorData });
      }

      setLoading(false);
    };

    fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        <Loader2 className="h-10 w-10 animate-spin" />
        <p className="ml-4">Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <p className="text-center mt-10 text-gray-600">Profile not found.</p>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            {profile.first_name} {profile.last_name}
          </CardTitle>
          <p className="text-sm text-gray-500">{profile.email}</p>
          {profile.profile_image ? (
            <img
              src={profile.profile_image}
              alt={company_name}
              className="w-14 h-14 rounded-full object-cover"
            />
          ) : (
            <UserCircle2 className="w-14 h-14 text-gray-400" />
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            <strong>Location:</strong> {profile.location}
          </p>
          <p>
            <strong>Role:</strong> {role}
          </p>
          {role === "entrepreneur" && (
            <>
              <p>
                <strong>Startup:</strong> {profile.name}
              </p>
              <p>
                <strong>Stage:</strong> {profile.stage}
              </p>
              <p>
                <strong>Industry:</strong> {profile.industry}
              </p>
              <p>
                <strong>Funding Needed:</strong> ${profile.funding_needed}
              </p>
              <p>
                <strong>Target Market:</strong> {profile.target_market}
              </p>
              <p>
                <strong>Business Model:</strong> {profile.business_model}
              </p>
            </>
          )}
          {role === "investor" && (
            <>
              <p>
                <strong>Industries:</strong> {profile.industries?.join(", ")}
              </p>
              <p>
                <strong>Investment Range:</strong> $
                {profile.investment_range_min} - ${profile.investment_range_max}
              </p>
              <p>
                <strong>Geographic Focus:</strong>{" "}
                {profile.geographic_focus?.join(", ")}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
