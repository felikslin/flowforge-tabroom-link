import { useState, useEffect, useRef, useCallback } from "react";
import { useMapsLibrary, useMap } from "@vis.gl/react-google-maps";

interface PlacesSearchBarProps {
  onPlaceSelected: (place: { lat: number; lng: number; name: string }) => void;
}

export function PlacesSearchBar({ onPlaceSelected }: PlacesSearchBarProps) {
  const placesLib = useMapsLibrary("places");
  const map = useMap();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null);
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Initialize services
  useEffect(() => {
    if (!placesLib || !map) return;
    setAutocompleteService(new placesLib.AutocompleteService());
    setPlacesService(new placesLib.PlacesService(map));
  }, [placesLib, map]);

  // Fetch predictions on query change
  useEffect(() => {
    if (!autocompleteService || !query.trim()) {
      setPredictions([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      autocompleteService.getPlacePredictions(
        { input: query, types: [] },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            setPredictions(results);
            setShowDropdown(true);
          } else {
            setPredictions([]);
          }
        }
      );
    }, 250);

    return () => clearTimeout(debounceRef.current);
  }, [autocompleteService, query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectPlace = useCallback(
    (placeId: string, description: string) => {
      if (!placesService) return;
      setQuery(description);
      setShowDropdown(false);
      setPredictions([]);

      placesService.getDetails(
        { placeId, fields: ["geometry", "name"] },
        (place, status) => {
          if (
            status === google.maps.places.PlacesServiceStatus.OK &&
            place?.geometry?.location
          ) {
            onPlaceSelected({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              name: place.name || description,
            });
          }
        }
      );
    },
    [placesService, onPlaceSelected]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && predictions.length > 0) {
      e.preventDefault();
      selectPlace(predictions[0].place_id, predictions[0].description);
    }
  };

  return (
    <div ref={containerRef} className="relative mb-3">
      <div className="flow-label mb-1.5">Search Destination</div>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search a place or address…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => predictions.length > 0 && setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-card text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary transition-colors"
        />
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        {query && (
          <button
            onClick={() => { setQuery(""); setPredictions([]); setShowDropdown(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-[14px] bg-transparent border-none cursor-pointer"
          >
            ×
          </button>
        )}
      </div>

      {showDropdown && predictions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-[240px] overflow-y-auto">
          {predictions.map((p) => (
            <button
              key={p.place_id}
              onClick={() => selectPlace(p.place_id, p.description)}
              className="w-full text-left px-3 py-2.5 text-[12px] border-none cursor-pointer bg-card text-foreground hover:bg-accent/40 transition-colors flex items-start gap-2"
            >
              <svg
                className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {p.structured_formatting.main_text}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {p.structured_formatting.secondary_text}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
