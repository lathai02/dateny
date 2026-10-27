import type { BrowserContext, Page } from "@playwright/test";

export const origin = { latitude: 21.0285, longitude: 105.8542 };
export const places = Array.from({ length: 30 }, (_, index) => ({
  id: `node:${index + 1}`,
  osmType: "node",
  name: `Quán thử nghiệm ${index + 1}`,
  category: ["restaurant", "cafe", "fast_food"][index % 3],
  distanceMeters: 100 + index * 40,
  latitude: origin.latitude + (index % 6) * 0.001,
  longitude: origin.longitude + Math.floor(index / 6) * 0.001,
  address: `${index + 1} Phố mẫu, Hà Nội`,
}));
export const spots = ["park", "cinema", "museum", "guest_house"].map(
  (kind, index) => ({
    id: `spot:${index}`,
    name: `Điểm hẹn ${index + 1}`,
    kind,
    latitude: origin.latitude + 0.001,
    longitude: origin.longitude + 0.001 + index * 0.001,
    distanceMeters: 200 + index * 100,
  }),
);
export const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

export async function grantLocation(context: BrowserContext) {
  await context.setGeolocation({ ...origin, accuracy: 10 });
  await context.grantPermissions(["geolocation"]);
}

export async function mockServices(page: Page) {
  const counts = { nearby: 0, route: 0, reviews: 0, spots: 0 };
  // No paid providers, real accounts, or public tile requests in regression tests.
  await page.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    return host === "localhost" || host === "127.0.0.1"
      ? route.continue()
      : route.abort();
  });
  await page.route(/\/\d+\/\d+\/\d+\.png(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e7eee8"/><path d="M0 80H256M0 180H256M80 0V256M180 0V256" stroke="#fff" stroke-width="14"/><text x="95" y="124" fill="#87958a" font-size="10">TEST MAP</text></svg>',
    }),
  );
  await page.route("**/api/places/nearby?**", (route) => {
    counts.nearby++;
    const url = new URL(route.request().url());
    return route.fulfill({
      json: {
        places,
        center: origin,
        radiusMeters: Number(url.searchParams.get("radius")),
        category: "all",
        source: "overpass",
        fetchedAt: "2026-01-01T00:00:00Z",
      },
    });
  });
  await page.route("**/api/places/route?**", (route) => {
    counts.route++;
    const url = new URL(route.request().url());
    return route.fulfill({
      json: {
        mode: url.searchParams.get("mode"),
        coordinates: [
          origin,
          { latitude: origin.latitude + 0.001, longitude: origin.longitude },
          {
            latitude: Number(url.searchParams.get("toLat")),
            longitude: Number(url.searchParams.get("toLon")),
          },
        ],
        distanceMeters: 350,
        durationSeconds: 300,
        steps: [
          {
            type: "turn",
            modifier: "right",
            street: "Phố mẫu",
            location: places[1],
            distanceMeters: 130,
          },
        ],
      },
    });
  });
  await page.route("**/api/places/date-spots?**", (route) => {
    counts.spots++;
    return route.fulfill({
      json: { spots, radiusMeters: 3000, center: origin, source: "overpass" },
    });
  });
  await page.route("**/api/reviews?**", (route) => {
    counts.reviews++;
    return route.fulfill({
      json: { enabled: true, averageRating: 4.8, reviewCount: 5, reviews: [] },
    });
  });
  return counts;
}
