import { useState, useEffect, useCallback } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useGeocode } from "@/hooks/use-geocode";
import { PlacesSearchBar } from "./PlacesSearchBar";
import { DirectionsSteps } from "./DirectionsSteps";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

interface VenueGoogleMapProps {
  venueAddress: string | null;
  venueName: string | null;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  rooms?: string[];
  selectedRoom?: string | null;
  onRoomSelect?: (room: string) => void;
  tournamentName?: string;
}

export function VenueGoogleMap(props: VenueGoogleMapProps) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <VenueMapInner {...props} />
    </APIProvider>
  );
}

function VenueMapInner({
  venueAddress,
  venueName,
  searchQuery = "",
  onSearchChange,
  rooms = [],
  selectedRoom,
  onRoomSelect,
  tournamentName,
}: VenueGoogleMapProps) {
  const map = useMap();
  const routesLib = useMapsLibrary("routes");
  const { result: venueCoords, loading: geocoding, error: geocodeError } = useGeocode(
    venueAddress || venueName
  );

  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [directionsResult, setDirectionsResult] = useState<google.maps.DirectionsResult | null>(null);
  const [routeSummary, setRouteSummary] = useState<{ distance: string; duration: string } | null>(null);
  const [showingDirections, setShowingDirections] = useState(false);
  const [directionsError, setDirectionsError] = useState<string | null>(null);
<<<<<<< HEAD
  const [mapReady, setMapReady] = useState(false);
=======
  const [searchDestination, setSearchDestination] = useState<{ lat: number; lng: number; name: string } | null>(null);
>>>>>>> 6ae9db0758ceab94b0a9b4f37555e922687cdf97

  // Watch location continuously when directions are active
  const geo = useGeolocation(showingDirections);

  const activeDestination = searchDestination || venueCoords;
  const activeDestinationName = searchDestination?.name || venueName || "Venue";

  // Fit bounds to show venue + user location
  useEffect(() => {
    if (!map) return;

    if (activeDestination && geo.lat && geo.lng) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(activeDestination);
      bounds.extend({ lat: geo.lat, lng: geo.lng });
      map.fitBounds(bounds, 60);
      const listener = google.maps.event.addListenerOnce(map, "idle", () => {
        const z = map.getZoom();
        if (z && z > 15) map.setZoom(15);
      });
      return () => google.maps.event.removeListener(listener);
    } else if (geo.lat && geo.lng) {
      map.panTo({ lat: geo.lat, lng: geo.lng });
      map.setZoom(14);
    } else if (activeDestination) {
      map.panTo(activeDestination);
      map.setZoom(15);
    }
  }, [map, activeDestination, geo.lat, geo.lng]);

<<<<<<< HEAD
  // Mark map as ready for smooth fade-in
  useEffect(() => {
    if (map) {
      const timer = setTimeout(() => setMapReady(true), 300);
      return () => clearTimeout(timer);
    }
  }, [map]);

  // Initialize DirectionsRenderer when map and routes library are ready
=======
  // Initialize DirectionsRenderer
>>>>>>> 6ae9db0758ceab94b0a9b4f37555e922687cdf97
  useEffect(() => {
    if (!map || !routesLib) return;
    const renderer = new routesLib.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: "#2A5C45",
        strokeWeight: 5,
        strokeOpacity: 0.85,
      },
    });
    setDirectionsRenderer(renderer);
    return () => renderer.setMap(null);
  }, [map, routesLib]);

  const requestDirections = useCallback((dest?: { lat: number; lng: number }) => {
    const target = dest || activeDestination;
    if (!routesLib || !geo.lat || !geo.lng || !target || !directionsRenderer) return;

    setDirectionsError(null);
    const service = new routesLib.DirectionsService();
    service.route(
      {
        origin: { lat: geo.lat, lng: geo.lng },
        destination: { lat: target.lat, lng: target.lng },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === "OK" && result) {
          directionsRenderer.setDirections(result);
          setDirectionsResult(result);
          const leg = result.routes?.[0]?.legs?.[0];
          if (leg) {
            setRouteSummary({
              distance: leg.distance?.text || "",
              duration: leg.duration?.text || "",
            });
          }
          setShowingDirections(true);
        } else {
          setDirectionsError("Could not calculate directions");
        }
      }
    );
  }, [routesLib, geo.lat, geo.lng, activeDestination, directionsRenderer]);

  const clearDirections = useCallback(() => {
    if (directionsRenderer) {
      directionsRenderer.setDirections({ routes: [] } as unknown as google.maps.DirectionsResult);
    }
    setDirectionsResult(null);
    setRouteSummary(null);
    setShowingDirections(false);
    setSearchDestination(null);
  }, [directionsRenderer]);

  const handlePlaceSelected = useCallback(
    (place: { lat: number; lng: number; name: string }) => {
      setSearchDestination(place);
      if (geo.lat && geo.lng && directionsRenderer && routesLib) {
        setTimeout(() => requestDirections(place), 100);
      }
    },
    [geo.lat, geo.lng, directionsRenderer, routesLib, requestDirections]
  );

  const defaultCenter = activeDestination || { lat: 39.8283, lng: -98.5795 };
  const defaultZoom = activeDestination ? 15 : 4;

  // Filter rooms for the floating search dropdown
  const filteredRooms = rooms.filter((r) =>
    r.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
<<<<<<< HEAD
    <div className="relative w-full" style={{ height: "calc(100vh - 120px)", minHeight: "400px" }}>
      {/* Map fills full container */}
      <div
        className="absolute inset-0 rounded-xl overflow-hidden border border-border"
        style={{
          opacity: mapReady ? 1 : 0,
          transition: "opacity 0.4s ease-in-out",
        }}
      >
=======
    <div>
      {/* Search bar */}
      <PlacesSearchBar onPlaceSelected={handlePlaceSelected} />

      {/* Map container */}
      <div className="relative w-full aspect-[16/10] rounded-lg border border-border overflow-hidden">
>>>>>>> 6ae9db0758ceab94b0a9b4f37555e922687cdf97
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={defaultZoom}
          gestureHandling="greedy"
          disableDefaultUI={true}
          zoomControl={true}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={true}
          style={{ width: "100%", height: "100%" }}
          mapId="venue-map"
        >
<<<<<<< HEAD
          {/* Venue marker */}
          {venueCoords && (
            <AdvancedMarker position={venueCoords} title={venueName || "Venue"}>
              <Pin
                background="#2A5C45"
                borderColor="#1a3d2e"
                glyphColor="#ffffff"
              />
            </AdvancedMarker>
          )}

          {/* User location marker - animated blue dot */}
=======
          {activeDestination && (
            <Marker position={activeDestination} title={activeDestinationName} />
          )}
>>>>>>> 6ae9db0758ceab94b0a9b4f37555e922687cdf97
          {geo.lat && geo.lng && (
            <AdvancedMarker
              position={{ lat: geo.lat, lng: geo.lng }}
              title="Your location"
            >
              <div className="relative">
                <div
                  className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white"
                  style={{ boxShadow: "0 0 0 2px rgba(66,133,244,0.3)" }}
                />
                <div
                  className="absolute inset-0 w-4 h-4 rounded-full bg-blue-500/40 animate-ping"
                  style={{ animationDuration: "2s" }}
                />
              </div>
            </AdvancedMarker>
          )}
        </Map>
<<<<<<< HEAD
      </div>

      {/* Geocoding loading overlay */}
      {(geocoding || !mapReady) && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80 rounded-xl z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-[11px] text-muted-foreground">Loading map...</span>
          </div>
        </div>
      )}

      {/* Floating search bar */}
      {onSearchChange && rooms.length > 0 && (
        <div className="absolute top-3 left-3 right-3 z-20">
          <div className="relative">
            <input
              type="text"
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-card/95 backdrop-blur-sm border border-border text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary transition-colors"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
            />
            {searchQuery && filteredRooms.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full mt-1 bg-card/95 backdrop-blur-sm border border-border rounded-lg max-h-[200px] overflow-y-auto"
                style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
              >
                {filteredRooms.map((room) => (
                  <button
                    key={room}
                    onClick={() => {
                      onRoomSelect?.(room);
                      onSearchChange("");
                    }}
                    className={`w-full text-left px-4 py-2 text-[12px] border-none cursor-pointer transition-colors ${
                      selectedRoom === room
                        ? "bg-primary/10 text-primary font-medium"
                        : "bg-transparent text-foreground hover:bg-flow-surface2"
                    }`}
                  >
                    {room}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating controls - bottom left */}
      <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-2">
        {!geo.granted && !geo.loading && (
          <button
            onClick={geo.requestLocation}
            className="px-3 py-2 rounded-lg text-[11px] bg-card/95 backdrop-blur-sm border border-border text-foreground cursor-pointer hover:bg-card transition-colors font-medium"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
=======
        {geocoding && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/60">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {!geo.granted && !geo.loading && (
          <button
            onClick={geo.requestLocation}
            className="px-2.5 py-1.5 rounded-md text-[11px] border border-border bg-card text-foreground cursor-pointer hover:bg-accent/40 transition-colors"
>>>>>>> 6ae9db0758ceab94b0a9b4f37555e922687cdf97
          >
            Enable Location
          </button>
        )}
        {geo.loading && (
          <div
            className="px-3 py-2 rounded-lg text-[10px] text-muted-foreground bg-card/95 backdrop-blur-sm border border-border"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
          >
            Getting location...
          </div>
        )}
        {geo.granted && activeDestination && !showingDirections && (
          <button
<<<<<<< HEAD
            onClick={requestDirections}
            className="px-3 py-2 rounded-lg text-[11px] bg-primary text-primary-foreground border-none cursor-pointer font-medium"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
=======
            onClick={() => requestDirections()}
            className="px-2.5 py-1.5 rounded-md text-[11px] bg-primary text-primary-foreground border-none cursor-pointer font-medium"
>>>>>>> 6ae9db0758ceab94b0a9b4f37555e922687cdf97
          >
            Get Directions
          </button>
        )}
        {showingDirections && (
          <button
            onClick={clearDirections}
<<<<<<< HEAD
            className="px-3 py-2 rounded-lg text-[11px] bg-card/95 backdrop-blur-sm border border-border text-foreground cursor-pointer hover:bg-card transition-colors"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
=======
            className="px-2.5 py-1.5 rounded-md text-[11px] border border-border bg-card text-foreground cursor-pointer hover:bg-accent/40 transition-colors"
>>>>>>> 6ae9db0758ceab94b0a9b4f37555e922687cdf97
          >
            Clear Directions
          </button>
        )}
<<<<<<< HEAD
      </div>

      {/* Floating route summary - bottom center */}
      {showingDirections && routeSummary && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2.5 rounded-lg bg-card/95 backdrop-blur-sm border border-border text-foreground"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
        >
          <div className="text-[12px] font-medium text-center">
            {routeSummary.distance} &middot; {routeSummary.duration}
          </div>
        </div>
      )}

      {/* Selected room indicator - floating pill */}
      {selectedRoom && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg bg-primary text-primary-foreground"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium">{selectedRoom}</span>
            <a
              href={`https://maps.google.com?q=${encodeURIComponent(selectedRoom + " " + (tournamentName || ""))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-primary-foreground/80 underline"
            >
              Open in Maps
            </a>
          </div>
        </div>
      )}

      {/* Error messages - floating bottom */}
      {(geocodeError || geo.error || directionsError) && (
        <div
          className="absolute bottom-16 left-3 right-3 z-20 px-3 py-2 rounded-lg bg-destructive/90 text-destructive-foreground text-[11px]"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
        >
          {geocodeError || geo.error || directionsError}
        </div>
      )}

      {/* Venue info label - floating bottom right */}
      {(venueName || venueAddress) && (
        <div
          className="absolute bottom-3 right-3 z-20 max-w-[220px] px-3 py-2 rounded-lg bg-card/95 backdrop-blur-sm border border-border"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
        >
          {venueName && (
            <p className="text-[11px] font-medium text-foreground truncate">{venueName}</p>
          )}
          {venueAddress && (
            <p className="text-[10px] text-muted-foreground truncate">{venueAddress}</p>
          )}
        </div>
=======
        {showingDirections && routeSummary && (
          <span className="text-[11px] text-muted-foreground">
            {routeSummary.distance} · {routeSummary.duration}
          </span>
        )}
      </div>

      {/* Turn-by-turn directions */}
      {showingDirections && directionsResult && (
        <DirectionsSteps
          directions={directionsResult}
          userLat={geo.lat}
          userLng={geo.lng}
        />
>>>>>>> 6ae9db0758ceab94b0a9b4f37555e922687cdf97
      )}

      {/* Errors */}
      {geocodeError && <p className="text-[10px] text-destructive mt-1">{geocodeError}</p>}
      {geo.error && <p className="text-[10px] text-destructive mt-1">{geo.error}</p>}
      {directionsError && <p className="text-[10px] text-destructive mt-1">{directionsError}</p>}
    </div>
  );
}
