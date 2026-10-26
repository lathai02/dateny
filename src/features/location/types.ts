import type { Coordinates } from "@/lib/places/types";
export type LocationState =
  | {
      status: "idle" | "loading" | "denied" | "error";
      coordinates: null;
      message?: string;
    }
  | { status: "ready"; coordinates: Coordinates };
