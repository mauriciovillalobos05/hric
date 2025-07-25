import React, { useState, useEffect } from "react";
import Badge from "./uiComponents/badge";
import Button from "./uiComponents/button";
import { UserCircle2, Star, StarOff } from "lucide-react";

function InvestorCard({
  founder,
  company_name,
  description,
  location,
  profile_image,
  match_score,
  match_reasons = [],
  funding_stage,
  industry,
  onToggleFavorite,
  isFavorite = false,
}) {
  const [favorited, setFavorited] = useState(isFavorite);
  const [likes, setLikes] = useState([
    { name: "Ana Torres", photo: "https://i.pravatar.cc/150?img=10" },
    { name: "Luis Mendoza", photo: "https://i.pravatar.cc/150?img=25" },
    { name: "Mateo Uribe", photo: "https://i.pravatar.cc/150?img=31" },
  ]);
  const [showLikes, setShowLikes] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [plan, setPlan] = useState("");

  useEffect(() => {
    const userPlan = sessionStorage.getItem("selected_plan") || "";
    setPlan(userPlan.toLowerCase());
  }, []);

  const handleFavoriteClick = () => {
    const newState = !favorited;
    setFavorited(newState);
    if (onToggleFavorite) {
      onToggleFavorite({ company_name, favorited: newState });
    }
  };

  return (
    <div className="border rounded-lg shadow-md p-4 bg-white w-full relative">
      {/* Top right buttons */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1 text-right">
        <div
          className="cursor-pointer"
          onClick={handleFavoriteClick}
          title={favorited ? "Remove from Watchlist" : "Add to Watchlist"}
        >
          {favorited ? (
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-400" />
          ) : (
            <StarOff className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <div className="mt-1">
          <Badge variant="outline" className="text-xs px-2 py-1">
            Match: {match_score}%
          </Badge>
        </div>

        {(plan === "premium" || plan === "vip") && (
          <div className="text-xs text-gray-600 mt-1">{likes.length} likes</div>
        )}
        {plan === "vip" && (
          <button
            onClick={() => setShowLikes(true)}
            className="text-xs text-blue-600 hover:underline"
          >
            View Likes
          </button>
        )}
      </div>

      {/* Likes Modal */}
      {showLikes && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-80 relative">
            <h3 className="text-lg font-semibold mb-4">Liked by</h3>
            <ul className="space-y-3 max-h-60 overflow-y-auto">
              {likes.map((user, index) => (
                <li key={index} className="flex items-center gap-3">
                  <img
                    src={user.photo}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover border"
                  />
                  <span className="text-sm text-gray-800">{user.name}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setShowLikes(false)}
              className="absolute top-2 right-3 text-gray-500 hover:text-black text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* View Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96 relative">
            <h3 className="text-lg font-semibold mb-2">{company_name}</h3>
            <p className="text-sm text-gray-700 mb-1">{description}</p>
            <p className="text-sm text-gray-500 mb-2">
              Founded by {founder} • Based in {location}
            </p>
            <p className="text-sm text-gray-600 mb-1">
              Industry: <strong>{industry}</strong>
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Funding Stage: <strong>{funding_stage}</strong>
            </p>
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-2 right-3 text-gray-500 hover:text-black text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-80 relative">
            <h3 className="text-lg font-semibold mb-4">
              Connect with {founder}
            </h3>
            <p className="text-sm text-gray-700">
              We'll notify {founder} from <strong>{company_name}</strong> that
              you're interested.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowConnectModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  alert("Connection request sent!");
                  setShowConnectModal(false);
                }}
              >
                Send Request
              </Button>
            </div>
            <button
              onClick={() => setShowConnectModal(false)}
              className="absolute top-2 right-3 text-gray-500 hover:text-black text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center space-x-4 mt-2">
        {profile_image ? (
          <img
            src={profile_image}
            alt={company_name}
            className="w-14 h-14 rounded-full object-cover"
          />
        ) : (
          <UserCircle2 className="w-14 h-14 text-gray-400" />
        )}
        <div>
          <h3 className="text-lg font-semibold">{company_name}</h3>
          <p className="text-sm text-gray-600">
            {founder} &bull; {location}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="mt-3 text-gray-700 text-sm">{description}</p>

      {/* Match Reasons */}
      {match_reasons.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {match_reasons.map((reason, idx) => (
            <Badge key={idx} className="bg-blue-100 text-blue-800">
              {reason}
            </Badge>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          <strong>{funding_stage}</strong> • {industry}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowProfileModal(true)}
          >
            View Profile
          </Button>
          <Button size="sm" onClick={() => setShowConnectModal(true)}>
            Connect
          </Button>
        </div>
      </div>
    </div>
  );
}

export default InvestorCard;