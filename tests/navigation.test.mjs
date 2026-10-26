import test from "node:test";
import assert from "node:assert/strict";
import {
  navigationProgress,
  walkingStepText,
} from "../src/lib/places/navigation.ts";

const route = {
  coordinates: [
    { latitude: 21, longitude: 105 },
    { latitude: 21, longitude: 105.001 },
    { latitude: 21.001, longitude: 105.001 },
  ],
  distanceMeters: 215,
  durationSeconds: 180,
  steps: [
    {
      type: "turn",
      modifier: "left",
      street: "Phố A",
      distanceMeters: 100,
      location: { latitude: 21, longitude: 105.001 },
    },
  ],
};

test("repeated GPS fixes reuse immutable step projections; a new route gets a new cache", () => {
  let reads = 0;
  const tracked = {
    ...route,
    get steps() {
      reads++;
      return route.steps;
    },
  };
  for (let i = 0; i < 30; i++)
    navigationProgress(tracked, { latitude: 21, longitude: 105 + i / 100000 });
  assert.equal(reads, 1);
  const another = {
    ...route,
    get steps() {
      reads++;
      return route.steps;
    },
  };
  navigationProgress(another, { latitude: 21, longitude: 105 });
  assert.equal(reads, 2);
});

test("remaining distance and turn shrink as GPS advances", () => {
  const start = navigationProgress(route, {
    latitude: 21,
    longitude: 105.0002,
  });
  const later = navigationProgress(route, {
    latitude: 21,
    longitude: 105.0008,
  });
  assert.ok(start.remainingMeters > later.remainingMeters);
  assert.ok(start.metersToStep > later.metersToStep);
  assert.equal(later.nextStep?.street, "Phố A");
});

test("off-route detection requires meaningful distance", () => {
  const onRoute = navigationProgress(route, {
    latitude: 21,
    longitude: 105.0005,
  });
  const away = navigationProgress(route, {
    latitude: 21.001,
    longitude: 105.0005,
  });
  assert.ok(onRoute.offRouteMeters < 5);
  assert.ok(away.offRouteMeters > 40);
});

test("arrival and Vietnamese maneuver labels", () => {
  assert.equal(
    navigationProgress(route, { latitude: 21.001, longitude: 105.001 }).arrived,
    true,
  );
  assert.equal(walkingStepText(route.steps[0]), "Rẽ trái");
  assert.equal(walkingStepText(null), "Tiếp tục đi tới điểm đến");
});
