import type { Coordinates } from "./types";

export type WalkingRoute = {
  coordinates: Coordinates[];
  distanceMeters: number;
  durationSeconds: number;
  steps: WalkingStep[];
};

export type WalkingStep = {
  location: Coordinates;
  distanceMeters: number;
  type: string;
  modifier?: string;
  street?: string;
};
