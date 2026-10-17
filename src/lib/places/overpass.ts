import {
  PLACE_CATEGORIES,
  type Coordinates,
  type OsmElementType,
  type Place,
  type PlaceCategory,
  type PlaceCategoryFilter,
} from "./types";

type OverpassElement = {
  type?: unknown;
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  tags?: Record<string, unknown>;
};

type OverpassResponse = { elements?: unknown };

const DEFAULT_ENDPOINT = "https://overpass-api.de/api/interpreter";
const UPSTREAM_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 2_000_000;
const MAX_PLACES_PER_CATEGORY = 80;

export class OverpassError extends Error {
  constructor(
    message: string,
    public readonly code: "timeout" | "rate_limited" | "unavailable" | "invalid_response",
  ) {
    super(message);
  }
}

export function distanceInMeters(from: Coordinates, to: Coordinates): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDifference = radians(to.latitude - from.latitude);
  const longitudeDifference = radians(to.longitude - from.longitude);
  const arc = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude))
    * Math.sin(longitudeDifference / 2) ** 2;
  const safeArc = Math.min(1, Math.max(0, arc));
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(safeArc), Math.sqrt(1 - safeArc)));
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function websiteFrom(tags: Record<string, unknown>): string | undefined {
  const raw = nonEmpty(tags.website) ?? nonEmpty(tags["contact:website"]);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function addressFrom(tags: Record<string, unknown>): string | undefined {
  const full = nonEmpty(tags["addr:full"]);
  if (full) return full;
  const street = [nonEmpty(tags["addr:housenumber"]), nonEmpty(tags["addr:street"])]
    .filter(Boolean).join(" ");
  return [
    street || undefined,
    nonEmpty(tags["addr:suburb"]) ?? nonEmpty(tags["addr:district"]),
    nonEmpty(tags["addr:city"]),
  ].filter(Boolean).join(", ") || undefined;
}

export function buildOverpassQuery(
  center: Coordinates,
  radiusMeters: number,
  category: PlaceCategoryFilter,
): string {
  // All interpolated values are validated or from a fixed allowlist in the route.
  const around = `(around:${radiusMeters},${center.latitude},${center.longitude})`;
  const categories = category === "all" ? PLACE_CATEGORIES : [category];
  const selectors = categories.map((item) => `nwr["amenity"="${item}"]${around};`).join("");
  return `[out:json][timeout:9];(${selectors});out tags center;`;
}

export function normalizeOverpassPlaces(
  payload: OverpassResponse,
  center: Coordinates,
  radiusMeters: number,
  categoryFilter: PlaceCategoryFilter = "all",
): Place[] {
  if (!Array.isArray(payload.elements)) throw new OverpassError("Invalid Overpass response", "invalid_response");

  const places: Place[] = [];
  for (const value of payload.elements as OverpassElement[]) {
    if (!value || typeof value !== "object") continue;
    if (value.type !== "node" && value.type !== "way" && value.type !== "relation") continue;
    if (typeof value.id !== "number" || !Number.isSafeInteger(value.id)) continue;
    const tags = value.tags && typeof value.tags === "object" ? value.tags : {};
    const category = tags.amenity;
    if (!PLACE_CATEGORIES.includes(category as PlaceCategory)) continue;
    if (categoryFilter !== "all" && category !== categoryFilter) continue;
    const name = nonEmpty(tags["name:vi"]) ?? nonEmpty(tags.name) ?? nonEmpty(tags["name:en"]);
    if (!name) continue;

    const latitude = value.type === "node" ? value.lat ?? value.center?.lat : value.center?.lat;
    const longitude = value.type === "node" ? value.lon ?? value.center?.lon : value.center?.lon;
    if (typeof latitude !== "number" || typeof longitude !== "number") continue;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;

    const point = { latitude, longitude };
    const distanceMeters = distanceInMeters(center, point);
    if (distanceMeters > radiusMeters) continue;
    const address = addressFrom(tags);
    const cuisine = nonEmpty(tags.cuisine);
    const openingHours = nonEmpty(tags.opening_hours);
    const website = websiteFrom(tags);
    places.push({
      id: `${value.type}/${value.id}`,
      osmType: value.type as OsmElementType,
      name,
      category: category as PlaceCategory,
      ...point,
      distanceMeters,
      ...(address && { address }),
      ...(cuisine && { cuisine }),
      ...(openingHours && { openingHours }),
      ...(website && { website }),
    });
  }
  const counts: Record<PlaceCategory, number> = { restaurant: 0, cafe: 0, fast_food: 0 };
  return places.sort((a, b) => a.distanceMeters - b.distanceMeters).filter((place) => {
    if (counts[place.category] >= MAX_PLACES_PER_CATEGORY) return false;
    counts[place.category] += 1;
    return true;
  });
}

export async function queryOverpass(
  center: Coordinates,
  radiusMeters: number,
  category: PlaceCategoryFilter,
): Promise<Place[]> {
  const endpoint = process.env.OVERPASS_API_URL || DEFAULT_ENDPOINT;
  const query = buildOverpassQuery(center, radiusMeters, category);
  const signal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Dateny/0.1 (nearby place discovery)",
        Accept: "application/json",
      },
      body: new URLSearchParams({ data: query }),
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (signal.aborted || (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))) {
      throw new OverpassError("Overpass timed out", "timeout");
    }
    throw new OverpassError("Overpass is unavailable", "unavailable");
  }

  if (response.status === 429 || response.status === 406) {
    throw new OverpassError("Overpass rate limit", "rate_limited");
  }
  if (!response.ok) throw new OverpassError(`Overpass returned ${response.status}`, "unavailable");
  const declaredLength = Number(response.headers.get("content-length"));
  if (declaredLength > MAX_RESPONSE_BYTES) throw new OverpassError("Overpass response too large", "invalid_response");

  let payload: unknown;
  try {
    if (!response.body) throw new Error("Empty response");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Response too large");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    if (signal.aborted) throw new OverpassError("Overpass timed out", "timeout");
    throw new OverpassError("Invalid Overpass response", "invalid_response");
  }
  if (!payload || typeof payload !== "object") throw new OverpassError("Invalid Overpass response", "invalid_response");
  return normalizeOverpassPlaces(payload as OverpassResponse, center, radiusMeters, category);
}
