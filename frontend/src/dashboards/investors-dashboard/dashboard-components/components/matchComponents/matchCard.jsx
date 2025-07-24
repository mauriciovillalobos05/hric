import React, { useState } from "react";
import Badge from "./uiComponents/badge";
import Button from "./uiComponents/button";
import { UserCircle2, Star, StarOff } from "lucide-react";

function MatchCard({
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

  const handleFavoriteClick = () => {
    const newState = !favorited;
    setFavorited(newState);
    if (onToggleFavorite) {
      onToggleFavorite({ company_name, favorited: newState });
    }
  };

  return (
    <div className="border rounded-lg shadow-md p-4 bg-white w-full relative">
      {/* ⭐ Favorite Toggle Button */}
      <div
        className="absolute top-3 right-3 cursor-pointer"
        onClick={handleFavoriteClick}
        title={favorited ? "Remove from Watchlist" : "Add to Watchlist"}
      >
        {favorited ? (
          <Star className="w-5 h-5 text-yellow-500 fill-yellow-400" />
        ) : (
          <StarOff className="w-5 h-5 text-gray-400" />
        )}
      </div>

      {/* Header */}
      <div className="flex items-center space-x-4">
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

        <div className="ml-auto">
          <Badge variant="outline" className="text-sm">
            Match: {match_score}%
          </Badge>
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
          <Button variant="outline" size="sm">
            View Profile
          </Button>
          <Button size="sm">Connect</Button>
        </div>
      </div>
    </div>
  );
}

export default MatchCard;
