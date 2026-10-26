"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getJson } from "@/lib/http/client";
import type { DateSpot } from "@/lib/places/date-plan";
import type { TravelMode, TravelRoute } from "@/lib/places/route-types";
import type { Coordinates, Place } from "@/lib/places/types";

type DirectionsState = {
  place: Place | null;
  origin: Coordinates | null;
  route: TravelRoute | null;
  mode: TravelMode;
  status: "idle" | "loading" | "ready" | "error";
  error: string;
};
const INITIAL: DirectionsState = {
  place: null,
  origin: null,
  route: null,
  mode: "walking",
  status: "idle",
  error: "",
};

export function useDirections(coordinates: Coordinates | null) {
  const [state, setState] = useState<DirectionsState>(INITIAL);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);
  const close = useCallback(() => {
    controllerRef.current?.abort();
    setState(INITIAL);
  }, []);
  const start = useCallback(
    async (destination: Place | DateSpot, mode: TravelMode = "walking") => {
      if (!coordinates) return;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const place: Place =
        "category" in destination
          ? destination
          : { ...destination, category: "restaurant" };
      // Show a route from the already-granted fix immediately. High-accuracy GPS
      // starts with live navigation and can reroute; preview no longer waits 7s for GPS.
      const origin = coordinates;
      setState({
        place,
        origin,
        route: null,
        mode,
        status: "loading",
        error: "",
      });
      try {
        const params = new URLSearchParams({
          fromLat: origin.latitude.toFixed(6),
          fromLon: origin.longitude.toFixed(6),
          toLat: place.latitude.toFixed(6),
          toLon: place.longitude.toFixed(6),
          mode,
        });
        const route = await getJson<TravelRoute>(
          `/api/places/route?${params}`,
          { signal: controller.signal },
        );
        if (
          !route ||
          !Array.isArray(route.coordinates) ||
          route.coordinates.length < 2
        )
          throw new Error("Dữ liệu chỉ đường không hợp lệ.");
        if (!controller.signal.aborted)
          setState({ place, origin, route, mode, status: "ready", error: "" });
      } catch (error) {
        if (!controller.signal.aborted)
          setState({
            place,
            origin,
            route: null,
            mode,
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : "Chưa thể tìm tuyến đường.",
          });
      }
    },
    [coordinates],
  );
  return { ...state, start, close };
}
