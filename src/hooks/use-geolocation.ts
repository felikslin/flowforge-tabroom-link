import { useState, useCallback, useEffect, useRef } from "react";

interface GeoState {
  lat: number | null;
  lng: number | null;
  error: string | null;
  loading: boolean;
  granted: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    lat: null,
    lng: null,
    error: null,
    loading: false,
    granted: false,
  });
  const watchIdRef = useRef<number | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: "Geolocation not supported" }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    // Get initial position quickly
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          error: null,
          loading: false,
          granted: true,
        });
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
        setState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          error: null,
          loading: false,
          granted: true,
        });
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

  return { ...state, requestLocation };
}
