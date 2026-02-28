import { useState, useCallback, useEffect, useRef } from "react";

interface GeoState {
  lat: number | null;
  lng: number | null;
  heading: number | null; // Direction of travel in degrees (0-360)
  error: string | null;
  loading: boolean;
  granted: boolean;
}

export function useGeolocation(watch = false) {
  const [state, setState] = useState<GeoState>({
    lat: null,
    lng: null,
    heading: null,
    error: null,
    loading: false,
    granted: false,
  });
  const watchIdRef = useRef<number | null>(null);
  const previousPosRef = useRef<{ lat: number; lng: number } | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: "Geolocation not supported" }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    // Get initial position quickly
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const heading = pos.coords.heading ?? null;
        setState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading,
          error: null,
          loading: false,
          granted: true,
        });
        previousPosRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      (err) => {
        setState((s) => ({
          ...s,
          loading: false,
          error:
            err.code === 1
              ? "Location access denied. Please enable it in your browser settings."
              : err.code === 2
              ? "Location unavailable"
              : "Location request timed out",
        }));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    // Start watching for live updates
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        let heading = pos.coords.heading ?? null;
        
        // If device doesn't provide heading, calculate from movement
        if (heading === null && previousPosRef.current) {
          const prev = previousPosRef.current;
          const dLng = pos.coords.longitude - prev.lng;
          const dLat = pos.coords.latitude - prev.lat;
          if (Math.abs(dLng) > 0.00001 || Math.abs(dLat) > 0.00001) {
            heading = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
          }
        }
        
        setState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading,
          error: null,
          loading: false,
          granted: true,
        });
        previousPosRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      () => {
        // Silently ignore watch errors — we already have initial position
      },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
  }, []);

  // Cleanup watcher on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Continuous watch mode
  useEffect(() => {
    if (!watch || !state.granted || !navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState((s) => {
          let heading = pos.coords.heading ?? s.heading;
          
          // Calculate heading from movement if not provided
          if (heading === null && previousPosRef.current) {
            const prev = previousPosRef.current;
            const dLng = pos.coords.longitude - prev.lng;
            const dLat = pos.coords.latitude - prev.lat;
            if (Math.abs(dLng) > 0.00001 || Math.abs(dLat) > 0.00001) {
              heading = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
            }
          }
          
          previousPosRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          
          return {
            ...s,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading,
            error: null,
          };
        });
      },
      (err) => {
        setState((s) => ({
          ...s,
          error: err.code === 2 ? "Location unavailable" : s.error,
        }));
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [watch, state.granted]);

  return { ...state, requestLocation };
}
