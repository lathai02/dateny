import type { Coordinates } from "./types";
import type { TravelMode } from "./route-types";

// Maps URLs open the user's Maps app/browser; this is not a Google Maps Platform API call.
export function googleMapsDirectionsUrl(
  destination: Coordinates,
  mode: TravelMode,
): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.latitude.toFixed(6)},${destination.longitude.toFixed(6)}`,
    travelmode: mode === "motorcycle" ? "two-wheeler" : mode,
    dir_action: "navigate",
  });
  return `https://www.google.com/maps/dir/?${params}`;
}
