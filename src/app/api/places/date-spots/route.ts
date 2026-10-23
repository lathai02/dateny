import { queryDateSpots, queryPhotonDateSpots } from "@/lib/places/date-spots";
import { distanceInMeters } from "@/lib/places/overpass";
import type { DateSpot } from "@/lib/places/date-plan";
import type { Coordinates } from "@/lib/places/types";
import { consumeRateLimit } from "@/lib/security/request";

export const runtime = "nodejs";

type LookupResult = { spots: DateSpot[]; source: "overpass" | "photon" };
const cache = new Map<string, LookupResult & { expiresAt: number }>();
const inFlight = new Map<string, Promise<LookupResult>>();
let lastRequestAt = 0;
let backoffUntil = 0;
let overpassBackoffUntil = 0;
let photonBackoffUntil = 0;

async function queryProviders(center: Coordinates, radius: number): Promise<LookupResult> {
  let photonSpots: DateSpot[] | null = null;
  if (Date.now() >= photonBackoffUntil) {
    try {
      photonSpots = await queryPhotonDateSpots(center, radius);
      if (photonSpots.length) return { spots: photonSpots, source: "photon" };
    } catch (failure) {
      photonBackoffUntil = Date.now() + 30_000;
      console.warn("Dateny: date spot Photon unavailable; trying Overpass", failure instanceof Error ? failure.message : failure);
    }
  }
  if (Date.now() >= overpassBackoffUntil) {
    try { return { spots: await queryDateSpots(center, radius), source: "overpass" }; }
    catch (failure) {
      overpassBackoffUntil = Date.now() + 30_000;
      console.warn("Dateny: date spot Overpass unavailable", failure instanceof Error ? failure.message : failure);
    }
  }
  if (photonSpots) return { spots: photonSpots, source: "photon" };
  throw new Error("Both date spot providers unavailable");
}

function error(message: string, status: number, retryAfter?: number): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store", ...(retryAfter && { "Retry-After": String(retryAfter) }) } });
}

export async function GET(request: Request): Promise<Response> {
  const retryAfter = consumeRateLimit(request, "places:date-spots", 20, 60_000);
  if (retryAfter) return error("Bạn đang gửi quá nhiều yêu cầu. Hãy thử lại sau.", 429, retryAfter);
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lon = Number(params.get("lon"));
  const radius = params.has("radius") ? Number(params.get("radius")) : 3_000;
  if (!params.get("lat")?.trim() || !params.get("lon")?.trim() || !Number.isFinite(lat) || !Number.isFinite(lon)
    || Math.abs(lat) > 90 || Math.abs(lon) > 180 || !Number.isInteger(radius) || radius < 250 || radius > 5_000) {
    return error("Vị trí hoặc bán kính không hợp lệ.", 400);
  }
  const center: Coordinates = { latitude: Number(lat.toFixed(4)), longitude: Number(lon.toFixed(4)) };
  const key = `${center.latitude}:${center.longitude}:${radius}`;
  const now = Date.now();
  let lookup: LookupResult | undefined = cache.get(key)?.expiresAt && cache.get(key)!.expiresAt > now ? cache.get(key) : undefined;
  if (!lookup) {
    let pending = inFlight.get(key);
    if (!pending) {
      if (now < backoffUntil) return error("Nguồn địa điểm đang bận. Hãy thử lại sau.", 429, Math.ceil((backoffUntil - now) / 1000));
      if (now - lastRequestAt < 1_500) return error("Đang có quá nhiều yêu cầu. Thử lại sau 2 giây.", 429, 2);
      lastRequestAt = now;
      pending = queryProviders(center, radius);
      inFlight.set(key, pending);
      pending.then((result) => {
        cache.set(key, { ...result, expiresAt: Date.now() + 5 * 60_000 });
        if (cache.size > 80) cache.delete(cache.keys().next().value!);
      }).catch(() => { backoffUntil = Date.now() + 30_000; }).finally(() => { inFlight.delete(key); });
    }
    try { lookup = await pending; }
    catch (failure) {
      console.warn("Dateny: both date spot providers failed", failure instanceof Error ? failure.message : failure);
      return error("Chưa tải được điểm vui chơi. Vui lòng thử lại sau.", 502);
    }
  }
  const exactCenter = { latitude: lat, longitude: lon };
  return Response.json({ spots: lookup.spots.map((spot) => ({ ...spot, distanceMeters: distanceInMeters(exactCenter, spot) }))
    .filter((spot) => spot.distanceMeters <= radius), center: exactCenter, radiusMeters: radius, source: lookup.source },
  { headers: { "Cache-Control": "private, max-age=60" } });
}
