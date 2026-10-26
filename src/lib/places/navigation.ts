import type { TravelRoute, TravelStep } from "./route-types";
import type { Coordinates } from "./types";

const EARTH_RADIUS_METERS = 6_371_000;

export function metersBetween(a: Coordinates, b: Coordinates): number {
  const latitude = (a.latitude + b.latitude) * Math.PI / 360;
  const north = (b.latitude - a.latitude) * Math.PI / 180 * EARTH_RADIUS_METERS;
  const east = (b.longitude - a.longitude) * Math.PI / 180 * EARTH_RADIUS_METERS * Math.cos(latitude);
  return Math.hypot(north, east);
}

function nearestPathPoint(path: Coordinates[], position: Coordinates): { along: number; away: number } {
  let best = { along: 0, away: Infinity };
  let traversed = 0;
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1];
    const to = path[index];
    const latitude = position.latitude * Math.PI / 180;
    const scaleX = 111_195 * Math.cos(latitude);
    const scaleY = 111_195;
    const dx = (to.longitude - from.longitude) * scaleX;
    const dy = (to.latitude - from.latitude) * scaleY;
    const px = (position.longitude - from.longitude) * scaleX;
    const py = (position.latitude - from.latitude) * scaleY;
    const lengthSquared = dx * dx + dy * dy;
    const fraction = lengthSquared ? Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSquared)) : 0;
    const away = Math.hypot(px - fraction * dx, py - fraction * dy);
    const length = Math.sqrt(lengthSquared);
    if (away < best.away) best = { along: traversed + fraction * length, away };
    traversed += length;
  }
  return best;
}

export function navigationProgress(route: TravelRoute, position: Coordinates) {
  const pathLength = route.coordinates.reduce((total, point, index) =>
    index ? total + metersBetween(route.coordinates[index - 1], point) : 0, 0);
  const nearest = nearestPathPoint(route.coordinates, position);
  const traveledFraction = pathLength ? Math.min(1, nearest.along / pathLength) : 0;
  const remainingMeters = route.distanceMeters * (1 - traveledFraction);
  const next = route.steps
    .filter((step) => step.type !== "depart" && step.type !== "arrive")
    .map((step) => ({ step, along: nearestPathPoint(route.coordinates, step.location).along }))
    .find(({ along }) => along > nearest.along + 8);
  return {
    remainingMeters,
    remainingSeconds: route.distanceMeters > 0 ? route.durationSeconds * remainingMeters / route.distanceMeters : 0,
    offRouteMeters: nearest.away,
    nextStep: next?.step ?? null,
    metersToStep: next ? Math.max(0, next.along - nearest.along) : remainingMeters,
    arrived: remainingMeters < 25 && metersBetween(position, route.coordinates[route.coordinates.length - 1]) < 35,
  };
}

export function walkingStepText(step: TravelStep | null): string {
  if (!step) return "Tiếp tục đi tới điểm đến";
  if (step.type === "roundabout" || step.type === "rotary") return "Đi vào vòng xuyến";
  if (step.type === "exit roundabout" || step.type === "exit rotary") return "Ra khỏi vòng xuyến";
  if (step.type === "uturn" || step.modifier === "uturn") return "Quay đầu";
  if (step.modifier?.includes("left")) return "Rẽ trái";
  if (step.modifier?.includes("right")) return "Rẽ phải";
  return "Đi thẳng";
}
