import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { createDatePlan } = loadTs("src/lib/places/date-plan.ts");
const {
  buildDateSpotQuery,
  normalizeDateSpots,
  buildPhotonDateSpotsUrl,
  normalizePhotonDateSpots,
} = loadTs("src/lib/places/date-spots.ts");
const origin = { latitude: 21, longitude: 105 };

test("bounded shortlist matches exhaustive stable ranking across budgets", () => {
  const { distanceInMeters } = loadTs("src/lib/places/geo.ts");
  const foods = Array.from({ length: 16 }, (_, i) => ({
    id: `f${i}`,
    name: `F${i}`,
    category: ["restaurant", "cafe", "fast_food"][i % 3],
    latitude: 21 + (i % 4) / 10000,
    longitude: 105 + i / 10000,
    distanceMeters: i * 15,
  }));
  const activities = Array.from({ length: 10 }, (_, i) => ({
    id: `a${i}`,
    name: `A${i}`,
    kind: i % 2 ? "cinema" : "park",
    latitude: 21 + i / 10000,
    longitude: 105 + i / 10000,
    distanceMeters: i * 10,
  }));
  for (const budget of ["light", "balanced", "flexible"]) {
    const candidates = [];
    for (const first of foods.filter((p) => p.category !== "cafe")) {
      for (const second of activities) {
        for (const final of foods.filter((p) => p.category === "cafe")) {
          const preference =
            budget === "light"
              ? (first.category === "fast_food" ? -350 : 0) +
                (second.kind === "park" ? -450 : 0)
              : budget === "flexible" && second.kind === "cinema"
                ? -350
                : 0;
          candidates.push({
            ids: [first.id, second.id, final.id],
            score:
              first.distanceMeters * 0.3 +
              distanceInMeters(first, second) +
              distanceInMeters(second, final) +
              preference,
          });
        }
      }
    }
    const expected = candidates.sort((a, b) => a.score - b.score).slice(0, 24);
    for (const random of [0, 0.5, 0.999]) {
      const plan = createDatePlan(
        foods,
        activities,
        origin,
        "long",
        budget,
        () => random,
      );
      assert.deepEqual(
        plan.stops.map((stop) => stop.place.id),
        expected[Math.floor(random * expected.length)].ids,
      );
    }
  }
});
const place = (id, category, lon) => ({
  id,
  name: id,
  category,
  latitude: 21,
  longitude: lon,
  distanceMeters: 0,
});
const spot = (id, kind, lon) => ({
  id,
  name: id,
  kind,
  latitude: 21,
  longitude: lon,
  distanceMeters: 0,
});

test("a short date plan has three distinct, walkable stops", () => {
  const plan = createDatePlan(
    [place("dinner", "restaurant", 105.001), place("coffee", "cafe", 105.006)],
    [spot("movie", "cinema", 105.003)],
    origin,
    "short",
    "balanced",
    () => 0,
  );
  assert.ok(plan);
  assert.deepEqual(
    plan.stops.map((stop) => stop.place.id),
    ["dinner", "movie", "coffee"],
  );
});

test("short plans reject far-apart stops; longer dates can use them", () => {
  const food = [
    place("dinner", "restaurant", 105.001),
    place("coffee", "cafe", 105.047),
  ];
  const activities = [spot("park", "park", 105.025)];
  assert.equal(
    createDatePlan(food, activities, origin, "short", "light"),
    null,
  );
  assert.ok(createDatePlan(food, activities, origin, "long", "light"));
});

test("overnight plans require a real lodging OSM result", () => {
  const food = [
    place("dinner", "restaurant", 105.001),
    place("coffee", "cafe", 105.006),
  ];
  const activities = [spot("park", "park", 105.003)];
  assert.equal(
    createDatePlan(food, activities, origin, "overnight", "flexible"),
    null,
  );
  const plan = createDatePlan(
    food,
    [...activities, spot("guest", "guest_house", 105.007)],
    origin,
    "overnight",
    "flexible",
    () => 0,
  );
  assert.equal(plan?.stops[2].place.id, "guest");
});

test("reroll avoids repeating the same plan when another candidate exists", () => {
  const food = [
    place("dinner", "restaurant", 105.001),
    place("coffee", "cafe", 105.006),
  ];
  const activities = [
    spot("park", "park", 105.003),
    spot("movie", "cinema", 105.004),
  ];
  const first = createDatePlan(
    food,
    activities,
    origin,
    "short",
    "balanced",
    () => 0,
  );
  assert.ok(first);
  const reroll = createDatePlan(
    food,
    activities,
    origin,
    "short",
    "balanced",
    () => 0,
    first.stops.map((stop) => stop.place.id).join("|"),
  );
  assert.notDeepEqual(
    reroll?.stops.map((stop) => stop.place.id),
    first.stops.map((stop) => stop.place.id),
  );
});

test("OSM ways use center coordinates and absent details stay absent", () => {
  const result = normalizeDateSpots(
    {
      elements: [
        {
          type: "way",
          id: 7,
          center: { lat: 21, lon: 105.003 },
          tags: { name: "Cinema A", amenity: "cinema" },
        },
        {
          type: "relation",
          id: 8,
          center: { lat: 21, lon: 105.005 },
          tags: { name: "Park B", leisure: "park" },
        },
        {
          type: "node",
          id: 9,
          lat: 21,
          lon: 105.003,
          tags: { tourism: "museum" },
        },
      ],
    },
    origin,
    3000,
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].id, "way/7");
  assert.equal(result[0].longitude, 105.003);
  assert.equal(result[0].address, undefined);
  assert.equal(result[1].id, "relation/8");
});

test("date spot query requests activity and lodging without invented prices", () => {
  const query = buildDateSpotQuery(origin, 3000);
  assert.match(query, /amenity"="cinema/);
  assert.match(query, /tourism"="guest_house/);
  assert.doesNotMatch(query, /price|review|rating/);
});

test("Photon fallback asks for all activity categories in one nearby request", () => {
  const url = buildPhotonDateSpotsUrl(origin, 3000);
  assert.equal(url.pathname, "/reverse");
  assert.equal(url.searchParams.get("radius"), "3");
  assert.match(url.searchParams.get("include"), /osm\.amenity\.cinema/);
  assert.match(url.searchParams.get("include"), /osm\.tourism\.guest_house/);
});

test("Photon fallback normalizes only real nearby activity places", () => {
  const result = normalizePhotonDateSpots(
    {
      features: [
        {
          geometry: { type: "Point", coordinates: [105.003, 21] },
          properties: {
            name: "Park A",
            osm_key: "leisure",
            osm_value: "park",
            osm_type: "W",
            osm_id: 10,
          },
        },
        {
          geometry: { type: "Point", coordinates: [105.003, 21] },
          properties: {
            name: "Duplicate",
            osm_key: "leisure",
            osm_value: "park",
            osm_type: "W",
            osm_id: 10,
          },
        },
        {
          geometry: { type: "Point", coordinates: [105.003, 21] },
          properties: {
            name: "Restaurant",
            osm_key: "amenity",
            osm_value: "restaurant",
            osm_type: "N",
            osm_id: 11,
          },
        },
        {
          geometry: { type: "Point", coordinates: [106, 21] },
          properties: {
            name: "Far",
            osm_key: "amenity",
            osm_value: "cinema",
            osm_type: "N",
            osm_id: 12,
          },
        },
      ],
    },
    origin,
    3000,
  );
  assert.deepEqual(
    result.map((spot) => spot.id),
    ["way/10"],
  );
  assert.equal(result[0].kind, "park");
  assert.equal(result[0].website, undefined);
});

test("date spots API falls back to Overpass when Photon returns 502", async () => {
  const { GET } = loadTs("src/app/api/places/date-spots/route.ts");
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    if (calls.length === 1) return new Response("Bad gateway", { status: 502 });
    return Response.json({
      elements: [
        {
          type: "way",
          id: 10,
          center: { lat: 21, lon: 105.003 },
          tags: { name: "Park A", leisure: "park" },
        },
      ],
    });
  };
  try {
    const response = await GET(
      new Request(
        "http://localhost/api/places/date-spots?lat=21&lon=105&radius=3000",
      ),
    );
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.source, "overpass");
    assert.equal(data.spots[0].name, "Park A");
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
