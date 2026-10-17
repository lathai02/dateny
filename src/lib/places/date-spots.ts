import { DATE_SPOT_KINDS, type DateSpot, type DateSpotKind } from "./date-plan";
import { distanceInMeters, OverpassError } from "./overpass";
import type { Coordinates } from "./types";

type Element = {
  type?: unknown; id?: unknown; lat?: unknown; lon?: unknown;
  center?: { lat?: unknown; lon?: unknown }; tags?: Record<string, unknown>;
};
type PhotonFeature = {
  geometry?: { type?: unknown; coordinates?: unknown };
  properties?: Record<string, unknown>;
};

const selectors: Array<[string, string, DateSpotKind]> = [
  ["amenity", "cinema", "cinema"], ["leisure", "park", "park"],
  ["tourism", "museum", "museum"], ["tourism", "gallery", "gallery"],
  ["leisure", "bowling_alley", "bowling_alley"], ["tourism", "viewpoint", "viewpoint"],
  ["tourism", "guest_house", "guest_house"],
];

const nonEmpty = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value.trim() : undefined;

export function buildDateSpotQuery(center: Coordinates, radius: number): string {
  const around = `(around:${radius},${center.latitude},${center.longitude})`;
  return `[out:json][timeout:9];(${selectors.map(([key, value]) => `nwr["${key}"="${value}"]["name"]${around};`).join("")});out tags center;`;
}

export function normalizeDateSpots(payload: { elements?: unknown }, center: Coordinates, radius: number): DateSpot[] {
  if (!Array.isArray(payload.elements)) throw new OverpassError("Invalid date spots response", "invalid_response");
  const counts = Object.fromEntries(DATE_SPOT_KINDS.map((kind) => [kind, 0])) as Record<DateSpotKind, number>;
  const spots: DateSpot[] = [];
  for (const element of payload.elements as Element[]) {
    if (!element || !["node", "way", "relation"].includes(String(element.type)) || !Number.isSafeInteger(element.id)) continue;
    const tags = element.tags && typeof element.tags === "object" ? element.tags : {};
    const match = selectors.find(([key, value]) => tags[key] === value);
    if (!match) continue;
    const kind = match[2];
    const name = nonEmpty(tags["name:vi"]) ?? nonEmpty(tags.name) ?? nonEmpty(tags["name:en"]);
    const latitude = element.type === "node" ? element.lat ?? element.center?.lat : element.center?.lat;
    const longitude = element.type === "node" ? element.lon ?? element.center?.lon : element.center?.lon;
    if (!name || typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    const point = { latitude, longitude };
    const distanceMeters = distanceInMeters(center, point);
    if (distanceMeters > radius) continue;
    const streetAddress = [nonEmpty(tags["addr:housenumber"]), nonEmpty(tags["addr:street"])].filter(Boolean).join(" ");
    const address = nonEmpty(tags["addr:full"]) ?? (streetAddress || undefined);
    const openingHours = nonEmpty(tags.opening_hours);
    const rawWebsite = nonEmpty(tags.website) ?? nonEmpty(tags["contact:website"]);
    let website: string | undefined;
    if (rawWebsite) { try { const url = new URL(rawWebsite); if (["http:", "https:"].includes(url.protocol)) website = url.href; } catch { /* Missing or invalid OSM field. */ } }
    spots.push({ id: `${element.type}/${element.id}`, name, kind, ...point, distanceMeters,
      ...(address && { address }), ...(openingHours && { openingHours }), ...(website && { website }) });
  }
  return spots.sort((a, b) => a.distanceMeters - b.distanceMeters).filter((spot) => {
    if (counts[spot.kind] >= 60) return false;
    counts[spot.kind]++;
    return true;
  });
}

export async function queryDateSpots(center: Coordinates, radius: number): Promise<DateSpot[]> {
  const signal = AbortSignal.timeout(10_000);
  let response: Response;
  try {
    response = await fetch(process.env.OVERPASS_API_URL || "https://overpass-api.de/api/interpreter", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "User-Agent": "Dateny/0.1 (date planning)", Accept: "application/json" },
      body: new URLSearchParams({ data: buildDateSpotQuery(center, radius) }), signal, cache: "no-store",
    });
  } catch {
    throw new OverpassError("Date spot request failed", signal.aborted ? "timeout" : "unavailable");
  }
  if (response.status === 429 || response.status === 406) throw new OverpassError("Overpass rate limit", "rate_limited");
  if (!response.ok) throw new OverpassError(`Overpass returned ${response.status}`, "unavailable");
  if (Number(response.headers.get("content-length")) > 2_000_000) throw new OverpassError("Date spot response too large", "invalid_response");
  if (!response.body) throw new OverpassError("Empty date spot response", "invalid_response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > 2_000_000) throw new OverpassError("Date spot response too large", "invalid_response");
      chunks.push(result.value);
    }
  } catch (error) {
    if (signal.aborted) throw new OverpassError("Date spot request timed out", "timeout");
    throw error;
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  try { return normalizeDateSpots(JSON.parse(new TextDecoder().decode(body)), center, radius); }
  catch (error) { if (error instanceof OverpassError) throw error; throw new OverpassError("Invalid date spot data", "invalid_response"); }
}

export function buildPhotonDateSpotsUrl(center: Coordinates, radius: number): URL {
  const url = new URL(process.env.PHOTON_API_URL || "https://photon.komoot.io/reverse");
  url.searchParams.set("lat", String(center.latitude));
  url.searchParams.set("lon", String(center.longitude));
  url.searchParams.set("radius", String(radius / 1_000));
  url.searchParams.set("limit", "100");
  // Photon includes any comma-separated category. A single reverse request covers all reels.
  url.searchParams.set("include", selectors.map(([key, value]) => `osm.${key}.${value}`).join(","));
  return url;
}

export function normalizePhotonDateSpots(payload: { features?: unknown }, center: Coordinates, radius: number): DateSpot[] {
  if (!Array.isArray(payload.features)) throw new Error("Invalid Photon date spots response");
  const seen = new Set<string>();
  const spots: DateSpot[] = [];
  for (const feature of payload.features as PhotonFeature[]) {
    if (!feature || feature.geometry?.type !== "Point" || !Array.isArray(feature.geometry.coordinates)) continue;
    const properties = feature.properties;
    if (!properties || typeof properties !== "object") continue;
    const match = selectors.find(([key, value]) => properties.osm_key === key && properties.osm_value === value);
    if (!match) continue;
    const osmType = { N: "node", W: "way", R: "relation" }[String(properties.osm_type) as "N" | "W" | "R"];
    const osmId = properties.osm_id;
    const [longitude, latitude] = feature.geometry.coordinates;
    const name = nonEmpty(properties.name);
    if (!osmType || typeof osmId !== "number" || !Number.isSafeInteger(osmId) || !name
      || typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)
      || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    const id = `${osmType}/${osmId}`;
    if (seen.has(id)) continue;
    const point = { latitude, longitude };
    const distanceMeters = distanceInMeters(center, point);
    if (distanceMeters > radius) continue;
    seen.add(id);
    const address = [nonEmpty(properties.housenumber), nonEmpty(properties.street)].filter(Boolean).join(" ") || undefined;
    const extra = properties.extra && typeof properties.extra === "object" ? properties.extra as Record<string, unknown> : {};
    const openingHours = nonEmpty(extra.opening_hours);
    const rawWebsite = nonEmpty(extra.website) ?? nonEmpty(extra["contact:website"]);
    let website: string | undefined;
    if (rawWebsite) { try { const url = new URL(rawWebsite); if (["http:", "https:"].includes(url.protocol)) website = url.href; } catch { /* OSM field may not be a URL. */ } }
    spots.push({ id, name, kind: match[2], ...point, distanceMeters,
      ...(address && { address }), ...(openingHours && { openingHours }), ...(website && { website }) });
  }
  return spots.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export async function queryPhotonDateSpots(center: Coordinates, radius: number): Promise<DateSpot[]> {
  const response = await fetch(buildPhotonDateSpotsUrl(center, radius), {
    headers: { Accept: "application/json", "User-Agent": "Dateny/0.1 (date planning fallback)" },
    signal: AbortSignal.timeout(8_000), cache: "no-store",
  });
  if (!response.ok) throw new Error(`Photon returned ${response.status}`);
  const maxBytes = 750_000;
  if (Number(response.headers.get("content-length")) > maxBytes) throw new Error("Photon response too large");
  if (!response.body) throw new Error("Empty Photon response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > maxBytes) throw new Error("Photon response too large");
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return normalizePhotonDateSpots(JSON.parse(new TextDecoder().decode(body)) as { features?: unknown }, center, radius);
}
