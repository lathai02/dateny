import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

test("all place endpoints reject invalid input before contacting providers", async (t) => {
  let networkCalls = 0;
  t.mock.method(globalThis, "fetch", () => {
    networkCalls++;
    throw new Error("Unexpected provider request");
  });
  for (const [path, queries] of [
    [
      "nearby",
      [
        "",
        "lat=91&lon=105",
        "lat=21&lon=105&radius=100000",
        "lat=21&lon=105&category=invalid",
      ],
    ],
    ["date-spots", ["", "lat=21&lon=181", "lat=21&lon=105&radius=-1"]],
    [
      "route",
      [
        "",
        "fromLat=21&fromLon=105&toLat=21&toLon=105&mode=jet",
        "fromLat=21&fromLon=105&toLat=35&toLon=105",
      ],
    ],
  ]) {
    const { GET } = loadTs(`src/app/api/places/${path}/route.ts`);
    for (const query of queries) {
      const response = await GET(
        new Request(`https://example.test/api/places/${path}?${query}`),
      );
      assert.equal(response.status, 400, `${path}?${query}`);
      assert.equal(response.headers.get("Cache-Control"), "no-store");
    }
  }
  assert.equal(networkCalls, 0);
});

test("nearby endpoint rate limiting remains in place after service extraction", async (t) => {
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected provider request");
  });
  const { GET } = loadTs("src/app/api/places/nearby/route.ts");
  const request = new Request("https://example.test/api/places/nearby", {
    headers: { "x-forwarded-for": "203.0.113.77" },
  });
  for (let i = 0; i < 30; i++) assert.equal((await GET(request)).status, 400);
  const limited = await GET(request);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("Retry-After")) > 0);
});
