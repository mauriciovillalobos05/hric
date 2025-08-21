import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

export default function LocationAutocomplete({ value = "", onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [inputValue, setInputValue] = useState(value);

  // Ensure query only updates on first render or external reset
  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

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
              "X-RapidAPI-Key":
                "965b5a8f84msh2cc329de9240607p1b4158jsn7bc2cea9220a",
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

  return (
    <div className="relative col-span-2">
      <Input
        placeholder="Location"
        value={inputValue}
        onChange={(e) => {
          const val = e.target.value;
          setInputValue(val);
          onChange(val); 
        }}
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-10 bg-white border mt-1 rounded-md shadow-md w-full max-h-40 overflow-y-auto">
          {suggestions.map((city) => {
            const location = `${city.city}, ${city.region}, ${city.country}`;
            return (
              <li
                key={city.id}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => {
                  setInputValue(location); // updates input
                  onChange(location); // updates parent form
                  setSuggestions([]); // hide suggestions
                }}
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
