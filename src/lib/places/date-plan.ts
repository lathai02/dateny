import { distanceInMeters } from "./geo";
import type { Coordinates, Place } from "./types";

export const DATE_SPOT_KINDS = [
  "cinema",
  "park",
  "museum",
  "gallery",
  "bowling_alley",
  "viewpoint",
  "guest_house",
] as const;
export type DateSpotKind = (typeof DATE_SPOT_KINDS)[number];
export type DateDuration = "short" | "long" | "overnight";
export type DateBudget = "light" | "balanced" | "flexible";

export type DateSpot = Coordinates & {
  id: string;
  name: string;
  kind: DateSpotKind;
  distanceMeters: number;
  address?: string;
  openingHours?: string;
  website?: string;
};

export type DateStop = {
  role: "eat" | "play" | "finish";
  label: string;
  place: Place | DateSpot;
};

export type DatePlan = {
  stops: [DateStop, DateStop, DateStop];
  duration: DateDuration;
  budget: DateBudget;
};

export const dateKindLabels: Record<DateSpotKind, string> = {
  cinema: "Rạp phim",
  park: "Công viên",
  museum: "Bảo tàng",
  gallery: "Triển lãm",
  bowling_alley: "Bowling",
  viewpoint: "Điểm ngắm cảnh",
  guest_house: "Lưu trú",
};

function randomFrom<T>(items: T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

export function createDatePlan(
  foodPlaces: Place[],
  spots: DateSpot[],
  origin: Coordinates,
  duration: DateDuration,
  budget: DateBudget,
  random: () => number = Math.random,
  excludeIds?: string,
): DatePlan | null {
  const food = foodPlaces.filter(
    (place) =>
      place.category === "restaurant" || place.category === "fast_food",
  );
  const cafes = foodPlaces.filter((place) => place.category === "cafe");
  const activities = spots.filter((spot) => spot.kind !== "guest_house");
  const finish =
    duration === "overnight"
      ? spots.filter((spot) => spot.kind === "guest_house")
      : cafes;
  if (!food.length || !activities.length || !finish.length) return null;

  const maxLeg =
    duration === "short" ? 1_800 : duration === "long" ? 3_000 : 5_000;
  const candidates: Array<{
    first: Place;
    second: DateSpot;
    final: Place | DateSpot;
    score: number;
  }> = [];
  const closestFood = [...food]
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 24);
  const closestActivities = [...activities]
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 40);
  const closestFinish = [...finish]
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 24);
  // The second leg depends on activity + finish only, not on the restaurant.
  const finishLegs = new Map(
    closestActivities.map((second) => [
      second,
      closestFinish.map((final) => ({
        final,
        distance: distanceInMeters(second, final),
      })),
    ]),
  );
  for (const first of closestFood) {
    for (const second of closestActivities) {
      if (first.id === second.id) continue;
      const firstLeg = distanceInMeters(first, second);
      if (firstLeg > maxLeg) continue;
      for (const { final, distance: secondLeg } of finishLegs.get(second)!) {
        if (final.id === first.id || final.id === second.id) continue;
        if (secondLeg > maxLeg) continue;
        const preference =
          budget === "light"
            ? (first.category === "fast_food" ? -350 : 0) +
              (["park", "viewpoint"].includes(second.kind) ? -450 : 0)
            : budget === "flexible" &&
                ["cinema", "bowling_alley"].includes(second.kind)
              ? -350
              : 0;
        const candidate = {
          first,
          second,
          final,
          score: first.distanceMeters * 0.3 + firstLeg + secondLeg + preference,
        };
        // Keep the best 24 in stable score order instead of retaining/sorting
        // up to 23,040 triples. Equal scores preserve the original loop order.
        if (candidates.length === 24 && candidate.score >= candidates[23].score)
          continue;
        let insertion = candidates.findIndex(
          (item) => item.score > candidate.score,
        );
        if (insertion === -1) insertion = candidates.length;
        candidates.splice(insertion, 0, candidate);
        if (candidates.length > 24) candidates.pop();
      }
    }
  }
  if (!candidates.length) return null;
  const shortlist = candidates;
  const fresh =
    excludeIds && shortlist.length > 1
      ? shortlist.filter(
          ({ first, second, final }) =>
            `${first.id}|${second.id}|${final.id}` !== excludeIds,
        )
      : shortlist;
  const { first, second, final } = randomFrom(
    fresh.length ? fresh : shortlist,
    random,
  );
  return {
    duration,
    budget,
    stops: [
      { role: "eat", label: "Ăn uống", place: first },
      { role: "play", label: dateKindLabels[second.kind], place: second },
      {
        role: "finish",
        label: duration === "overnight" ? "Lưu trú" : "Cà phê",
        place: final,
      },
    ],
  };
}
