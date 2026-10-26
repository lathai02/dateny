"use client";

import { useCallback, useEffect, useState } from "react";
import { getJson } from "@/lib/http/client";
import type {
  Coordinates,
  NearbyPlacesResponse,
  Place,
} from "@/lib/places/types";

type Results = NearbyPlacesResponse & { centerKey: string };
const EMPTY_PLACES: Place[] = [];

export function useNearbyPlaces(
  coordinates: Coordinates | null,
  radiusMeters: number,
) {
  const [results, setResults] = useState<Results | null>(null);
  const [requestState, setRequestState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [requestError, setRequestError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const retry = useCallback(() => setRetryKey((key) => key + 1), []);
  const latitude = coordinates?.latitude;
  const longitude = coordinates?.longitude;
  const centerKey = coordinates
    ? `${latitude!.toFixed(4)}:${longitude!.toFixed(4)}`
    : "";
  const hasCoverage = Boolean(
    results &&
    results.centerKey === centerKey &&
    results.radiusMeters >= radiusMeters,
  );

  useEffect(() => {
    if (latitude === undefined || longitude === undefined || hasCoverage)
      return;
    const controller = new AbortController();
    const load = async () => {
      setRequestState("loading");
      setRequestError("");
      const params = new URLSearchParams({
        lat: latitude.toFixed(6),
        lon: longitude.toFixed(6),
        radius: String(radiusMeters),
        category: "all",
      });
      try {
        const data = await getJson<NearbyPlacesResponse>(
          `/api/places/nearby?${params}`,
          { signal: controller.signal },
        );
        if (!data || !Array.isArray(data.places))
          throw new Error("Dữ liệu địa điểm không hợp lệ.");
        if (controller.signal.aborted) return;
        setResults({ ...data, centerKey });
        setRequestState("success");
      } catch (error) {
        if (controller.signal.aborted) return;
        setRequestError(
          error instanceof Error ? error.message : "Chưa tải được địa điểm.",
        );
        setRequestState("error");
      }
    };
    void load();
    return () => controller.abort();
  }, [centerKey, latitude, longitude, radiusMeters, hasCoverage, retryKey]);

  return {
    results,
    hasCoverage,
    requestState,
    requestError,
    retry,
    hasEnteredDiscovery: results !== null,
    places: hasCoverage ? results!.places : EMPTY_PLACES,
  };
}
