import { useState, useEffect, useCallback } from "react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { supabase } from "@/integrations/supabase/client";

interface NearbyPlace {
  name: string;
  icon: string;
  meta: string;
  dist: string;
  distMeters: number;
  type: string;
  rating: number | null;
  address: string;
  lat: number;
  lng: number;
  isOpen: boolean | null;
}

export function NearbyTab() {
  const [filter, setFilter] = useState("all");
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const geo = useGeolocation();

  const filters = [
    { id: "all", label: "All" },
    { id: "food", label: "🍜 Food" },
    { id: "cafe", label: "☕ Café" },
    { id: "store", label: "🛒 Store" },
  ];

  const fetchPlaces = useCallback(async (lat: number, lng: number, f: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("nearby-places", {
        body: { lat, lng, filter: f },
      });
      if (fnError) throw fnError;
      setPlaces(data?.places || []);
    } catch (e: any) {
      setError(e.message || "Failed to fetch nearby places");
    } finally {
      setLoading(false);
    }
  }, []);

  // Request location on mount
  useEffect(() => {
    if (!geo.granted && !geo.loading && !geo.error) {
      geo.requestLocation();
    }
  }, []);

  // Fetch when location acquired or filter changes
  useEffect(() => {
    if (geo.lat && geo.lng) {
      fetchPlaces(geo.lat, geo.lng, filter);
    }
  }, [geo.lat, geo.lng, filter, fetchPlaces]);

  const filtered = filter === "all" ? places : places.filter((p) => p.type === filter);

  // Location permission prompt
  if (!geo.granted && !geo.loading) {
    return (
      <div className="animate-fadein">
        <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
          Nearby Places
        </h2>
        <p className="text-muted-foreground text-[11.5px] mb-5">
          Find food, cafés, and stores near you
        </p>
        <div className="flow-card text-center py-8">
          <div className="text-3xl mb-3">📍</div>
          <p className="text-[13px] font-medium mb-1">Enable Location Access</p>
          <p className="text-muted-foreground text-[11px] mb-4">
            {geo.error || "We need your location to find nearby places."}
          </p>
          <button
            onClick={geo.requestLocation}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[12px] font-medium border-none cursor-pointer"
          >
            Allow Location
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        Nearby Places
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        {loading ? "Searching nearby…" : `${filtered.length} places found · Sorted by distance`}
      </p>

      <div className="flex gap-1 bg-flow-surface2 p-1 rounded-lg w-fit mb-3.5">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-md text-[11px] cursor-pointer border-none font-mono transition-all ${
              filter === f.id
                ? "bg-card text-foreground font-medium shadow-sm"
                : "text-muted-foreground bg-transparent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-flow-warn-light text-flow-warn px-3 py-2 rounded-lg text-[11px] mb-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flow-card">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2.5 py-2.5">
              <div className="w-[34px] h-[34px] rounded-lg bg-flow-surface2 animate-pulse" />
              <div className="flex-1">
                <div className="h-3 w-24 bg-flow-surface2 rounded animate-pulse mb-1.5" />
                <div className="h-2.5 w-40 bg-flow-surface2 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flow-card">
          {filtered.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-xs">
              No places found for this category.
            </div>
          ) : (
            filtered.map((place, i) => (
              <div
                key={i}
                className={`flex items-center gap-2.5 py-2.5 ${
                  i < filtered.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="w-[34px] h-[34px] rounded-lg bg-flow-surface2 flex items-center justify-center text-base flex-shrink-0">
                  {place.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium flex items-center gap-1.5">
                    {place.name}
                    {place.isOpen !== null && (
                      <span className={`text-[9px] px-1.5 py-px rounded-full ${
                        place.isOpen
                          ? "bg-flow-accent-light text-primary"
                          : "bg-flow-warn-light text-flow-warn"
                      }`}>
                        {place.isOpen ? "Open" : "Closed"}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{place.meta}</div>
                  {place.address && (
                    <div className="text-[10px] text-muted-foreground truncate">{place.address}</div>
                  )}
                </div>
                <a
                  href={`https://maps.google.com/maps?q=${place.lat},${place.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex flex-col items-end gap-0.5 no-underline flex-shrink-0"
                >
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {place.dist}
                  </span>
                  <span className="text-[9px] text-primary">↗ Map</span>
                </a>
              </div>
            ))
          )}
        </div>
      )}

      <button
        onClick={() => geo.lat && geo.lng && fetchPlaces(geo.lat, geo.lng, filter)}
        className="mt-3 w-full py-2 rounded-lg border border-border bg-card text-[11px] text-muted-foreground cursor-pointer hover:bg-flow-surface2 transition-colors"
      >
        ↻ Refresh
      </button>
    </div>
  );
}
