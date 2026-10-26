import type { Coordinates } from "./types";

export function distanceInMeters(from: Coordinates, to: Coordinates): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDifference = radians(to.latitude - from.latitude);
  const longitudeDifference = radians(to.longitude - from.longitude);
  const arc =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDifference / 2) ** 2;
  const safeArc = Math.min(1, Math.max(0, arc));
  return Math.round(
    6_371_000 * 2 * Math.atan2(Math.sqrt(safeArc), Math.sqrt(1 - safeArc)),
  );
}
