import { useEffect, useMemo, useState, useRef } from "react";
import { X } from "lucide-react";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

interface NavigationModeProps {
  directions: google.maps.DirectionsResult;
  userLat: number | null;
  userLng: number | null;
  userHeading: number | null;
  destinationName: string;
  onExit: () => void;
}

function getDistanceBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function maneuverIcon(maneuver: string | undefined): string {
  if (!maneuver) return "→";
  if (maneuver.includes("left")) return "↰";
  if (maneuver.includes("right")) return "↱";
  if (maneuver.includes("uturn")) return "↩";
  if (maneuver.includes("merge")) return "⤵";
  if (maneuver.includes("ramp")) return "↗";
  if (maneuver.includes("roundabout")) return "↻";
  return "→";
}

function formatDistance(meters: number): string {
  if (meters < 100) return `${Math.round(meters / 10) * 10} m`;
  if (meters < 1000) return `${Math.round(meters / 50) * 50} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// First-person map view component
function FirstPersonMapView({
  directions,
  userLat,
  userLng,
  userHeading,
}: {
  directions: google.maps.DirectionsResult;
  userLat: number;
  userLng: number;
  userHeading: number | null;
}) {
  const map = useMap();
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  // Initialize renderer
  useEffect(() => {
    if (!map) return;
    
    const renderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: "#2A5C45",
        strokeWeight: 6,
        strokeOpacity: 0.9,
      },
    });
    
    renderer.setDirections(directions);
    rendererRef.current = renderer;
    
    return () => {
      renderer.setMap(null);
    };
  }, [map, directions]);

  // Follow user position with heading
  useEffect(() => {
    if (!map) return;
    
    map.setCenter({ lat: userLat, lng: userLng });
    map.setZoom(18);
    
    // Rotate map based on heading (first-person view)
    if (userHeading !== null) {
      map.setHeading(userHeading);
    }
    
    map.setTilt(45); // 3D perspective
  }, [map, userLat, userLng, userHeading]);

  return (
    <>
      {/* User position marker */}
      <AdvancedMarker position={{ lat: userLat, lng: userLng }}>
        <div className="relative">
          <div
            className="w-5 h-5 rounded-full bg-blue-500 border-3 border-white"
            style={{ boxShadow: "0 0 0 3px rgba(66,133,244,0.4)" }}
          />
          {userHeading !== null && (
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full"
              style={{
                width: 0,
                height: 0,
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderBottom: "12px solid #4285f4",
                transform: `translateX(-50%) translateY(-100%) rotate(${360 - userHeading}deg)`,
                transformOrigin: "50% 100%",
              }}
            />
          )}
        </div>
      </AdvancedMarker>
    </>
  );
}

export function NavigationMode({
  directions,
  userLat,
  userLng,
  userHeading,
  destinationName,
  onExit,
}: NavigationModeProps) {
  const steps = directions?.routes?.[0]?.legs?.[0]?.steps || [];
  const leg = directions?.routes?.[0]?.legs?.[0];
  const [arrived, setArrived] = useState(false);

  // Find the current step based on user position
  const activeStepIdx = useMemo(() => {
    if (!steps.length || userLat == null || userLng == null) return 0;

    // Find the nearest step that user hasn't passed yet
    let closestIdx = 0;
    let minDist = Infinity;

    for (let i = 0; i < steps.length; i++) {
      const endLat = steps[i].end_location.lat();
      const endLng = steps[i].end_location.lng();
      const dist = getDistanceBetween(userLat, userLng, endLat, endLng);

      if (dist < minDist) {
        minDist = dist;
        closestIdx = i;
      }
    }

    // Check if we're very close to the final destination
    if (closestIdx === steps.length - 1 && minDist < 20) {
      setArrived(true);
    }

    return closestIdx;
  }, [steps, userLat, userLng]);

  const currentStep = steps[activeStepIdx];
  const nextStep = steps[activeStepIdx + 1];

  // Calculate distance to next turn
  const distanceToTurn = useMemo(() => {
    if (!currentStep || userLat == null || userLng == null) return null;
    const endLat = currentStep.end_location.lat();
    const endLng = currentStep.end_location.lng();
    return getDistanceBetween(userLat, userLng, endLat, endLng);
  }, [currentStep, userLat, userLng]);

  // Calculate remaining distance and ETA
  const remaining = useMemo(() => {
    if (!steps.length || userLat == null || userLng == null) {
      return {
        distance: leg?.distance?.text || "",
        duration: leg?.duration?.text || "",
      };
    }

    // Sum up distance from current step to end
    let totalMeters = distanceToTurn || 0;
    for (let i = activeStepIdx + 1; i < steps.length; i++) {
      totalMeters += steps[i].distance?.value || 0;
    }

    return {
      distance: formatDistance(totalMeters),
      duration: leg?.duration?.text || "",
    };
  }, [steps, activeStepIdx, distanceToTurn, leg, userLat, userLng]);

  // Prevent scrolling on body when in navigation mode
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!currentStep) return null;

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <div className="fixed inset-0 z-50 bg-card flex flex-col animate-fadein">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card z-10">
          <div className="flex-1">
            <div className="text-[11px] text-muted-foreground">To</div>
            <div className="text-[14px] font-medium text-foreground truncate">
              {destinationName}
            </div>
          </div>
          <button
            onClick={onExit}
            className="w-9 h-9 rounded-full bg-accent/40 hover:bg-accent/60 flex items-center justify-center transition-colors cursor-pointer border-none"
            aria-label="Exit navigation"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* First-person map view */}
        {!arrived && userLat && userLng && (
          <div className="relative w-full flex-1 border-b border-border">
            <Map
              defaultCenter={{ lat: userLat, lng: userLng }}
              defaultZoom={18}
              gestureHandling="greedy"
              disableDefaultUI={true}
              zoomControl={false}
              mapTypeControl={false}
              streetViewControl={false}
              fullscreenControl={false}
              style={{ width: "100%", height: "100%" }}
              mapId="navigation-map"
            >
              <FirstPersonMapView
                directions={directions}
                userLat={userLat}
                userLng={userLng}
                userHeading={userHeading}
              />
            </Map>
            
            {/* Floating instruction overlay */}
            <div className="absolute top-3 left-3 right-3 bg-card/95 backdrop-blur-sm rounded-lg shadow-lg border border-border p-2.5">
              <div className="flex items-center gap-2">
                <div className="text-[32px] leading-none shrink-0">
                  {maneuverIcon(currentStep.maneuver)}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[13px] font-semibold text-foreground leading-tight"
                    dangerouslySetInnerHTML={{ __html: currentStep.instructions }}
                  />
                  {distanceToTurn !== null && (
                    <div className="text-[16px] font-bold text-primary mt-0.5">
                      {formatDistance(distanceToTurn)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main content - hidden when navigating */}
        {!arrived && (
          <div className="px-4 py-2 border-b border-border bg-accent/10">
            {/* Next step preview */}
            {nextStep && (
              <div className="flex items-center gap-2">
                <div className="text-[20px] leading-none shrink-0 opacity-60">
                  {maneuverIcon(nextStep.maneuver)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-muted-foreground">Then in {nextStep.distance?.text}</div>
                  <div
                    className="text-[11px] text-foreground leading-tight"
                    dangerouslySetInnerHTML={{ __html: nextStep.instructions }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {arrived && (
          <div className="flex-1 overflow-y-auto">
            /* Arrival screen */
            <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 text-center">
              <div className="text-[72px] mb-4">🎯</div>
              <h2 className="text-[32px] font-bold text-foreground mb-2">
                You've arrived!
              </h2>
              <p className="text-[16px] text-muted-foreground mb-8">
                {destinationName}
              </p>
              <button
                onClick={onExit}
                className="px-6 py-3 rounded-lg bg-primary text-primary-foreground text-[14px] font-medium cursor-pointer border-none hover:opacity-90 transition-opacity"
              >
                Exit Navigation
              </button>
            </div>
          </div>
        )}

        {/* All remaining steps - collapsible */}
        {!arrived && (
          <div className="px-4 py-2">
              <details className="group">
                <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none py-1">
                  All steps ({steps.length - activeStepIdx} remaining)
                </summary>
                <div className="mt-2 space-y-0 border-l-2 border-border ml-2 max-h-[120px] overflow-y-auto">
                  {steps.slice(activeStepIdx).map((step, i) => {
                    const idx = activeStepIdx + i;
                    const isCurrent = i === 0;
                    return (
                      <div
                        key={idx}
                        className={`relative pl-4 py-1.5 ${
                          isCurrent ? "bg-primary/5" : ""
                        }`}
                      >
                        <div
                          className={`absolute left-[-4px] top-2.5 w-2 h-2 rounded-full border-2 ${
                            isCurrent
                              ? "bg-primary border-primary"
                              : "bg-card border-border"
                          }`}
                        />
                        <div className="flex items-start gap-2">
                          <span className="text-[14px] shrink-0">
                            {maneuverIcon(step.maneuver)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div
                              className={`text-[10px] leading-tight ${
                                isCurrent
                                  ? "text-foreground font-medium"
                                  : "text-foreground/80"
                              }`}
                              dangerouslySetInnerHTML={{ __html: step.instructions }}
                            />
                            <div className="flex gap-2 mt-0.5 text-[9px] text-muted-foreground">
                              <span>{step.distance?.text}</span>
                              <span>·</span>
                              <span>{step.duration?.text}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
        )}

      {/* Bottom bar with ETA */}
      {!arrived && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-card">
          <div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Distance</div>
            <div className="text-[14px] font-bold text-foreground">
              {remaining.distance}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">ETA</div>
            <div className="text-[14px] font-bold text-primary">
              {remaining.duration}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Step</div>
            <div className="text-[14px] font-bold text-foreground">
              {activeStepIdx + 1}/{steps.length}
            </div>
          </div>
        </div>
      )}
    </div>
    </APIProvider>
  );
}
