import { useState, useEffect } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

interface GeocodeResult {
  lat: number;
  lng: number;
}

export function useGeocode(address: string | null) {
  const geocodingLib = useMapsLibrary("geocoding");
  const [result, setResult] = useState<GeocodeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!geocodingLib || !address) {
      setResult(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const geocoder = new geocodingLib.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (cancelled) return;
      setLoading(false);

      if (status === "OK" && results && results.length > 0) {
        const location = results[0].geometry.location;
        setResult({ lat: location.lat(), lng: location.lng() });
      } else {
        setError(`Geocoding failed: ${status}`);
        setResult(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [geocodingLib, address]);

  return { result, loading, error };
}
