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
  const [searchDestination, setSearchDestination] = useState<{ lat: number; lng: number; name: string } | null>(null);

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

  // Initialize DirectionsRenderer
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
    <div>
      {/* Search bar */}
      <PlacesSearchBar onPlaceSelected={handlePlaceSelected} />

      {/* Map container */}
      <div className="relative w-full aspect-[16/10] rounded-lg border border-border overflow-hidden">
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
          {/* Destination marker */}
          {activeDestination && (
            <AdvancedMarker position={activeDestination} title={activeDestinationName}>
              <Pin
                background="#2A5C45"
                borderColor="#1a3d2e"
                glyphColor="#ffffff"
              />
            </AdvancedMarker>
          )}

          {/* User location marker */}
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
          >
            Enable Location
          </button>
        )}
        {geo.loading && (
          <span className="text-[10px] text-muted-foreground">Getting location...</span>
        )}
        {geo.granted && activeDestination && !showingDirections && (
          <button
            onClick={() => requestDirections()}
            className="px-2.5 py-1.5 rounded-md text-[11px] bg-primary text-primary-foreground border-none cursor-pointer font-medium"
          >
            Get Directions
          </button>
        )}
        {showingDirections && (
          <button
            onClick={clearDirections}
            className="px-2.5 py-1.5 rounded-md text-[11px] border border-border bg-card text-foreground cursor-pointer hover:bg-accent/40 transition-colors"
          >
            Clear Directions
          </button>
        )}
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
      )}

      {/* Errors */}
      {geocodeError && <p className="text-[10px] text-destructive mt-1">{geocodeError}</p>}
      {geo.error && <p className="text-[10px] text-destructive mt-1">{geo.error}</p>}
      {directionsError && <p className="text-[10px] text-destructive mt-1">{directionsError}</p>}
    </div>
  );
}
