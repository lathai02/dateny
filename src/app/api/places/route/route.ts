import type { WalkingRoute, WalkingStep } from "@/lib/places/route-types";
import type { Coordinates } from "@/lib/places/types";
import { consumeRateLimit } from "@/lib/security/request";

export const runtime = "nodejs";

const ROUTER_URL = (process.env.OSRM_FOOT_BASE_URL?.trim() || "https://routing.openstreetmap.de/routed-foot").replace(/\/+$/, "");
const CACHE_TTL_MS = 5 * 60_000;
const MIN_UPSTREAM_GAP_MS = 1_500;
const MAX_CACHE_ENTRIES = 100;
const cache = new Map<string, { route: WalkingRoute; expiresAt: number }>();
const inFlight = new Map<string, Promise<WalkingRoute>>();
let lastUpstreamStart = 0;

function numberParam(value: string | null): number | null {
  if (!value?.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validCoordinate(point: Coordinates): boolean {
  return Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}

function error(message: string, status: number, retryAfter?: number): Response {
  return Response.json({ error: message }, { status, headers: {
    "Cache-Control": "no-store",
    ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
  } });
}

function parseRoute(data: unknown): WalkingRoute {
  if (!data || typeof data !== "object" || !("code" in data) || data.code !== "Ok" || !("routes" in data) || !Array.isArray(data.routes)) {
    throw new Error("Không tìm thấy đường đi bộ đến quán này.");
  }
  const route = data.routes[0];
  if (!route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration) || !Array.isArray(route.geometry?.coordinates)) {
    throw new Error("Dữ liệu chỉ đường không hợp lệ.");
  }
  const rawCoordinates: unknown[] = route.geometry.coordinates;
  if (rawCoordinates.length < 2 || rawCoordinates.length > 10_000) throw new Error("Dữ liệu chỉ đường không hợp lệ.");
  const coordinates = rawCoordinates.map((point) => {
    if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) throw new Error("Dữ liệu chỉ đường không hợp lệ.");
    const coordinate = { latitude: point[1] as number, longitude: point[0] as number };
    if (!validCoordinate(coordinate)) throw new Error("Dữ liệu chỉ đường không hợp lệ.");
    return coordinate;
  });
  const steps: WalkingStep[] = (Array.isArray(route.legs) ? route.legs : [])
    .flatMap((leg: { steps?: unknown }) => Array.isArray(leg.steps) ? leg.steps : [])
    .filter((step: { maneuver?: { location?: unknown } }) => {
      const location = step?.maneuver?.location;
      return Array.isArray(location) && Number.isFinite(location[0]) && Number.isFinite(location[1])
        && validCoordinate({ longitude: location[0], latitude: location[1] });
    })
    .slice(0, 150)
    .map((step: { distance?: number; name?: string; maneuver: { location: number[]; type?: string; modifier?: string } }) => ({
      location: { longitude: step.maneuver.location[0], latitude: step.maneuver.location[1] },
      distanceMeters: Number.isFinite(step.distance) ? Math.max(0, step.distance!) : 0,
      type: typeof step.maneuver.type === "string" ? step.maneuver.type : "turn",
      ...(typeof step.maneuver.modifier === "string" ? { modifier: step.maneuver.modifier } : {}),
      ...(typeof step.name === "string" && step.name.trim() ? { street: step.name.trim().slice(0, 120) } : {}),
    }));
  return { coordinates, distanceMeters: route.distance, durationSeconds: route.duration, steps };
}

async function fetchRoute(from: Coordinates, to: Coordinates): Promise<WalkingRoute> {
  const path = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  // FOSSGIS selects the foot profile via /routed-foot; its OSRM route path still uses /v1/driving/.
  const url = `${ROUTER_URL}/route/v1/driving/${path}?overview=full&geometries=geojson&steps=true`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(9_000),
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": "Dateny/1.0 (walking route planner)" },
  });
  if (!response.ok) throw new Error("Dịch vụ chỉ đường chưa phản hồi. Hãy thử lại sau.");
  return parseRoute(await response.json());
}

export async function GET(request: Request): Promise<Response> {
  const retryAfter = consumeRateLimit(request, "places:route", 40, 60_000);
  if (retryAfter) return error("Bạn đang gửi quá nhiều yêu cầu. Hãy thử lại sau.", 429, retryAfter);
  const params = new URL(request.url).searchParams;
  const from = { latitude: numberParam(params.get("fromLat")), longitude: numberParam(params.get("fromLon")) };
  const to = { latitude: numberParam(params.get("toLat")), longitude: numberParam(params.get("toLon")) };
  if (from.latitude === null || from.longitude === null || to.latitude === null || to.longitude === null
    || !validCoordinate(from as Coordinates) || !validCoordinate(to as Coordinates)) {
    return error("Vị trí bắt đầu hoặc điểm đến không hợp lệ.", 400);
  }
  const origin = from as Coordinates;
  const destination = to as Coordinates;
  const latGap = (origin.latitude - destination.latitude) * 111_000;
  const lonGap = (origin.longitude - destination.longitude) * 111_000 * Math.cos(origin.latitude * Math.PI / 180);
  if (Math.hypot(latGap, lonGap) > 8_000) return error("Quán ở quá xa để chỉ đường đi bộ trong app.", 400);

  const rounded = [origin.longitude, origin.latitude, destination.longitude, destination.latitude].map((value) => value.toFixed(5));
  const key = rounded.join(":");
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return Response.json(cached.route, { headers: { "Cache-Control": "private, max-age=60" } });
  if (cached) cache.delete(key);

  let pending = inFlight.get(key);
  if (!pending) {
    if (now - lastUpstreamStart < MIN_UPSTREAM_GAP_MS) return error("Đang có nhiều yêu cầu. Hãy thử lại sau 2 giây.", 429, 2);
    lastUpstreamStart = now;
    const roundedFrom = { longitude: Number(rounded[0]), latitude: Number(rounded[1]) };
    const roundedTo = { longitude: Number(rounded[2]), latitude: Number(rounded[3]) };
    pending = fetchRoute(roundedFrom, roundedTo);
    inFlight.set(key, pending);
    pending.then((route) => {
      cache.set(key, { route, expiresAt: Date.now() + CACHE_TTL_MS });
      if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
    }).finally(() => inFlight.delete(key)).catch(() => undefined);
  }
  try {
    const route = await pending;
    return Response.json(route, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (cause) {
    console.warn("Dateny: walking routing failed", cause instanceof Error ? cause.message : cause);
    return error(cause instanceof Error && cause.name === "TimeoutError"
      ? "Tìm đường quá lâu. Hãy thử lại hoặc mở OpenStreetMap."
      : cause instanceof Error ? cause.message : "Chưa thể tìm đường đi bộ lúc này.", 503);
  }
}
