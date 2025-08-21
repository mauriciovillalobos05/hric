// src/components/LocationMultiSelect.jsx
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function LocationMultiSelect({ values = [], onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (!inputValue || inputValue.length < 2) {
      setSuggestions([]);
      return;
    }

    const fetchCities = async () => {
      try {
        const res = await fetch(
          `https://wft-geo-db.p.rapidapi.com/v1/geo/cities?namePrefix=${encodeURIComponent(
            inputValue
          )}&limit=5&sort=-population`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              "X-RapidAPI-Key": "965b5a8f84msh2cc329de9240607p1b4158jsn7bc2cea9220a",
              "X-RapidAPI-Host": "wft-geo-db.p.rapidapi.com",
            },
          }
        );
        const data = await res.json();
        setSuggestions(data.data || []);
      } catch (err) {
        console.error("GeoDB fetch error:", err);
        setSuggestions([]);
      }
    };

    const debounce = setTimeout(fetchCities, 300);
    return () => clearTimeout(debounce);
  }, [inputValue]);

  const handleAdd = (location) => {
    if (!values.includes(location)) {
      onChange([...values, location]);
    }
    setInputValue("");
    setSuggestions([]);
  };

  const handleRemove = (location) => {
    onChange(values.filter((loc) => loc !== location));
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((location) => (
          <Badge key={location} className="flex items-center gap-1">
            {location}
            <button
              type="button"
              onClick={() => handleRemove(location)}
              className="ml-1 text-xs text-red-600"
            >
              ✕
            </button>
          </Badge>
        ))}
      </div>
      <Input
        placeholder="Add a location"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-10 bg-white border mt-1 rounded-md shadow-md w-full max-h-40 overflow-y-auto">
          {suggestions.map((city) => {
            const location = `${city.city}, ${city.region}, ${city.country}`;
            return (
              <li
                key={city.id}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => handleAdd(location)}
              >
                {location}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
