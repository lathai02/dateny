import { distanceInMeters } from "./overpass";
import {
  PLACE_CATEGORIES,
  type Coordinates,
  type Place,
  type PlaceCategory,
  type PlaceCategoryFilter,
} from "./types";

type GeoapifyFeature = {
  geometry?: { type?: unknown; coordinates?: unknown };
  properties?: Record<string, unknown>;
};

type GeoapifyResponse = { features?: unknown };

const DEFAULT_ENDPOINT = "https://api.geoapify.com/v2/places";
const TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 1_500_000;
const MAX_RESULTS = 120;
const DEFAULT_DAILY_SAFETY_LIMIT = 1_000;
let budgetDay = "";
let requestsToday = 0;

const API_CATEGORIES: Record<PlaceCategory, string> = {
  restaurant: "catering.restaurant",
  cafe: "catering.cafe",
  fast_food: "catering.fast_food",
};

function consumeDailySafetyBudget() {
  const today = new Date().toISOString().slice(0, 10);
  if (budgetDay !== today) {
    budgetDay = today;
    requestsToday = 0;
  }
  const configured = Number(process.env.GEOAPIFY_DAILY_REQUEST_LIMIT);
  const limit =
    Number.isInteger(configured) && configured > 0
      ? configured
      : DEFAULT_DAILY_SAFETY_LIMIT;
  if (requestsToday >= limit)
    throw new Error("Geoapify daily safety limit reached");
  requestsToday += 1;
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function safeWebsite(value: unknown): string | undefined {
  const raw = nonEmpty(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function categoryFrom(
  properties: Record<string, unknown>,
): PlaceCategory | undefined {
  const categories = Array.isArray(properties.categories)
    ? properties.categories
    : [];
  for (const category of PLACE_CATEGORIES) {
    if (
      categories.some(
        (value) =>
          typeof value === "string" &&
          value.startsWith(API_CATEGORIES[category]),
      )
    ) {
      return category;
    }
  }
  return undefined;
}

export function buildGeoapifyPlacesUrl(
  center: Coordinates,
  radiusMeters: number,
  category: PlaceCategoryFilter,
  apiKey: string,
): URL {
  const url = new URL(process.env.GEOAPIFY_PLACES_URL || DEFAULT_ENDPOINT);
  const categories = category === "all" ? PLACE_CATEGORIES : [category];
  const point = `${center.longitude},${center.latitude}`;
  url.searchParams.set(
    "categories",
    categories.map((item) => API_CATEGORIES[item]).join(","),
  );
  url.searchParams.set("conditions", "named");
  url.searchParams.set("filter", `circle:${point},${radiusMeters}`);
  url.searchParams.set("bias", `proximity:${point}`);
  url.searchParams.set("limit", String(MAX_RESULTS));
  url.searchParams.set("lang", "vi");
  url.searchParams.set("apiKey", apiKey);
  return url;
}

export function normalizeGeoapifyPlaces(
  payload: GeoapifyResponse,
  center: Coordinates,
  radiusMeters: number,
  categoryFilter: PlaceCategoryFilter,
): Place[] {
  if (!Array.isArray(payload.features))
    throw new Error("Invalid Geoapify response");
  const places: Place[] = [];
  const seen = new Set<string>();

  for (const feature of payload.features as GeoapifyFeature[]) {
    if (
      !feature ||
      typeof feature !== "object" ||
      feature.geometry?.type !== "Point"
    )
      continue;
    const properties = feature.properties;
    const point = feature.geometry.coordinates;
    if (!properties || typeof properties !== "object" || !Array.isArray(point))
      continue;
    const [longitude, latitude] = point;
    if (typeof latitude !== "number" || typeof longitude !== "number") continue;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;

    const name = nonEmpty(properties.name);
    const id = nonEmpty(properties.place_id);
    const category = categoryFrom(properties);
    if (!name || !id || !category || seen.has(id)) continue;
    if (categoryFilter !== "all" && category !== categoryFilter) continue;
    const distanceMeters = distanceInMeters(center, { latitude, longitude });
    if (distanceMeters > radiusMeters) continue;

    const datasource =
      properties.datasource && typeof properties.datasource === "object"
        ? (properties.datasource as Record<string, unknown>)
        : {};
    const raw =
      datasource.raw && typeof datasource.raw === "object"
        ? (datasource.raw as Record<string, unknown>)
        : {};
    const addressParts = [
      nonEmpty(properties.address_line1),
      nonEmpty(properties.address_line2),
    ]
      .filter(Boolean)
      .join(", ");
    const address =
      nonEmpty(properties.formatted) ?? (addressParts || undefined);
    const cuisine = nonEmpty(raw.cuisine);
    const openingHours = nonEmpty(raw.opening_hours);
    const website = safeWebsite(raw.website ?? raw["contact:website"]);

    seen.add(id);
    places.push({
      id: `geoapify/${id}`,
      name,
      category,
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

export async function queryGeoapify(
  center: Coordinates,
  radiusMeters: number,
  category: PlaceCategoryFilter,
): Promise<Place[]> {
  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) throw new Error("Geoapify API key is not configured");
  consumeDailySafetyBudget();
  const response = await fetch(
    buildGeoapifyPlacesUrl(center, radiusMeters, category, apiKey),
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(`Geoapify returned ${response.status}`);
  const declaredLength = Number(response.headers.get("content-length"));
  if (declaredLength > MAX_RESPONSE_BYTES)
    throw new Error("Geoapify response too large");
  const body = await response.text();
  if (body.length > MAX_RESPONSE_BYTES)
    throw new Error("Geoapify response too large");
  return normalizeGeoapifyPlaces(
    JSON.parse(body) as GeoapifyResponse,
    center,
    radiusMeters,
    category,
  );
}
