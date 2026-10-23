import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import ts from "typescript";

const modules = new Map();
function loadTs(filename) {
  const path = resolve(filename.endsWith(".ts") ? filename : `${filename}.ts`);
  if (modules.has(path)) return modules.get(path).exports;
  const loadedModule = { exports: {} };
  modules.set(path, loadedModule);
  const source = readFileSync(path, "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (specifier) => {
    if (specifier.startsWith("@/")) return loadTs(resolve("src", specifier.slice(2)));
    if (!specifier.startsWith(".")) throw new Error(`Unexpected import: ${specifier}`);
    return loadTs(resolve(dirname(path), specifier));
  };
  new Function("require", "module", "exports", code)(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const origin = { latitude: 21, longitude: 105 };
const { buildGeoapifyPlacesUrl, normalizeGeoapifyPlaces } = loadTs("src/lib/places/geoapify.ts");
const { queryPhoton } = loadTs("src/lib/places/photon.ts");
const { consumeRateLimit, hasSameOrigin } = loadTs("src/lib/security/request.ts");

test("security helpers reject cross-origin writes and cap repeated requests", () => {
  const sameOrigin = new Request("http://localhost:3000/api/reviews", { headers: { origin: "http://localhost:3000", "x-forwarded-for": "203.0.113.10" } });
  const crossOrigin = new Request("http://localhost:3000/api/reviews", { headers: { origin: "https://attacker.example", "x-forwarded-for": "203.0.113.11" } });
  assert.equal(hasSameOrigin(sameOrigin), true);
  assert.equal(hasSameOrigin(crossOrigin), false);
  assert.equal(consumeRateLimit(sameOrigin, "test:limit", 2, 60_000), null);
  assert.equal(consumeRateLimit(sameOrigin, "test:limit", 2, 60_000), null);
  assert.ok(consumeRateLimit(sameOrigin, "test:limit", 2, 60_000) >= 1);
});

test("Geoapify request asks for named food places inside the requested circle", () => {
  const url = buildGeoapifyPlacesUrl(origin, 2_000, "all", "secret-test-key");
  assert.equal(url.searchParams.get("categories"), "catering.restaurant,catering.cafe,catering.fast_food");
  assert.equal(url.searchParams.get("conditions"), "named");
  assert.equal(url.searchParams.get("filter"), "circle:105,21,2000");
  assert.equal(url.searchParams.get("bias"), "proximity:105,21");
  assert.equal(url.searchParams.get("limit"), "120");
  assert.equal(url.searchParams.get("apiKey"), "secret-test-key");
});

test("Geoapify response becomes provider-independent places and removes invalid rows", () => {
  const result = normalizeGeoapifyPlaces({ features: [
    {
      geometry: { type: "Point", coordinates: [105.003, 21] },
      properties: {
        place_id: "restaurant-a",
        name: "Bếp Việt",
        formatted: "12 Phố Huế, Hà Nội",
        categories: ["catering.restaurant", "catering.restaurant.vietnamese"],
        datasource: { raw: { cuisine: "vietnamese", opening_hours: "08:00-22:00", website: "https://example.com" } },
      },
    },
    {
      geometry: { type: "Point", coordinates: [105.004, 21] },
      properties: { place_id: "no-name", categories: ["catering.cafe"] },
    },
    {
      geometry: { type: "Point", coordinates: [106, 21] },
      properties: { place_id: "too-far", name: "Far", categories: ["catering.fast_food"] },
    },
  ] }, origin, 2_000, "all");

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "geoapify/restaurant-a");
  assert.equal(result[0].category, "restaurant");
  assert.equal(result[0].address, "12 Phố Huế, Hà Nội");
  assert.equal(result[0].cuisine, "vietnamese");
  assert.equal(result[0].website, "https://example.com/");
});

test("Photon requests enough nearby results in a single call", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (input) => {
    requestedUrl = new URL(String(input));
    return Response.json({ features: [] });
  };
  try {
    await queryPhoton(origin, 2_000, "all");
    assert.equal(requestedUrl.searchParams.get("limit"), "120");
    assert.equal(requestedUrl.searchParams.getAll("osm_tag").length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("nearby API uses Photon before Overpass when Geoapify is not configured", async () => {
  const previousKey = process.env.GEOAPIFY_API_KEY;
  delete process.env.GEOAPIFY_API_KEY;
  const { GET } = loadTs("src/app/api/places/nearby/route.ts");
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return Response.json({ features: [{
      geometry: { type: "Point", coordinates: [105.001, 21] },
      properties: { name: "Cafe A", osm_key: "amenity", osm_value: "cafe", osm_type: "N", osm_id: 1 },
    }] });
  };
  try {
    const response = await GET(new Request("http://localhost/api/places/nearby?lat=21&lon=105&radius=2000&category=all"));
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.source, "photon");
    assert.equal(data.places[0].name, "Cafe A");
    assert.equal(calls.length, 1);
    assert.match(calls[0], /photon\.komoot\.io\/reverse/);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.GEOAPIFY_API_KEY;
    else process.env.GEOAPIFY_API_KEY = previousKey;
  }
});
