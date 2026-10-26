import type { Coordinates } from "./types";

export type TravelMode = "walking" | "motorcycle" | "driving";

export type TravelRoute = {
  mode: TravelMode;
  coordinates: Coordinates[];
  distanceMeters: number;
  durationSeconds: number;
  steps: TravelStep[];
};

export type TravelStep = {
  location: Coordinates;
  distanceMeters: number;
  type: string;
  modifier?: string;
  street?: string;
};
