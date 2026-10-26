import { errorResponse, numericParam } from "@/server/http";
import { distanceInMeters, queryOverpass } from "@/lib/places/overpass";
import { queryPhoton } from "@/lib/places/photon";
import { queryGeoapify } from "@/lib/places/geoapify";
import {
  PLACE_CATEGORIES,
  type Coordinates,
  type NearbyPlacesResponse,
  type Place,
  type PlaceCategoryFilter,
} from "@/lib/places/types";
import { consumeRateLimit } from "@/lib/security/request";

const MIN_RADIUS_METERS = 250;
const MAX_RADIUS_METERS = 5_000;
const CACHE_TTL_MS = 15 * 60_000;
const MIN_UPSTREAM_GAP_MS = 300;
const MAX_CACHE_ENTRIES = 80;

type LookupResult = { places: Place[]; source: NearbyPlacesResponse["source"] };
type CacheEntry = LookupResult & { expiresAt: number; fetchedAt: string };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<LookupResult>>();
let lastUpstreamStart = 0;
let overpassBackoffUntil = 0;
let photonBackoffUntil = 0;
let geoapifyBackoffUntil = 0;

async function queryPlaces(
  center: Coordinates,
  radiusMeters: number,
  category: PlaceCategoryFilter,
): Promise<LookupResult> {
  if (
    process.env.GEOAPIFY_API_KEY?.trim() &&
    Date.now() >= geoapifyBackoffUntil
  ) {
    try {
      const places = await queryGeoapify(center, radiusMeters, category);
      if (places.length) return { places, source: "geoapify" };
    } catch (error) {
      geoapifyBackoffUntil = Date.now() + 30_000;
      console.warn(
        "Dateny: Geoapify unavailable; trying Photon",
        error instanceof Error ? error.message : error,
      );
    }
  }

  let photonPlaces: Place[] | null = null;
  if (Date.now() >= photonBackoffUntil) {
    try {
      photonPlaces = await queryPhoton(center, radiusMeters, category);
      if (photonPlaces.length)
        return { places: photonPlaces, source: "photon" };
    } catch (error) {
      photonBackoffUntil = Date.now() + 30_000;
      console.warn(
        "Dateny: Photon unavailable; trying Overpass",
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (Date.now() >= overpassBackoffUntil) {
    try {
      return {
        places: await queryOverpass(center, radiusMeters, category),
        source: "overpass",
      };
    } catch (error) {
      overpassBackoffUntil = Date.now() + 30_000;
      console.warn(
        "Dateny: Overpass unavailable",
        error instanceof Error ? error.message : error,
      );
    }
  }
  if (photonPlaces) return { places: photonPlaces, source: "photon" };
  throw new Error("All place providers are unavailable");
}

export async function getNearbyPlaces(request: Request): Promise<Response> {
  const retryAfter = consumeRateLimit(request, "places:nearby", 30, 60_000);
  if (retryAfter)
    return errorResponse(
      "Bạn đang gửi quá nhiều yêu cầu. Hãy thử lại sau.",
      429,
      retryAfter,
    );
  const params = new URL(request.url).searchParams;
  const latitude = numericParam(params.get("lat"));
  const longitude = numericParam(params.get("lon"));
  const radiusMeters = params.has("radius")
    ? numericParam(params.get("radius"))
    : 2_000;
  const category = params.get("category") ?? "all";

  if (
    latitude === null ||
    longitude === null ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 ||
    radiusMeters === null ||
    !Number.isInteger(radiusMeters) ||
    radiusMeters < MIN_RADIUS_METERS ||
    radiusMeters > MAX_RADIUS_METERS ||
    (category !== "all" &&
      !PLACE_CATEGORIES.includes(category as (typeof PLACE_CATEGORIES)[number]))
  ) {
    return errorResponse("Vị trí, bán kính hoặc loại quán không hợp lệ.", 400);
  }

  // Nearby coordinate rounding lets close repeat requests share one cached query.
  const queryCenter: Coordinates = {
    latitude: Number(latitude.toFixed(4)),
    longitude: Number(longitude.toFixed(4)),
  };
  const key = `${queryCenter.latitude}:${queryCenter.longitude}:${radiusMeters}:${category}`;
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && existing.expiresAt <= now) cache.delete(key);

  let lookup: LookupResult | undefined =
    existing && existing.expiresAt > now ? existing : undefined;
  let fetchedAt =
    existing && existing.expiresAt > now ? existing.fetchedAt : undefined;
  if (!lookup) {
    let pending = inFlight.get(key);
    if (!pending) {
      if (now - lastUpstreamStart < MIN_UPSTREAM_GAP_MS) {
        return errorResponse(
          "Đang có quá nhiều yêu cầu. Thử lại sau 2 giây.",
          429,
          2,
        );
      }
      lastUpstreamStart = now;
      pending = queryPlaces(
        queryCenter,
        radiusMeters,
        category as PlaceCategoryFilter,
      );
      inFlight.set(key, pending);
      pending
        .then((result) => {
          cache.set(key, {
            ...result,
            expiresAt: Date.now() + CACHE_TTL_MS,
            fetchedAt: new Date().toISOString(),
          });
          if (cache.size > MAX_CACHE_ENTRIES)
            cache.delete(cache.keys().next().value!);
        })
        .finally(() => inFlight.delete(key))
        .catch(() => undefined);
    }
    try {
      lookup = await pending;
      fetchedAt = cache.get(key)?.fetchedAt;
    } catch (error) {
      console.error(
        "Dateny: both place providers failed",
        error instanceof Error ? error.message : error,
      );
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        return errorResponse("Tìm quán quá lâu. Vui lòng thử lại.", 504);
      }
      return errorResponse("Nguồn địa điểm đang lỗi. Vui lòng thử lại.", 502);
    }
  }

  const exactCenter = { latitude, longitude };
  const response: NearbyPlacesResponse = {
    center: exactCenter,
    radiusMeters,
    category: category as PlaceCategoryFilter,
    source: lookup.source,
    places: lookup.places
      .map((place) => ({
        ...place,
        distanceMeters: distanceInMeters(exactCenter, place),
      }))
      .filter((place) => place.distanceMeters <= radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters),
    fetchedAt: fetchedAt ?? new Date().toISOString(),
  };
  return Response.json(response, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
