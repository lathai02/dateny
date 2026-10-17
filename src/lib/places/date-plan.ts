import { distanceInMeters } from "./overpass";
import type { Coordinates, Place } from "./types";

export const DATE_SPOT_KINDS = ["cinema", "park", "museum", "gallery", "bowling_alley", "viewpoint", "guest_house"] as const;
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

export type DatePlan = { stops: [DateStop, DateStop, DateStop]; duration: DateDuration; budget: DateBudget };

export const dateKindLabels: Record<DateSpotKind, string> = {
  cinema: "Rạp phim", park: "Công viên", museum: "Bảo tàng", gallery: "Triển lãm",
  bowling_alley: "Bowling", viewpoint: "Điểm ngắm cảnh", guest_house: "Lưu trú",
};

function randomFrom<T>(items: T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

export function createDatePlan(
  foodPlaces: Place[], spots: DateSpot[], origin: Coordinates, duration: DateDuration,
  budget: DateBudget, random: () => number = Math.random, excludeIds?: string,
): DatePlan | null {
  const food = foodPlaces.filter((place) => place.category === "restaurant" || place.category === "fast_food");
  const cafes = foodPlaces.filter((place) => place.category === "cafe");
  const activities = spots.filter((spot) => spot.kind !== "guest_house");
  const finish = duration === "overnight" ? spots.filter((spot) => spot.kind === "guest_house") : cafes;
  if (!food.length || !activities.length || !finish.length) return null;

  const maxLeg = duration === "short" ? 1_800 : duration === "long" ? 3_000 : 5_000;
  const candidates: Array<{ first: Place; second: DateSpot; final: Place | DateSpot; score: number }> = [];
  const closestFood = [...food].sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 24);
  const closestActivities = [...activities].sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 40);
  const closestFinish = [...finish].sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 24);
  for (const first of closestFood) {
    for (const second of closestActivities) {
      if (first.id === second.id) continue;
      const firstLeg = distanceInMeters(first, second);
      if (firstLeg > maxLeg) continue;
      for (const final of closestFinish) {
        if (final.id === first.id || final.id === second.id) continue;
        const secondLeg = distanceInMeters(second, final);
        if (secondLeg > maxLeg) continue;
        const preference = budget === "light"
          ? (first.category === "fast_food" ? -350 : 0) + (["park", "viewpoint"].includes(second.kind) ? -450 : 0)
          : budget === "flexible" && ["cinema", "bowling_alley"].includes(second.kind) ? -350 : 0;
        candidates.push({ first, second, final, score: first.distanceMeters * .3 + firstLeg + secondLeg + preference });
      }
    }
  }
  if (!candidates.length) return null;
  const shortlist = candidates.sort((a, b) => a.score - b.score).slice(0, 24);
  const fresh = excludeIds && shortlist.length > 1
    ? shortlist.filter(({ first, second, final }) => `${first.id}|${second.id}|${final.id}` !== excludeIds)
    : shortlist;
  const { first, second, final } = randomFrom(fresh.length ? fresh : shortlist, random);
  return {
    duration, budget,
    stops: [
      { role: "eat", label: "Ăn uống", place: first },
      { role: "play", label: dateKindLabels[second.kind], place: second },
      { role: "finish", label: duration === "overnight" ? "Lưu trú" : "Cà phê", place: final },
    ],
  };
}
