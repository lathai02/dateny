import { distanceInMeters } from "./overpass";
import {
  PLACE_CATEGORIES,
  type Coordinates,
  type OsmElementType,
  type Place,
  type PlaceCategory,
  type PlaceCategoryFilter,
} from "./types";

type PhotonFeature = {
  geometry?: { type?: unknown; coordinates?: unknown };
  properties?: Record<string, unknown>;
};

type PhotonResponse = { features?: unknown };

const DEFAULT_ENDPOINT = "https://photon.komoot.io/reverse";
const TIMEOUT_MS = 4_000;
const MAX_RESPONSE_BYTES = 1_500_000;
const OSM_TYPES: Record<string, OsmElementType> = { N: "node", W: "way", R: "relation" };

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function websiteFrom(properties: Record<string, unknown>): string | undefined {
  const extra = properties.extra && typeof properties.extra === "object"
    ? properties.extra as Record<string, unknown> : {};
  const raw = nonEmpty(extra.website) ?? nonEmpty(extra["contact:website"]);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function normalizePhotonPlaces(
  payload: PhotonResponse,
  center: Coordinates,
  radiusMeters: number,
  categoryFilter: PlaceCategoryFilter,
): Place[] {
  if (!Array.isArray(payload.features)) throw new Error("Invalid Photon response");
  const places: Place[] = [];
  const seen = new Set<string>();

  for (const value of payload.features as PhotonFeature[]) {
    if (!value || typeof value !== "object") continue;
    const properties = value.properties;
    const point = value.geometry?.coordinates;
    if (!properties || typeof properties !== "object" || !Array.isArray(point)) continue;
    if (value.geometry?.type !== "Point") continue;
    const [longitude, latitude] = point;
    if (typeof latitude !== "number" || typeof longitude !== "number") continue;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    if (properties.osm_key !== "amenity") continue;
    const category = properties.osm_value;
    if (!PLACE_CATEGORIES.includes(category as PlaceCategory)) continue;
    if (categoryFilter !== "all" && category !== categoryFilter) continue;
    const osmType = OSM_TYPES[String(properties.osm_type)];
    const osmId = properties.osm_id;
    const name = nonEmpty(properties.name);
    if (!osmType || typeof osmId !== "number" || !Number.isSafeInteger(osmId) || !name) continue;
    const id = `${osmType}/${osmId}`;
    if (seen.has(id)) continue;

    const distanceMeters = distanceInMeters(center, { latitude, longitude });
    if (distanceMeters > radiusMeters) continue;
    const street = [nonEmpty(properties.housenumber), nonEmpty(properties.street)].filter(Boolean).join(" ");
    const address = [street || undefined, nonEmpty(properties.district), nonEmpty(properties.city)]
      .filter(Boolean).join(", ") || undefined;
    const extra = properties.extra && typeof properties.extra === "object"
      ? properties.extra as Record<string, unknown> : {};
    const cuisine = nonEmpty(extra.cuisine);
    const openingHours = nonEmpty(extra.opening_hours);
    const website = websiteFrom(properties);

    seen.add(id);
    places.push({
      id,
      osmType,
      name,
      category: category as PlaceCategory,
      latitude,
      longitude,
      distanceMeters,
      ...(address && { address }),
      ...(cuisine && { cuisine }),
      ...(openingHours && { openingHours }),
      ...(website && { website }),
    });
  }
  return places.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export async function queryPhoton(
  center: Coordinates,
  radiusMeters: number,
  category: PlaceCategoryFilter,
): Promise<Place[]> {
  const url = new URL(process.env.PHOTON_API_URL || DEFAULT_ENDPOINT);
  url.searchParams.set("lat", String(center.latitude));
  url.searchParams.set("lon", String(center.longitude));
  url.searchParams.set("radius", String(radiusMeters / 1_000));
  // A larger single response keeps category filters useful in dense city centres
  // without requiring extra public-server requests.
  url.searchParams.set("limit", "120");
  for (const item of category === "all" ? PLACE_CATEGORIES : [category]) {
    url.searchParams.append("osm_tag", `amenity:${item}`);
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Dateny/0.1 (nearby place discovery)" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Photon returned ${response.status}`);
  const declaredLength = Number(response.headers.get("content-length"));
  if (declaredLength > MAX_RESPONSE_BYTES) throw new Error("Photon response too large");
  const body = await response.text();
  if (body.length > MAX_RESPONSE_BYTES) throw new Error("Photon response too large");
  return normalizePhotonPlaces(JSON.parse(body) as PhotonResponse, center, radiusMeters, category);
}
